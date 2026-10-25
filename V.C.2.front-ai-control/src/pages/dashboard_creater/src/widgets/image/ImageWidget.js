import { WidgetBase } from '../../core/WidgetBase.js';
import { renderWidgetDataPlaceholder } from '../../core/widgetDataBinding.js';
import { collectDashboardFilters, filtersForModel } from '../../../../../services/dashboardFilterUtils.js';
import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import apiClient from '../../../../../services/apiClient.js';
import { dataModelService } from '../../../../../services/dataModelService.js';
import { getAvatarUrl } from '../../../../../utils/getAvatarUrl.js';
import { MediaAudioPlayer, normalizeAudioTrackPlacement, normalizeAudioTrackSort } from './audioPlayerPanel.js';
import {
  collectUniqueImageValues,
  coerceMediaBlob,
  parseImageValue,
  resolveHttpOrStaticUrl,
  resolveMediaPresentation,
} from './imageResolve.js';
import { defaultTextColor, defaultFontFamily } from '../../theme/themeRuntime.js';

const SELECT_LIMIT = 500;

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fillShell(inner) {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;">${inner}</div>`;
}

/**
 * Media widget (type `image` for backward compatibility).
 * Shows one media item when the bound field resolves to exactly one value.
 * Supports image, video, pdf, audio (full player), and social embeds.
 */
