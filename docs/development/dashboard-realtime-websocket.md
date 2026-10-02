# WebSocket realtime в dev (конструктор дашборда)

## Почему `ws://localhost:5173/ws/realtime`

В dev без `VITE_API_URL` фронт шлёт API и WS на тот же origin что и Vite ([`front-ai-control/src/services/apiBaseUrl.js`](../../front-ai-control/src/services/apiBaseUrl.js)). Прокси в [`front-ai-control/vite.config.ts`](../../front-ai-control/vite.config.ts) пробрасывает `/ws` на бэкенд (`VITE_DEV_PROXY_TARGET`, по умолчанию `http://127.0.0.1:8000`).

## Флаги включения realtime

- **Frontend**: в **dev** WebSocket `/ws/realtime` включён по умолчанию (`VITE_REALTIME_DASHBOARD_WS` не задан). Явно выключить: `VITE_REALTIME_DASHBOARD_WS=false`. В production нужно `VITE_REALTIME_DASHBOARD_WS=true`.
- **Backend**: `REALTIME_SYNC__ENABLED=true` включает FastAPI WS-шлюз к TCP `realtime-sync`.
- Если `REALTIME_SYNC__ENABLED=false`, `/ws/realtime` закрывается сразу с кодом `1008` без попытки TCP connect.

## Ошибки в консоли

1. **`WebSocket is closed before the connection is established`**  
   Частый шум при **React Strict Mode** в dev (дважды mount/unmount): первое соединение закрывается до установки второго.

2. **Соединение не поднимается / 1011**  
   После accept FastAPI-шлюз [`src/app/routers/realtime_ws/router.py`](../../src/app/routers/realtime_ws/router.py) подключается к TCP **`REALTIME_SYNC__TCP_HOST` / `REALTIME_SYNC__TCP_PORT`** (из [`src/core/settings/config.py`](../../src/core/settings/config.py), по умолчанию `127.0.0.1:9009`). Если сервис **`realtime-sync`** не запущен, в логах бэкенда будет `realtime-sync TCP connect failed`, браузер увидит обрыв.

## Что сделать локально

- Поднять процесс `realtime-sync` на порту из env или скорректировать `REALTIME_SYNC__*` под ваш docker-compose.
- Убедиться, что **`VITE_DEV_PROXY_TARGET`** указывает на тот же FastAPI, где зарегистрирован **`/ws/realtime`** (не другой процесс на :8000, например минимальный мок без WS).
