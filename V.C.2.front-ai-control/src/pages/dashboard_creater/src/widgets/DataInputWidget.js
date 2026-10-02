import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { hasDataBinding, isDataBindingUnavailable, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import {
  collectFormData,
  parseDataInputErrorDetail,
  renderFieldInput,
} from './data-input/dataInputFieldRenderers.js';
import {
  createDefaultDataInputSettings,
  migrateDataInputSettings,
  normalizeFieldDef,
} from './data-input/dataInputSchema.js';
import {
  fetchSelectOptionsFromFormula,
  fieldUsesOptionsFormula,
} from './data-input/dataInputSelectOptions.js';
import { buildDashWidgetHeadingHtml } from './common/widgetTitle.js';
import {
  checkDataInputPrimaryKey,
  fetchWidgetFormSchema,
  insertDataInput,
  suggestDataInputPrimaryKey,
  uploadDataInputFile,
} from './data-input/dataInputApi.js';
import { invalidateDashboardTransportCaches } from '../../../../services/dashboardFilterTransport.js';
import { fingerprintDataInputPayload } from './data-input/dataInputPayloadFingerprint.js';

const PK_CHECK_DEBOUNCE_MS = 320;
const DUPLICATE_PAYLOAD_MESSAGE =
  'Эти данные уже были сохранены. Измените поля, чтобы отправить снова.';

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class DataInputWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'data_input',
      width: config.width || 320,
      height: config.height || 280,
    });
    const merged = { ...createDefaultDataInputSettings(), ...(config.settings || {}) };
    this.settings = migrateDataInputSettings(merged);
    /** @type {object|null} */
    this._formSchema = null;
    /** @type {string|null} */
    this._submitError = null;
    /** @type {string|null} */
    this._submitSuccess = null;
    /** @type {Record<string, unknown>|null} */
    this._draftValues = null;
    /** @type {Set<string>} */
    this._pkConflictFields = new Set();
    /** @type {Map<string, ReturnType<typeof setTimeout>>} */
    this._pkCheckTimers = new Map();
    /** @type {number} */
    this._pkCheckSeq = 0;
    this._boundSubmit = null;
    this._boundClick = null;
    this._boundPkInput = null;
    /** @type {Map<string, { value: string, label: string }[]>} */
    this._resolvedSelectOptions = new Map();
    /** @type {number} */
    this._selectOptionsGen = 0;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._selectOptionsTimer = null;
    /** @type {boolean} */
    this._submitInFlight = false;
    /** @type {string|null} fingerprint of last successful insert */
    this._lastSubmittedFingerprint = null;
  }

  _isInteractive() {
    const mode = typeof window !== 'undefined' && window.engine ? window.engine.mode : 'editor';
    return mode === 'viewer' || this.settings.interactiveInEditor === true;
  }

  _canWrite() {
    if (this._formSchema && typeof this._formSchema.can_write === 'boolean') {
      return this._formSchema.can_write;
    }
    // Until schema loads, allow UI; server enforces model edit on write.
    return true;
  }

  _numericWidgetId() {
    const raw = this.id;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const s = String(raw || '');
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  async _loadSchema() {
    const wid = this._numericWidgetId();
    if (!wid) return null;
    try {
      this._formSchema = await fetchWidgetFormSchema(wid);
      if (this._formSchema?.schema_hash) {
        this.settings.schema_hash = this._formSchema.schema_hash;
      }
      return this._formSchema;
    } catch (e) {
      console.warn('DataInputWidget schema load', e);
      return null;
    }
  }

  _visibleFields() {
    const fromSettings = (this.settings.fields || []).map(normalizeFieldDef);
    if (fromSettings.length) {
      return fromSettings.filter((f) => !f.hidden && f.type !== 'formula' || f.type === 'formula');
    }
    const schemaFields = this._formSchema?.fields || [];
    return schemaFields.map(normalizeFieldDef).filter((f) => !f.hidden);
  }

  _fieldValue(field) {
    const name = String(field.name || '');
    if (this._draftValues && Object.prototype.hasOwnProperty.call(this._draftValues, name)) {
      return this._draftValues[name];
    }
    return field.default;
  }

  _withResolvedSelectOptions(field) {
    if (!fieldUsesOptionsFormula(field)) return field;
    const key = String(field.id || field.name || '');
    const opts = this._resolvedSelectOptions?.get(key);
    if (!Array.isArray(opts)) return field;
    return { ...field, options: opts };
  }

  _scheduleSelectOptionsResolve() {
    if (this._selectOptionsTimer) clearTimeout(this._selectOptionsTimer);
    this._selectOptionsTimer = setTimeout(() => {
      this._selectOptionsTimer = null;
      const engine = typeof window !== 'undefined' ? window.engine : null;
      if (!engine) return;
      const gen = ++this._selectOptionsGen;
      void this._resolveSelectOptions(engine, gen);
    }, 280);
  }

  async _resolveSelectOptions(engine, gen) {
    const fields = this._visibleFields().filter((f) => fieldUsesOptionsFormula(f));
    if (!fields.length) {
      if (this._resolvedSelectOptions?.size) this._resolvedSelectOptions = new Map();
      return;
    }
    const modelId = this.settings.modelId ?? this.dataSource?.modelId;
    const fallbackTable = this.settings.table || this.dataSource?.table || '';
    const next = new Map();
    await Promise.all(
      fields.map(async (f) => {
        const key = String(f.id || f.name || '');
        try {
          const opts = await fetchSelectOptionsFromFormula(engine, {
            modelId,
            formula: f.optionsFormula,
            labelFormula: f.optionsLabelFormula,
            fallbackTable,
          });
          next.set(key, opts);
        } catch (err) {
          console.warn('DataInputWidget select options', err);
          next.set(key, this._resolvedSelectOptions?.get(key) || []);
        }
      }),
    );
    if (gen !== this._selectOptionsGen) return;
    this._resolvedSelectOptions = next;
    this.render();
    this.applyStyles();
  }

  update(opts = {}) {
    super.update(opts);
    this._scheduleSelectOptionsResolve();
  }

  _renderFormHtml() {
    const typography = this.styles?.typography || {};
    const fields = this._visibleFields().filter((f) => f.type !== 'formula' || !f.hidden);
    const cols = Math.min(3, Math.max(1, parseInt(this.settings.columns, 10) || 1));
    const title = this.settings.showTitle !== false ? this.settings.title : '';
    const submitLabel = this.settings.submitLabel || 'Сохранить';

    const fieldBlocks = fields
      .filter((f) => f.type !== 'formula')
      .map((field) => {
        const conflict = this._pkConflictFields.has(String(field.name || ''));
        const wrapExtra = [
          field.isPrimaryKey ? 'data-input-field-wrap--pk' : '',
          conflict ? 'data-input-field-wrap--pk-conflict' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const pkBadge = field.isPrimaryKey
          ? '<span class="data-input-pk-badge" title="Primary key">PK</span>'
          : '';
        const val = this._fieldValue(field);
        if (field.type === 'boolean') {
          return `<div class="data-input-field-wrap ${wrapExtra}">${renderFieldInput(this._withResolvedSelectOptions(field), val, field.name)}</div>`;
        }
        return `
          <div class="data-input-field-wrap ${wrapExtra}">
            <label class="data-input-label" for="di-${escHtml(field.name)}">
              ${escHtml(field.label || field.name)}${field.required || field.isPrimaryKey ? ' *' : ''}
              ${pkBadge}
            </label>
            ${renderFieldInput(this._withResolvedSelectOptions(field), val, field.name)}
            ${
              conflict
                ? '<div class="data-input-pk-hint" data-pk-hint="1">Значение занято — введите другое или нажмите «Сгенерировать».</div>'
                : '<div class="data-input-pk-hint" data-pk-hint="1" hidden></div>'
            }
          </div>`;
      })
      .join('');

    const formulaFields = fields.filter((f) => f.type === 'formula');
    const formulaBlocks = formulaFields
      .map(
        (f) =>
          `<div class="data-input-field-wrap"><label class="data-input-label">${escHtml(f.label || f.name)}</label>${renderFieldInput(f, null, f.name)}</div>`,
      )
      .join('');

    const err = this._submitError
      ? `<div class="data-input-msg data-input-msg--error">${escHtml(this._submitError)}</div>`
      : '';
    const ok = this._submitSuccess
      ? `<div class="data-input-msg data-input-msg--ok">${escHtml(this._submitSuccess)}</div>`
      : '';

    const noModelWrite = this._formSchema && this._formSchema.can_write === false;
    const writeBlockedMsg = noModelWrite
      ? `<div class="data-input-msg data-input-msg--error">Нет права редактирования модели данных — ввод недоступен.</div>`
      : '';
    const canSubmit = this._isInteractive() && this._canWrite() && !this._submitInFlight;
    const disabled = canSubmit ? '' : ' disabled';
    const buttonLabel = this._submitInFlight ? 'Сохранение…' : submitLabel;

    return `
      <div class="dash-widget-shell dash-widget-shell--column data-input-widget-root" style="font-family:${typography.fontFamily || 'Inter'},sans-serif;">
        ${title ? buildDashWidgetHeadingHtml({ ...this.settings, showTitle: true, title }, escHtml) : ''}
        <form class="data-input-form" style="--di-cols:${cols}" novalidate>
          <div class="data-input-fields">${fieldBlocks}${formulaBlocks}</div>
          ${writeBlockedMsg}${err}${ok}
          <button type="submit" class="data-input-submit btn btn-primary"${disabled}>${escHtml(buttonLabel)}</button>
        </form>
      </div>`;
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;

    const typography = this.styles?.typography || {};
    if (isDataBindingUnavailable(this) || (!hasDataBinding(this) && !this.settings.table)) {
      content.innerHTML = renderWidgetDataPlaceholder(this, typography);
      return;
    }

    const visibleFields = this._visibleFields().filter((f) => f.type !== 'formula' || !f.hidden);
    if (!visibleFields.length) {
      content.innerHTML = `
        <div class="dash-widget-shell dash-widget-shell--column data-input-widget-root" style="font-family:${typography.fontFamily || 'Inter'},sans-serif;">
          <div class="dash-widget-empty dash-widget-empty--hint">
            <p>Добавьте поля в панели справа или перетащите колонки из панели «Данные».</p>
          </div>
        </div>`;
      return;
    }

    content.innerHTML = this._renderFormHtml();
    this._wireForm(content);
  }

  _wireForm(content) {
    const form = content.querySelector('.data-input-form');
    if (!form) return;
    if (this._boundSubmit) {
      form.removeEventListener('submit', this._boundSubmit);
    }
    this._boundSubmit = (e) => this._handleSubmit(e);
    form.addEventListener('submit', this._boundSubmit);

    if (this._boundClick) {
      form.removeEventListener('click', this._boundClick);
    }
    this._boundClick = (e) => this._handleFormClick(e);
    form.addEventListener('click', this._boundClick);

    if (this._boundPkInput) {
      form.removeEventListener('input', this._boundPkInput);
      form.removeEventListener('change', this._boundPkInput);
    }
    this._boundPkInput = (e) => this._handlePkFieldInput(e);
    form.addEventListener('input', this._boundPkInput);
    form.addEventListener('change', this._boundPkInput);

    form.querySelectorAll('.data-input-file').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const blocked = this._writeBlockedReason();
        if (blocked) {
          this._submitError = blocked;
          this.render();
          return;
        }
        const wid = this._numericWidgetId();
        if (!wid) return;
        try {
          const up = await uploadDataInputFile(wid, file);
          input.dataset.uploadedValue = up.file_id || up.url || '';
        } catch (err) {
          this._submitError = err?.response?.data?.detail || String(err?.message || err);
          this.render();
        }
      });
    });
  }

  /**
   * @param {string} fieldName
   * @param {boolean} occupied
   */
  _setPkConflictUi(fieldName, occupied) {
    const name = String(fieldName || '');
    if (!name) return;
    if (occupied) this._pkConflictFields.add(name);
    else this._pkConflictFields.delete(name);

    const form = this.element?.querySelector('.data-input-form');
    const input = form?.querySelector(`[name="${CSS.escape(name)}"]`);
    const wrap = input?.closest?.('.data-input-field-wrap');
    if (!wrap) return;
    wrap.classList.toggle('data-input-field-wrap--pk-conflict', occupied);
    const hint = wrap.querySelector('[data-pk-hint]');
    if (hint) {
      if (occupied) {
        hint.hidden = false;
        hint.textContent = 'Значение занято — введите другое или нажмите «Сгенерировать».';
      } else {
        hint.hidden = true;
        hint.textContent = '';
      }
    }
  }

  _clearPkCheckTimers() {
    for (const t of this._pkCheckTimers.values()) {
      clearTimeout(t);
    }
    this._pkCheckTimers.clear();
  }

  /**
   * @param {Event} e
   */
  _handlePkFieldInput(e) {
    const target = /** @type {HTMLElement|null} */ (e.target);
    if (!target || !('name' in target)) return;
    const fieldName = String(/** @type {HTMLInputElement} */ (target).name || '');
    if (!fieldName) return;
    const field = this._visibleFields().find((f) => String(f.name || '') === fieldName);
    if (!field?.isPrimaryKey) return;
    if (!this._isInteractive()) return;

    const value = String(/** @type {HTMLInputElement} */ (target).value ?? '');
    this._draftValues = { ...(this._draftValues || {}), [fieldName]: value };

    const prev = this._pkCheckTimers.get(fieldName);
    if (prev) clearTimeout(prev);

    if (!value.trim()) {
      this._setPkConflictUi(fieldName, false);
      this._pkCheckTimers.delete(fieldName);
      return;
    }

    const timer = setTimeout(() => {
      this._pkCheckTimers.delete(fieldName);
      void this._checkPkOccupied(fieldName, value);
    }, PK_CHECK_DEBOUNCE_MS);
    this._pkCheckTimers.set(fieldName, timer);
  }

  /**
   * @param {string} fieldName
   * @param {unknown} value
   */
  async _checkPkOccupied(fieldName, value) {
    const wid = this._numericWidgetId();
    if (!wid) return;
    const seq = ++this._pkCheckSeq;
    try {
      const res = await checkDataInputPrimaryKey(wid, fieldName, value);
      if (seq !== this._pkCheckSeq) return;
      const current = this.element?.querySelector(`[name="${CSS.escape(fieldName)}"]`);
      const currentVal =
        current && 'value' in current ? String(/** @type {HTMLInputElement} */ (current).value || '') : '';
      if (String(value ?? '') !== currentVal) return;
      this._setPkConflictUi(fieldName, !!res?.occupied);
      if (res?.occupied) {
        this._submitError = null;
      }
    } catch (err) {
      if (seq !== this._pkCheckSeq) return;
      console.warn('DataInputWidget PK check', err);
    }
  }

  async _handleFormClick(e) {
    const btn = e.target?.closest?.('[data-pk-generate]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!this._isInteractive()) return;
    const blocked = this._writeBlockedReason();
    if (blocked) {
      this._submitError = blocked;
      this.render();
      return;
    }

    const fieldName = String(btn.getAttribute('data-pk-generate') || '').trim();
    if (!fieldName) return;
    const wid = this._numericWidgetId();
    if (!wid) {
      this._submitError = 'Виджет не сохранён — сохраните дашборд.';
      this.render();
      return;
    }

    const form = this.element.querySelector('.data-input-form');
    const fields = this._visibleFields().filter((f) => f.type !== 'formula');
    this._draftValues = collectFormData(form, fields);

    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = '…';
    try {
      const currentEl = form?.querySelector(`[name="${CSS.escape(fieldName)}"]`);
      const currentValue =
        currentEl && 'value' in currentEl ? String(/** @type {HTMLInputElement} */ (currentEl).value || '') : '';
      const res = await suggestDataInputPrimaryKey(wid, fieldName, currentValue);
      const value = res?.value;
      this._draftValues = { ...(this._draftValues || {}), [fieldName]: value };
      this._pkConflictFields.delete(fieldName);
      this._submitError = null;
      this._submitSuccess = null;
      this.render();
      const input = this.element.querySelector(`[name="${CSS.escape(fieldName)}"]`);
      if (input && 'value' in input) {
        input.focus();
        input.select?.();
      }
      if (value != null && String(value).trim() !== '') {
        void this._checkPkOccupied(fieldName, value);
      }
    } catch (err) {
      const parsed = parseDataInputErrorDetail(err?.response?.data?.detail);
      this._submitError = parsed?.message || String(err?.message || err);
      this.render();
    } finally {
      // render() rebuilds DOM; ignore btn restore
      void prevLabel;
    }
  }

  _writeBlockedReason() {
    if (isDataBindingUnavailable(this)) {
      return 'Поле данных недоступно — обновите привязку модели.';
    }
    const modelId = this.settings?.modelId ?? this.dataSource?.modelId;
    if (modelId == null || modelId === '') {
      return 'Модель данных не привязана — обновите виджет.';
    }
    if (this._formSchema && this._formSchema.can_write === false) {
      return 'Нет права редактирования модели данных — ввод недоступен.';
    }
    return null;
  }

  async _handleSubmit(e) {
    e.preventDefault();
    if (!this._isInteractive()) return;
    if (this._submitInFlight) return;
    const blocked = this._writeBlockedReason();
    if (blocked) {
      this._submitError = blocked;
      this.render();
      return;
    }
    const wid = this._numericWidgetId();
    if (!wid) {
      this._submitError = 'Виджет не сохранён — сохраните дашборд';
      this.render();
      return;
    }

    const form = this.element.querySelector('.data-input-form');
    const fields = this._visibleFields().filter((f) => f.type !== 'formula');
    const raw = collectFormData(form, fields);
    this._draftValues = { ...raw };

    const fingerprint = fingerprintDataInputPayload(raw);
    if (fingerprint && fingerprint === this._lastSubmittedFingerprint) {
      this._submitSuccess = null;
      this._submitError = DUPLICATE_PAYLOAD_MESSAGE;
      this.render();
      return;
    }

    for (const field of fields) {
      const type = String(field.type || '').toLowerCase();
      if ((type === 'file' || type === 'image') && raw[field.name] instanceof File) {
        try {
          const up = await uploadDataInputFile(wid, raw[field.name]);
          raw[field.name] = up.file_id || up.url;
          this._draftValues[field.name] = raw[field.name];
        } catch (err) {
          this._submitError = err?.response?.data?.detail || 'Upload failed';
          this.render();
          return;
        }
      }
    }

    const postUploadFingerprint = fingerprintDataInputPayload(raw);
    if (postUploadFingerprint && postUploadFingerprint === this._lastSubmittedFingerprint) {
      this._submitSuccess = null;
      this._submitError = DUPLICATE_PAYLOAD_MESSAGE;
      this.render();
      return;
    }

    this._submitError = null;
    this._submitSuccess = null;
    this._pkConflictFields = new Set();
    this._submitInFlight = true;
    this.render();

    try {
      await insertDataInput(wid, raw, this.settings.schema_hash || this._formSchema?.schema_hash);
      this._lastSubmittedFingerprint = postUploadFingerprint || fingerprint;
      this._submitSuccess = 'Сохранено';
      this._draftValues = null;
      this._pkConflictFields = new Set();
      form?.reset();
      invalidateDashboardTransportCaches({ filtersChanged: false, dataChanged: true });
      eventBus.emit('dashboard:data-input-submitted', { widgetId: wid, widget: this });
    } catch (err) {
      const parsed = parseDataInputErrorDetail(err?.response?.data?.detail);
      if (parsed?.code === 'pk_taken') {
        this._pkConflictFields = new Set(parsed.fields || []);
        this._submitError =
          parsed.message ||
          'Primary key уже занят. Сгенерируйте новое значение и повторите сохранение.';
      } else if (parsed?.code === 'duplicate_payload') {
        this._lastSubmittedFingerprint = postUploadFingerprint || fingerprint;
        this._submitError = parsed.message || DUPLICATE_PAYLOAD_MESSAGE;
      } else {
        this._submitError = parsed?.message || String(err?.message || err);
      }
    } finally {
      this._submitInFlight = false;
      this.render();
    }
  }

  async reloadFromDataModel(engine) {
    if (!engine) return;
    await this._loadSchema();
    this.update();
  }

  destroy() {
    if (this._selectOptionsTimer) {
      clearTimeout(this._selectOptionsTimer);
      this._selectOptionsTimer = null;
    }
    this._selectOptionsGen += 1;
    this._clearPkCheckTimers();
    const form = this.element?.querySelector('.data-input-form');
    if (form && this._boundSubmit) {
      form.removeEventListener('submit', this._boundSubmit);
    }
    if (form && this._boundClick) {
      form.removeEventListener('click', this._boundClick);
    }
    if (form && this._boundPkInput) {
      form.removeEventListener('input', this._boundPkInput);
      form.removeEventListener('change', this._boundPkInput);
    }
    super.destroy?.();
  }

  toJSON() {
    return { ...super.toJSON(), settings: this.settings };
  }

  fromJSON(json) {
    super.fromJSON(json);
    this.settings = migrateDataInputSettings({
      ...createDefaultDataInputSettings(),
      ...(json.settings || {}),
    });
    this._formSchema = null;
    this._draftValues = null;
    this._pkConflictFields = new Set();
    this._resolvedSelectOptions = new Map();
    this._submitInFlight = false;
    this._lastSubmittedFingerprint = null;
    this.render();
    this._scheduleSelectOptionsResolve();
  }
}
