#!/usr/bin/env bash
# Interactive production env wizard for dist/prod.
# Usage (from dist/prod):
#   ./init_env.sh
#   ./init_env.sh --yes   # overwrite without confirm
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ENV="${ROOT}/prod.env"
EXAMPLE="${ROOT}/prod.env.example"
PY_ENV="${ROOT}/python/src/config/environments/prod.env"
RUNTIME_JS="${ROOT}/frontend/runtime-config.js"
YES=0

for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./init_env.sh [--yes]

Interactive wizard: writes prod.env, patches python prod.env,
and generates frontend/runtime-config.js (DOMAIN / DOMAIN_API).

  --yes   overwrite without confirmation
EOF
      exit 0
      ;;
  esac
done

# ── helpers ──────────────────────────────────────────────────────────

die() { echo "error: $*" >&2; exit 1; }

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import secrets; print(secrets.token_hex(32))'
  else
    die "need openssl or python3 to generate secrets"
  fi
}

# Load KEY=VALUE from file (safe for bash 3.2 / macOS).
load_env_file() {
  local f="$1" line key val
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    # strip optional surrounding quotes
    if [[ "$val" == \"*\" && "$val" == *\" ]]; then
      val="${val#\"}"
      val="${val%\"}"
    fi
    export "$key=$val"
  done <"$f"
}

normalize_domain() {
  local d="${1:-}"
  d="${d#"${d%%[![:space:]]*}"}"
  d="${d%"${d##*[![:space:]]}"}"
  d="${d#https://}"
  d="${d#http://}"
  d="${d%%/*}"
  d="${d%%:*}"
  printf '%s' "$d"
}

ask() {
  # ask VAR "Prompt" "default"
  local var="$1" prompt="$2" def="${3:-}"
  local cur=""
  if [[ -n "${!var+x}" ]]; then
    cur="${!var}"
  fi
  [[ -z "$cur" ]] && cur="$def"
  local ans
  if [[ -n "$cur" ]]; then
    read -r -p "$prompt [$cur]: " ans || true
  else
    read -r -p "$prompt: " ans || true
  fi
  if [[ -z "$ans" ]]; then
    printf -v "$var" '%s' "$cur"
  else
    printf -v "$var" '%s' "$ans"
  fi
}

ask_secret() {
  # ask_secret VAR "Prompt" — empty keeps current; g / generate creates new
  local var="$1" prompt="$2"
  local cur="${!var:-}"
  local shown="(empty)"
  if [[ -n "$cur" && "$cur" != change-me* ]]; then
    shown="(set, ${#cur} chars)"
  elif [[ -n "$cur" ]]; then
    shown="(placeholder)"
  fi
  local ans
  read -r -p "$prompt $shown [Enter=keep, g=generate]: " ans || true
  case "$ans" in
    g|G|generate|GENERATE)
      printf -v "$var" '%s' "$(gen_secret)"
      echo "  → generated"
      ;;
    "")
      if [[ -z "$cur" || "$cur" == change-me* ]]; then
        printf -v "$var" '%s' "$(gen_secret)"
        echo "  → generated (was empty/placeholder)"
      fi
      ;;
    *)
      printf -v "$var" '%s' "$ans"
      ;;
  esac
}

ask_yn() {
  local var="$1" prompt="$2" def="${3:-n}"
  local ans
  read -r -p "$prompt [y/N]: " ans || true
  ans="${ans:-$def}"
  case "$ans" in
    y|Y|yes|YES) printf -v "$var" '%s' "y" ;;
    *) printf -v "$var" '%s' "n" ;;
  esac
}

