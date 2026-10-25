/**
 * Базовые заголовки вкладки по маршруту. Страницы уточняют их через
 * useDocumentTitle (название панели, задачи, документа, чата и т.п.).
 * Порядок важен: первое совпадение побеждает.
 */
const ROUTE_TITLES = [
  [/^\/$/, null],
  [/^\/signin\/?$/, 'Вход'],
  [/^\/signup\/?$/, 'Регистрация'],
  [/^\/invite\//, 'Приглашение'],
  [/^\/reset-password\//, 'Сброс пароля'],

  [/^\/profile\/?$/, 'Профиль'],
  [/^\/call(\/|$)/, 'Звонок'],
  [/^\/embed\//, 'Виджет панели'],

  [/^\/dashboard\/flows\/?$/, 'Управление потоками'],
  [/^\/dashboard\/[^/]+\/sheet\/[^/]+/, 'Лист панели управления'],
  [/^\/dashboard\/[^/]+\/?$/, 'Панель управления'],
  [/^\/dashboard\/?$/, 'Панели управления'],
  [/^\/flows(\/|$)/, 'Потоки'],
  [/^\/share\//, 'Панель управления по ссылке'],

  [/^\/tasks\/?$/, 'Задачи'],

  [/^\/documents\/share\//, 'Документ по ссылке'],
  [/^\/documents\/?$/, 'Документы'],

  [/^\/data-models\/create\/?$/, 'Новая модель данных'],
  [/^\/data-models\/[^/]+\/edit\/?$/, 'Редактирование модели данных'],
  [/^\/data-models\/[^/]+\/?$/, 'Модель данных'],
  [/^\/data-models\/?$/, 'Модели данных'],

  [/^\/datacode-editor\/?$/, 'Редактор DataCode'],
  [/^\/datacode-docs(\/|$)/, 'Документация DataCode'],
  [/^\/developer-api-docs(\/|$)/, 'API для разработчиков'],

  [/^\/support\/?$/, 'Поддержка'],
  [/^\/legal(\/|$)/, 'Правовая информация'],
];

export function getRouteTitle(pathname) {
  const path = String(pathname || '/');
  for (const [pattern, title] of ROUTE_TITLES) {
    if (pattern.test(path)) return title;
  }
  return null;
}
