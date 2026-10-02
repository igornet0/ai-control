/**
 * Преобразует detail из FastAPI (строка или массив validation errors) в текст для UI.
 */
export function formatApiError(error, fallback = 'Произошла ошибка') {
  const detail = error?.response?.data?.detail;
  if (!detail) {
    return error?.message || fallback;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) {
          const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
          return field ? `${field}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail);
  }
  return fallback;
}
