#!/usr/bin/env bash
# AiControl — install host dependencies for a production tree (dist/prod).
#
# Installs / configures:
#   - PostgreSQL (+ role & databases from prod.env)
#   - Redis
#   - Python 3.12 venv + pip requirements
#   - Node.js (for `npx serve` frontend) when missing
#   - Rust toolchain + DataCode from https://github.com/igornet0/DataCode
#   - optional: RabbitMQ, nginx
#
# Usage (from dist/prod after deploy, or from repo):
#   ./install.sh
#   ./install.sh -y
#   ./install.sh --skip-datacode
#   ./install.sh --with-nginx --with-rabbitmq --migrate
#
# Env:
#   PROD_ENV_FILE     default: <dist>/prod.env
#   DATACODE_DIR      clone path (default: $HOME/src/DataCode)
#   DATACODE_REPO     default: https://github.com/igornet0/DataCode.git
#   SKIP_SYSTEM=1     skip apt/brew packages
#   SKIP_PYTHON=1
#   SKIP_DATACODE=1
#   SKIP_DB=1         skip create role/databases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve dist/prod root: script may live in dist/prod/ or scripts/
if [[ -f "$SCRIPT_DIR/MANIFEST.txt" && -d "$SCRIPT_DIR/python" ]]; then
  DIST="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../dist/prod/MANIFEST.txt" ]]; then
  DIST="$(cd "$SCRIPT_DIR/../dist/prod" && pwd)"
elif [[ -f "$SCRIPT_DIR/dist/prod/MANIFEST.txt" ]]; then
  DIST="$(cd "$SCRIPT_DIR/dist/prod" && pwd)"
else
  DIST="${DIST_DIR:-}"
fi

if [[ -z "${DIST:-}" || ! -d "$DIST" ]]; then
  echo "error: cannot find dist/prod (run from dist/prod or set DIST_DIR)" >&2
  exit 1
fi

ENV_FILE="${PROD_ENV_FILE:-$DIST/prod.env}"
DATACODE_DIR="${DATACODE_DIR:-$HOME/src/DataCode}"
DATACODE_REPO="${DATACODE_REPO:-https://github.com/igornet0/DataCode.git}"

ASSUME_YES=0
DO_MIGRATE=0
WITH_NGINX=0
WITH_RABBIT=0
SKIP_SYSTEM="${SKIP_SYSTEM:-0}"
SKIP_PYTHON="${SKIP_PYTHON:-0}"
SKIP_DATACODE="${SKIP_DATACODE:-0}"
SKIP_DB="${SKIP_DB:-0}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log() { echo "${BLUE}==>${NC} $*"; }
ok() { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}!${NC} $*"; }
die() { echo "${RED}error:${NC} $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  -y, --yes              non-interactive (apt/brew)
  --migrate              run alembic upgrade head after Python venv
  --with-nginx           install nginx
  --with-rabbitmq        install RabbitMQ (optional workers)
  --skip-system          do not install OS packages
  --skip-python          skip venv / pip
  --skip-datacode        skip DataCode clone/build
  --skip-db              skip PostgreSQL role/database creation
  -h, --help             this help

DIST=$DIST
ENV_FILE=$ENV_FILE
DATACODE_DIR=$DATACODE_DIR
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y | --yes) ASSUME_YES=1 ;;
    --migrate) DO_MIGRATE=1 ;;
    --with-nginx) WITH_NGINX=1 ;;
    --with-rabbitmq) WITH_RABBIT=1 ;;
    --skip-system) SKIP_SYSTEM=1 ;;
    --skip-python) SKIP_PYTHON=1 ;;
    --skip-datacode) SKIP_DATACODE=1 ;;
    --skip-db) SKIP_DB=1 ;;
    -h | --help | help) usage; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

need_root_apt() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    die "need root or sudo to install packages: $*"
  fi
}

