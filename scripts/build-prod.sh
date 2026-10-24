#!/usr/bin/env bash
# Production build for AiControl (host tools, or inside Docker builder).
# Builds: frontend (V.1 / V.C.2), Python (py-worm), Rust sidecars → dist/prod/
# Also stages prod.env (+ example) and run.sh for start/stop/restart.
#
# Usage:
#   scripts/build-prod.sh              # all (host native arch)
#   scripts/build-prod.sh frontend|python|rust|env|clean
#   VERSION=2 scripts/build-prod.sh     # клиентская редакция V.C.2 (без тарифов)
#   scripts/build-prod-docker.sh       # linux/amd64 via Docker (macOS arm64 OK)
#
# Env:
#   VERSION           1 (V.1, админская, default) | 2 (V.C.2, клиентская)
#   DIST_DIR          output root (default: <repo>/dist/prod)
#   SKIP_NPM_CI=1     reuse node_modules
#   CARGO_TARGET=...  optional rustc triple (docker sets x86_64-unknown-linux-gnu)
#   FORCE_PROD_ENV=1  overwrite dist/prod/prod.env from example
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT/dist/prod}"
VERSION="${VERSION:-1}"
VERSION="${VERSION#version=}"
case "$VERSION" in
  1) FRONT_DIR="$ROOT/V.1.front-ai-control" ;;
  2) FRONT_DIR="$ROOT/V.C.2.front-ai-control" ;;
  *) echo "error: VERSION must be 1 or 2 (got: $VERSION)" >&2; exit 1 ;;
esac
SRC_DIR="$ROOT/py-worm"
RUST_DIR="$ROOT/office-rust"
# Модули только редакции 1 — в сборку V.C.2 не попадают.
EDITION1_ONLY_PY=(
  app/billing
  app/routers/billing
)
ENV_EXAMPLE="$ROOT/deployment/env/prod.env.example"
TARGET_FLAG=()
if [[ -n "${CARGO_TARGET:-}" ]]; then
  TARGET_FLAG=(--target "$CARGO_TARGET")
fi

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log() { echo "${BLUE}==>${NC} $*"; }
ok() { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}!${NC} $*"; }
die() { echo "${RED}error:${NC} $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

release_bin_dir() {
  if [[ -n "${CARGO_TARGET:-}" ]]; then
    echo "target/${CARGO_TARGET}/release"
  else
    echo "target/release"
  fi
}

copy_bin() {
  local src="$1"
  local dest_name="$2"
  [[ -f "$src" ]] || die "binary not found: $src"
  install -m 755 "$src" "$DIST_DIR/bin/$dest_name"
  ok "bin/$dest_name"
}

cmd_clean() {
  log "Cleaning $DIST_DIR"
  rm -rf "$DIST_DIR"
  ok "cleaned"
}

cmd_env() {
  need test
  [[ -f "$ENV_EXAMPLE" ]] || die "missing $ENV_EXAMPLE"
  mkdir -p "$DIST_DIR/env"

  install -m 644 "$ENV_EXAMPLE" "$DIST_DIR/prod.env.example"
  ok "prod.env.example"

  # Unified stack env (do not clobber local secrets unless FORCE_PROD_ENV=1).
  if [[ ! -f "$DIST_DIR/prod.env" || "${FORCE_PROD_ENV:-0}" == "1" ]]; then
    install -m 600 "$ENV_EXAMPLE" "$DIST_DIR/prod.env"
    ok "prod.env (from example — edit secrets)"
  else
    warn "prod.env exists — keep (FORCE_PROD_ENV=1 to reset)"
  fi

  # Python --env=prod file inside staged tree (after python stage) or from source now.
  mkdir -p "$DIST_DIR/python/src/config/environments"
  if [[ -f "$SRC_DIR/config/environments/prod.env" ]]; then
    if [[ ! -f "$DIST_DIR/python/src/config/environments/prod.env" || "${FORCE_PROD_ENV:-0}" == "1" ]]; then
      install -m 600 "$SRC_DIR/config/environments/prod.env" \
        "$DIST_DIR/python/src/config/environments/prod.env"
      ok "python/src/config/environments/prod.env"
    else
      warn "python …/prod.env exists — keep"
    fi
  else
    warn "src/config/environments/prod.env missing"
  fi
  # Always refresh example next to python env for operators.
  if [[ -f "$SRC_DIR/config/environments/prod.env" ]]; then
    # Sanitized pointer file — point operators at stack prod.env + python file.
    cat >"$DIST_DIR/env/README.txt" <<EOF
Environment files in this build
================================

1) Initialize (recommended):
  cd dist/prod && ./install.sh -y
  cd dist/prod && ./init_env.sh
  Writes prod.env, patches python …/prod.env, generates frontend/runtime-config.js
  (DOMAIN / DOMAIN_API → PUBLIC_ORIGIN / API_ORIGIN / CORS).

2) Start:
  ./run.sh up|stop|restart|status
  # or from repo: ./scripts/run-prod.sh …