set_kv_file() {
  # set_kv_file FILE KEY VALUE — upsert KEY=VALUE in FILE
  local file="$1" key="$2" value="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ ! -f "$file" ]]; then
    printf '%s=%s\n' "$key" "$value" >"$file"
    return
  fi
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    # escape for sed: use python for safe replace
    python3 - "$file" "$key" "$value" "$tmp" <<'PY'
import sys
path, key, value, out = sys.argv[1:5]
lines = open(path, encoding="utf-8", errors="replace").read().splitlines(True)
found = False
out_lines = []
for line in lines:
    if line.startswith(key + "=") and not line.lstrip().startswith("#"):
        out_lines.append(f"{key}={value}\n")
        found = True
    else:
        out_lines.append(line)
if not found:
    if out_lines and not out_lines[-1].endswith("\n"):
        out_lines[-1] += "\n"
    out_lines.append(f"{key}={value}\n")
open(out, "w", encoding="utf-8").writelines(out_lines)
PY
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
    rm -f "$tmp"
  fi
}

urlencode_pass() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

# ── load defaults ────────────────────────────────────────────────────

if [[ ! -f "$EXAMPLE" ]]; then
  die "missing $EXAMPLE — run from dist/prod after build"
fi

# Prefer existing prod.env, else example
if [[ -f "$STACK_ENV" ]]; then
  load_env_file "$STACK_ENV"
else
  load_env_file "$EXAMPLE"
fi
# Seed python SECURITY_* defaults without clobbering stack keys
if [[ -f "$PY_ENV" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    case "$line" in
      SECURITY__SECRET_KEY=*|SECURITY__REFRESH_SECRET_KEY=*)
        key="${line%%=*}"
        val="${line#*=}"
        if [[ -z "${!key:-}" || "${!key}" == change-me* ]]; then
          export "$key=$val"
        fi
        ;;
    esac
  done <"$PY_ENV"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  AiControl — init_env (domains, DB, secrets, runtime)"
echo "═══════════════════════════════════════════════════════════"
echo "  Root: $ROOT"
echo ""

# ── 1. Domains ───────────────────────────────────────────────────────

echo "── 1/6 Domains ──"
ask DOMAIN "DOMAIN (frontend site)" "${DOMAIN:-app.example.com}"
ask DOMAIN_API "DOMAIN_API (API host)" "${DOMAIN_API:-api.example.com}"
ask USE_HTTPS "USE_HTTPS (true/false)" "${USE_HTTPS:-true}"

DOMAIN="$(normalize_domain "$DOMAIN")"
DOMAIN_API="$(normalize_domain "$DOMAIN_API")"
[[ -n "$DOMAIN" ]] || die "DOMAIN is required"
[[ -n "$DOMAIN_API" ]] || die "DOMAIN_API is required"

SCHEME="https"
_use_https_lc="$(printf '%s' "$USE_HTTPS" | tr '[:upper:]' '[:lower:]')"
case "$_use_https_lc" in
  false|0|no|off) SCHEME="http"; USE_HTTPS=false ;;
  *) USE_HTTPS=true; SCHEME="https" ;;
esac

PUBLIC_ORIGIN="${SCHEME}://${DOMAIN}"
API_ORIGIN="${SCHEME}://${DOMAIN_API}"
CORS_ORIGINS="$PUBLIC_ORIGIN"
BACKEND_CORS_ORIGINS="$PUBLIC_ORIGIN"
SECURITY__CSRF_ENABLED=true
SECURITY__CSRF_COOKIE_NAME=csrf_token
SECURITY__CSRF_HEADER_NAME=X-CSRF-Token
# Optional: shared cookie domain for SPA+API subdomains, e.g. ".example.com" (leading dot).
SECURITY__CSRF_COOKIE_DOMAIN="${SECURITY__CSRF_COOKIE_DOMAIN:-}"

echo "  PUBLIC_ORIGIN=$PUBLIC_ORIGIN"
echo "  API_ORIGIN=$API_ORIGIN"
echo ""

# ── 2. Postgres ──────────────────────────────────────────────────────

