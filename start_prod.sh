#!/usr/bin/env bash
# Compatibility wrapper — prefer: make -f Makefile.build up  or  ./scripts/run-prod.sh up
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/scripts/run-prod.sh" "${1:-up}"