load_env_defaults() {
  PG_HOST="${PG_HOST:-127.0.0.1}"
  PG_PORT="${PG_PORT:-5432}"
  PG_USER="${PG_USER:-ai_control_user}"
  PG_PASSWORD="${PG_PASSWORD:-change-me-db-password}"
  PG_DB_APP="${PG_DB_APP:-ai_control}"
  PG_DB_API="${PG_DB_API:-ai_control_api}"
  PG_DB_MAIL="${PG_DB_MAIL:-mail_message}"
  REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
  REDIS_PORT="${REDIS_PORT:-6379}"

  if [[ -f "$ENV_FILE" ]]; then
    log "Loading $ENV_FILE"
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  else
    warn "missing $ENV_FILE — using defaults (run ./init_env.sh after install)"
  fi
}

detect_os() {
  OS_FAMILY=unknown
  if [[ "$(uname -s)" == "Darwin" ]]; then
    OS_FAMILY=macos
  elif [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}:${ID_LIKE:-}" in
      debian:* | ubuntu:* | *:debian* | *:ubuntu*) OS_FAMILY=debian ;;
      rhel:* | centos:* | fedora:* | *:rhel* | *:fedora*) OS_FAMILY=rhel ;;
      *) OS_FAMILY="${ID:-linux}" ;;
    esac
  fi
  ok "OS family: $OS_FAMILY ($(uname -s) $(uname -m))"
}

install_system_debian() {
  log "Installing system packages (apt)"
  need_root_apt apt-get update -y
  local pkgs=(
    ca-certificates
    curl
    git
    build-essential
    pkg-config
    libssl-dev
    libpq-dev
    postgresql
    postgresql-contrib
    redis-server
    rsync
    python3
    python3-venv
    python3-pip
  )
  # Prefer explicit 3.12 — default python3 on bleeding-edge distros may be 3.14
  # (no pyarrow wheels → cmake source build).
  if apt-cache show python3.12 >/dev/null 2>&1; then
    pkgs+=(python3.12 python3.12-venv)
  else
    warn "apt has no python3.12 — add deadsnakes PPA or install 3.12 manually before pip"
  fi
  if [[ "$WITH_NGINX" == "1" ]]; then
    pkgs+=(nginx)
  fi
  if [[ "$WITH_RABBIT" == "1" ]]; then
    pkgs+=(rabbitmq-server)
  fi
  if ! command -v node >/dev/null 2>&1; then
    pkgs+=(nodejs npm)
  fi

  if [[ "$ASSUME_YES" == "1" ]]; then
    need_root_apt DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"
  else
    need_root_apt apt-get install -y "${pkgs[@]}"
  fi

  need_root_apt systemctl enable --now postgresql || true
  need_root_apt systemctl enable --now redis-server || need_root_apt systemctl enable --now redis || true
  if [[ "$WITH_RABBIT" == "1" ]]; then
    need_root_apt systemctl enable --now rabbitmq-server || true
  fi
  if [[ "$WITH_NGINX" == "1" ]]; then
    need_root_apt systemctl enable --now nginx || true
  fi
}

install_system_macos() {
  command -v brew >/dev/null 2>&1 || die "Homebrew required on macOS (https://brew.sh)"
  log "Installing system packages (brew)"
  local pkgs=(postgresql@15 redis python@3.12 git curl openssl@3)
  if [[ "$WITH_NGINX" == "1" ]]; then
    pkgs+=(nginx)
  fi
  if [[ "$WITH_RABBIT" == "1" ]]; then
    pkgs+=(rabbitmq)
  fi
  if ! command -v node >/dev/null 2>&1; then
    pkgs+=(node)
  fi
  brew update || true
  brew install "${pkgs[@]}" || true
  brew services start postgresql@15 || brew services start postgresql || true
  brew services start redis || true
}