echo "── 2/6 Postgres ──"
ask PG_HOST "PG_HOST" "${PG_HOST:-127.0.0.1}"
ask PG_PORT "PG_PORT" "${PG_PORT:-5432}"
ask PG_USER "PG_USER" "${PG_USER:-ai_control_user}"
ask PG_PASSWORD "PG_PASSWORD" "${PG_PASSWORD:-}"
ask PG_DB_APP "PG_DB_APP" "${PG_DB_APP:-ai_control}"
ask PG_DB_API "PG_DB_API" "${PG_DB_API:-ai_control_api}"
ask PG_DB_MAIL "PG_DB_MAIL" "${PG_DB_MAIL:-mail_message}"
echo ""

# ── 3. Redis ─────────────────────────────────────────────────────────

echo "── 3/6 Redis ──"
ask REDIS_HOST "REDIS_HOST" "${REDIS_HOST:-127.0.0.1}"
ask REDIS_PORT "REDIS_PORT" "${REDIS_PORT:-6379}"
REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}/0"
echo "  REDIS_URL=$REDIS_URL"
echo ""

# ── 4. Secrets ───────────────────────────────────────────────────────

echo "── 4/6 Secrets (Enter=keep, g=generate) ──"
ask_secret JWT_SECRET "JWT_SECRET"
ask_secret INTERNAL_TOKEN "INTERNAL_TOKEN"
ask_secret SIGNALING_DEV_TOKEN "SIGNALING_DEV_TOKEN"
ask_secret SECURITY__SECRET_KEY "SECURITY__SECRET_KEY (python)"
ask_secret SECURITY__REFRESH_SECRET_KEY "SECURITY__REFRESH_SECRET_KEY (python)"
# defaults for python secrets if still empty
[[ -n "${SECURITY__SECRET_KEY:-}" && "${SECURITY__SECRET_KEY}" != change-me* ]] || SECURITY__SECRET_KEY="$(gen_secret)"
[[ -n "${SECURITY__REFRESH_SECRET_KEY:-}" && "${SECURITY__REFRESH_SECRET_KEY}" != change-me* ]] || SECURITY__REFRESH_SECRET_KEY="$(gen_secret)"
echo ""

# ── 5. Listen ports ──────────────────────────────────────────────────

echo "── 5/6 Listen ports ──"
ask FRONTEND_PORT "FRONTEND_PORT" "${FRONTEND_PORT:-3000}"
ask APP__PORT "APP__PORT (python app)" "${APP__PORT:-8000}"
ask API_PORT "API_PORT" "${API_PORT:-8002}"
ask AI_PORT "AI_PORT" "${AI_PORT:-8003}"
ask DASHBOARD_QUERY_LISTEN "DASHBOARD_QUERY_LISTEN" "${DASHBOARD_QUERY_LISTEN:-0.0.0.0:8787}"
ask TASK_REPORTING_LISTEN "TASK_REPORTING_LISTEN" "${TASK_REPORTING_LISTEN:-0.0.0.0:8790}"
ask FILE_PIPELINE_LISTEN "FILE_PIPELINE_LISTEN" "${FILE_PIPELINE_LISTEN:-0.0.0.0:8791}"
ask MAIL_MESSAGE_MANAGER_LISTEN "MAIL_MESSAGE_MANAGER_LISTEN" "${MAIL_MESSAGE_MANAGER_LISTEN:-0.0.0.0:8792}"
ask SCHEDULE_SYSTEM_LISTEN "SCHEDULE_SYSTEM_LISTEN" "${SCHEDULE_SYSTEM_LISTEN:-0.0.0.0:8793}"
ask SIGNALING_BIND "SIGNALING_BIND (PartyHome)" "${SIGNALING_BIND:-0.0.0.0:8989}"
FRONTEND_LISTEN="${FRONTEND_LISTEN:-0.0.0.0}"
APP__HOST="${APP__HOST:-0.0.0.0}"
echo ""

# ── 6. TURN + LiveKit ────────────────────────────────────────────────

