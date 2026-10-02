#!/usr/bin/env bash
# Start, stop, or restart the local AI Control stack on the host — no Docker.
# Postgres is expected already running on 127.0.0.1:5432.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/logs"
CMD="${1:-up}"
VERSION="${2:-1}"
VERSION="${VERSION#version=}"  # accept both "2" and "version=2"

PROCS=(
  dashboard-query
  realtime-sync
  task-reporting
  file-pipeline
  schedule-system
  mail-message-manager
  partyhome
  datacode
  frontend
  run_app
  run_api
  run_ai
)

kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

stop_pidfile() {
  local pf="$1"
  if [[ -f "$pf" ]]; then
    local pid
    pid="$(cat "$pf" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill_tree "$pid"
    fi
    rm -f "$pf"
  fi
}

stop_all() {
  echo "Stopping host stack..."
  for ((i = ${#PROCS[@]} - 1; i >= 0; i--)); do
    stop_pidfile "$LOG_DIR/${PROCS[i]}.pid"
  done
  # Standalone launcher office-rust/realtime-sync/run uses its own pidfile.
  stop_pidfile "$ROOT/office-rust/realtime-sync/realtime-sync.pid"
  # PartyHome run.sh child pidfiles (signaling / livekit / frontend).
  if [[ -x "$ROOT/office-rust/PartyHome/run.sh" ]]; then
    (cd "$ROOT/office-rust/PartyHome" && bash ./run.sh stop) || true
  fi
  echo "Stopped."
}

usage() {
  echo "Usage: $0 [up|stop|restart]" >&2
  exit 1
}

case "$CMD" in
  stop)
    stop_all
    exit 0
    ;;
  restart)
    stop_all
    sleep 1
    exec "$0" up "$VERSION"
    ;;
  up) 
    echo "Starting version: $VERSION"
    ;;
  *)
    usage
    ;;
esac

mkdir -p "$LOG_DIR" \
  "$ROOT/office-rust/ScheduleSystem/data" \
  "$ROOT/office-rust/MailMessageManager/data" \
  "$ROOT/office-rust/PartyHome/logs" \
  "$ROOT/office-rust/PartyHome/.run"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

need cargo
need poetry

if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    echo "Postgres is not ready on 127.0.0.1:5432." >&2
    echo "Start host Postgres (ai_control_dev / ai_control_api_dev) and retry." >&2
    exit 1
  fi
else
  echo "Note: pg_isready not found; skipping Postgres check."
fi

if command -v redis-cli >/dev/null 2>&1; then
  if ! redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    echo "Redis is not ready on 127.0.0.1:6379 (needed by app / MailMessageManager)." >&2
    echo "Start host redis-server and retry." >&2
    exit 1
  fi
else
  echo "Note: redis-cli not found; skipping Redis check."
fi

if command -v psql >/dev/null 2>&1; then
  if ! PGPASSWORD="${PGPASSWORD:-postgres}" psql -h 127.0.0.1 -U postgres -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='mail_message_dev'" 2>/dev/null | grep -q 1; then
    echo "Creating database mail_message_dev..."
    PGPASSWORD="${PGPASSWORD:-postgres}" psql -h 127.0.0.1 -U postgres -d postgres \
      -c "CREATE DATABASE mail_message_dev;" >/dev/null
  fi
fi

start_bg() {
  local name="$1"
  local workdir="$2"
  shift 2
  local pidfile="$LOG_DIR/${name}.pid"
  local logfile="$LOG_DIR/${name}.log"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "$name already running (pid $(cat "$pidfile"))"
    return
  fi
  echo "Starting $name..."
  (
    cd "$workdir"
    exec "$@"
  ) >>"$logfile" 2>&1 &
  echo $! >"$pidfile"
}

echo
echo "=== 1/3 Rust sidecars ==="
start_bg dashboard-query "$ROOT/office-rust/dashboard-query" \
  env DASHBOARD_QUERY_LISTEN=127.0.0.1:8787 \
  cargo run -p dashboard-query-server

start_bg realtime-sync "$ROOT/office-rust/realtime-sync" \
  env RTSYNC_CONFIG="$ROOT/office-rust/realtime-sync/config.toml" \
  cargo run --bin server

