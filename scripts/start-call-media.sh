#!/usr/bin/env bash
# Start coturn + LiveKit for PartyHome calls (not started by run.sh).
# Usage (on the prod host):
#   cd /root/2a_prod/prod
#   ./start-call-media.sh up|stop|status
#
# Reads TURN_* / LIVEKIT_* from prod.env. Keys must match livekit.yaml.
set -euo pipefail

DIST="$(cd "$(dirname "$0")" && pwd)"
# Repo: scripts/start-call-media.sh → ../prod.env ; prod host: script next to prod.env
if [[ ! -f "$DIST/prod.env" && -f "$DIST/../prod.env" ]]; then
  DIST="$(cd "$DIST/.." && pwd)"
fi
ENV_FILE="${PROD_ENV_FILE:-$DIST/prod.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: prod.env not found (looked in $DIST, set PROD_ENV_FILE)" >&2
  exit 1
fi
RUN_DIR="$DIST/.run/call-media"
LOG_DIR="$DIST/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

TURN_USERNAME="${TURN_USERNAME:-turnuser}"
TURN_CREDENTIAL="${TURN_CREDENTIAL:-}"
TURN_REALM="${TURN_REALM:-partyhome}"
TURN_EXTERNAL_IP="${TURN_EXTERNAL_IP:-}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-}"
LIVEKIT_BIND="${LIVEKIT_BIND:-0.0.0.0}"

die() { echo "error: $*" >&2; exit 1; }

is_alive() {
  local pf="$1"
  [[ -f "$pf" ]] || return 1
  local pid
  pid="$(cat "$pf" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null
}

stop_pidfile() {
  local pf="$1"
  if is_alive "$pf"; then
    kill "$(cat "$pf")" 2>/dev/null || true
    sleep 0.4
    if is_alive "$pf"; then
      kill -9 "$(cat "$pf")" 2>/dev/null || true
    fi
  fi
  rm -f "$pf"
}

write_livekit_yaml() {
  [[ -n "$LIVEKIT_API_KEY" && -n "$LIVEKIT_API_SECRET" ]] || die "LIVEKIT_API_KEY / LIVEKIT_API_SECRET empty in $ENV_FILE"
  cat >"$RUN_DIR/livekit.yaml" <<EOF
port: 7880
bind_addresses:
  - "${LIVEKIT_BIND}"
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
$(if [[ -n "$TURN_EXTERNAL_IP" ]]; then echo "  node_ip: \"${TURN_EXTERNAL_IP}\""; fi)
keys:
  "${LIVEKIT_API_KEY}": "${LIVEKIT_API_SECRET}"
logging:
  level: info
EOF
}

start_coturn() {
  local pf="$RUN_DIR/coturn.pid"
  local lf="$LOG_DIR/coturn.log"
  if is_alive "$pf"; then
    echo "coturn already running (pid $(cat "$pf"))"
    return 0
  fi
  [[ -n "$TURN_CREDENTIAL" ]] || die "TURN_CREDENTIAL empty in $ENV_FILE"

  local extra=()
  if [[ -n "$TURN_EXTERNAL_IP" ]]; then
    extra+=(--external-ip="$TURN_EXTERNAL_IP")
  fi
  if [[ -f /etc/letsencrypt/live/ai-control.24ai-spbconsult.ru/fullchain.pem ]]; then
    extra+=(
      --cert=/etc/letsencrypt/live/ai-control.24ai-spbconsult.ru/fullchain.pem
      --pkey=/etc/letsencrypt/live/ai-control.24ai-spbconsult.ru/privkey.pem
      --tls-listening-port=5349
    )
  fi

  if command -v turnserver >/dev/null 2>&1; then
    echo "Starting coturn (turnserver)…"
    nohup turnserver -n --log-file=stdout \
      --listening-ip=0.0.0.0 --listening-port=3478 \
      --min-port=49160 --max-port=49300 \
      --lt-cred-mech --fingerprint --no-cli --no-multicast-peers \
      --realm="$TURN_REALM" \
      --user="${TURN_USERNAME}:${TURN_CREDENTIAL}" \
      "${extra[@]}" >>"$lf" 2>&1 &
    echo $! >"$pf"
  elif command -v docker >/dev/null 2>&1; then
    echo "Starting coturn (docker, host network)…"
    docker rm -f aicontrol-coturn >/dev/null 2>&1 || true
    docker run -d --name aicontrol-coturn --network host --restart unless-stopped \
      -e TURN_USERNAME="$TURN_USERNAME" \
      -e TURN_CREDENTIAL="$TURN_CREDENTIAL" \
      -e TURN_REALM="$TURN_REALM" \
      -e TURN_EXTERNAL_IP="$TURN_EXTERNAL_IP" \
      coturn/coturn:4.6.2 \
      -n --log-file=stdout --listening-ip=0.0.0.0 --listening-port=3478 \
      --min-port=49160 --max-port=49300 \
      --lt-cred-mech --fingerprint --no-cli --no-multicast-peers \
      --realm="$TURN_REALM" \
      --user="${TURN_USERNAME}:${TURN_CREDENTIAL}" \
      ${TURN_EXTERNAL_IP:+--external-ip=$TURN_EXTERNAL_IP} \
      >/dev/null
    docker inspect -f '{{.State.Pid}}' aicontrol-coturn >"$pf"
  else
    die "install coturn (apt install coturn) or docker"
  fi
  sleep 0.5
  echo "coturn pid $(cat "$pf")  → $lf"
}

