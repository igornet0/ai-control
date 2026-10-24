#!/usr/bin/env bash
# Build AiControl production artifacts for linux/amd64 inside Docker.
# Designed for macOS arm64 hosts (Docker Desktop + qemu), also works on Linux.
#
# Usage:
#   scripts/build-prod-docker.sh              # all
#   scripts/build-prod-docker.sh rust         # rust only
#   scripts/build-prod-docker.sh frontend|python|env|clean
#
# Env:
#   DIST_DIR              host output (default: <repo>/dist/prod)
#   DOCKER_PLATFORM       default: linux/amd64
#   BUILD_IMAGE           default: aicontrol-build-prod
#   BUILD_DOCKERFILE      default: deployment/docker/Dockerfile.build-prod
#   FORCE_IMAGE_REBUILD=1 rebuild builder image even if present
#   SKIP_NPM_CI           passed through (default unset → npm ci in container)
#   FORCE_PROD_ENV        passed through
#   CARGO_TARGET          default: x86_64-unknown-linux-gnu
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT/dist/prod}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
BUILD_IMAGE="${BUILD_IMAGE:-aicontrol-build-prod}"
BUILD_DOCKERFILE="${BUILD_DOCKERFILE:-$ROOT/deployment/docker/Dockerfile.build-prod}"
TARGET="${1:-all}"

# Keep linux objects under target/<triple>/ so they do not clash with host
# macOS target/release on the same bind mount.
CARGO_TARGET="${CARGO_TARGET:-x86_64-unknown-linux-gnu}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log() { echo "${BLUE}==>${NC} $*"; }
ok() { echo "${GREEN}✓${NC} $*"; }
die() { echo "${RED}error:${NC} $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

need docker
[[ -f "$BUILD_DOCKERFILE" ]] || die "missing Dockerfile: $BUILD_DOCKERFILE"
[[ -f "$ROOT/scripts/build-prod.sh" ]] || die "missing scripts/build-prod.sh"

ensure_image() {
  if [[ "${FORCE_IMAGE_REBUILD:-0}" == "1" ]] \
    || ! docker image inspect "$BUILD_IMAGE" >/dev/null 2>&1; then
    log "Building builder image $BUILD_IMAGE ($DOCKER_PLATFORM)"
    # Context is only the Dockerfile directory (image has toolchains; source is bind-mounted).
    docker build \
      --platform "$DOCKER_PLATFORM" \
      -f "$BUILD_DOCKERFILE" \
      -t "$BUILD_IMAGE" \
      "$(dirname "$BUILD_DOCKERFILE")"
    ok "image $BUILD_IMAGE"
  else
    log "Reusing image $BUILD_IMAGE (FORCE_IMAGE_REBUILD=1 to rebuild)"
  fi
}

ensure_image
mkdir -p "$DIST_DIR"

VOLUME_REGISTRY="${BUILD_IMAGE}-cargo-registry"
VOLUME_GIT="${BUILD_IMAGE}-cargo-git"
VERSION="${VERSION:-1}"
VERSION="${VERSION#version=}"
if [[ "$VERSION" == "2" ]]; then
  FRONT_REL="V.C.2.front-ai-control"
else
  FRONT_REL="V.1.front-ai-control"
fi
VOLUME_NPM="${BUILD_IMAGE}-node-modules-v${VERSION}"

# Prefer writing through the repo bind-mount to avoid nested-volume surprises
# when DIST_DIR is the default <repo>/dist/prod.
DOCKER_ARGS=(
  --rm
  --platform "$DOCKER_PLATFORM"
  -v "$ROOT:/work"
  -v "$VOLUME_REGISTRY:/usr/local/cargo/registry"
  -v "$VOLUME_GIT:/usr/local/cargo/git"
  -v "$VOLUME_NPM:/work/$FRONT_REL/node_modules"
  -e VERSION="$VERSION"
  -e CARGO_TARGET="$CARGO_TARGET"
  -e SKIP_NPM_CI="${SKIP_NPM_CI:-}"
  -e FORCE_PROD_ENV="${FORCE_PROD_ENV:-}"
  -w /work
)

ABS_DIST="$(cd "$DIST_DIR" && pwd)"
ABS_DEFAULT="$(mkdir -p "$ROOT/dist/prod" && cd "$ROOT/dist/prod" && pwd)"
if [[ "$ABS_DIST" == "$ABS_DEFAULT" ]]; then
  DOCKER_ARGS+=(-e DIST_DIR=/work/dist/prod)
else
  DOCKER_ARGS+=(-v "$ABS_DIST:/out" -e DIST_DIR=/out)
fi

log "Docker build: version=$VERSION platform=$DOCKER_PLATFORM cmd=$TARGET cargo=$CARGO_TARGET"
log "Output: $DIST_DIR"

docker run "${DOCKER_ARGS[@]}" \
  "$BUILD_IMAGE" \
  ./scripts/build-prod.sh "$TARGET"

ok "linux/amd64 build finished → $DIST_DIR"
if [[ -d "$DIST_DIR/bin" ]] && command -v file >/dev/null 2>&1; then
  log "Binary formats (expect ELF x86-64 for Rust sidecars):"
  file "$DIST_DIR"/bin/* 2>/dev/null || true
fi