install_system_rhel() {
  log "Installing system packages (dnf/yum)"
  local mgr=dnf
  command -v dnf >/dev/null 2>&1 || mgr=yum
  need_root_apt "$mgr" install -y \
    ca-certificates curl git gcc gcc-c++ make openssl-devel \
    postgresql-server postgresql-contrib redis \
    python3 python3-pip python3-devel libpq-devel \
    rsync nodejs npm || true
  if [[ ! -d /var/lib/pgsql/data ]] && [[ ! -d /var/lib/pgsql/data/base ]]; then
    need_root_apt postgresql-setup --initdb 2>/dev/null \
      || need_root_apt postgresql-setup initdb 2>/dev/null \
      || true
  fi
  need_root_apt systemctl enable --now postgresql || true
  need_root_apt systemctl enable --now redis || need_root_apt systemctl enable --now redis-server || true
}

install_system() {
  [[ "$SKIP_SYSTEM" == "1" ]] && { warn "skip system packages"; return 0; }
  case "$OS_FAMILY" in
    debian) install_system_debian ;;
    macos) install_system_macos ;;
    rhel) install_system_rhel ;;
    *)
      warn "unknown OS — install manually: postgresql, redis, python3.12, git, build tools"
      ;;
  esac
  ok "system packages step done"
}

ensure_rust() {
  export PATH="${HOME}/.cargo/bin:${PATH}"
  if command -v cargo >/dev/null 2>&1; then
    ok "cargo: $(cargo --version)"
    return 0
  fi
  log "Installing Rust via rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
  # shellcheck disable=SC1090
  source "${HOME}/.cargo/env"
  ok "cargo: $(cargo --version)"
}

sql_escape() {
  # Escape single quotes for SQL string literals
  printf '%s' "$1" | sed "s/'/''/g"
}

psql_as_admin() {
  # Run SQL as postgres superuser (via temp file — avoids quoting hell)
  local sql="$1"
  local tmp
  tmp="$(mktemp)"
  printf '%s\n' "$sql" >"$tmp"
  chmod 644 "$tmp"

  local rc=0
  if [[ "$OS_FAMILY" == "macos" ]]; then
    psql -h "$PG_HOST" -p "$PG_PORT" -d postgres -v ON_ERROR_STOP=1 -f "$tmp" || rc=$?
  elif [[ "$(id -u)" -eq 0 ]]; then
    # postgres user must read the file
    chown postgres "$tmp" 2>/dev/null || true
    su - postgres -c "psql -v ON_ERROR_STOP=1 -d postgres -f $tmp" || rc=$?
  elif command -v sudo >/dev/null 2>&1; then
    sudo cp "$tmp" /tmp/aicontrol-install.sql
    sudo chown postgres /tmp/aicontrol-install.sql
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -f /tmp/aicontrol-install.sql || rc=$?
    sudo rm -f /tmp/aicontrol-install.sql
  else
    PGPASSWORD="${PGPASSWORD:-}" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres \
      -v ON_ERROR_STOP=1 -f "$tmp" || rc=$?
  fi
  rm -f "$tmp"
  return "$rc"
}

db_exists() {
  local db="$1"
  local out=""
  if [[ "$OS_FAMILY" == "macos" ]]; then
    out="$(psql -h "$PG_HOST" -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null || true)"
  elif command -v sudo >/dev/null 2>&1; then
    out="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null || true)"
  elif [[ "$(id -u)" -eq 0 ]]; then
    out="$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${db}'\"" 2>/dev/null || true)"
  else
    out="$(PGPASSWORD="${PGPASSWORD:-}" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null || true)"
  fi
  [[ "$(echo "$out" | tr -d '[:space:]')" == "1" ]]
}