start_livekit() {
  local pf="$RUN_DIR/livekit.pid"
  local lf="$LOG_DIR/livekit.log"
  if is_alive "$pf"; then
    echo "livekit already running (pid $(cat "$pf"))"
    return 0
  fi
  write_livekit_yaml

  local bin=""
  if command -v livekit-server >/dev/null 2>&1; then
    bin="$(command -v livekit-server)"
  elif [[ -x "$DIST/bin/livekit-server" ]]; then
    bin="$DIST/bin/livekit-server"
  fi

  if [[ -n "$bin" ]]; then
    echo "Starting LiveKit ($bin)…"
    nohup "$bin" --config "$RUN_DIR/livekit.yaml" >>"$lf" 2>&1 &
    echo $! >"$pf"
  elif command -v docker >/dev/null 2>&1; then
    echo "Starting LiveKit (docker, host network)…"
    docker rm -f aicontrol-livekit >/dev/null 2>&1 || true
    docker run -d --name aicontrol-livekit --network host --restart unless-stopped \
      -v "$RUN_DIR/livekit.yaml:/etc/livekit.yaml:ro" \
      livekit/livekit-server:v1.8.4 \
      --config /etc/livekit.yaml >/dev/null
    docker inspect -f '{{.State.Pid}}' aicontrol-livekit >"$pf"
  else
    die "install livekit-server (https://docs.livekit.io/home/self-hosting/local/) or docker"
  fi
  sleep 0.5
  echo "livekit pid $(cat "$pf")  → $lf"
}

cmd_stop() {
  stop_pidfile "$RUN_DIR/coturn.pid"
  stop_pidfile "$RUN_DIR/livekit.pid"
  docker rm -f aicontrol-coturn aicontrol-livekit >/dev/null 2>&1 || true
  echo "Stopped coturn + LiveKit."
}

cmd_status() {
  for name in coturn livekit; do
    local pf="$RUN_DIR/${name}.pid"
    if is_alive "$pf"; then
      echo "$name: up (pid $(cat "$pf"))"
    else
      echo "$name: down"
    fi
  done
  ss -lntp 2>/dev/null | grep -E ':3478|:5349|:7880|:8989' || true
  ss -ulnp 2>/dev/null | grep -E ':3478|:7881|:7882|:4916' || true
}

cmd_up() {
  start_coturn
  start_livekit
  echo
  echo "Open firewall if needed:"
  echo "  3478/udp 3478/tcp  49160-49300/udp   (coturn)"
  echo "  7880/tcp (localhost ok via nginx)  7881/tcp 7882/udp  (LiveKit media)"
  echo
  echo "Then:  $DIST/scripts/verify-call-media.sh   or copy verify-call-media.sh to this host"
  cmd_status
}

case "${1:-up}" in
  up|start) cmd_up ;;
  stop) cmd_stop ;;
  restart) cmd_stop; sleep 1; cmd_up ;;
  status) cmd_status ;;
  *) echo "Usage: $0 [up|stop|restart|status]" >&2; exit 1 ;;
esac
