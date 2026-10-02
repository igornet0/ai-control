/** Формат значения для <input type="date"> — локальная календарная дата. */
export function toDateInputValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Отправка даты на API без сдвига из-за часового пояса. */
export function fromDateInputValue(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  return `${str}T00:00:00`;
}