Files:
  dist/prod/prod.env
    Stack-wide env for Rust sidecars + run.sh (from deployment/env/prod.env.example).

  dist/prod/python/src/config/environments/prod.env
    Loaded by Python when running:  python run_*.py --env=prod

  dist/prod/frontend/runtime-config.js
    Browser API base (apiBase = DOMAIN_API origin). Set by init_env.sh.

  dist/prod/env/*.env
    Optional per-service overrides (sourced by run.sh if present).
EOF
  fi

  # Per-service env snippets (generated from stack example keys; override-friendly).
  cat >"$DIST_DIR/env/dashboard-query.env" <<'EOF'
# Optional overrides for dashboard-query-server
# DASHBOARD_QUERY_LISTEN=0.0.0.0:8787
# RUST_LOG=info
EOF
  cat >"$DIST_DIR/env/partyhome.env" <<'EOF'
# Optional overrides for partyhome-signaling
# SIGNALING_BIND=0.0.0.0:8989
# SIGNALING_DEV_TOKEN=change-me
# STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
# TURN_URLS=turn:YOUR_DOMAIN:3478?transport=udp,turn:YOUR_DOMAIN:3478?transport=tcp,turns:YOUR_DOMAIN:5349?transport=tcp
# TURN_USERNAME=turnuser
# TURN_CREDENTIAL=change-me
# LIVEKIT_URL=wss://YOUR_DOMAIN/livekit
# LIVEKIT_API_KEY=
# LIVEKIT_API_SECRET=
EOF
  cat >"$DIST_DIR/env/mail-message-manager.env" <<'EOF'
# Optional overrides for mail-message-manager-server
# MAIL_MESSAGE_MANAGER_LISTEN=0.0.0.0:8792
# MAIL_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/mail_message
EOF
  ok "env/ snippets"

  # Launcher + interactive env wizard + host install
  install -m 755 "$ROOT/scripts/run-prod.sh" "$DIST_DIR/run.sh"
  ok "run.sh"
  install -m 755 "$ROOT/scripts/init_env.sh" "$DIST_DIR/init_env.sh"
  ok "init_env.sh"
  install -m 755 "$ROOT/scripts/install-prod.sh" "$DIST_DIR/install.sh"
  ok "install.sh"
  install -m 755 "$ROOT/scripts/start-call-media.sh" "$DIST_DIR/start-call-media.sh"
  ok "start-call-media.sh"
  install -m 755 "$ROOT/scripts/verify-call-media.sh" "$DIST_DIR/verify-call-media.sh"
  ok "verify-call-media.sh"
  install -m 755 "$ROOT/scripts/deploy/fix_uplods_dir_server.sh" "$DIST_DIR/fix_uplods_dir_server.sh"
  ok "fix_uplods_dir_server.sh"

  # Dev-safe frontend runtime config (init_env.sh overwrites on server).
  mkdir -p "$DIST_DIR/frontend"
  if [[ ! -f "$DIST_DIR/frontend/runtime-config.js" ]]; then
    cat >"$DIST_DIR/frontend/runtime-config.js" <<'EOF'
/* Stub — overwritten by ./init_env.sh on the server */
window.__AICONTROL_RUNTIME__ = {
  apiBase: "",
  publicOrigin: "",
  partyhomeToken: ""
};
EOF
    ok "frontend/runtime-config.js (stub)"
  fi

  # realtime-sync config
  if [[ -f "$RUST_DIR/realtime-sync/config.toml" ]]; then
    mkdir -p "$DIST_DIR/share/realtime-sync"
    install -m 644 "$RUST_DIR/realtime-sync/config.toml" \
      "$DIST_DIR/share/realtime-sync/config.toml"
    ok "share/realtime-sync/config.toml"
  fi
}

