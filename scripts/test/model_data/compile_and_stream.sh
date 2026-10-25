#!/usr/bin/env bash
# Заливает данные в API-источники, затем компилирует модель (DataCode → SQLite).
#
# Порядок важен: source_table("orders") резолвится только после ingest
# (данные в persistent store → rehydrate в DCP при compile).
#
# Предусловие: create_model.py уже выполнен (есть output/credentials.json).
#
# Примеры:
#   ./scripts/test/model_data/compile_and_stream.sh
#   ./scripts/test/model_data/compile_and_stream.sh --env dev
#   ./scripts/test/model_data/compile_and_stream.sh --stream --iterations 10
#   ./scripts/test/model_data/compile_and_stream.sh --skip-initial --stream

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SRC_DIR="${REPO_ROOT}/py-worm"

ENV="dev"
CREDENTIALS="${SCRIPT_DIR}/output/credentials.json"
STREAM_ARGS=()
SKIP_COMPILE=0
SKIP_STREAM=0

usage() {
  cat <<'EOF'
Usage: compile_and_stream.sh [options] [-- stream_args...]

Options:
  --env dev|prod          Окружение (default: dev)
  --credentials PATH      Путь к credentials.json
  --skip-compile          Только stream, без compile
  --skip-stream           Только compile (нужен уже сделанный ingest)
  -h, --help              Справка

Аргументы после опций / после -- передаются в stream_data.py, например:
  --stream --append --iterations 5
  --skip-initial --stream

По умолчанию:
  1) stream_data: initial ingest + --stream --append --iterations 3
  2) compile_model
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="$2"
      shift 2
      ;;
    --credentials)
      CREDENTIALS="$2"
      shift 2
      ;;
    --skip-compile)
      SKIP_COMPILE=1
      shift
      ;;
    --skip-stream)
      SKIP_STREAM=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      STREAM_ARGS+=("$@")
      break
      ;;
    *)
      STREAM_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ ! -f "${CREDENTIALS}" ]]; then
  echo "compile_and_stream: credentials not found: ${CREDENTIALS}" >&2
  echo "Run: cd py-worm && poetry run python ../scripts/test/model_data/create_model.py --env ${ENV}" >&2
  exit 1
fi

if [[ ${#STREAM_ARGS[@]} -eq 0 ]]; then
  STREAM_ARGS=(--stream --append --iterations 3)
fi

COMMON_ARGS=(--env "${ENV}" --credentials "${CREDENTIALS}")

cd "${SRC_DIR}"

if [[ "${SKIP_STREAM}" -eq 0 ]]; then
  echo "=== stream_data (ingest before compile) ==="
  poetry run python "${SCRIPT_DIR}/stream_data.py" "${COMMON_ARGS[@]}" "${STREAM_ARGS[@]}"
  echo ""
fi

if [[ "${SKIP_COMPILE}" -eq 0 ]]; then
  echo "=== compile_model ==="
  poetry run python "${SCRIPT_DIR}/compile_model.py" "${COMMON_ARGS[@]}"
  echo ""
fi

echo "compile_and_stream: OK"
