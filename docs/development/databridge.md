# DataBridge

DataBridge exposes platform business entities to Data Models as
`source_table("platform_*", ...)` datasets. At compile time rows are materialized into
DCP Arrow tables (same path as API/JSON sources) and become tables in `latest.db`.

## Entities

| Entity | Table | Notes |
|--------|-------|--------|
| employees | `platform_employees` | Users as employees; `avatar` type `image` |
| tasks | `platform_tasks` | Tasks |
| projects | `platform_projects` | Projects |
| documents | `platform_documents` | Document metadata (+ `is_spreadsheet`) |
| document_field_values | `platform_document_field_values` | Scalar fields from text/form docs |
| document_tables | `platform_document_tables` | Catalog of form tables / spreadsheet sheets |
| document_table_cells | `platform_document_table_cells` | Exploded cells (no binary/images) |

Documents are read-only JSONB extracts from `Document.field_data` (+ template
`sheet_content` hints). PDF/binary content is never loaded into Datasets.

## Admin

1. Open **Profile → Admin → DataBridge**.
2. Enable the bridge and toggle entities / global field allowlists.
3. **Access** — who may use DataBridge as a data-model source: all employees, or
   restricted to specific employees / teams / job titles (`TeamRole`). Access is
   granted if the user matches any of the selected lists. Platform admins always
   have access; guests never do.
4. **Visibility policies** — what rows/fields a matching subject may materialize
   (stored in `databridge_configs.config.visibility_policies` JSONB). Separate from
   access: a user may be allowed to *use* the bridge but still see a reduced dataset.
   Built-in policies are always merged by stable id (`builtin_employee_department`,
   `builtin_employee_team`, `builtin_employee_own`): they can be enabled/disabled and
   customized, but not deleted. By default **department scope for all employees** is on.
5. `PUT /admin/databridge/config`

### Visibility policies

Each policy has:

| Field | Meaning |
|-------|---------|
| `subjects` | Who the policy applies to: `all`, and/or `user_ids` / `team_ids` / `team_roles` / `department_ids` (`match: any` = OR) |
| `entities.<name>.row_scope` | `all` \| `own` \| `team` \| `department` \| `deny` |
| `entities.<name>.allowed_fields` | Optional field ceiling; intersected with global allowlist + hard denies + tier maps |

Matching policies are **intersected** (most restrictive wins): fields ∩, row ids ∩;
`deny` yields an empty row set.

Filters run inside `PermissionResolver` during `engine.execute` (compile /
auto-refresh). The compiled `databridge.db` snapshot is shared: dashboard viewers
see the compiling user’s (or model owner’s) filtered data — there is no per-viewer
re-filter on SQLite attach in v1.

## Data Model

1. Add a data-source widget with `sourceType = databridge`.
2. Pick an enabled entity; DataCode sync emits e.g.

```datacode
global documents = source_table("platform_documents", ["id", "title", "is_spreadsheet"])
global cells = source_table("platform_document_table_cells", ["document_id", "row_index", "column_key", "value"])
```

3. Compile the model — `build_dcp_databridge_payload` loads permission-scoped rows for the
   compiling user (org visibility ∩ visibility policies) and injects Arrow into the DCP package.

### Employee avatars

At compile, `/static/avatars/{file}` values are read from `uploads/avatars/`, stored in the
model asset store, and rewritten to `asset://{sha}` in `platform_employees.avatar`. Bytes
are also embedded via DCP `put_asset`. The Image dashboard widget resolves `asset://` through
`GET /api/data-models/{id}/assets/{sha}` (legacy `/static/…` URLs still work until recompile).

## Metadata API

- `GET /api/databridge/entities`
- `GET /api/databridge/entities/{entity}`
- `GET /api/databridge/entities/{entity}/schema`
- `GET /api/databridge/entities/{entity}/relationships`

Admin:

- `GET /admin/databridge/config`
- `PUT /admin/databridge/config`
- `GET /admin/databridge/entities` (includes `access`, `visibility_policies`, `departments`)

## Package layout

`src/app/services/databridge/` — registry, engine, permissions, adapters, document extract, DCP builder.

MVP is **read-only**.
