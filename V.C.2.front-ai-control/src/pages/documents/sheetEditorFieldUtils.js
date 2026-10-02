const FIELD_BLOCK_TYPE = 'field';

/** Имена полей, уже занятых блоками «Поле заполнения» (кроме блока excludeIndex). */
export function getUsedFieldNames(blocks, excludeIndex = null) {
  const used = new Set();
  (Array.isArray(blocks) ? blocks : []).forEach((b, i) => {
    if (excludeIndex != null && i === excludeIndex) return;
    if (b?.type === FIELD_BLOCK_TYPE && b.field_name) {
      used.add(b.field_name);
    }
  });
  return used;
}

/** Поля структуры, ещё не привязанные к другим блокам. */
export function getSelectableFieldsForBlock(availableFields, blocks, blockIndex, currentFieldName) {
  const fields = Array.isArray(availableFields) ? availableFields : [];
  const used = getUsedFieldNames(blocks, blockIndex);
  const free = fields.filter((f) => !used.has(f.name));
  if (currentFieldName && !free.some((f) => f.name === currentFieldName)) {
    const current = fields.find((f) => f.name === currentFieldName);
    if (current) return [current, ...free];
  }
  return free;
}

/** Можно ли добавить ещё один блок поля. */
export function canAddFieldBlock(availableFields, blocks) {
  const fields = Array.isArray(availableFields) ? availableFields : [];
  if (fields.length === 0) return false;
  return getUsedFieldNames(blocks).size < fields.length;
}

/** Первое свободное поле для нового блока. */
export function getFirstFreeFieldName(availableFields, blocks) {
  const fields = Array.isArray(availableFields) ? availableFields : [];
  const used = getUsedFieldNames(blocks);
  const free = fields.find((f) => !used.has(f.name));
  return free?.name ?? '';
}
