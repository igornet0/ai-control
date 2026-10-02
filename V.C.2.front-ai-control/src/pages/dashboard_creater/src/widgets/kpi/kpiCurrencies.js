/**
 * Список валют для выбора в типографике KPI (символ + ISO-код).
 * @typedef {{ code: string, symbol: string, label: string }} KpiCurrencyOption
 */

/** @type {KpiCurrencyOption[]} */
export const KPI_CURRENCY_OPTIONS = [
  { code: 'RUB', symbol: '₽', label: 'Российский рубль' },
  { code: 'USD', symbol: '$', label: 'Доллар США' },
  { code: 'EUR', symbol: '€', label: 'Евро' },
  { code: 'GBP', symbol: '£', label: 'Фунт стерлингов' },
  { code: 'CNY', symbol: '¥', label: 'Китайский юань' },
  { code: 'JPY', symbol: '¥', label: 'Японская иена' },
  { code: 'KZT', symbol: '₸', label: 'Казахстанский тенге' },
  { code: 'UAH', symbol: '₴', label: 'Украинская гривна' },
  { code: 'BYN', symbol: 'Br', label: 'Белорусский рубль' },
  { code: 'CHF', symbol: 'Fr', label: 'Швейцарский франк' },
  { code: 'TRY', symbol: '₺', label: 'Турецкая лира' },
  { code: 'INR', symbol: '₹', label: 'Индийская рупия' },
  { code: 'KRW', symbol: '₩', label: 'Южнокорейская вона' },
  { code: 'BRL', symbol: 'R$', label: 'Бразильский реал' },
  { code: 'CAD', symbol: 'C$', label: 'Канадский доллар' },
  { code: 'AUD', symbol: 'A$', label: 'Австралийский доллар' },
  { code: 'PLN', symbol: 'zł', label: 'Польский злотый' },
  { code: 'CZK', symbol: 'Kč', label: 'Чешская крона' },
  { code: 'SEK', symbol: 'kr', label: 'Шведская крона' },
  { code: 'NOK', symbol: 'kr', label: 'Норвежская крона' },
  { code: 'AED', symbol: 'د.إ', label: 'Дирхам ОАЭ' },
  { code: 'SGD', symbol: 'S$', label: 'Сингапурский доллар' },
  { code: 'HKD', symbol: 'HK$', label: 'Гонконгский доллар' },
  { code: 'NZD', symbol: 'NZ$', label: 'Новозеландский доллар' },
];

/**
 * @param {string|null|undefined} code
 * @returns {KpiCurrencyOption}
 */
export function resolveKpiCurrencyOption(code) {
  const c = String(code || 'USD').trim().toUpperCase().slice(0, 3) || 'USD';
  const found = KPI_CURRENCY_OPTIONS.find((x) => x.code === c);
  if (found) return found;
  return { code: c, symbol: c, label: c };
}
