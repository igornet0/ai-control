import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import { FIELD_TYPES, createField, sanitizeIdentifier, validateIdentifier } from './schema.js';
import styles from './InteractiveDataSource.module.css';

function SortableFieldRow({ field, index, onChange, onDuplicate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const nameError = validateIdentifier(field.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.fieldRow}>
      <button type="button" className={styles.dragHandle} {...attributes} {...listeners} title="Перетащить">
        <Bars3Icon className={styles.iconSm} />
      </button>
      <input
        className={`${styles.inputCompact} ${nameError ? styles.inputInvalid : ''}`}
        value={field.name}
        onChange={(e) => onChange(index, { name: sanitizeIdentifier(e.target.value, field.name) })}
        placeholder="field_name"
        title={nameError || ''}
      />
      <select
        className={styles.selectCompact}
        value={field.type}
        onChange={(e) => onChange(index, { type: e.target.value })}
      >
        {FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        className={styles.inputCompact}
        value={field.defaultValue}
        onChange={(e) => onChange(index, { defaultValue: e.target.value })}
        placeholder="default"
        title="Default value"
      />
      <label className={styles.flagLabel} title="Nullable">
        <input
          type="checkbox"
          checked={field.nullable}
          onChange={(e) => onChange(index, { nullable: e.target.checked })}
        />
        null
      </label>
      <label className={styles.flagLabel} title="Primary key">
        <input
          type="checkbox"
          checked={field.primaryKey}
          onChange={(e) => onChange(index, { primaryKey: e.target.checked })}
        />
        pk
      </label>
      <label className={styles.flagLabel} title="Unique">
        <input
          type="checkbox"
          checked={field.unique}
          onChange={(e) => onChange(index, { unique: e.target.checked })}
        />
        uq
      </label>
      <button type="button" className={styles.iconBtn} onClick={() => onDuplicate(index)} title="Дублировать">
        <DocumentDuplicateIcon className={styles.iconSm} />
      </button>
      <button type="button" className={styles.iconBtnDanger} onClick={() => onRemove(index)} title="Удалить">
        <TrashIcon className={styles.iconSm} />
      </button>
    </div>
  );
}

export default function FieldEditor({ fields, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, oldIndex, newIndex));
  };

  const updateField = (index, patch) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const duplicateField = (index) => {
    const source = fields[index];
    const copy = createField({
      ...source,
      name: `${source.name}_copy`,
      primaryKey: false,
    });
    const next = [...fields];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const removeField = (index) => {
    if (fields.length <= 1) return;
    onChange(fields.filter((_, i) => i !== index));
  };

  const addField = () => {
    onChange([...fields, createField()]);
  };

  return (
    <div className={styles.fieldEditor}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.subTitle}>Поля таблицы</h4>
        <button type="button" className={styles.addBtn} onClick={addField}>+ Поле</button>
      </div>
      <div className={styles.fieldHeaderRow}>
        <span />
        <span>Имя</span>
        <span>Тип</span>
        <span>Default</span>
        <span>Флаги</span>
        <span />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.fieldList}>
            {fields.map((field, index) => (
              <SortableFieldRow
                key={field.id}
                field={field}
                index={index}
                onChange={updateField}
                onDuplicate={duplicateField}
                onRemove={removeField}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