cmd_frontend() {
  need npm
  log "Building $(basename "$FRONT_DIR") (production, version $VERSION)"
  mkdir -p "$DIST_DIR/frontend"
  local keep_rt=""
  if [[ -f "$DIST_DIR/frontend/runtime-config.js" ]]; then
    keep_rt="$(mktemp)"
    cp "$DIST_DIR/frontend/runtime-config.js" "$keep_rt"
  fi
  (
    cd "$FRONT_DIR"
    if [[ "${SKIP_NPM_CI:-0}" != "1" ]]; then
      if [[ -f package-lock.json ]]; then
        npm ci
      else
        npm install
      fi
    fi
    npm run build
  )
  rsync -a --delete "$FRONT_DIR/dist/" "$DIST_DIR/frontend/"
  if [[ -n "$keep_rt" && -f "$keep_rt" ]]; then
    if grep -qE 'apiBase:[[:space:]]*"[^"]+' "$keep_rt" 2>/dev/null \
      && ! grep -qE 'apiBase:[[:space:]]*""' "$keep_rt" 2>/dev/null; then
      cp "$keep_rt" "$DIST_DIR/frontend/runtime-config.js"
      ok "restored frontend/runtime-config.js"
    fi
    rm -f "$keep_rt"
  fi
  ok "frontend → $DIST_DIR/frontend"
}

cmd_python() {
  need poetry
  log "Preparing Python (py-worm) for production, version $VERSION"
  mkdir -p "$DIST_DIR/python"

  (
    cd "$SRC_DIR"
    poetry check
    if poetry export -f requirements.txt --only main --without-hashes \
      -o "$DIST_DIR/python/requirements.txt" 2>/dev/null; then
      ok "requirements.txt (poetry export --only main)"
    elif poetry export -f requirements.txt --without-hashes \
      -o "$DIST_DIR/python/requirements.txt" 2>/dev/null; then
      warn "exported full lock (plugin may not support --only main)"
    else
      warn "poetry-plugin-export missing — skip requirements.txt"
      rm -f "$DIST_DIR/python/requirements.txt"
    fi
  )

  # Preserve existing prod.env under staged tree across rebuilds.
  local keep_py_env=""
  local tmp_py_env=""
  if [[ -f "$DIST_DIR/python/src/config/environments/prod.env" && "${FORCE_PROD_ENV:-0}" != "1" ]]; then
    tmp_py_env="$(mktemp)"
    cp "$DIST_DIR/python/src/config/environments/prod.env" "$tmp_py_env"
    keep_py_env=1
  fi

  local py_edition_excludes=()
  if [[ "$VERSION" == "2" ]]; then
    local mod
    for mod in "${EDITION1_ONLY_PY[@]}"; do
      py_edition_excludes+=(--exclude "/$mod/")
    done
  fi

  # Anchored excludes (/…) only skip runtime data dirs at src root.
  # A bare 'data_models' also matched app/routers/data_models and dropped the API package.
  rsync -a \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.pytest_cache' \
    --exclude '.mypy_cache' \
    --exclude '/logs/' \
    --exclude '/data_models/' \
    --exclude '/dashboards/' \
    --exclude '/uploads/' \
    --exclude '.venv' \
    --exclude 'htmlcov' \
    --exclude '.coverage' \
    --exclude 'data_models.zip' \
    "${py_edition_excludes[@]}" \
    --delete \
    "$SRC_DIR/" "$DIST_DIR/python/src/"

  if [[ "$VERSION" == "2" ]]; then
    # rsync --delete не трогает исключённые пути — убрать остатки прошлой сборки V.1.
    for mod in "${EDITION1_ONLY_PY[@]}"; do
      rm -rf "$DIST_DIR/python/src/$mod"
    done
    ok "edition 2: billing modules excluded"
  fi

  if [[ -n "$keep_py_env" ]]; then
    mkdir -p "$DIST_DIR/python/src/config/environments"
    cp "$tmp_py_env" "$DIST_DIR/python/src/config/environments/prod.env"
    rm -f "$tmp_py_env"
    ok "restored python …/prod.env"
  fi

  cat >"$DIST_DIR/python/README.txt" <<EOF
AiControl Python (production staging)

Prefer host installer (postgres/redis/venv/DataCode):
  cd dist/prod && ./install.sh -y

Or manually:
1. Create venv and install deps (once):
     cd dist/prod/python
     python3.12 -m venv .venv
     . .venv/bin/activate
     pip install -U pip
     pip install -r requirements.txt

2. Edit env:
     python/src/config/environments/prod.env
     ../prod.env   (stack / Rust)

3. Prefer stack launcher:
     cd dist/prod && ./run.sh up

   Or manually:
     cd python/src && ../.venv/bin/python run_app.py --env=prod
EOF
  ok "python → $DIST_DIR/python"
}

