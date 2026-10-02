/**
 * Field renderers for data input widget form.
 */

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normalize any stored/ISO datetime into a value accepted by <input type="datetime-local">.
 * Browsers reject space-separated stamps (`2026-08-13 12:30`) and Z/ms suffixes without step —
 * the control then looks empty and submits "" → insert fails / column stays empty.
 * @param {unknown} value
 * @returns {string}
 */
export function toDatetimeLocalValue(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (!s) return '';
  s = s.replace(/ /g, 'T');
  // 2026-08-13T12:30:00.000Z / +00:00 → 2026-08-13T12:30:00
  s = s.replace(/\.\d{1,9}/, '');
  s = s.replace(/Z$/i, '');
  s = s.replace(/[+-]\d{2}:\d{2}$/, '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  return s.slice(0, 19);
}

/**
 * Canonical ISO-like stamp for SQLite / model storage (matches existing ingest data).
 * @param {unknown} value
 * @returns {string}
 */
export function toDatetimeStorageValue(value) {
  const local = toDatetimeLocalValue(value);
  if (!local) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return `${local}:00`;
  return local;
}

function inputAttrs(field, value) {
  const ro = field.readonly ? ' readonly' : '';
  const req = field.required || field.isPrimaryKey ? ' required' : '';
  const ph = field.placeholder ? ` placeholder="${escHtml(field.placeholder)}"` : '';
  const ac = field.autocomplete ? ` autocomplete="${escHtml(field.autocomplete)}"` : '';
  const type = String(field.type || 'text').toLowerCase();
  let display = value;
  if (type === 'datetime') display = toDatetimeLocalValue(value);
  else if (type === 'date' && value != null) display = String(value).trim().slice(0, 10);
  return { ro, req, ph, ac, val: display != null && display !== '' ? escHtml(String(display)) : '' };
}

function wrapPrimaryKeyInput(field, nameAttr, inputHtml) {
  if (!field.isPrimaryKey) return inputHtml;
  return `
    <div class="data-input-pk-control">
      ${inputHtml}
      <button type="button" class="data-input-pk-generate btn btn-secondary" data-pk-generate="${escHtml(nameAttr)}" title="Сгенерировать значение primary key">
        Сгенерировать
      </button>
    </div>`;
}

/** @param {object} field @param {*} value @param {string} nameAttr */
export function renderFieldInput(field, value, nameAttr) {
  const type = String(field.type || 'text').toLowerCase();
  const { ro, req, ph, ac, val } = inputAttrs(field, value);
  const id = `di-${nameAttr}`;
  const pkClass = field.isPrimaryKey ? ' data-input-field--pk' : '';

  if (type === 'textarea') {
    const html = `<textarea class="data-input-field data-input-textarea${pkClass}" id="${id}" name="${nameAttr}" rows="3"${ro}${req}${ph}${ac}>${val}</textarea>`;
    return wrapPrimaryKeyInput(field, nameAttr, html);
  }
  if (type === 'boolean') {
    const checked = value === true || value === 'true' || value === '1' ? ' checked' : '';
    return `<label class="data-input-checkbox"><input type="checkbox" class="data-input-field" id="${id}" name="${nameAttr}" value="1"${checked}${ro}${req}><span>${escHtml(field.label || field.name)}</span></label>`;
  }
  if (type === 'select' || type === 'relation') {
    const opts = (field.options || []).map((o) => {
      const s = typeof o === 'object' && o != null ? String(o.value ?? o.label ?? '') : String(o);
      const lab = typeof o === 'object' && o != null ? String(o.label ?? o.value ?? s) : s;
      const sel = String(value ?? '') === s ? ' selected' : '';
      return `<option value="${escHtml(s)}"${sel}>${escHtml(lab)}</option>`;
    });
    const html = `<select class="data-input-field data-input-select${pkClass}" id="${id}" name="${nameAttr}"${ro}${req}${ac}><option value="">—</option>${opts.join('')}</select>`;
    return wrapPrimaryKeyInput(field, nameAttr, html);
  }
  if (type === 'multiselect') {
    const selected = new Set(String(value || '').split(',').map((s) => s.trim()).filter(Boolean));
    const opts = (field.options || []).map((o) => {
      const s = typeof o === 'object' && o != null ? String(o.value ?? o.label ?? '') : String(o);
      const lab = typeof o === 'object' && o != null ? String(o.label ?? o.value ?? s) : s;
      const sel = selected.has(s) ? ' selected' : '';
      return `<option value="${escHtml(s)}"${sel}>${escHtml(lab)}</option>`;
    });
    return `<select class="data-input-field data-input-multiselect" id="${id}" name="${nameAttr}" multiple${ro}${req}>${opts.join('')}</select>`;
  }
  if (type === 'tags') {
    const html = `<input type="text" class="data-input-field data-input-tags${pkClass}" id="${id}" name="${nameAttr}" value="${val}"${ro}${req}${ph}${ac} data-tags="1">`;
    return wrapPrimaryKeyInput(field, nameAttr, html);
  }
  if (type === 'file' || type === 'image') {
    const accept = type === 'image' ? ' accept="image/*"' : '';
    return `<input type="file" class="data-input-field data-input-file" id="${id}" name="${nameAttr}" data-file-field="1"${accept}${ro}${req}>`;
  }
  if (type === 'formula') {
    return `<div class="data-input-formula-preview" data-formula-name="${nameAttr}">—</div>`;
  }

  let inputType = 'text';
  if (type === 'number') inputType = 'number';
  else if (type === 'float') inputType = 'number';
  else if (type === 'email') inputType = 'email';
  else if (type === 'password') inputType = 'password';
  else if (type === 'date') inputType = 'date';
  else if (type === 'datetime') inputType = 'datetime-local';

  let extra = '';
  if (field.min != null && inputType === 'number') extra += ` min="${field.min}"`;
  if (field.max != null && inputType === 'number') extra += ` max="${field.max}"`;
  if (field.max_length != null) extra += ` maxlength="${field.max_length}"`;
  if (type === 'float') extra += ' step="any"';
  // Allow seconds so generated / ISO stamps with :ss are not cleared by the browser.
  if (type === 'datetime') extra += ' step="1"';

  const html = `<input type="${inputType}" class="data-input-field${pkClass}" id="${id}" name="${nameAttr}" value="${val}"${ro}${req}${ph}${ac}${extra}>`;
  return wrapPrimaryKeyInput(field, nameAttr, html);
}

/** Collect form values from DOM container. */
export function collectFormData(container, fields) {
  /** @type {Record<string, unknown>} */
  const data = {};
  if (!container) return data;
  for (const field of fields) {
    const name = String(field.name || '');
    if (!name || field.hidden || field.type === 'formula') continue;
    const el = container.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!el) continue;
    const type = String(field.type || 'text').toLowerCase();
    if (type === 'boolean') {
      data[name] = /** @type {HTMLInputElement} */ (el).checked;
    } else if (type === 'multiselect') {
      const sel = /** @type {HTMLSelectElement} */ (el);
      data[name] = [...sel.selectedOptions].map((o) => o.value);
    } else if (type === 'file' || type === 'image') {
      const fileEl = /** @type {HTMLInputElement} */ (el);
      if (fileEl.files?.length) {
        data[name] = fileEl.files[0];
      } else if (fileEl.dataset.uploadedValue) {
        data[name] = fileEl.dataset.uploadedValue;
      }
    } else if (type === 'datetime') {
      data[name] = toDatetimeStorageValue(/** @type {HTMLInputElement} */ (el).value);
    } else if (type === 'date') {
      const raw = String(/** @type {HTMLInputElement} */ (el).value || '').trim();
      data[name] = raw ? raw.slice(0, 10) : '';
    } else {
      data[name] = /** @type {HTMLInputElement} */ (el).value;
    }
  }
  return data;
}

/**
 * Parse API error detail for PK conflict.
 * @param {*} detail
 * @returns {{ code?: string, message: string, fields: string[] } | null}
 */
export function parseDataInputErrorDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === 'string') {
    return { message: detail, fields: [] };
  }
  if (typeof detail === 'object') {
    const message =
      detail.message ||
      detail.detail ||
      (typeof detail === 'object' ? JSON.stringify(detail) : String(detail));
    const fields = Array.isArray(detail.fields) ? detail.fields.map(String) : [];
    return {
      code: detail.code ? String(detail.code) : undefined,
      message: String(message),
      fields,
    };
  }
  return { message: String(detail), fields: [] };
}
