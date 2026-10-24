#!/usr/bin/env bash
# AiControl V1 в Docker на минимальном железе: 1 CPU / 1 GB на ВСЮ платформу.
#
#   scripts/v1-min.sh build     — фронт (на хосте) + образы, строго по одному (иначе OOM в VM)
#   scripts/v1-min.sh seed      — дампы dev-БД с хоста + копия data_models/uploads в тома
#   scripts/v1-min.sh limits    — общий cgroup /aicontrol-v1: cpu.max=1 CPU, memory.max=1G, swap=0
#   scripts/v1-min.sh up        — limits + compose up + ожидание health
#   scripts/v1-min.sh status    — health всех модулей + потребление бюджета
#   scripts/v1-min.sh benchuser — тестовый пользователь bench_v1 в Docker-БД (для /api/bench)
#   scripts/v1-min.sh down      — остановить (тома сохраняются; down -v — удалить данные)
#   scripts/v1-min.sh all       — build + seed + up
#
# Локальные данные не меняются: БД только читаются pg_dump, data_models монтируется :ro.
# Переопределения: V1_CPU (по умолчанию 1), V1_MEM (1G), HOST_PG (127.0.0.1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/deployment/docker/v1-min"
export V1_DIR="$DIR"
COMPOSE=(docker compose -f "$DIR/docker-compose.v1-min.yml")
PROJECT=aicv1
CG=aicontrol-v1
V1_CPU="${V1_CPU:-1}"
V1_MEM="${V1_MEM:-1G}"
HOST_PG="${HOST_PG:-127.0.0.1}"
DBS=(ai_control_dev ai_control_api_dev aicontrol_ai_dev mail_message_dev)
# Порядок сборки: сначала мелкие, py-worm последним (самый тяжёлый слой зависимостей).
BUILD_ORDER=(schedule-system dashboard-query realtime-sync task-reporting file-pipeline
             partyhome mail-message-manager aicontrol-ai datacode backend frontend)

log() { printf '\033[1;34m[v1-min]\033[0m %s\n' "$*"; }

cg_exec() {
  docker run --rm --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup \
    debian:bookworm-slim sh -c "$1"
}

cmd_build() {
  log "frontend: npm run build (V.1.front-ai-control)"
  (cd "$ROOT/V.1.front-ai-control" && npm run build >/dev/null)
  for s in "${BUILD_ORDER[@]}"; do
    log "image: $s"
    "${COMPOSE[@]}" build "$s"
  done
}

cmd_seed() {
  mkdir -p "$DIR/seed/dumps"
  local pg_dump; pg_dump="$(command -v pg_dump || echo /opt/homebrew/bin/pg_dump)"
  for db in "${DBS[@]}"; do
    if [[ -f "$DIR/seed/dumps/$db.dump" && "${REFRESH:-0}" != 1 ]]; then
      log "dump $db: есть (REFRESH=1 — пересоздать)"; continue
    fi
    log "dump $db"
    "$pg_dump" -h "$HOST_PG" -U postgres -Fc -Z 6 -f "$DIR/seed/dumps/$db.dump" "$db" \
      || log "WARN: $db не выгружена — будет пустой"
  done
  for vol in data_models uploads; do
    local src="$ROOT/py-worm/$vol"
    [[ -d "$src" ]] || continue
    log "volume ${PROJECT}_$vol ← py-worm/$vol (read-only источник)"
    docker volume create "${PROJECT}_$vol" >/dev/null
    docker run --rm -v "$src:/src:ro" -v "${PROJECT}_$vol:/dst" debian:bookworm-slim \
      sh -c '[ -n "$(ls -A /dst)" ] && echo "  уже заполнен" || cp -a /src/. /dst/'
  done
  fix_links
}

# latest.db в data_models — абсолютные симлинки на путь хоста (…/data_models/_cas/…),
# в контейнере они битые → py-worm отвечает 404 «SQLite database not found».
# Переписываем в относительные внутри тома (только копия, исходник не трогаем).
fix_links() {
  docker run --rm -v "${PROJECT}_data_models:/d" debian:bookworm-slim sh -c '
    cd /d; n=0
    for l in $(find . -type l -lname "/*data_models/*"); do
      rel="${l#./}"; depth=$(printf %s "$rel" | tr -cd / | wc -c); up=""
      i=0; while [ $i -lt $depth ]; do up="../$up"; i=$((i+1)); done
      ln -sfn "$up$(readlink "$l" | sed "s#.*/data_models/##")" "$l"; n=$((n+1))
    done
    echo "  symlinks → relative: $n"'
}

cmd_limits() {
  local quota=$(( V1_CPU * 100000 ))
  log "cgroup /$CG: cpu.max=$quota/100000, memory.max=$V1_MEM, swap=0"
  cg_exec "set -e; mkdir -p /sys/fs/cgroup/$CG
    echo '+cpu +memory +pids +io' > /sys/fs/cgroup/$CG/cgroup.subtree_control || true
    echo '$quota 100000' > /sys/fs/cgroup/$CG/cpu.max
    echo '$V1_MEM' > /sys/fs/cgroup/$CG/memory.max
    echo 0 > /sys/fs/cgroup/$CG/memory.swap.max
    echo -n '  cpu.max='; cat /sys/fs/cgroup/$CG/cpu.max
    echo -n '  memory.max='; cat /sys/fs/cgroup/$CG/memory.max"
}

