#!/usr/bin/env bash
# Start / stop / restart / status for a built AiControl production tree (dist/prod).
#
# Usage:
#   ./scripts/run-prod.sh up|stop|restart|status
#   dist/prod/run.sh up|stop|restart|status
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/MANIFEST.txt" && -d "$SCRIPT_DIR/bin" ]]; then
  DIST="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../dist/prod/MANIFEST.txt" ]]; then
  DIST="$(cd "$SCRIPT_DIR/../dist/prod" && pwd)"
else
  DIST="${DIST_DIR:-}"
  if [[ -z "$DIST" || ! -d "$DIST/bin" ]]; then
    echo "error: dist/prod not found. Build first: make -f Makefile.build all" >&2
    exit 1
  fi
fi

RUN_DIR="$DIST/run"
LOG_DIR="$DIST/logs"
ENV_FILE="${PROD_ENV_FILE:-$DIST/prod.env}"
CMD="${1:-status}"

mkdir -p "$RUN_DIR" "$LOG_DIR" "$DIST/data/data_models"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log() { echo "${BLUE}==>${NC} $*"; }
ok() { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}!${NC} $*"; }
die() { echo "${RED}error:${NC} $*" >&2; exit 1; }

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    die "missing $ENV_FILE — run ./init_env.sh (or copy prod.env.example → prod.env)"
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

stop_pidfile() {
  local name="$1"
  local pf="$RUN_DIR/${name}.pid"
  if [[ -f "$pf" ]]; then
    local pid
    pid="$(cat "$pf" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping $name (pid $pid)"
      kill_tree "$pid"
      sleep 0.3
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pf"
  fi
}

is_up() {
  local pf="$RUN_DIR/${1}.pid"
  [[ -f "$pf" ]] && kill -0 "$(cat "$pf" 2>/dev/null)" 2>/dev/null
}

start_bg() {
  local name="$1"
  shift
  local pf="$RUN_DIR/${name}.pid"
  local lf="$LOG_DIR/${name}.log"
  if is_up "$name"; then
    warn "$name already running (pid $(cat "$pf"))"
    return 0
  fi
  log "Starting $name…"
  (
    cd "$DIST"
    exec "$@"
  ) >>"$lf" 2>&1 &
  echo $! >"$pf"
  sleep 0.25
  if is_up "$name"; then
    ok "$name pid $(cat "$pf")  → logs/${name}.log"
  else
    warn "$name may have failed — see logs/${name}.log"
  fi
}

