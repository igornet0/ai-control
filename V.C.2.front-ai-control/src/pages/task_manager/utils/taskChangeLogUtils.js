const FIELD_LABELS = {
  status: 'Статус',
  priority: 'Приоритет',
  due_date: 'Срок выполнения',
};

export function formatTaskChangeEntry(entry) {
  const fieldLabel = FIELD_LABELS[entry.field] || entry.field;
  const fromLabel = entry.from_label ?? entry.from ?? '—';
  const toLabel = entry.to_label ?? entry.to ?? '—';
  const when = entry.at
    ? new Date(entry.at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const who = entry.by_user_name || 'Система';
  return {
    id: `${entry.field}-${entry.at}-${entry.by_user_id ?? 'sys'}`,
    when,
    who,
    text: `${fieldLabel}: ${fromLabel} → ${toLabel}`,
  };
}

export function getTaskChangeLog(task) {
  const raw = task?.meta_data?.change_log;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...raw]
    .reverse()
    .map(formatTaskChangeEntry);
}
