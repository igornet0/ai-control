# Dashboard share link — public read APIs (reference)

Authenticated dashboard flow uses:

| Area | Service / usage | Authenticated path |
|------|-------------------|---------------------|
| Dashboard meta | `dashboardService.getDashboard` → `api.js` | `GET /api/dashboards/{id}` |
| Sheets list | `sheetService.getDashboardSheets` → `apiClient` | `GET /api/dashboards/{id}/sheets` |
| Sheet | `sheetService.getSheet` | `GET /api/dashboards/sheets/{sheetId}` |
| Widgets | `widgetService.getSheetWidgets` | `GET /api/dashboard-widgets/sheet/{sheetId}/widgets` |
| Widget | `widgetService.getWidget` | `GET /api/dashboard-widgets/{widgetId}` |
| Table / filters (SQLite) | `dashboardQueryService` → `api.js` | `POST /api/data-models/{modelId}/sqlite/query`, `POST .../sqlite/column-distinct` |
| Data panel schema | `getDashboardSchema` → `dashboardSqliteSchemaService` | `GET /api/dashboards/{id}/data-models`, `GET /api/data-models/{modelId}/sqlite-db/schema` |
| Save widgets | `widgetService.bulkSaveWidgets` | `POST /api/dashboard-widgets/sheet/{sheetId}/bulk-save` |

Share-link public endpoints mirror these under:

`GET|POST /api/public/dashboard-links/{token}/...`

| Area | Public path |
|------|-------------|
| Bootstrap | `GET .../{token}/bootstrap` |
| Sheets | `GET .../{token}/sheets`, `GET .../{token}/sheets/{sheetId}` |
| Data models + SQLite schema (Data panel) | `GET .../{token}/data-models`, `GET .../{token}/data-models/{modelId}/sqlite-db/schema` |
| Widgets | `GET .../{token}/sheets/{sheetId}/widgets`, `GET .../{token}/widgets/{widgetId}` |
| SQLite query / distinct | `POST .../{token}/data-models/{modelId}/sqlite/query`, `POST .../sqlite/column-distinct` |
| Bulk save (edit link only) | `POST .../{token}/sheets/{sheetId}/widgets/bulk-save` |

with the same response shapes where possible, and server-side checks that `sheet_id` / `widget_id` / `model_id` belong to the dashboard bound to the link.