echo "── 6/7 TURN (recommended for calls across NAT) ──"
ask_yn USE_TURN "Configure TURN/coturn?"
if [[ "$USE_TURN" == "y" ]]; then
  ask TURN_URLS "TURN_URLS" "${TURN_URLS:-turn:${DOMAIN}:3478?transport=udp,turn:${DOMAIN}:3478?transport=tcp,turns:${DOMAIN}:5349?transport=tcp}"
  ask TURN_USERNAME "TURN_USERNAME" "${TURN_USERNAME:-turnuser}"
  ask_secret TURN_CREDENTIAL "TURN_CREDENTIAL"
else
  TURN_URLS=""
  TURN_USERNAME=""
  TURN_CREDENTIAL=""
fi
echo ""

echo "── 7/7 LiveKit (optional SFU) ──"
ask_yn USE_LIVEKIT "Configure LiveKit?"
if [[ "$USE_LIVEKIT" == "y" ]]; then
  ask LIVEKIT_URL "LIVEKIT_URL (browser-reachable wss://)" "${LIVEKIT_URL:-wss://${DOMAIN}}"
  ask LIVEKIT_API_KEY "LIVEKIT_API_KEY" "${LIVEKIT_API_KEY:-}"
  ask LIVEKIT_API_SECRET "LIVEKIT_API_SECRET" "${LIVEKIT_API_SECRET:-}"
else
  LIVEKIT_URL=""
  LIVEKIT_API_KEY=""
  LIVEKIT_API_SECRET=""
fi
echo ""

# ── derived URLs ─────────────────────────────────────────────────────

PASS_ENC="$(urlencode_pass "$PG_PASSWORD")"
MAIL_DATABASE_URL="postgresql://${PG_USER}:${PASS_ENC}@${PG_HOST}:${PG_PORT}/${PG_DB_MAIL}"
DEV_USERS_DATABASE_URL="postgresql://${PG_USER}:${PASS_ENC}@${PG_HOST}:${PG_PORT}/${PG_DB_APP}"
DATABASE_URL="postgresql://${PG_USER}:${PASS_ENC}@${PG_HOST}:${PG_PORT}/${PG_DB_APP}"
API_DATABASE_URL="postgresql://${PG_USER}:${PASS_ENC}@${PG_HOST}:${PG_PORT}/${PG_DB_API}"
SQLITE_QUERY_RUST__CACHE_REDIS_URL="$REDIS_URL"

AUTH_LOGIN_URL="${API_ORIGIN}/auth/login_user/"
APP_HEALTH_URL="${API_ORIGIN}/health"
API_HEALTH_URL="${API_ORIGIN}/health"
AI_HEALTH_URL="${API_ORIGIN}/health"
REALTIME_SYNC_URL="${REALTIME_SYNC_URL:-http://127.0.0.1:9010/health}"
PARTYHOME_HEALTH_URL="http://127.0.0.1:${SIGNALING_BIND##*:}/health"
MAIL_HEALTH_URL="http://127.0.0.1:${MAIL_MESSAGE_MANAGER_LISTEN##*:}/api/messaging/health"
DASHBOARD_QUERY_URL="http://127.0.0.1:${DASHBOARD_QUERY_LISTEN##*:}/health"

