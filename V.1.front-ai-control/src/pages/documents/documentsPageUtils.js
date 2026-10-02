import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';

export const CARD_ACCENTS = ['violet', 'cyan', 'amber', 'rose', 'emerald'];

export function getCardAccent(id) {
  const n = Math.abs(Number(id) || 0);
  return CARD_ACCENTS[n % CARD_ACCENTS.length];
}

export function matchesSearch(...parts) {
  const query = (parts.pop() || '').trim().toLowerCase();
  if (!query) return true;
  return parts.some((p) => String(p ?? '').toLowerCase().includes(query));
}

function joinFilterParts(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} и ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} и ${parts[parts.length - 1]}`;
}

/** Сообщение для пустого списка при активных фильтрах / поиске. */
export function buildFilterEmptyMessage({
  searchQuery = '',
  departmentId = '',
  departmentName = '',
  kindName = '',
  projectId = '',
  projectName = '',
  dateFrom = '',
  dateTo = '',
  pendingOnly = false,
} = {}) {
  const parts = [];
  const q = String(searchQuery || '').trim();
  if (q) parts.push(`запросу «${q}»`);
  if (departmentId === 'none') parts.push('отделу «Общие (без отдела)»');
  else if (departmentId) parts.push(`отделу «${departmentName || departmentId}»`);
  if (kindName) parts.push(`виду «${kindName}»`);
  if (projectId === 'none') parts.push('проекту «Без проекта»');
  else if (projectId) parts.push(`проекту «${projectName || projectId}»`);
  if (dateFrom && dateTo) parts.push(`датам ${dateFrom} — ${dateTo}`);
  else if (dateFrom) parts.push(`дате от ${dateFrom}`);
  else if (dateTo) parts.push(`дате до ${dateTo}`);
  if (pendingOnly) parts.push('наличию предложенных изменений');
  if (parts.length === 0) return 'Ничего не найдено по выбранным фильтрам';
  return `Ничего не найдено по ${joinFilterParts(parts)}`;
}

export function countTemplateMeta(template) {
  const sc = template?.sheet_content;
  if (!Array.isArray(sc) || sc.length === 0) return { label: '0 полей', detail: null };
  if (sc.length === 1 && sc[0]?.type === SPREADSHEET_BLOCK_TYPE) {
    const block = sc[0];
    const cols = block.tableColumns?.length || block.colCount || 0;
    const rows = Math.max(0, (block.rowCount || 0) - (block.hasHeaderRow ? 1 : 0));
    return { label: `${cols} колонок`, detail: `${rows} строк в сетке` };
  }
  const fields = sc.filter((b) => b?.type === 'field').length;
  const tables = sc.filter((b) => b?.type === 'field' && b.displayType === 'table').length;
  return {
    label: `${fields} ${fields === 1 ? 'поле' : fields < 5 ? 'поля' : 'полей'}`,
    detail: tables > 0 ? `${tables} табл.` : null,
  };
}

/** Разбивает блоки листа на страницы по разрывам page_break */
export function splitSheetIntoPages(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [[]];
  const pages = [[]];
  blocks.forEach((block) => {
    if (block?.type === 'page_break') {
      pages.push([]);
    } else {
      pages[pages.length - 1].push(block);
    }
  });
  while (pages.length > 1 && pages[pages.length - 1].length === 0) {
    pages.pop();
  }
  return pages.length > 0 ? pages : [[]];
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин. назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч. назад`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

import { resolveTitleTemplate } from './documentPlaceholders';

export { resolveTitleTemplate };

/** Заголовок документа для списков: сохранённый title или шаблон «Реестр задач — № 2». */
export function getDocumentDisplayTitle(doc, templates = [], kindName = '') {
  const trimmed = doc?.title != null ? String(doc.title).trim() : '';
  if (trimmed) return trimmed;

  const list = Array.isArray(templates) ? templates : [];
  const template = doc?.template_id
    ? list.find((t) => String(t.id) === String(doc.template_id))
    : null;

  const kindLabel = kindName || template?.name || 'Документ';
  const titleTemplate =
    template?.title_template != null && String(template.title_template).trim() !== ''
      ? template.title_template
      : `${kindLabel} — № {номер}`;

  return (
    resolveTitleTemplate(titleTemplate, {
      номер: doc?.number ?? doc?.id,
      вид: kindName || kindLabel,
    }) || `№ ${doc?.number ?? doc?.id}${kindLabel ? ` — ${kindLabel}` : ''}`
  );
}
