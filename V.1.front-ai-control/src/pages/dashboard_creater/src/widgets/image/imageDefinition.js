import { defineWidget } from '../../sdk/defineWidget.js';
import { ImageWidget } from './ImageWidget.js';
import { eventBus } from '../../core/EventBus.js';
import { dashboardService } from '../../../../../services/dashboardService.js';
import { dataModelService } from '../../../../../services/dataModelService.js';
import { isModelMediaFile, modelFileUri } from './imageResolve.js';
import {
  normalizeAudioTrackPlacement,
  normalizeAudioTrackSort,
} from './audioPlayerPanel.js';

function getBoundField(widget) {
  const ds = widget?.dataSource;
  if (ds?.modelId == null || !ds?.table || !ds?.field) return null;
  return {
    field: String(ds.field),
    table: String(ds.table || ''),
    modelId: ds.modelId,
    modelName: ds.modelName ? String(ds.modelName) : '',
  };
}

/**
 * @typedef {{ id: number, name: string }} ModelOption
 */

/**
 * Resolve models available for media browsing (binding → settings → dashboard links).
 * @param {import('../../sdk/createSettingsPanelApi.js').SettingsPanelApi} api
 * @returns {Promise<ModelOption[]>}
 */
async function resolveAssetModels(api) {
  /** @type {Map<number, string>} */
  const byId = new Map();
  const push = (rawId, name) => {
    const n = Number(rawId);
    if (!Number.isFinite(n) || n <= 0) return;
    const label = (name && String(name).trim()) || byId.get(n) || `Модель #${n}`;
    if (!byId.has(n) || (name && String(name).trim())) {
      byId.set(n, label);
    }
  };

  const w = api.widget;
  push(w?.dataSource?.modelId ?? w?.dataSource?.model_id, w?.dataSource?.modelName);
  push(w?.settings?.modelId ?? w?.settings?.model_id, w?.settings?.modelName);
  push(w?.settings?.assetModelId, null);

  const dashboardId = api.engine?.dashboardId;
  if (dashboardId != null && dashboardId !== '') {
    try {
      const res = await dashboardService.getDashboardDataModels(dashboardId);
      const list = Array.isArray(res) ? res : res?.data_models || res?.data || [];
      list.forEach((m) => push(m?.id ?? m?.model_id ?? m, m?.name ?? m?.title));
    } catch {
      /* ignore */
    }
  }

  const widgets = api.engine?.widgetManager?.getAllWidgets?.() || [];
  widgets.forEach((other) => {
    push(other?.dataSource?.modelId ?? other?.dataSource?.model_id, other?.dataSource?.modelName);
    push(other?.settings?.modelId, other?.settings?.modelName);
  });

  const missing = [...byId.entries()].filter(([, name]) => /^Модель #\d+$/.test(name)).map(([id]) => id);
  if (missing.length) {
    try {
      const all = await dataModelService.getDataModels();
      const list = Array.isArray(all) ? all : all?.data_models || all?.data || [];
      const nameById = new Map(
        list
          .map((m) => [Number(m?.id), m?.name])
          .filter(([id, name]) => Number.isFinite(id) && id > 0 && name),
      );
      missing.forEach((id) => {
        const name = nameById.get(id);
        if (name) byId.set(id, String(name));
      });
    } catch {
      /* ignore */
    }
  }

  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function renderImageSettingsPanel(api) {
  const wrap = document.createElement('div');

  const fitGroup = document.createElement('div');
  fitGroup.className = 'style-control-group';
  const fitLabel = document.createElement('label');
  fitLabel.className = 'style-label';
  fitLabel.textContent = 'Object-fit';
  const fitSelect = document.createElement('select');
  fitSelect.className = 'style-input';
  for (const opt of ['contain', 'cover', 'fill', 'none', 'scale-down']) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    fitSelect.appendChild(o);
  }
  fitSelect.value = api.getSettings().objectFit || 'contain';
  fitSelect.addEventListener('change', () => {
    api.patchSettings({ objectFit: fitSelect.value });
    api.widget.render();
  });
  fitGroup.appendChild(fitLabel);
  fitGroup.appendChild(fitSelect);

  const altGroup = document.createElement('div');
  altGroup.className = 'style-control-group';
  const altLabel = document.createElement('label');
  altLabel.className = 'style-label';
  altLabel.textContent = 'Alt / title';
  const altInput = document.createElement('input');
  altInput.className = 'style-input';
  altInput.value = api.getSettings().alt || '';
  altInput.addEventListener('input', () => {
    api.patchSettings({ alt: altInput.value });
  });
  altGroup.appendChild(altLabel);
  altGroup.appendChild(altInput);

  const waitingGroup = document.createElement('div');
  waitingGroup.className = 'style-control-group';
  const waitingLabel = document.createElement('label');
  waitingLabel.className = 'style-label';
  waitingLabel.textContent = 'Текст, пока не одно значение';
  const waitingInput = document.createElement('input');
  waitingInput.className = 'style-input';
  waitingInput.placeholder = 'Например: Выберите одну запись';
  waitingInput.value = api.getSettings().waitingText || '';
  waitingInput.addEventListener('change', () => {
    api.patchSettings({ waitingText: waitingInput.value });
    api.widget.render();
  });
  waitingInput.addEventListener('input', () => {
    api.patchSettings({ waitingText: waitingInput.value });
  });
  const waitingHint = document.createElement('div');
  waitingHint.style.cssText =
    'margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;';
  waitingHint.textContent =
    'Поле может вернуть массив ссылок. Медиа показывается только если после фильтров осталось ровно одно значение (картинка, видео, PDF или ссылка YouTube/Vimeo/…). Иначе — пустой экран или этот текст.';
  waitingGroup.appendChild(waitingLabel);
  waitingGroup.appendChild(waitingInput);
  waitingGroup.appendChild(waitingHint);

  /** Music player options — relevant when current media is audio */
  const musicGroup = document.createElement('div');
  musicGroup.className = 'style-control-group';
  musicGroup.dataset.mediaMusicSettings = '1';

  const musicTitle = document.createElement('label');
  musicTitle.className = 'style-label';
  musicTitle.textContent = 'Музыка';
  musicGroup.appendChild(musicTitle);

  const playlistRow = document.createElement('label');
  playlistRow.style.cssText =
    'display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer;margin-top:0.35rem;';
  const playlistCb = document.createElement('input');
  playlistCb.type = 'checkbox';
  playlistCb.checked = api.getSettings().audioPlaylistEnabled !== false;
  const playlistText = document.createElement('span');
  playlistText.textContent = 'Плеер с каруселью треков модели';
  playlistRow.appendChild(playlistCb);
  playlistRow.appendChild(playlistText);
  musicGroup.appendChild(playlistRow);

  const searchRow = document.createElement('label');
  searchRow.style.cssText =
    'display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer;margin-top:0.5rem;';
  const searchCb = document.createElement('input');
  searchCb.type = 'checkbox';
  searchCb.checked = api.getSettings().audioShowSearch !== false;
  const searchText = document.createElement('span');
  searchText.textContent = 'Показывать поиск по трекам';
  searchRow.appendChild(searchCb);
  searchRow.appendChild(searchText);
  musicGroup.appendChild(searchRow);

  const placementGroup = document.createElement('div');
  placementGroup.style.cssText = 'margin-top:0.55rem;';
  const placementLabel = document.createElement('label');
  placementLabel.className = 'style-label';
  placementLabel.textContent = 'Расположение треков';
  const placementSelect = document.createElement('select');
  placementSelect.className = 'style-input';
  for (const opt of [
    { value: 'bottom', label: 'Снизу' },
    { value: 'right', label: 'Справа' },
  ]) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    placementSelect.appendChild(o);
  }
  placementSelect.value = normalizeAudioTrackPlacement(api.getSettings().audioTrackPlacement);
  placementGroup.appendChild(placementLabel);
  placementGroup.appendChild(placementSelect);
  musicGroup.appendChild(placementGroup);

  const sortGroup = document.createElement('div');
  sortGroup.style.cssText = 'margin-top:0.55rem;';
  const sortLabel = document.createElement('label');
  sortLabel.className = 'style-label';
  sortLabel.textContent = 'Сортировка треков';
  const sortSelect = document.createElement('select');
  sortSelect.className = 'style-input';
  for (const opt of [
    { value: 'model', label: 'Как в модели' },
    { value: 'name-asc', label: 'Название А–Я' },
    { value: 'name-desc', label: 'Название Я–А' },
    { value: 'date-new', label: 'Сначала новые' },
    { value: 'date-old', label: 'Сначала старые' },
  ]) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sortSelect.appendChild(o);
  }
  sortSelect.value = normalizeAudioTrackSort(api.getSettings().audioTrackSort);
  sortGroup.appendChild(sortLabel);
  sortGroup.appendChild(sortSelect);
  musicGroup.appendChild(sortGroup);

  const musicHint = document.createElement('div');
  musicHint.style.cssText =
    'margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;';
  musicHint.textContent =
    'Если плеер выключен — воспроизводится только выбранный трек. При включённом плеере треки листаются по одному. Расположение — где стоит карусель, сортировка меняет порядок треков в ней.';
  musicGroup.appendChild(musicHint);

  const syncMusicUi = () => {
    const playlistOn = playlistCb.checked;
    searchRow.style.display = playlistOn ? 'flex' : 'none';
    placementGroup.style.display = playlistOn ? 'block' : 'none';
    sortGroup.style.display = playlistOn ? 'block' : 'none';
  };
  syncMusicUi();

  const applyMusicSettings = () => {
    const playlistOn = playlistCb.checked;
    api.patchSettings({
      audioPlaylistEnabled: playlistOn,
      audioShowSearch: playlistOn ? searchCb.checked : api.getSettings().audioShowSearch !== false,
      audioTrackPlacement: normalizeAudioTrackPlacement(placementSelect.value),
      audioTrackSort: normalizeAudioTrackSort(sortSelect.value),
    });
    syncMusicUi();
    const w = api.widget;
    if (typeof w?.reloadFromDataModel === 'function') {
      void w.reloadFromDataModel(api.engine);
    } else if (typeof w?.render === 'function') {
      w.render();
    }
  };
  playlistCb.addEventListener('change', applyMusicSettings);
  searchCb.addEventListener('change', applyMusicSettings);
  placementSelect.addEventListener('change', applyMusicSettings);
  sortSelect.addEventListener('change', applyMusicSettings);

  const refreshMusicVisibility = () => {
    const w = api.widget;
    const kind = w?._mediaKind;
    const staticSrc = String(api.getSettings().staticSrc || '');
    const looksAudio =
      kind === 'audio' ||
      /\.(mp3|wav|m4a|aac|flac|oga|ogg)(?:[?#]|$)/i.test(staticSrc) ||
      /audio/i.test(staticSrc);
    musicGroup.style.display = looksAudio || kind === 'audio' ? '' : 'none';
  };
  refreshMusicVisibility();
  api.onChange?.(refreshMusicVisibility);

  const staticGroup = document.createElement('div');
  staticGroup.className = 'style-control-group';
  const staticLabel = document.createElement('label');
  staticLabel.className = 'style-label';
  staticLabel.textContent = 'URL / YouTube / model-file:// / asset://';
  const staticInput = document.createElement('input');
  staticInput.className = 'style-input';
  staticInput.placeholder = 'https://youtu.be/… или model-file://…';
  staticInput.value = api.getSettings().staticSrc || '';
  const applyStaticSrc = (value) => {
    api.patchSettings({ staticSrc: value });
    if (typeof api.widget.reloadFromDataModel === 'function') {
      api.widget.reloadFromDataModel(api.engine);
    } else if (typeof api.widget.render === 'function') {
      api.widget.render();
    }
  };
  staticInput.addEventListener('change', () => {
    applyStaticSrc(staticInput.value);
  });
  staticGroup.appendChild(staticLabel);
  staticGroup.appendChild(staticInput);

  /** Slot: bound field chip XOR model/file pickers */
  const sourceSlot = document.createElement('div');
  sourceSlot.className = 'media-widget-source-slot';

  const renderBoundFieldChip = (bound) => {
    const group = document.createElement('div');
    group.className = 'style-control-group';
    const label = document.createElement('label');
    label.className = 'style-label';
    label.textContent = 'Поле';
    const chips = document.createElement('div');
    chips.className = 'data-binding-chips';
    const chip = document.createElement('span');
    chip.className = 'data-binding-chip';
    chip.title = bound.table ? `${bound.table}.${bound.field}` : bound.field;
    const name = document.createElement('span');
    name.className = 'data-binding-chip-label';
    name.textContent = bound.field;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'data-binding-chip-remove';
    removeBtn.title = 'Убрать поле';
    removeBtn.setAttribute('aria-label', 'Убрать поле');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const w = api.widget;
      if (!w) return;
      w.dataSource = null;
      eventBus.emit('widget:data-binding-updated', { widget: w });
      if (api.engine?.saveSnapshot) api.engine.saveSnapshot();
      void api.requestReload();
      renderSourceSlot();
    });
    chip.appendChild(name);
    chip.appendChild(removeBtn);
    chips.appendChild(chip);
    if (bound.table || bound.modelName) {
      const meta = document.createElement('div');
      meta.style.cssText =
        'margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;';
      meta.textContent = [bound.modelName, bound.table].filter(Boolean).join(' · ');
      group.appendChild(label);
      group.appendChild(chips);
      group.appendChild(meta);
    } else {
      group.appendChild(label);
      group.appendChild(chips);
    }
    return group;
  };

  const renderModelPickers = () => {
    const frag = document.createDocumentFragment();

    const modelGroup = document.createElement('div');
    modelGroup.className = 'style-control-group';
    const modelLabel = document.createElement('label');
    modelLabel.className = 'style-label';
    modelLabel.textContent = 'Модель данных';
    const modelSelect = document.createElement('select');
    modelSelect.className = 'style-input';
    const modelPlaceholder = document.createElement('option');
    modelPlaceholder.value = '';
    modelPlaceholder.textContent = 'Загрузка…';
    modelSelect.appendChild(modelPlaceholder);
    modelGroup.appendChild(modelLabel);
    modelGroup.appendChild(modelSelect);

    const pickerGroup = document.createElement('div');
    pickerGroup.className = 'style-control-group';
    const pickerLabel = document.createElement('label');
    pickerLabel.className = 'style-label';
    pickerLabel.textContent = 'Файлы модели (изображение / видео / PDF)';
    const pickerSelect = document.createElement('select');
    pickerSelect.className = 'style-input';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '—';
    pickerSelect.appendChild(emptyOpt);
    const statusHint = document.createElement('div');
    statusHint.style.cssText =
      'margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;';
    statusHint.textContent = 'Загрузка списка…';
    pickerGroup.appendChild(pickerLabel);
    pickerGroup.appendChild(pickerSelect);
    pickerGroup.appendChild(statusHint);

    const loadMediaForModel = async (modelId) => {
      while (pickerSelect.options.length > 1) {
        pickerSelect.remove(1);
      }
      if (!modelId) {
        statusHint.textContent =
          'Нет модели данных. Привяжите поле с вкладки «Данные» или добавьте модель к дашборду.';
        return;
      }
      statusHint.textContent = 'Загрузка файлов модели…';
      try {
        const { files } = await dataModelService.getModelFiles(modelId);
        const media = (files || []).filter(isModelMediaFile);
        if (!media.length) {
          statusHint.textContent =
            'В модели нет медиа (image/video/pdf). Загрузите файл с подходящей ролью или расширением.';
          return;
        }
        for (const f of media) {
          const fileId = f.data_model_file_id ?? f.id;
          const o = document.createElement('option');
          o.value = modelFileUri(modelId, fileId);
          o.textContent = f.original_filename || f.filename || `file #${fileId}`;
          pickerSelect.appendChild(o);
        }
        const cur = api.getSettings().staticSrc || '';
        if (cur) pickerSelect.value = cur;
        statusHint.textContent = `Найдено медиа-файлов: ${media.length}`;
      } catch (err) {
        const detail = err?.response?.data?.detail || err?.message || 'ошибка';
        statusHint.textContent = `Не удалось загрузить файлы модели: ${detail}`;
      }
    };

    resolveAssetModels(api).then((models) => {
      if (!sourceSlot.contains(modelSelect)) return;
      modelSelect.innerHTML = '';
      if (!models.length) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Нет доступных моделей';
        modelSelect.appendChild(o);
        statusHint.textContent =
          'Привяжите поле модели к виджету или подключите data model к дашборду.';
        return;
      }
      const preferred = Number(
        api.widget?.dataSource?.modelId
          ?? api.getSettings().assetModelId
          ?? api.getSettings().modelId
          ?? models[0].id,
      );
      for (const m of models) {
        const o = document.createElement('option');
        o.value = String(m.id);
        o.textContent = m.name;
        modelSelect.appendChild(o);
      }
      const selected = models.some((m) => m.id === preferred) ? preferred : models[0].id;
      modelSelect.value = String(selected);
      api.patchSettings({ assetModelId: selected });
      loadMediaForModel(selected);
    });

    modelSelect.addEventListener('change', () => {
      const id = Number(modelSelect.value);
      if (!Number.isFinite(id) || id <= 0) {
        loadMediaForModel(null);
        return;
      }
      api.patchSettings({ assetModelId: id });
      loadMediaForModel(id);
    });

    pickerSelect.addEventListener('change', () => {
      if (!pickerSelect.value) return;
      staticInput.value = pickerSelect.value;
      applyStaticSrc(pickerSelect.value);
    });

    frag.appendChild(modelGroup);
    frag.appendChild(pickerGroup);
    return frag;
  };

  const renderSourceSlot = () => {
    sourceSlot.replaceChildren();
    const bound = getBoundField(api.widget);
    if (bound) {
      staticGroup.style.display = 'none';
      sourceSlot.appendChild(renderBoundFieldChip(bound));
    } else {
      staticGroup.style.display = '';
      sourceSlot.appendChild(renderModelPickers());
    }
  };

  renderSourceSlot();

  wrap.appendChild(fitGroup);
  wrap.appendChild(altGroup);
  wrap.appendChild(waitingGroup);
  wrap.appendChild(musicGroup);
  wrap.appendChild(staticGroup);
  wrap.appendChild(sourceSlot);
  return wrap;
}

export const imageDefinition = defineWidget({
  type: 'image',
  displayName: 'Медиа',
  category: 'content',
  defaultSize: { width: 520, height: 300 },
  defaultSettings: () => ({
    objectFit: 'contain',
    alt: '',
    staticSrc: '',
    waitingText: '',
    assetModelId: null,
    audioPlaylistEnabled: true,
    audioShowSearch: true,
    audioTrackPlacement: 'bottom',
    audioTrackSort: 'model',
  }),
  capabilities: {
    dataBinding: 'single-field',
    formulas: true,
    reloadable: true,
  },
  WidgetClass: ImageWidget,
  settingsPanel: {
    sections: [
      {
        id: 'image-content',
        title: 'Медиа',
        render: renderImageSettingsPanel,
      },
    ],
  },
  paletteDefaults: () => ({
    width: 520,
    height: 300,
    settings: {
      objectFit: 'contain',
      alt: '',
      staticSrc: '',
      waitingText: '',
      assetModelId: null,
      audioPlaylistEnabled: true,
      audioShowSearch: true,
      audioTrackPlacement: 'bottom',
      audioTrackSort: 'model',
    },
  }),
});

export default imageDefinition;