ENVIRONMENT="${ENVIRONMENT:-production}"
JWT_ALGORITHM="${JWT_ALGORITHM:-HS256}"
JWT_NO_EXPIRY="${JWT_NO_EXPIRY:-false}"
RUST_LOG="${RUST_LOG:-info}"
LOGGING__LEVEL="${LOGGING__LEVEL:-INFO}"
SQLITE_QUERY_RUST__ENABLED="${SQLITE_QUERY_RUST__ENABLED:-true}"
SQLITE_QUERY_RUST__BASE_URL="${SQLITE_QUERY_RUST__BASE_URL:-http://127.0.0.1:8787}"
SQLITE_QUERY_RUST__TIMEOUT_SEC="${SQLITE_QUERY_RUST__TIMEOUT_SEC:-120}"
SQLITE_QUERY_RUST__PYTHON_FALLBACK_ON_TIMEOUT="${SQLITE_QUERY_RUST__PYTHON_FALLBACK_ON_TIMEOUT:-false}"
SQLITE_QUERY_RUST__CACHE_ENABLED="${SQLITE_QUERY_RUST__CACHE_ENABLED:-true}"
RTSYNC_CONFIG="${RTSYNC_CONFIG:-share/realtime-sync/config.toml}"
DATA_MODELS_DIR="${DATA_MODELS_DIR:-data/data_models}"
SCHEDULE_DB_PATH="${SCHEDULE_DB_PATH:-data/schedule.db}"
UPLOADS_ROOT="${UPLOADS_ROOT:-data/uploads}"
STUN_URLS="${STUN_URLS:-stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478}"

# ── confirm ──────────────────────────────────────────────────────────

if [[ "$YES" -ne 1 ]]; then
  echo "Will write:"
  echo "  $STACK_ENV"
  echo "  $RUNTIME_JS"
  [[ -f "$PY_ENV" ]] && echo "  patch $PY_ENV"
  ask_yn CONFIRM "Continue?"
  [[ "$CONFIRM" == "y" ]] || { echo "Aborted."; exit 1; }
fi

# ── write prod.env atomically ────────────────────────────────────────

