#!/usr/bin/env bash
# Verify coturn + LiveKit + that PartyHome welcome actually offers them.
# Usage on the prod host:
#   cd /root/2a_prod/prod && bash scripts/verify-call-media.sh
# or from repo:  bash scripts/verify-call-media.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROD_ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
  if [[ -f "$PWD/prod.env" ]]; then
    ENV_FILE="$PWD/prod.env"
  elif [[ -f "$ROOT/prod.env" ]]; then
    ENV_FILE="$ROOT/prod.env"
  else
    echo "error: prod.env not found (set PROD_ENV_FILE)" >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

TOKEN="${SIGNALING_DEV_TOKEN:-}"
DOMAIN="${DOMAIN:-ai-control.24ai-spbconsult.ru}"
PASS=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; PASS=1; }

echo "== ports =="
if curl -sf -o /dev/null http://127.0.0.1:8989/health; then
  ok "signaling :8989"
else
  bad "signaling :8989 not listening"
fi
if ss -lntu 2>/dev/null | grep -qE ':3478([^0-9]|$)'; then ok "coturn :3478"; else bad "coturn :3478 not listening — start-call-media.sh up"; fi
if ss -lntu 2>/dev/null | grep -qE ':7880([^0-9]|$)'; then ok "LiveKit :7880"; else bad "LiveKit :7880 not listening — start-call-media.sh up"; fi
if ss -lntu 2>/dev/null | grep -qE ':5349([^0-9]|$)'; then ok "TURNS :5349"; else echo "WARN TURNS :5349 not listening — UDP/TCP 3478 is enough if the firewall allows it"; fi
n_turn="$(ps -C turnserver -o pid= 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${n_turn:-0}" -gt 1 ]]; then
  bad "несколько turnserver ($n_turn шт.) — systemctl stop coturn && systemctl disable coturn && ./start-call-media.sh restart"
fi

echo
echo "== local health =="
code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8989/health || true)"
[[ "$code" == "200" ]] && ok "http://127.0.0.1:8989/health → $code" || bad "signaling health → $code"

echo
echo "== public nginx =="
code="$(curl -sS -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/partyhome/health" || true)"
[[ "$code" == "200" ]] && ok "/api/partyhome/health → $code" || bad "/api/partyhome/health → $code (nginx rewrite?)"

ws_code="$(curl -sS --http1.1 -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "https://${DOMAIN}/api/partyhome/ws?room_id=probe&token=WRONG" || true)"
if [[ "$ws_code" == "401" ]]; then
  ok "WS bad token → 401 (proxy + auth)"
else
  echo "WARN WS bad-token probe → $ws_code (curl is not a full browser WS; 400 is common). Signaling welcome below is the real check."
fi

lk_body="$(curl -sS "https://${DOMAIN}/livekit/" 2>/dev/null | head -c 200 || true)"
if echo "$lk_body" | grep -qiE 'doctype html|index.html|<html'; then
  bad "/livekit/ returns SPA HTML — nginx location /livekit/ not deployed, or LiveKit down"
else
  ok "/livekit/ is not the SPA (body starts: $(echo "$lk_body" | tr '\n' ' ' | cut -c1-80))"
fi

echo
echo "== PartyHome welcome (does signaling hand TURN + SFU to the browser?) =="
python3 - "$TOKEN" <<'PY'
import base64, json, os, socket, struct, sys, hashlib, secrets

token = sys.argv[1] if len(sys.argv) > 1 else ""
if not token:
    print("FAIL SIGNALING_DEV_TOKEN empty")
    sys.exit(1)

def ws_key():
    return base64.b64encode(secrets.token_bytes(16)).decode()

def mask_frame(payload: bytes) -> bytes:
    mask = secrets.token_bytes(4)
    data = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    header = bytes([0x81, 0x80 | len(payload)]) + mask
    return header + data

def read_frame(sock: socket.socket) -> str:
    hdr = sock.recv(2)
    if len(hdr) < 2:
        raise RuntimeError("short websocket header")
    ln = hdr[1] & 0x7F
    if ln == 126:
        ext = sock.recv(2)
        ln = struct.unpack("!H", ext)[0]
    elif ln == 127:
        ext = sock.recv(8)
        ln = struct.unpack("!Q", ext)[0]
    data = b""
    while len(data) < ln:
        chunk = sock.recv(ln - len(data))
        if not chunk:
            break
        data += chunk
    return data.decode("utf-8", "replace")

path = f"/ws?room_id=verify-call-media&token={token}"
key = ws_key()
req = (
    f"GET {path} HTTP/1.1\r\n"
    f"Host: 127.0.0.1:8989\r\n"
    "Upgrade: websocket\r\n"
    "Connection: Upgrade\r\n"
    f"Sec-WebSocket-Key: {key}\r\n"
    "Sec-WebSocket-Version: 13\r\n"
    "\r\n"
)
s = socket.create_connection(("127.0.0.1", 8989), timeout=8)
s.sendall(req.encode())
buf = b""
while b"\r\n\r\n" not in buf:
    buf += s.recv(4096)
head, _ = buf.split(b"\r\n\r\n", 1)
if b" 101 " not in head.split(b"\r\n", 1)[0]:
    print("FAIL websocket handshake:", head.split(b"\r\n", 1)[0].decode())
    sys.exit(1)
s.sendall(mask_frame(json.dumps({"type": "join", "display_name": "1|probe"}).encode()))
msg = json.loads(read_frame(s))
s.close()
if msg.get("type") != "welcome":
    print("FAIL expected welcome, got", msg.get("type"), msg)
    sys.exit(1)

ice = msg.get("iceServers") or []
urls = []
for srv in ice:
    u = srv.get("urls") or []
    if isinstance(u, str):
        u = [u]
    urls.extend(u)
turn = [u for u in urls if str(u).lower().startswith(("turn:", "turns:"))]
stun = [u for u in urls if str(u).lower().startswith(("stun:", "stuns:"))]
media = msg.get("media") or {}
print("peer_id     ", msg.get("peer_id"))
print("stun        ", stun[:6] or "(none)")
print("turn        ", turn or "(none)")
print("turn user   ", next((s.get("username") for s in ice if s.get("username")), None))
print("media.mode  ", media.get("mode"))
print("media.url   ", media.get("url"))
rc = 0
if not turn:
    print("FAIL welcome has no turn:/turns: — TURN_* not loaded or empty")
    rc = 1
else:
    print("OK  welcome includes TURN")
if media.get("mode") == "sfu" and media.get("url") and media.get("token"):
    print("OK  welcome includes SFU (LiveKit token minted)")
    if "127.0.0.1" in str(media.get("url")) or str(media.get("url")).startswith("ws://"):
        print("FAIL media.url is not public wss:// — browsers cannot use it")
        rc = 1
else:
    print("FAIL welcome has no SFU media — LIVEKIT_* incomplete or mint failed")
    rc = 1
sys.exit(rc)
PY

echo
if [[ "$PASS" -eq 0 ]]; then
  echo "All checks passed. Next: two browsers on different networks, roster «В звонке», connection=connected."
else
  echo "Some checks failed (see FAIL lines). Coturn/LiveKit/nginx must be up before employee calls work across NAT."
  exit 1
fi