setup_postgres() {
  [[ "$SKIP_DB" == "1" ]] && { warn "skip database setup"; return 0; }
  log "Waiting for PostgreSQL on ${PG_HOST}:${PG_PORT}"
  local i
  for i in $(seq 1 30); do
    if command -v pg_isready >/dev/null 2>&1 && pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
      break
    fi
    if [[ "$i" -eq 30 ]]; then
      die "PostgreSQL not ready on ${PG_HOST}:${PG_PORT}"
    fi
    sleep 1
  done
  ok "PostgreSQL is ready"

  local pass_esc user_esc
  pass_esc="$(sql_escape "$PG_PASSWORD")"
  user_esc="$(sql_escape "$PG_USER")"

  log "Ensuring role $PG_USER and databases"
  psql_as_admin "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user_esc}') THEN
    CREATE ROLE ${user_esc} LOGIN PASSWORD '${pass_esc}';
  ELSE
    ALTER ROLE ${user_esc} WITH LOGIN PASSWORD '${pass_esc}';
  END IF;
END \$\$;"

  local db
  for db in "$PG_DB_APP" "$PG_DB_API" "$PG_DB_MAIL"; do
    if ! db_exists "$db"; then
      log "Creating database $db"
      psql_as_admin "CREATE DATABASE ${db} OWNER ${user_esc};"
    else
      ok "database $db exists"
      psql_as_admin "ALTER DATABASE ${db} OWNER TO ${user_esc};" || true
    fi
    psql_as_admin "GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${user_esc};" || true
  done
  ok "PostgreSQL role/databases ready"
}

setup_redis() {
  log "Checking Redis ${REDIS_HOST}:${REDIS_PORT}"
  if command -v redis-cli >/dev/null 2>&1; then
    local i
    for i in $(seq 1 20); do
      if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -qi pong; then
        ok "Redis PONG"
        return 0
      fi
      sleep 1
    done
    warn "Redis not responding — start redis-server manually"
  else
    warn "redis-cli not found"
  fi
}

pick_python() {
  # Prefer 3.12; allow 3.13. Refuse 3.14+ — many deps (pyarrow, …) lack wheels and
  # force a source build (needs cmake/Arrow C++).
  local c ver major minor
  for c in python3.12 python3.13; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  if command -v python3 >/dev/null 2>&1; then
    ver="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    major="${ver%%.*}"
    minor="${ver#*.}"
    if [[ "$major" == "3" && "$minor" -ge 12 && "$minor" -le 13 ]]; then
      echo python3
      return 0
    fi
    echo "error: python3 is $ver — need 3.12 or 3.13 (not 3.14+)." >&2
    echo "  pyarrow and other pins ship wheels only for supported CPython versions." >&2
    echo "  Install:  sudo apt-get install -y python3.12 python3.12-venv" >&2
    echo "  Then:     rm -rf python/.venv && ./install.sh --skip-system -y" >&2
    return 1
  fi
  return 1
}

