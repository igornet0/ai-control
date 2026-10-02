# Редактор формул BI — архитектура и дорожная карта

## Текущая реализация (vanilla)

Модальное окно собирается в `src/formula/formulaEditorModal.js`:

- **Левая зона** — источники: выбор таблицы, поиск, список полей с цветом типа, клик и drag-and-drop в textarea.
- **Центр** — редактор формулы (textarea), живой разбор через `compileFormula`, статус в шапке, деталь ошибки под полем, предпросмотр значения через API.
- **Правая зона** — конструктор (агрегат + поле → «Вставить») и сетка шаблонов функций из `FORMULA_FUNCTION_REGISTRY`.

Действия в шапке: **Проверить** (синтаксис), **Предпросмотр** (запрос к SQLite), **Сохранить**, **Отмена**.

Расширение без правки разметки:

- новые функции: `extraFunctionTemplates` в опциях `wireFormulaEditorModal`;
- кастомная логика сохранения — колбэк `onSave`.

## Предлагаемая структура React-компонентов

Интеграция в `DashboardCreaterApp.jsx` или отдельный портал:

```
FormulaEditorModal/
  index.tsx                 — портал, props: open, onClose, onSave, dashboardId, dataSource, initialFormula
  FormulaModalHeader.tsx    — заголовок, статус, кнопки
  DataSourcesPanel.tsx      — таблица, поиск, FieldList
  FormulaEditorPanel.tsx    — обёртка над редактором (см. ниже)
  BuilderPanel.tsx          — агрегат, поле, вставка
  FunctionChips.tsx         — реестр шаблонов
  hooks/
    useDashboardSchema.ts   — обёртка над getDashboardSchema
    useFormulaParse.ts      — debounced compileFormula
    useFormulaPreview.ts    — runSingleFormulaOnDashboard
    useFieldDnD.ts          — drag data + drop в редактор
```

**FormulaEditorPanel** внутри позже подменяется:

- фаза 1: `<textarea>` + классы ошибки (как сейчас);
- фаза 2: **CodeMirror 6** (`@codemirror/view`, `@codemirror/autocomplete`) с кастомным completion из полей и `FORMULA_FUNCTION_REGISTRY`;
- фаза 3 (опционально): Lezer-грамматика формул для подсветки и узких диапазонов ошибок.

Контекст для автокомплита: `{ tables, fields, functions }`, единый источник для нескольких моделей данных — массив `modelId` в props.

## UX-логика (сценарий)

1. Загрузка схемы по `dashboardId` и фильтр по `dataSource.modelId`.
2. Фильтр таблицы и текста обновляют список полей и селект конструктора.
3. Ввод в textarea → debounce → `compileFormula` → статус OK/ошибка.
4. «Предпросмотр» → тот же путь, что `runSingleFormulaOnDashboard` сейчас.
5. «Сохранить» → повторная проверка синтаксиса, затем `onSave(formula)`.

## Будущие возможности (архитектура)

| Фича | Подход |
|------|--------|
| `IF(cond, a, b)` | расширить parser/tokenizer + AST + SQLite CASE |
| Фильтры в формуле | отдельный слой «виртуального» AST или второй запрос; контракт API |
| Несколько источников | `dataSource[]` в modal props; префиксы таблиц или выбор «активной» базовой таблицы виджета |
| Кастомные функции | плюс к реестру; на сервере — whitelist в `sqlite_dashboard_query` |

## Зависимости

Сейчас Monaco не подключён; в проекте уже есть `@codemirror/*` — предпочтительный путь для подсветки без тяжёлого бандла Monaco.
