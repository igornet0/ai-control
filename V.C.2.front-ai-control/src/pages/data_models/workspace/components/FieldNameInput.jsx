import React, { useState } from 'react';

/**
 * Field picker: proper <select> when upstream fields are known.
 * allowCustom adds «Своё имя…» which switches to a text input.
 * Values from templates that are not in the source list stay visible as an option.
 */
export default function FieldNameInput({
  availableFields = [],
  value,
  onChange,
  className,
  placeholder = 'Имя поля',
  allowCustom = false,
}) {
  const [customMode, setCustomMode] = useState(false);

  const baseFields = [];
  const seen = new Set();
  for (const field of availableFields || []) {
    const name = typeof field === 'string' ? field : field?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    baseFields.push(name);
  }

  const current = value || '';
  const options = [...baseFields];
  if (current && !seen.has(current)) {
    options.unshift(current);
  }

  if (baseFields.length > 0 && allowCustom && customMode) {
    return (
      <input
        type="text"
        className={className}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!current.trim() || seen.has(current)) setCustomMode(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={placeholder}
        autoFocus
      />
    );
  }

  if (options.length > 0) {
    return (
      <select
        className={className}
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '__custom__') {
            setCustomMode(true);
            onChange('');
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
        aria-label={placeholder}
      >
        <option value="">— Поле —</option>
        {options.map((field) => (
          <option key={field} value={field}>{field}</option>
        ))}
        {allowCustom && <option value="__custom__">Своё имя…</option>}
      </select>
    );
  }

  return (
    <input
      type="text"
      className={className}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      aria-label={placeholder}
    />
  );
}