setup_python() {
  [[ "$SKIP_PYTHON" == "1" ]] && { warn "skip Python venv"; return 0; }
  local py
  py="$(pick_python)" || die "Python 3.12 or 3.13 required (see messages above)"
  ok "Python: $($py --version) ($py)"

  local req="$DIST/python/requirements.txt"
  local venv="$DIST/python/.venv"
  [[ -f "$req" ]] || die "missing $req — rebuild dist (make -f Makefile.build …)"

  # Always recreate if missing OR wrong interpreter (stale 3.14 venv is the usual failure).
  if [[ -d "$venv" ]]; then
    local vpy=""
    if [[ -x "$venv/bin/python" ]]; then
      vpy="$("$venv/bin/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    fi
    if [[ "$vpy" != "3.12" && "$vpy" != "3.13" ]]; then
      warn "removing incompatible venv (was Python ${vpy:-unknown}) — must be 3.12/3.13"
      rm -rf "$venv"
    fi
  fi

  if [[ ! -d "$venv" ]]; then
    log "Creating venv with $py → $venv"
    "$py" -m venv "$venv"
  else
    log "Reusing venv $venv"
  fi

  # shellcheck disable=SC1091
  source "$venv/bin/activate"

  local venv_ver
  venv_ver="$(python -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
  if [[ "$venv_ver" != "3.12" && "$venv_ver" != "3.13" ]]; then
    die "venv still reports Python $venv_ver (path=$(command -v python)). Refusing pip — pyarrow has no 3.14 wheels. Fix: rm -rf $venv && apt install python3.12 python3.12-venv"
  fi
  ok "venv interpreter OK: Python $venv_ver ($(command -v python))"

  pip install -U pip wheel
  log "pip install -r requirements.txt (may take a few minutes)"
  pip install -r "$req"
  ok "Python deps installed → $venv"

  if [[ "$DO_MIGRATE" == "1" ]]; then
    log "Running alembic upgrade head"
    (
      cd "$DIST/python/src"
      export ENVIRONMENT=production
      if [[ -f "$DIST/python/src/config/environments/prod.env" ]]; then
        set -a
        # shellcheck disable=SC1091
        source "$DIST/python/src/config/environments/prod.env"
        set +a
      fi
      if [[ -f "$ENV_FILE" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        set +a
      fi
      if [[ -d core/alembic ]] || [[ -f alembic.ini ]]; then
        alembic upgrade head
      elif [[ -d infrastructure/database/migrations ]]; then
        warn "legacy migrations path — run deployment/scripts/run_migration.py from full repo if needed"
      else
        warn "alembic config not found under python/src — skip migrate"
      fi
    ) || warn "alembic failed — check logs / DATABASE_URL"
  fi
}

setup_datacode() {
  [[ "$SKIP_DATACODE" == "1" ]] && { warn "skip DataCode"; return 0; }
  ensure_rust

  if command -v datacode >/dev/null 2>&1; then
    ok "datacode already on PATH: $(command -v datacode)"
    datacode --help >/dev/null 2>&1 || true
    return 0
  fi

  log "Installing DataCode from $DATACODE_REPO"
  mkdir -p "$(dirname "$DATACODE_DIR")"
  if [[ ! -d "$DATACODE_DIR/.git" ]]; then
    git clone --recurse-submodules "$DATACODE_REPO" "$DATACODE_DIR"
  else
    log "Updating existing clone $DATACODE_DIR"
    git -C "$DATACODE_DIR" fetch --tags || true
    git -C "$DATACODE_DIR" pull --ff-only || warn "git pull failed — using existing tree"
    git -C "$DATACODE_DIR" submodule update --init --recursive || true
  fi

  (
    cd "$DATACODE_DIR"
    if [[ -x ./install.sh ]]; then
      chmod +x ./install.sh
      ./install.sh
    else
      cargo build --release
      cargo install --path . --force
    fi
  )

  export PATH="${HOME}/.cargo/bin:${PATH}"
  if command -v datacode >/dev/null 2>&1; then
    ok "datacode installed: $(command -v datacode)"
  else
    warn "datacode not on PATH — add: export PATH=\"\$HOME/.cargo/bin:\$PATH\""
  fi
}

print_next() {
  echo
  ok "Install finished for $DIST"
  cat <<EOF

Next steps:
  1. Configure env (domains, secrets, DB password):
       cd $DIST && ./init_env.sh

  2. Ensure PATH includes cargo bin (DataCode):
       export PATH="\$HOME/.cargo/bin:\$PATH"

  3. Start stack:
       cd $DIST && ./run.sh up

  4. DataCode WS (if run.sh does not start it):
       datacode --websocket --host 127.0.0.1 --port 8899 --use-ve --build_model

  5. Nginx (optional): see deployment/nginx/aicontrol.conf

Databases: ${PG_DB_APP}, ${PG_DB_API}, ${PG_DB_MAIL}  user=${PG_USER}
Redis:     ${REDIS_HOST}:${REDIS_PORT}
EOF
}

main() {
  echo "AiControl install.sh"
  echo "===================="
  detect_os
  load_env_defaults
  install_system
  setup_postgres
  setup_redis
  setup_python
  setup_datacode
  print_next
}

main
