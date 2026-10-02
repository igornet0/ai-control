#!/usr/bin/env bash
# Создаёт дашборд с листами и всеми типами виджетов на основе model_data.
#
# Предусловие: модель создана (scripts/test/model_data/output/credentials.json).
# Желательно уже скомпилирована: ./scripts/test/model_data/compile_and_stream.sh
#
# Примеры:
#   ./scripts/test/dashboard/create_dashboard.sh
#   ./scripts/test/dashboard/create_dashboard.sh --env dev
#   ./scripts/test/dashboard/create_dashboard.sh --dashboard-name "My test dash"
#   ./scripts/test/dashboard/create_dashboard.sh --model-id 42 --verify

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SRC_DIR="${REPO_ROOT}/src"

ENV="dev"
MODEL_CREDENTIALS="${SCRIPT_DIR}/../model_data/output/credentials.json"
OUTPUT="${SCRIPT_DIR}/output/credentials.json"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
DASHBOARD_NAME=""
MODEL_ID=""
VERIFY=0

usage() {
  cat <<'EOF'
Usage: create_dashboard.sh [options]

Options:
  --env dev|prod              Окружение (default: dev)
  --model-credentials PATH    credentials.json модели (model_data)
  --output PATH               Куда писать dashboard credentials.json
  --admin-email EMAIL         Логин control-plane (иначе из credentials/settings)
  --admin-password PASS       Пароль control-plane
  --dashboard-name NAME       Имя дашборда (иначе с timestamp)
  --model-id ID               Override model_id из credentials
  --verify                    После создания запустить verify_dashboard.py
  -h, --help                  Справка

Предусловие:
  cd src && poetry run python ../scripts/test/model_data/create_model.py --env dev
  ./scripts/test/model_data/compile_and_stream.sh --env dev
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="$2"
      shift 2
      ;;
    --model-credentials)
      MODEL_CREDENTIALS="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="$2"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    --dashboard-name)
      DASHBOARD_NAME="$2"
      shift 2
      ;;
    --model-id)
      MODEL_ID="$2"
      shift 2
      ;;
    --verify)
      VERIFY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "create_dashboard.sh: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${MODEL_CREDENTIALS}" ]]; then
  echo "create_dashboard.sh: model credentials not found: ${MODEL_CREDENTIALS}" >&2
  echo "Run: cd src && poetry run python ../scripts/test/model_data/create_model.py --env ${ENV}" >&2
  exit 1
fi

ARGS=(
  --env "${ENV}"
  --model-credentials "${MODEL_CREDENTIALS}"
  --output "${OUTPUT}"
)

if [[ -n "${ADMIN_EMAIL}" ]]; then
  ARGS+=(--admin-email "${ADMIN_EMAIL}")
fi
if [[ -n "${ADMIN_PASSWORD}" ]]; then
  ARGS+=(--admin-password "${ADMIN_PASSWORD}")
fi
if [[ -n "${DASHBOARD_NAME}" ]]; then
  ARGS+=(--dashboard-name "${DASHBOARD_NAME}")
fi
if [[ -n "${MODEL_ID}" ]]; then
  ARGS+=(--model-id "${MODEL_ID}")
fi

cd "${SRC_DIR}"

echo "=== create_dashboard ==="
poetry run python "${SCRIPT_DIR}/create_dashboard.py" "${ARGS[@]}"
echo ""

if [[ "${VERIFY}" -eq 1 ]]; then
  echo "=== verify_dashboard ==="
  poetry run python "${SCRIPT_DIR}/verify_dashboard.py" \
    --env "${ENV}" \
    --credentials "${OUTPUT}"
  echo ""
fi

echo "create_dashboard.sh: OK"