start_bg task-reporting "$ROOT/office-rust/task-reporting" \
  env TASK_REPORTING_LISTEN=127.0.0.1:8790 \
  cargo run -p task-reporting-server

start_bg file-pipeline "$ROOT/office-rust/file-pipeline" \
  env FILE_PIPELINE_LISTEN=127.0.0.1:8791 \
  cargo run -p file-pipeline-server

start_bg schedule-system "$ROOT/office-rust/ScheduleSystem" \
  env \
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/ai_control_dev \
  API_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/ai_control_api_dev \
  DATA_MODELS_DIR="$ROOT/py-worm/data_models" \
  SCHEDULE_DB_PATH="$ROOT/office-rust/ScheduleSystem/data/schedule.db" \
  JWT_SECRET=dev-secret-key-change-in-production \
  JWT_NO_EXPIRY=true \
  INTERNAL_TOKEN=dev-schedule-internal-token \
  AUTH_LOGIN_URL=http://127.0.0.1:8000/auth/login_user/ \
  REALTIME_SYNC_URL=http://127.0.0.1:9010/health \
  PARTYHOME_HEALTH_URL=http://127.0.0.1:8989/health \
  cargo run -p schedule-system-server

start_bg mail-message-manager "$ROOT/office-rust/MailMessageManager" \
  bash -c 'set -a
    if [[ -f env.development ]]; then . ./env.development
    elif [[ -f env.development.example ]]; then . ./env.development.example
    fi
    set +a
    exec cargo run -p mail-message-manager-server'

start_bg partyhome "$ROOT/office-rust/PartyHome" \
  bash ./run.sh up --wait

echo
echo "=== 2/3 DataCode + frontend ==="
if command -v datacode >/dev/null 2>&1; then
  start_bg datacode "$ROOT" \
    datacode --websocket --host 127.0.0.1 --port 8899 --use-ve --build_model
else
  echo "Note: datacode not on PATH — skip :8899 (install the binary or add it to PATH)."
fi

if command -v npm >/dev/null 2>&1; then
  echo "Installing frontend deps (npm ci)..."
  if [[ "$VERSION" == "1" ]]; then
    (cd "$ROOT/V.1.front-ai-control" && npm ci)
    start_bg frontend "$ROOT/V.1.front-ai-control" \
    env VITE_REALTIME_DASHBOARD_WS=true \
    npm run dev -- --host 0.0.0.0 --port 3000
  else
    (cd "$ROOT/V.C.2.front-ai-control" && npm ci)
    start_bg frontend "$ROOT/V.C.2.front-ai-control" \
    env VITE_REALTIME_DASHBOARD_WS=true \
    npm run dev -- --host 0.0.0.0 --port 3000
  fi
else
  echo "Note: npm not found — skip frontend :3000."
fi

echo
echo "=== 3/3 Python (app / api / ai) ==="
start_bg run_app "$ROOT/py-worm" poetry run python run_app.py --env=dev
start_bg run_api "$ROOT/py-worm" poetry run python run_api.py --env=dev
start_bg run_ai "$ROOT/py-worm" poetry run python run_ai.py --env=dev

cat <<EOF

Stack is up (host only, no Docker).

  Frontend            http://127.0.0.1:3000
  App                 http://127.0.0.1:8000/health
  Developer API       http://127.0.0.1:8002/health
  AI API              http://127.0.0.1:8003/health
  DataCode            tcp://127.0.0.1:8899
  dashboard-query     http://127.0.0.1:8787/health
  realtime-sync TCP   127.0.0.1:9009
  realtime-sync HTTP  http://127.0.0.1:9010/health
  task-reporting      http://127.0.0.1:8790/health
  file-pipeline       http://127.0.0.1:8791/health
  MailMessageManager  http://127.0.0.1:8792/api/messaging/health
  PartyHome signaling http://127.0.0.1:8989/health
  ScheduleSystem UI   http://127.0.0.1:8793   (superuser)

  Logs: $LOG_DIR/*.log
  PartyHome logs: $ROOT/rust/PartyHome/logs/
  First cargo compile can take 1–2 min.

Stop:     $0 stop
Restart:  $0 restart

EOF
