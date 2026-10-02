#!/usr/bin/env bash
# Migrate Python uploads from python/src/uploads → data/uploads (prod tree).
#
# Moves avatars / projects / tasks files, sets UPLOADS_ROOT in prod.env,
# and rewrites absolute filesystem paths in PostgreSQL.
#
# Avatars in DB stay as /static/avatars/... (URL unchanged).
#
# Usage (on server, from prod root e.g. ~/2a_prod/prod):
#   ./fix_uplods_dir_server.sh --dry-run
#   ./fix_uplods_dir_server.sh -y
#
# Recommended:
#   ./run.sh stop
#   ./fix_uplods_dir_server.sh -y
#   ./run.sh up
#
# Env:
#   PROD_ENV_FILE   default: <dist>/prod.env
#   DIST_DIR        prod root if script is not inside it
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/MANIFEST.txt" && -d "$SCRIPT_DIR/python" ]]; then
  DIST="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../MANIFEST.txt" && -d "$SCRIPT_DIR/../python" ]]; then
  DIST="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [[ -f "$SCRIPT_DIR/../../MANIFEST.txt" && -d "$SCRIPT_DIR/../../python" ]]; then
  DIST="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  DIST="${DIST_DIR:-}"
fi

if [[ -z "${DIST:-}" || ! -d "$DIST/python" ]]; then
  echo "error: cannot find prod root (set DIST_DIR or run from dist/prod)" >&2
  exit 1
fi

ENV_FILE="${PROD_ENV_FILE:-$DIST/prod.env}"
OLD_UPLOADS="$DIST/python/src/uploads"
NEW_UPLOADS="$DIST/data/uploads"

DRY_RUN=0
ASSUME_YES=0

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

  --dry-run   show actions only
  -y, --yes   do not ask for confirmation
  -h, --help  this help

DIST=$DIST
OLD=$OLD_UPLOADS
NEW=$NEW_UPLOADS
ENV=$ENV_FILE
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -y | --yes) ASSUME_YES=1 ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    die "missing $ENV_FILE"
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  DATABASE_URL="${DATABASE_URL:-}"
  [[ -n "$DATABASE_URL" ]] || die "DATABASE_URL not set in $ENV_FILE"
}

count_files() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo 0
    return
  fi
  find "$dir" -type f 2>/dev/null | wc -l | tr -d ' '
}

merge_uploads() {
  local old="$1" new="$2"
  if [[ ! -d "$old" ]]; then
    warn "source missing: $old (nothing to move)"
    return 0
  fi
  local n
  n="$(count_files "$old")"
  log "Moving $n file(s): $old → $new"
  run mkdir -p "$new/avatars" "$new/projects" "$new/tasks"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a "$old/" "$new/"
  else
    run cp -a "$old/." "$new/"
  fi
  ok "files merged into $new"
}

backup_old_uploads() {
  local old="$1"
  if [[ ! -d "$old" ]]; then
    return 0
  fi
  local backup="${old}.bak.$(date +%Y%m%d%H%M%S)"
  log "Renaming old uploads dir → $backup"
  run mv "$old" "$backup"
  ok "old dir renamed (remove manually after verification)"
}

patch_prod_env() {
  local key="UPLOADS_ROOT"
  local val="data/uploads"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if grep -qE "^${key}=${val}$" "$ENV_FILE"; then
      ok "$ENV_FILE already has ${key}=${val}"
      return 0
    fi
    log "Updating ${key} in $ENV_FILE"
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "[dry-run] sed -i update ${key}=${val} in $ENV_FILE"
      return 0
    fi
    local tmp
    tmp="$(mktemp)"
    sed -E "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    log "Appending ${key}=${val} to $ENV_FILE"
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "[dry-run] echo ${key}=${val} >> $ENV_FILE"
      return 0
    fi
    printf '\nUPLOADS_ROOT=%s\n' "$val" >>"$ENV_FILE"
  fi
  ok "prod.env patched"
}