build_one_rust() {
  local dir="$1"
  local package="$2"
  local bin_name="$3"
  local out_name="${4:-$bin_name}"
  local rel
  rel="$(release_bin_dir)"

  log "Rust release: $package ($dir)"
  (
    cd "$RUST_DIR/$dir"
    cargo build --release -p "$package" "${TARGET_FLAG[@]}"
  )
  copy_bin "$RUST_DIR/$dir/$rel/$bin_name" "$out_name"
}

cmd_rust() {
  need cargo
  mkdir -p "$DIST_DIR/bin"

  build_one_rust dashboard-query dashboard-query-server dashboard-query-server
  build_one_rust realtime-sync realtime-sync server realtime-sync-server
  build_one_rust task-reporting task-reporting-server task-reporting-server
  build_one_rust file-pipeline file-pipeline-server file-pipeline-server
  build_one_rust ScheduleSystem schedule-system-server schedule-system-server
  build_one_rust MailMessageManager mail-message-manager-server mail-message-manager-server
  build_one_rust PartyHome signaling signaling partyhome-signaling

  if [[ -d "$RUST_DIR/ScheduleSystem/schedule-system-server/static" ]]; then
    mkdir -p "$DIST_DIR/share/schedule-system"
    rsync -a "$RUST_DIR/ScheduleSystem/schedule-system-server/static/" \
      "$DIST_DIR/share/schedule-system/static/"
    ok "share/schedule-system/static"
  fi

  ok "rust binaries → $DIST_DIR/bin"
}

write_manifest() {
  local mf="$DIST_DIR/MANIFEST.txt"
  {
    echo "AiControl production build"
    echo "built_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "host: $(uname -s) $(uname -m)"
    echo "git: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    echo "cargo_target: ${CARGO_TARGET:-host}"
    echo "version: $VERSION ($(basename "$FRONT_DIR"))"
    echo ""
    echo "bin/"
    if [[ -d "$DIST_DIR/bin" ]]; then
      ls -1 "$DIST_DIR/bin" | sed 's/^/  /'
    fi
    echo ""
    echo "frontend/: $( [[ -d $DIST_DIR/frontend ]] && echo present || echo missing )"
    echo "python/:  $( [[ -d $DIST_DIR/python ]] && echo present || echo missing )"
    echo "prod.env: $( [[ -f $DIST_DIR/prod.env ]] && echo present || echo missing )"
    echo "run.sh:   $( [[ -x $DIST_DIR/run.sh ]] && echo present || echo missing )"
  } >"$mf"
  ok "MANIFEST → $mf"
}

cmd_all() {
  mkdir -p "$DIST_DIR"
  cmd_frontend
  cmd_python
  cmd_rust
  cmd_env
  write_manifest
  echo
  ok "Production build complete: $DIST_DIR"
  echo "  1. Install deps: $DIST_DIR/install.sh -y"
  echo "  2. Init env:     $DIST_DIR/init_env.sh"
  echo "  3. Start:  $DIST_DIR/run.sh up"
  echo "     Stop:   $DIST_DIR/run.sh stop"
}

usage() {
  cat <<EOF
Usage: [VERSION=1|2] $(basename "$0") [all|frontend|python|rust|env|clean|manifest]

  all        build frontend + python + rust + env/run.sh (default)
  frontend   npm production build → dist/prod/frontend
  python     stage src + requirements → dist/prod/python
  rust       cargo --release sidecars → dist/prod/bin
  env        stage prod.env, init_env.sh, env/*, run.sh
  clean      remove dist/prod
  manifest   rewrite MANIFEST.txt

Environment:
  VERSION=$VERSION
  DIST_DIR=$DIST_DIR
  SKIP_NPM_CI=0|1
  FORCE_PROD_ENV=0|1
  CARGO_TARGET=  (optional triple)
EOF
}

TARGET="${1:-all}"
case "$TARGET" in
  all | "") cmd_all ;;
  frontend | front) cmd_frontend; write_manifest ;;
  python | src) cmd_python; cmd_env; write_manifest ;;
  rust) cmd_rust; write_manifest ;;
  env) cmd_env; write_manifest ;;
  clean) cmd_clean ;;
  manifest) write_manifest ;;
  -h | --help | help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