TMP="$(mktemp)"
{
  cat <<EOF
# Generated by init_env.sh — $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Do not commit secrets.

# ── Domains ─────────────────────────────────────────────────────────
DOMAIN=${DOMAIN}
DOMAIN_API=${DOMAIN_API}
USE_HTTPS=${USE_HTTPS}
PUBLIC_ORIGIN=${PUBLIC_ORIGIN}
API_ORIGIN=${API_ORIGIN}
CORS_ORIGINS=${CORS_ORIGINS}
BACKEND_CORS_ORIGINS=${BACKEND_CORS_ORIGINS}
SECURITY__CSRF_ENABLED=${SECURITY__CSRF_ENABLED}
SECURITY__CSRF_COOKIE_NAME=${SECURITY__CSRF_COOKIE_NAME}
SECURITY__CSRF_HEADER_NAME=${SECURITY__CSRF_HEADER_NAME}
SECURITY__CSRF_COOKIE_DOMAIN=${SECURITY__CSRF_COOKIE_DOMAIN}

# ── Shared ──────────────────────────────────────────────────────────
ENVIRONMENT=${ENVIRONMENT}
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=${JWT_ALGORITHM}
JWT_NO_EXPIRY=${JWT_NO_EXPIRY}
INTERNAL_TOKEN=${INTERNAL_TOKEN}
RUST_LOG=${RUST_LOG}

# Postgres
PG_HOST=${PG_HOST}
PG_PORT=${PG_PORT}
PG_USER=${PG_USER}
PG_PASSWORD=${PG_PASSWORD}
PG_DB_APP=${PG_DB_APP}
PG_DB_API=${PG_DB_API}
PG_DB_MAIL=${PG_DB_MAIL}

# Redis
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
REDIS_URL=${REDIS_URL}

# ── Python ──────────────────────────────────────────────────────────
APP__HOST=${APP__HOST}
APP__PORT=${APP__PORT}
API_PORT=${API_PORT}
AI_PORT=${AI_PORT}
LOGGING__LEVEL=${LOGGING__LEVEL}
SQLITE_QUERY_RUST__ENABLED=${SQLITE_QUERY_RUST__ENABLED}
SQLITE_QUERY_RUST__BASE_URL=${SQLITE_QUERY_RUST__BASE_URL}
SQLITE_QUERY_RUST__TIMEOUT_SEC=${SQLITE_QUERY_RUST__TIMEOUT_SEC}
SQLITE_QUERY_RUST__PYTHON_FALLBACK_ON_TIMEOUT=${SQLITE_QUERY_RUST__PYTHON_FALLBACK_ON_TIMEOUT}
SQLITE_QUERY_RUST__CACHE_ENABLED=${SQLITE_QUERY_RUST__CACHE_ENABLED}
SQLITE_QUERY_RUST__CACHE_REDIS_URL=${SQLITE_QUERY_RUST__CACHE_REDIS_URL}

# ── Frontend ────────────────────────────────────────────────────────
FRONTEND_LISTEN=${FRONTEND_LISTEN}
FRONTEND_PORT=${FRONTEND_PORT}

# ── Sidecars ────────────────────────────────────────────────────────
DASHBOARD_QUERY_LISTEN=${DASHBOARD_QUERY_LISTEN}
RTSYNC_CONFIG=${RTSYNC_CONFIG}
TASK_REPORTING_LISTEN=${TASK_REPORTING_LISTEN}
FILE_PIPELINE_LISTEN=${FILE_PIPELINE_LISTEN}
MAIL_MESSAGE_MANAGER_LISTEN=${MAIL_MESSAGE_MANAGER_LISTEN}
MAIL_DATABASE_URL=${MAIL_DATABASE_URL}
DEV_USERS_DATABASE_URL=${DEV_USERS_DATABASE_URL}
SCHEDULE_SYSTEM_LISTEN=${SCHEDULE_SYSTEM_LISTEN}
DATABASE_URL=${DATABASE_URL}
API_DATABASE_URL=${API_DATABASE_URL}
DATA_MODELS_DIR=${DATA_MODELS_DIR}
SCHEDULE_DB_PATH=${SCHEDULE_DB_PATH}
UPLOADS_ROOT=${UPLOADS_ROOT}
AUTH_LOGIN_URL=${AUTH_LOGIN_URL}
REALTIME_SYNC_URL=${REALTIME_SYNC_URL}
PARTYHOME_HEALTH_URL=${PARTYHOME_HEALTH_URL}
APP_HEALTH_URL=${APP_HEALTH_URL}
API_HEALTH_URL=${API_HEALTH_URL}
AI_HEALTH_URL=${AI_HEALTH_URL}
MAIL_HEALTH_URL=${MAIL_HEALTH_URL}
DASHBOARD_QUERY_URL=${DASHBOARD_QUERY_URL}

# ── PartyHome ───────────────────────────────────────────────────────
SIGNALING_BIND=${SIGNALING_BIND}
SIGNALING_DEV_TOKEN=${SIGNALING_DEV_TOKEN}
STUN_URLS=${STUN_URLS}
EOF
  if [[ -n "${TURN_URLS:-}" && -n "${TURN_USERNAME:-}" && -n "${TURN_CREDENTIAL:-}" ]]; then
    cat <<EOF
TURN_URLS=${TURN_URLS}
TURN_USERNAME=${TURN_USERNAME}
TURN_CREDENTIAL=${TURN_CREDENTIAL}
EOF
  fi
  if [[ -n "${LIVEKIT_URL:-}" ]]; then
    cat <<EOF
LIVEKIT_URL=${LIVEKIT_URL}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
EOF
  fi
} >"$TMP"

mv "$TMP" "$STACK_ENV"
chmod 600 "$STACK_ENV"
echo "Wrote $STACK_ENV"

# ── runtime-config.js ────────────────────────────────────────────────