update_db_paths() {
  local old_abs new_abs
  old_abs="$(cd "$OLD_UPLOADS" 2>/dev/null && pwd || true)"
  new_abs="$(cd "$DIST/data" && pwd)/uploads"

  if [[ -z "$old_abs" || ! -d "$OLD_UPLOADS" ]]; then
    # Old dir may already be renamed; still fix rows that mention python/src/uploads
    old_abs="$DIST/python/src/uploads"
  fi

  local old_esc new_esc old_rel_esc
  old_esc="$(sql_escape "$old_abs")"
  new_esc="$(sql_escape "$new_abs")"
  old_rel_esc="$(sql_escape "python/src/uploads")"

  log "Updating DB paths: $old_abs → $new_abs"

  local sql
  sql=$(cat <<EOSQL
BEGIN;

UPDATE project_attachments
SET storage_path = REPLACE(storage_path, '${old_esc}', '${new_esc}')
WHERE storage_path LIKE '%${old_esc}%';

UPDATE project_attachments
SET storage_path = REPLACE(storage_path, '${old_rel_esc}', 'data/uploads')
WHERE storage_path LIKE '%${old_rel_esc}%';

UPDATE files
SET file_path = REPLACE(file_path, '${old_esc}', '${new_esc}')
WHERE file_path LIKE '%${old_esc}%';

UPDATE files
SET file_path = REPLACE(file_path, '${old_rel_esc}', 'data/uploads')
WHERE file_path LIKE '%${old_rel_esc}%';

-- Legacy relative avatar filesystem paths (if any were stored)
UPDATE users
SET avatar = REPLACE(avatar, 'uploads/avatars/', '/static/avatars/')
WHERE avatar LIKE 'uploads/avatars/%';

UPDATE ai_agent_configs
SET avatar_path = REPLACE(avatar_path, 'uploads/avatars/', '/static/avatars/')
WHERE avatar_path LIKE 'uploads/avatars/%';

COMMIT;
EOSQL
)

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] psql DATABASE_URL <<SQL"
    echo "$sql"
    echo "SQL"
    return 0
  fi

  if ! command -v psql >/dev/null 2>&1; then
    die "psql not found — install postgresql-client"
  fi

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"

  local counts
  counts="$(psql "$DATABASE_URL" -tAc "
    SELECT
      (SELECT COUNT(*) FROM project_attachments WHERE storage_path LIKE '%data/uploads%')::text
      || ' project_attachments, '
      || (SELECT COUNT(*) FROM files WHERE file_path LIKE '%data/uploads%')::text
      || ' files'
  ")"
  ok "DB updated ($counts with data/uploads paths)"
}

main() {
  echo "AiControl — migrate uploads to data/"
  echo "DIST=$DIST"
  echo "OLD=$OLD_UPLOADS"
  echo "NEW=$NEW_UPLOADS"
  echo

  load_env

  local old_count new_count
  old_count="$(count_files "$OLD_UPLOADS")"
  new_count="$(count_files "$NEW_UPLOADS")"
  echo "Files in old dir: $old_count"
  echo "Files in new dir: $new_count"
  echo

  if [[ "$old_count" == "0" && "$new_count" -gt "0" ]]; then
    warn "old uploads empty, new dir already has files — skipping file move"
  else
    if [[ "$ASSUME_YES" != "1" && "$DRY_RUN" != "1" ]]; then
      read -r -p "Stop services first (./run.sh stop). Continue migration? [y/N] " ans || true
      [[ "${ans:-}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
    fi
    merge_uploads "$OLD_UPLOADS" "$NEW_UPLOADS"
    backup_old_uploads "$OLD_UPLOADS"
  fi

  patch_prod_env
  update_db_paths

  echo
  ok "Migration complete"
  cat <<EOF

Next:
  1. Deploy updated Python code (UPLOADS_ROOT support).
  2. ./run.sh up
  3. Verify avatars: curl -I https://<api>/static/avatars/<file>
  4. Remove ${OLD_UPLOADS}.bak.* after checks.

EOF
}

main
