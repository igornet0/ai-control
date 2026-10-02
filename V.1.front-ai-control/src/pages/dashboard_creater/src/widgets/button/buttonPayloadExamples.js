/**
 * Examples & help for button-widget action payloads.
 */

export const BUTTON_PAYLOAD_EXAMPLES = Object.freeze([
  {
    actionType: 'navigate',
    title: 'Перейти на лист',
    description:
      'Лист выбирается в поле «Лист» (target). В payload можно передать параметры или фильтры, которые применятся после перехода.',
    examples: [
      {
        label: 'С параметрами',
        how: 'После перехода выставит runtime-параметры на целевом листе.',
        json: {
          params: {
            source: 'button',
            region: 'west',
          },
        },
      },
      {
        label: 'С фильтрами',
        how: 'Можно передать набор фильтров вместе с навигацией (если обработчик перехода их поддерживает).',
        json: {
          filters: [
            { field: 'country', value: 'Netherlands' },
          ],
        },
      },
    ],
  },
  {
    actionType: 'link',
    title: 'Ссылка',
    description:
      'Открывает URL в новой вкладке. Адрес задаётся в поле «URL» (target / payload.url).',
    examples: [
      {
        label: 'HTTPS',
        how: 'Полный адрес страницы. По нажатию откроется новая вкладка.',
        json: {
          url: 'https://example.com',
        },
      },
      {
        label: 'Без протокола',
        how: 'Если протокол не указан, подставится https://',
        json: {
          url: 'example.com/docs',
        },
      },
    ],
  },
  {
    actionType: 'reload',
    title: 'Обновить данные',
    description:
      'Мягкое обновление: перезагружает данные виджетов без сборки модели. Payload обычно пустой.',
    examples: [
      {
        label: 'Пустой payload',
        how: 'Достаточно типа действия «Обновить данные». JSON можно оставить {}.',
        json: {},
      },
    ],
  },
  {
    actionType: 'hard_reload',
    title: 'Сборка модели',
    description:
      'Запускает compile-model, показывает прогресс, затем обновляет дашборд. Модель можно выбрать в UI или указать в payload.',
    examples: [
      {
        label: 'Конкретная модель',
        how: 'Соберёт только указанную модель данных.',
        json: {
          modelId: 12,
        },
      },
      {
        label: 'Несколько моделей',
        how: 'Соберёт модели по очереди, затем обновит данные.',
        json: {
          modelIds: [12, 15],
        },
      },
    ],
  },
  {
    actionType: 'filter',
    title: 'Фильтр',
    description:
      'Меняет выбранные значения у виджетов-фильтров. Поля «Поле фильтра» и «Значение» пишут в payload автоматически; JSON нужен для тонкой настройки.',
    examples: [
      {
        label: 'Заменить значение',
        how: 'mode: replace (по умолчанию) — поставить одно значение.',
        json: {
          field: 'country',
          value: 'Netherlands',
          mode: 'replace',
        },
      },
      {
        label: 'Несколько значений',
        how: 'Передаёт список значений в values.',
        json: {
          field: 'country',
          values: ['Netherlands', 'Germany'],
          mode: 'replace',
        },
      },
      {
        label: 'Добавить к выбору',
        how: 'mode: append — дописать значения к уже выбранным.',
        json: {
          field: 'country',
          values: ['Belgium'],
          mode: 'append',
        },
      },
      {
        label: 'Очистить фильтр',
        how: 'mode: clear — сбросить выбранные значения для поля.',
        json: {
          field: 'country',
          mode: 'clear',
        },
      },
      {
        label: 'С привязкой к таблице/модели',
        how: 'Сужает поиск строки фильтра, если на дашборде несколько одинаковых полей.',
        json: {
          modelId: 12,
          table: 'orders',
          field: 'status',
          value: 'open',
          debounceMs: 0,
        },
      },
    ],
  },
  {
    actionType: 'set_variable',
    title: 'Переменная',
    description:
      'Меняет скаляр @имя из каталога переменных (модель и дашборд). Переменные модели — локальный override; переменные дашборда сохраняются в layout_config.',
    examples: [
      {
        label: 'Одна переменная',
        how: 'Выберите имя в селекторе, значение — новый скаляр.',
        json: {
          key: 'sum_amount_sum',
          value: 100,
        },
      },
      {
        label: 'Несколько переменных',
        how: 'Через variables можно задать пачку ключей.',
        json: {
          variables: {
            sum_amount_sum: 0,
            threshold: 50,
          },
        },
      },
    ],
  },
  {
    actionType: 'custom',
    title: 'Своё действие',
    description:
      'Вызывает обработчик, зарегистрированный через ButtonActionDispatcher.registerCustomAction(name, handler). Имя берётся из handler / name / target.',
    examples: [
      {
        label: 'Вызов обработчика',
        how: 'handler — имя зарегистрированной функции.',
        json: {
          handler: 'myHandler',
          foo: 1,
        },
      },
      {
        label: 'С доп. данными',
        how: 'Любые поля payload попадут в handler как action.payload.',
        json: {
          handler: 'exportReport',
          format: 'xlsx',
          includeFilters: true,
        },
      },
    ],
  },
]);

export function getButtonPayloadExamplesForType(actionType) {
  const type = String(actionType || '').toLowerCase();
  const found = BUTTON_PAYLOAD_EXAMPLES.find((item) => item.actionType === type);
  return found || null;
}