abs_under_dist() {
  local p="$1"
  if [[ -z "$p" ]]; then
    echo ""
    return
  fi
  if [[ "$p" == /* ]]; then
    echo "$p"
  else
    echo "$DIST/$p"
  fi
}

start_python_entry() {
  local name="$1"
  local entry="$2"
  local wrapper="$RUN_DIR/_run_${name}.sh"
  cat >"$wrapper" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$DIST/python/src"
if [[ -x "$DIST/python/.venv/bin/python" ]]; then
  exec "$DIST/python/.venv/bin/python" "$entry" --env=prod
fi
if [[ -x "$DIST/python/src/.venv/bin/python" ]]; then
  exec "$DIST/python/src/.venv/bin/python" "$entry" --env=prod
fi
if command -v poetry >/dev/null 2>&1 && [[ -f pyproject.toml ]]; then
  exec poetry run python "$entry" --env=prod
fi
exec python3 "$entry" --env=prod
EOF
  chmod +x "$wrapper"
  start_bg "$name" bash "$wrapper"
}

start_frontend() {
  local port="${FRONTEND_PORT:-3000}"
  local host="${FRONTEND_LISTEN:-0.0.0.0}"
  if ! [[ -d "$DIST/frontend" ]]; then
    warn "frontend/ missing — skip"
    return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    start_bg frontend npx --yes serve -s frontend -l "tcp://${host}:${port}"
  elif command -v python3 >/dev/null 2>&1; then
    start_bg frontend python3 -m http.server "$port" --bind "$host" --directory frontend
  else
    warn "no npx/python3 to serve frontend"
  fi
}

PROCS_ORDER=(
  dashboard-query
  realtime-sync
  task-reporting
  file-pipeline
  schedule-system
  mail-message-manager
  partyhome
  datacode
  run_app
  run_api
  run_ai
  frontend
)

cmd_stop() {
  log "Stopping production stack in $DIST"
  local i
  for ((i = ${#PROCS_ORDER[@]} - 1; i >= 0; i--)); do
    stop_pidfile "${PROCS_ORDER[i]}"
  done
  ok "Stopped."
}

cmd_up() {
  if [[ ! -f "$ENV_FILE" ]]; then
    warn "missing $ENV_FILE — run ./init_env.sh first"
  elif grep -qE '^JWT_SECRET=change-me' "$ENV_FILE" 2>/dev/null; then
    warn "prod.env still has placeholder secrets — run ./init_env.sh"
  fi

  load_env
  [[ -x "$DIST/bin/dashboard-query-server" ]] || die "binaries missing — run make -f Makefile.build all"

  export DATA_MODELS_DIR
  export SCHEDULE_DB_PATH
  export UPLOADS_ROOT
  DATA_MODELS_DIR="$(abs_under_dist "${DATA_MODELS_DIR:-data/data_models}")"
  SCHEDULE_DB_PATH="$(abs_under_dist "${SCHEDULE_DB_PATH:-data/schedule.db}")"
  UPLOADS_ROOT="$(abs_under_dist "${UPLOADS_ROOT:-data/uploads}")"
  mkdir -p "$(dirname "$SCHEDULE_DB_PATH")" "$DATA_MODELS_DIR" \
    "$UPLOADS_ROOT/avatars" "$UPLOADS_ROOT/projects" "$UPLOADS_ROOT/tasks"

  if [[ -n "${RTSYNC_CONFIG:-}" ]]; then
    RTSYNC_CONFIG="$(abs_under_dist "$RTSYNC_CONFIG")"
    export RTSYNC_CONFIG
  elif [[ -f "$DIST/share/realtime-sync/config.toml" ]]; then
    export RTSYNC_CONFIG="$DIST/share/realtime-sync/config.toml"
  fi

  # ScheduleSystem uses DATABASE_URL / API_DATABASE_URL from prod.env
  start_bg dashboard-query "$DIST/bin/dashboard-query-server"
  start_bg realtime-sync "$DIST/bin/realtime-sync-server"
  start_bg task-reporting "$DIST/bin/task-reporting-server"
  start_bg file-pipeline "$DIST/bin/file-pipeline-server"
  start_bg schedule-system "$DIST/bin/schedule-system-server"

  # Mail prefers MAIL_DATABASE_URL (keep parent DATABASE_URL for schedule).
  start_bg mail-message-manager \
    env \
    DATABASE_URL="${MAIL_DATABASE_URL:-${DATABASE_URL:-}}" \
    REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}" \
    "$DIST/bin/mail-message-manager-server"

  start_bg partyhome "$DIST/bin/partyhome-signaling"

  if command -v datacode >/dev/null 2>&1; then
    start_bg datacode \
      datacode --websocket --host 127.0.0.1 --port 8899 --use-ve --build_model
  else
    warn "datacode not on PATH — skip :8899 (./install.sh or export PATH=\"\$HOME/.cargo/bin:\$PATH\")"
  fi

  if [[ -d "$DIST/python/src" ]]; then
    start_python_entry run_app run_app.py
    start_python_entry run_api run_api.py
    start_python_entry run_ai run_ai.py
  else
    warn "python/src missing — skip app/api/ai"
  fi

  start_frontend

  echo
  ok "Production stack is up ($DIST)"
  echo "  Frontend     http://127.0.0.1:${FRONTEND_PORT:-3000}"
  echo "  App          http://127.0.0.1:${APP__PORT:-8000}/health"
  echo "  dashboard-q  http://127.0.0.1:8787/health"
  echo "  PartyHome    http://127.0.0.1:8989/health"
  echo "  DataCode     ws://127.0.0.1:8899"
  echo "  Schedule UI  http://127.0.0.1:8793"
  echo "  Logs         $LOG_DIR/"
  echo
  echo "Stop:    $(basename "$0") stop"
  echo "Restart: $(basename "$0") restart"
}

cmd_status() {
  echo "DIST=$DIST"
  echo "ENV=$ENV_FILE"
  local name
  for name in "${PROCS_ORDER[@]}"; do
    if is_up "$name"; then
      echo "  $name: up (pid $(cat "$RUN_DIR/${name}.pid"))"
    else
      echo "  $name: down"
    fi
  done
}

cmd_restart() {
  cmd_stop
  sleep 1
  cmd_up
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [up|stop|restart|status]

  up       start all services from dist/prod (needs prod.env)
  stop     stop all
  restart  stop then up
  status   show pidfiles

DIST=$DIST
PROD_ENV_FILE=$ENV_FILE
EOF
}

case "$CMD" in
  up | start) cmd_up ;;
  stop | down) cmd_stop ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  -h | --help | help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