export class ImageWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'image',
      width: config.width || 520,
      height: config.height || 300,
    });
    const s = config.settings || {};
    this.settings = {
      objectFit: s.objectFit || 'contain',
      alt: s.alt != null ? String(s.alt) : '',
      staticSrc: s.staticSrc != null ? String(s.staticSrc) : '',
      /** Shown when bound field has 0 or >1 values (filter not narrowed to one). */
      waitingText: s.waitingText != null ? String(s.waitingText) : '',
      /** Full playlist player vs single track. */
      audioPlaylistEnabled: s.audioPlaylistEnabled !== false,
      /** Search bar inside playlist player. */
      audioShowSearch: s.audioShowSearch !== false,
      /** Carousel strip: bottom or right of the player. */
      audioTrackPlacement: s.audioTrackPlacement || 'bottom',
      /** Playlist order: model | name-asc | name-desc | date-new | date-old. */
      audioTrackSort: s.audioTrackSort || 'model',
      ...s,
    };
    // Normalize booleans after spread (legacy saves may omit keys)
    if (this.settings.audioPlaylistEnabled == null) this.settings.audioPlaylistEnabled = true;
    if (this.settings.audioShowSearch == null) this.settings.audioShowSearch = true;
    this.settings.audioPlaylistEnabled = this.settings.audioPlaylistEnabled !== false;
    this.settings.audioShowSearch = this.settings.audioShowSearch !== false;
    this.settings.audioTrackPlacement = normalizeAudioTrackPlacement(this.settings.audioTrackPlacement);
    this.settings.audioTrackSort = normalizeAudioTrackSort(this.settings.audioTrackSort);
    /** @type {string} */
    this._displaySrc = '';
    /** @type {string|null} */
    this._embedSrc = null;
    /** @type {'image'|'video'|'pdf'|'audio'|'embed'|'link'} */
    this._mediaKind = 'image';
    /** @type {string|null} */
    this._objectUrl = null;
    /** @type {string} */
    this._error = '';
    /** @type {'idle'|'waiting'|'ready'|'error'} */
    this._mode = 'idle';
    /** @type {number} */
    this._valueCount = 0;
    /** @type {number} */
    this._reloadSeq = 0;
    /** @type {string} */
    this._trackTitle = '';
    /** @type {MediaAudioPlayer|null} */
    this._audioPlayer = null;
    /** @type {HTMLElement|null} */
    this._profileLightbox = null;
    /** @type {(e: KeyboardEvent) => void | null} */
    this._profileLightboxKeyHandler = null;
  }

  _revokeObjectUrl() {
    if (this._objectUrl) {
      try {
        URL.revokeObjectURL(this._objectUrl);
      } catch {
        /* ignore */
      }
      this._objectUrl = null;
    }
  }

  _teardownAudioPlayer() {
    if (this._audioPlayer) {
      this._audioPlayer.destroy();
      this._audioPlayer = null;
    }
  }

  destroy() {
    this._closeProfileLightbox();
    this._teardownAudioPlayer();
    this._revokeObjectUrl();
    if (typeof super.destroy === 'function') super.destroy();
  }

  _clearImageState({ mode = 'idle', error = '' } = {}) {
    this._teardownAudioPlayer();
    this._revokeObjectUrl();
    this._displaySrc = '';
    this._embedSrc = null;
    this._mediaKind = 'image';
    this._trackTitle = '';
    this._error = error;
    this._mode = mode;
  }

  /**
   * Like _clearImageState but keeps the audio player alive (preserves playback).
   * Used when data reload produces an audio result again.
   */
  _clearImageStateKeepAudio({ mode = 'idle', error = '' } = {}) {
    this._revokeObjectUrl();
    this._displaySrc = '';
    this._embedSrc = null;
    this._mediaKind = 'image';
    this._trackTitle = '';
    this._error = error;
    this._mode = mode;
  }

  /**
   * @param {string} src
   * @param {string|null|undefined} [mimeHint]
   * @param {string|null|undefined} [originalUrl]
   * @param {string|null|undefined} [filenameHint]
   * @param {string|null|undefined} [forcedKind]
   */
  _setPresentation(src, mimeHint, originalUrl, filenameHint, forcedKind) {
    if (forcedKind && ['image', 'video', 'audio', 'pdf', 'embed', 'link'].includes(forcedKind)) {
      this._mediaKind = forcedKind;
      this._displaySrc = src;
      this._embedSrc = forcedKind === 'embed' ? src : null;
      this._mode = 'ready';
      this._error = '';
      if (filenameHint) {
        this._trackTitle = String(filenameHint).replace(/\.[a-z0-9]+$/i, '') || String(filenameHint);
      }
      return;
    }
    const probe = originalUrl || src;
    const { mediaKind, displaySrc, embedSrc } = resolveMediaPresentation(
      probe,
      mimeHint,
      filenameHint,
    );
    this._mediaKind = mediaKind;
    if (filenameHint) {
      this._trackTitle = String(filenameHint).replace(/\.[a-z0-9]+$/i, '') || String(filenameHint);
    }
    if (mediaKind === 'embed') {
      this._displaySrc = displaySrc;
      this._embedSrc = embedSrc || displaySrc;
    } else {
      this._displaySrc = src.startsWith('blob:') ? src : displaySrc || src;
      this._embedSrc = null;
    }
    this._mode = 'ready';
    this._error = '';
  }

  /**
   * Build / refresh playlist when current media is audio.
   * @param {number|null} modelId
   * @param {{ fileId?: number|null, raw?: string, title?: string }} [opts]
   */
  async _prepareAudioPlayer(modelId, opts = {}) {
    if (!this._audioPlayer) this._audioPlayer = new MediaAudioPlayer(this);
    // Save playback state before potentially reloading tracks/layout
    this._audioPlayer._savePlaybackState();
    this._audioPlayer.setUiOptions({
      playlist: this.settings.audioPlaylistEnabled !== false,
      showSearch: this.settings.audioShowSearch !== false,
      trackPlacement: this.settings.audioTrackPlacement,
      trackSort: this.settings.audioTrackSort,
    });
    // Preserve current track key across reload if tracks still contain it
    const prevKey = this._audioPlayer.currentKey;
    await this._audioPlayer.loadFromModel(modelId, opts.fileId ?? null, {
      raw: opts.raw || this._displaySrc,
      title: opts.title || this._trackTitle || this.settings.alt || 'Трек',
    });
    // Restore key if it still exists in the new track list
    if (prevKey && this._audioPlayer._allTracks.some((t) => t.key === prevKey)) {
      this._audioPlayer.currentKey = prevKey;
      this._audioPlayer._applyTrackMode();
    }
  }

  _renderWaiting(content, waitingText, color, fontFamily) {
    this._teardownAudioPlayer();
    if (waitingText) {
      content.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
          box-sizing:border-box;padding:16px;text-align:center;color:${escHtml(color)};
          font-family:'${escHtml(fontFamily).replace(/'/g, '&#39;')}',sans-serif;font-size:14px;line-height:1.4;opacity:0.85;">
          ${escHtml(waitingText)}
        </div>`;
      return;
    }
    content.innerHTML = '';
  }

  _renderMediaHtml() {
    const fit = ['contain', 'cover', 'fill', 'none', 'scale-down'].includes(this.settings.objectFit)
      ? this.settings.objectFit
      : 'contain';
    const alt = escHtml(this.settings.alt || '');
    const src = escHtml(this._displaySrc);
    const kind = this._mediaKind;

    if (kind === 'embed') {
      const embed = escHtml(this._embedSrc || this._displaySrc);
      return fillShell(`
        <iframe src="${embed}" title="${alt || 'Видео'}"
          style="border:0;width:100%;height:100%;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`);
    }
    if (kind === 'video') {
      return fillShell(`
        <video src="${src}" controls playsinline preload="metadata"
          style="max-width:100%;max-height:100%;width:100%;height:100%;object-fit:${fit};display:block;background:#000;"></video>`);
    }
    if (kind === 'pdf') {
      return fillShell(`
        <iframe src="${src}" title="${alt || 'PDF'}"
          style="border:0;width:100%;height:100%;background:#fff;"></iframe>`);
    }
    if (kind === 'link') {
      const href = escHtml(this._displaySrc);
      return fillShell(`
        <div style="width:100%;height:100%;position:relative;box-sizing:border-box;">
          <iframe src="${href}" title="${alt || 'Ссылка'}"
            style="border:0;width:100%;height:100%;" loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
          <a href="${href}" target="_blank" rel="noopener noreferrer"
            style="position:absolute;right:8px;bottom:8px;padding:4px 8px;font-size:11px;
              background:rgba(0,0,0,0.65);color:#fff;border-radius:4px;text-decoration:none;">Открыть</a>
        </div>`);
    }
    return fillShell(`
      <img src="${src}" alt="${alt}"
        style="max-width:100%;max-height:100%;width:100%;height:100%;object-fit:${fit};display:block;" />`);
  }

  render() {
    const content = this.element?.querySelector('.widget-content');
    if (!content) return;

    const ds = this.dataSource;
    const hasBinding = ds?.modelId != null && !!ds?.table && !!ds?.field;
    const hasStatic = !!(this.settings.staticSrc || '').trim();
    const waitingText = (this.settings.waitingText || '').trim();
    const typography = this.styles?.typography || {};
    const color = typography.color || defaultTextColor();
    const fontFamily = typography.fontFamily || defaultFontFamily();

    if (this._error && this._mode === 'error') {
      this._teardownAudioPlayer();
      content.innerHTML = `<div style="padding:12px;color:#f87171;font-size:12px;">${escHtml(this._error)}</div>`;
      return;
    }

    if (this._mode === 'waiting' || (hasBinding && !this._displaySrc && this._mode !== 'ready')) {
      if (hasBinding || waitingText) {
        this._renderWaiting(content, waitingText, color, fontFamily);
        return;
      }
    }

    if (!hasBinding && !hasStatic && !this._displaySrc && this._mediaKind !== 'audio') {
      this._teardownAudioPlayer();
      content.innerHTML = renderWidgetDataPlaceholder(this, typography);
      return;
    }

    if (!this._displaySrc && this._mediaKind !== 'audio') {
      if (waitingText) {
        this._renderWaiting(content, waitingText, color, fontFamily);
        return;
      }
      this._teardownAudioPlayer();
      content.innerHTML = hasBinding ? '' : renderWidgetDataPlaceholder(this, typography);
      return;
    }

    if (this._mediaKind === 'audio') {
      if (!this._audioPlayer) this._audioPlayer = new MediaAudioPlayer(this);
      this._audioPlayer.setUiOptions({
        playlist: this.settings.audioPlaylistEnabled !== false,
        showSearch: this.settings.audioShowSearch !== false,
        trackPlacement: this.settings.audioTrackPlacement,
        trackSort: this.settings.audioTrackSort,
      });
      this._audioPlayer.mount(content);
      return;
    }

    this._teardownAudioPlayer();
    content.innerHTML = this._renderMediaHtml();
    this._bindProfileMediaInteraction(content);
  }

  _isProfileHost() {
    return Boolean(this.element?.classList.contains('widget--profile-host'));
  }

  _bindProfileMediaInteraction(content) {
    if (!this._isProfileHost() || !content) return;
    const img = content.querySelector('img');
    if (!img || !this._displaySrc) return;
    img.style.cursor = 'pointer';
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    img.setAttribute('title', 'Открыть');
    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._openProfileLightbox(this._displaySrc, this.settings.alt || '');
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') open(event);
    });
  }

  _openProfileLightbox(src, alt) {
    this._closeProfileLightbox();
    if (!src || typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.className = 'profile-media-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:9999',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.88)',
      'padding:16px',
      'box-sizing:border-box',
      'cursor:zoom-out',
    ].join(';');
    overlay.innerHTML = `
      <img src="${escHtml(src)}" alt="${escHtml(alt)}"
        style="max-width:100%;max-height:100%;object-fit:contain;display:block;cursor:default;box-shadow:0 12px 48px rgba(0,0,0,0.45);" />`;
    overlay.addEventListener('click', () => this._closeProfileLightbox());
    overlay.querySelector('img')?.addEventListener('click', (event) => event.stopPropagation());
    this._profileLightboxKeyHandler = (event) => {
      if (event.key === 'Escape') this._closeProfileLightbox();
    };
    document.addEventListener('keydown', this._profileLightboxKeyHandler);
    document.body.appendChild(overlay);
    this._profileLightbox = overlay;
  }

  _closeProfileLightbox() {
    if (this._profileLightboxKeyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._profileLightboxKeyHandler);
    }
    this._profileLightboxKeyHandler = null;
    if (this._profileLightbox?.parentNode) {
      this._profileLightbox.parentNode.removeChild(this._profileLightbox);
    }
    this._profileLightbox = null;
  }

  async _resolveModelFileMeta(modelId, fileId) {
    try {
      const { files } = await dataModelService.getModelFiles(modelId);
      const hit = (files || []).find((f) => {
        const id = Number(f.data_model_file_id ?? f.id);
        return id === Number(fileId);
      });
      if (!hit) return { mime: '', filename: '', role: '' };
      return {
        mime: hit.mime_type || hit.content_type || '',
        filename: hit.original_filename || hit.filename || '',
        role: hit.role || hit.file_role || '',
      };
    } catch {
      return { mime: '', filename: '', role: '' };
    }
  }

  async _applyRawValue(raw, modelId) {
    this._revokeObjectUrl();
    this._error = '';
    const parsed = parseImageValue(raw);
    if (parsed.kind === 'empty') {
      this._displaySrc = '';
      this._embedSrc = null;
      this._mode = 'waiting';
      return;
    }
    if (parsed.kind === 'url') {
      const resolved = resolveHttpOrStaticUrl(parsed.url, getAvatarUrl);
      this._setPresentation(resolved, null, parsed.url, parsed.url);
      if (this._mediaKind === 'audio') {
        await this._prepareAudioPlayer(modelId, {
          raw: resolved,
          title: this._trackTitle || 'Трек',
        });
      } else {
        this._teardownAudioPlayer();
      }
      return;
    }
    if (parsed.kind === 'model-file') {
      try {
        const meta = await this._resolveModelFileMeta(parsed.modelId, parsed.fileId);
        const rawBlob = await dataModelService.getModelFileBlob(parsed.modelId, parsed.fileId);
        const { blob, mime, mediaKind } = coerceMediaBlob(
          rawBlob,
          meta.mime,
          meta.filename,
        );
        const kindFromRole =
          meta.role === 'video' || meta.role === 'audio' || meta.role === 'pdf' || meta.role === 'image'
            ? meta.role
            : mediaKind;

        if (kindFromRole === 'audio') {
          // Playlist player owns object URLs; don't keep a separate display blob.
          this._setPresentation('', mime, null, meta.filename, 'audio');
          await this._prepareAudioPlayer(parsed.modelId, {
            fileId: parsed.fileId,
            raw: raw,
            title: this._trackTitle || meta.filename,
          });
          return;
        }

        this._teardownAudioPlayer();
        const objUrl = URL.createObjectURL(blob);
        this._objectUrl = objUrl;
        this._setPresentation(objUrl, mime, null, meta.filename, kindFromRole);
      } catch (e) {
        this._error = e?.response?.data?.detail || e?.message || 'Не удалось загрузить файл модели';
        this._displaySrc = '';
        this._mode = 'error';
      }
      return;
    }
    if (parsed.kind === 'asset') {
      if (modelId == null) {
        this._error = 'Нет modelId для asset://';
        this._displaySrc = '';
        this._mode = 'error';
        return;
      }
      try {
        const { data, headers } = await apiClient.get(`/data-models/${modelId}/assets/${parsed.sha}`, {
          responseType: 'blob',
        });
        const headerMime =
          headers?.['content-type'] || headers?.['Content-Type'] || data?.type || '';
        const { blob, mime, mediaKind } = coerceMediaBlob(data, headerMime, '');
        if (mediaKind === 'audio') {
          const objUrl = URL.createObjectURL(blob);
          this._objectUrl = objUrl;
          this._setPresentation(objUrl, mime, null, '', 'audio');
          await this._prepareAudioPlayer(modelId, {
            raw: objUrl,
            title: this.settings.alt || 'Трек',
          });
          return;
        }
        this._teardownAudioPlayer();
        const objUrl = URL.createObjectURL(blob);
        this._objectUrl = objUrl;
        this._setPresentation(objUrl, mime, null, '', mediaKind);
      } catch (e) {
        this._error = e?.response?.data?.detail || e?.message || 'Не удалось загрузить asset';
        this._displaySrc = '';
        this._mode = 'error';
      }
    }
  }

  _resolveAssetModelId() {
    const ds = this.dataSource;
    const fromDs = ds?.modelId ?? ds?.model_id;
    const fromSettings = this.settings?.assetModelId ?? this.settings?.modelId ?? this.settings?.model_id;
    const n = Number(fromDs ?? fromSettings);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async reloadFromDataModel(engine) {
    const seq = ++this._reloadSeq;
    const staticSrc = (this.settings.staticSrc || '').trim();
    const ds = this.dataSource;
    const assetModelId = this._resolveAssetModelId();

    if ((!ds || ds.modelId == null || !ds.table || !ds.field) && staticSrc) {
      await this._applyRawValue(staticSrc, assetModelId);
      if (seq === this._reloadSeq) this.update();
      return;
    }

    if (!engine || !ds?.modelId || !ds?.table || !ds?.field) {
      if (staticSrc) {
        await this._applyRawValue(staticSrc, assetModelId);
      } else if (assetModelId) {
        // No binding / static — still allow music library from selected model; reuse existing player
        if (!this._audioPlayer) this._audioPlayer = new MediaAudioPlayer(this);
        this._audioPlayer._savePlaybackState();
        const prevKey = this._audioPlayer.currentKey;
        this._audioPlayer.setUiOptions({
          playlist: this.settings.audioPlaylistEnabled !== false,
          showSearch: this.settings.audioShowSearch !== false,
          trackPlacement: this.settings.audioTrackPlacement,
          trackSort: this.settings.audioTrackSort,
        });
        await this._audioPlayer.loadFromModel(assetModelId, null, null);
        if (prevKey && this._audioPlayer._allTracks.some((t) => t.key === prevKey)) {
          this._audioPlayer.currentKey = prevKey;
          this._audioPlayer._applyTrackMode();
        }
        if (this._audioPlayer.tracks.length) {
          this._mediaKind = 'audio';
          this._mode = 'ready';
          this._displaySrc = this._audioPlayer.tracks[0].raw;
        } else {
          this._clearImageStateKeepAudio({ mode: 'idle' });
        }
      } else {
        this._clearImageState({ mode: 'idle' });
      }
      if (seq === this._reloadSeq) this.update();
      return;
    }

    const client = getDashboardDataModelClient(engine);
    if (!client) return;

    try {
      const filters = filtersForModel(collectDashboardFilters(engine), ds.modelId);
      const { rows } = await client.fetchSelect({
        modelId: ds.modelId,
        base_table: ds.table,
        columns: [ds.field],
        filters,
        limit: SELECT_LIMIT,
      });
      if (seq !== this._reloadSeq) return;

      const values = collectUniqueImageValues(rows, ds.field);
      this._valueCount = values.length;

      if (values.length === 1) {
        await this._applyRawValue(values[0], ds.modelId);
      } else {
        this._clearImageState({ mode: 'waiting' });
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (seq !== this._reloadSeq) return;
      console.error('ImageWidget reloadFromDataModel', e);
      this._clearImageState({
        mode: 'error',
        error: e?.message || 'Ошибка загрузки медиа',
      });
    }
    if (seq === this._reloadSeq) this.update();
  }

  toJSON() {
    return { ...super.toJSON(), settings: { ...this.settings } };
  }
}