mkdir -p "$(dirname "$RUNTIME_JS")"
python3 - "$RUNTIME_JS" "$API_ORIGIN" "$PUBLIC_ORIGIN" "${SIGNALING_DEV_TOKEN:-dev}" <<'PY'
import json, sys
path, api, pub, token = sys.argv[1:5]
open(path, "w", encoding="utf-8").write(
    "/* Generated by init_env.sh — do not edit by hand */\n"
    "window.__AICONTROL_RUNTIME__ = {\n"
    f"  apiBase: {json.dumps(api)},\n"
    f"  publicOrigin: {json.dumps(pub)},\n"
    f"  partyhomeToken: {json.dumps(token)}\n"
    "};\n"
)
PY
echo "Wrote $RUNTIME_JS"

# ── patch python prod.env ────────────────────────────────────────────

if [[ -f "$PY_ENV" ]]; then
  set_kv_file "$PY_ENV" "DATABASE__HOST" "$PG_HOST"
  set_kv_file "$PY_ENV" "DATABASE__PORT" "$PG_PORT"
  set_kv_file "$PY_ENV" "DATABASE__USER" "$PG_USER"
  set_kv_file "$PY_ENV" "DATABASE__PASSWORD" "$PG_PASSWORD"
  set_kv_file "$PY_ENV" "DATABASE__DB_NAME" "$PG_DB_APP"
  set_kv_file "$PY_ENV" "CORS_ORIGINS" "$CORS_ORIGINS"
  set_kv_file "$PY_ENV" "BACKEND_CORS_ORIGINS" "$BACKEND_CORS_ORIGINS"
  set_kv_file "$PY_ENV" "SECURITY__CSRF_ENABLED" "${SECURITY__CSRF_ENABLED:-true}"
  set_kv_file "$PY_ENV" "SECURITY__CSRF_COOKIE_NAME" "${SECURITY__CSRF_COOKIE_NAME:-csrf_token}"
  set_kv_file "$PY_ENV" "SECURITY__CSRF_HEADER_NAME" "${SECURITY__CSRF_HEADER_NAME:-X-CSRF-Token}"
  set_kv_file "$PY_ENV" "SECURITY__CSRF_COOKIE_DOMAIN" "${SECURITY__CSRF_COOKIE_DOMAIN:-}"
  set_kv_file "$PY_ENV" "APP__FRONTEND_HOST" "$DOMAIN"
  set_kv_file "$PY_ENV" "APP__FRONTEND_PROTOCOL" "$SCHEME"
  if [[ "$USE_HTTPS" == "true" ]]; then
    set_kv_file "$PY_ENV" "APP__FRONTEND_PORT" "443"
  else
    set_kv_file "$PY_ENV" "APP__FRONTEND_PORT" "80"
  fi
  set_kv_file "$PY_ENV" "REACT_APP_API_URL" "$API_ORIGIN"
  set_kv_file "$PY_ENV" "SECURITY__SECRET_KEY" "$SECURITY__SECRET_KEY"
  set_kv_file "$PY_ENV" "SECURITY__REFRESH_SECRET_KEY" "$SECURITY__REFRESH_SECRET_KEY"
  set_kv_file "$PY_ENV" "REDIS_HOST" "$REDIS_HOST"
  set_kv_file "$PY_ENV" "REDIS_PORT" "$REDIS_PORT"
  set_kv_file "$PY_ENV" "REDIS_URL" "$REDIS_URL"
  set_kv_file "$PY_ENV" "APP__HOST" "$APP__HOST"
  set_kv_file "$PY_ENV" "APP__PORT" "$APP__PORT"
  echo "Patched $PY_ENV"
else
  echo "warn: python prod.env not found at $PY_ENV (skip patch)" >&2
fi

echo ""
echo "Done. Next: ./run.sh up"
echo "  Frontend: $PUBLIC_ORIGIN  (or http://HOST:${FRONTEND_PORT})"
echo "  API base: $API_ORIGIN"
  echo "  Developer API docs: ${PUBLIC_ORIGIN}/developer-api-docs"
  echo "  DataCode docs: ${PUBLIC_ORIGIN}/datacode-docs"
echo "  Developer API ingest: ${API_ORIGIN}/ext/api/v1/ingest/..."