cmd_status() {
  local -a checks=(
    "nginx/frontend|http://127.0.0.1:3000/nginx-health"
    "py-worm app|http://127.0.0.1:8000/health"
    "py-worm api|http://127.0.0.1:8002/health"
    "aicontrol-ai|http://127.0.0.1:8003/health"
    "dashboard-query|http://127.0.0.1:8787/health"
    "task-reporting|http://127.0.0.1:8790/health"
    "file-pipeline|http://127.0.0.1:8791/health"
    "mail-message-manager|http://127.0.0.1:8792/api/messaging/health"
    "schedule-system|http://127.0.0.1:8793/health"
    "partyhome|http://127.0.0.1:8989/health"
    "realtime-sync|http://127.0.0.1:9010/health"
  )
  local script=""
  for c in "${checks[@]}"; do
    script+="printf '%-22s ' '${c%%|*}'; curl -s -o /dev/null -m 3 -w '%{http_code}\n' '${c#*|}' || echo DOWN;"
  done
  script+="printf '%-22s ' datacode:8899; (exec 3<>/dev/tcp/127.0.0.1/8899) 2>/dev/null && echo open || echo DOWN"
  "${COMPOSE[@]}" exec -T schedule-system bash -c "$script"
  cg_exec "cd /sys/fs/cgroup/$CG; echo; echo \"budget: memory.current=\$((\$(cat memory.current)/1048576))MiB / max=\$(cat memory.max) peak=\$((\$(cat memory.peak 2>/dev/null || echo 0)/1048576))MiB\";
    echo \"cpu.max=\$(cat cpu.max)  \$(grep -E 'usage_usec|nr_throttled|throttled_usec' cpu.stat | tr '\n' ' ')\";
    grep -E '^(oom|oom_kill) ' memory.events | tr '\n' ' '; echo"
}

# Тестовый пользователь для бенчмарка ScheduleSystem — только в Docker-копии БД.
# Пароль генерируется и хранится в deployment/docker/v1-min/.bench.env (gitignored).
cmd_benchuser() {
  local envf="$DIR/.bench.env" pw
  if [[ -f "$envf" ]]; then pw="$(sed -n 's/^BENCH_PASSWORD=//p' "$envf")"
  else pw="$(openssl rand -hex 12)"; printf 'BENCH_LOGIN=bench_v1\nBENCH_PASSWORD=%s\n' "$pw" > "$envf"; chmod 600 "$envf"; fi
  local hash
  hash="$("${COMPOSE[@]}" exec -T -e PW="$pw" backend python -c \
    'import bcrypt,os;print(bcrypt.hashpw(os.environ["PW"].encode(),bcrypt.gensalt()).decode())')"
  "${COMPOSE[@]}" exec -T postgres psql -h 127.0.0.1 -U postgres -d ai_control_dev -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO users (login,name,password,email,balance,role,team_role,is_active,is_superuser,is_verified,is_2fa_enabled,is_2fa_verified,created,updated)
     VALUES ('bench_v1','Bench V1','$hash','bench_v1@bench.test',0,'admin','CTO',true,true,true,false,false,now(),now())
     ON CONFLICT (login) DO UPDATE SET password=EXCLUDED.password, is_active=true;"
  log "bench user bench_v1 готов (пароль в ${envf#$ROOT/})"
}

wait_healthy() {
  log "ожидание старта (до 10 мин: восстановление БД на 1 CPU небыстрое)…"
  for _ in $(seq 1 120); do
    if "${COMPOSE[@]}" exec -T schedule-system curl -sf -m 3 http://127.0.0.1:8000/health >/dev/null 2>&1 \
       && "${COMPOSE[@]}" exec -T schedule-system curl -sf -m 3 http://127.0.0.1:3000/nginx-health >/dev/null 2>&1; then
      log "платформа поднялась"; return 0
    fi
    sleep 5
  done
  log "WARN: py-worm не ответил за 10 минут — см. ${COMPOSE[*]} logs backend"
}

cmd_up() {
  cmd_limits
  "${COMPOSE[@]}" up -d
  wait_healthy
  cmd_status
  log "UI: http://localhost:3000   ScheduleSystem: http://localhost:8793"
}

case "${1:-}" in
  build)  cmd_build ;;
  seed)   cmd_seed ;;
  limits) cmd_limits ;;
  up)     cmd_up ;;
  status) cmd_status ;;
  benchuser) cmd_benchuser ;;
  fixlinks) fix_links ;;
  down)   shift; "${COMPOSE[@]}" down "$@" ;;
  all)    cmd_build; cmd_seed; cmd_up ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
