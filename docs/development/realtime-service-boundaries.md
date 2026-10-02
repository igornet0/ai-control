# Realtime: границы сервисов

- **Dashboard / share real-time документация:** [dashboard-realtime-websocket.md](./dashboard-realtime-websocket.md), [dashboard-share-public-apis.md](./dashboard-share-public-apis.md).
- **Python шлюзы:** приложение FastAPI: [src/app/routers/realtime_ws](../../src/app/routers/realtime_ws), [src/app/routers/realtime_integration](../../src/app/routers/realtime_integration).
- **Внешний TCP sync:** настройки `REALTIME_SYNC__*` в `core/settings/config.py` (`RealtimeSyncConfig`) — браузер обычно не подключается напрямую; используется мост через backend WebSocket при необходимости.

При выборе между отдельным процессом (например внешним relay) и встроенным WS придерживайтесь одного источника маршрутизации событий, чтобы избежать дубля доставки.
