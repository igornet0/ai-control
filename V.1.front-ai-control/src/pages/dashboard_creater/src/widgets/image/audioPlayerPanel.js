/**
 * In-widget music player: search, playlist from model audio files, transport + volume.
 */

import { coerceMediaBlob, mediaKindFromMeta, modelFileUri } from './imageResolve.js';
import { dataModelService } from '../../../../../services/dataModelService.js';

const SVG = {
  prev: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`,
  next: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  shuffle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`,
  loopAll: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>`,
  loopOne: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-2.5-4.5h-1v-3l-2 1v1h1v1.5h-1V13h-1v1.5c0 .83.67 1.5 1.5 1.5H13c.83 0 1.5-.67 1.5-1.5v-1c0-.83-.67-1.5-1.5-1.5z"/></svg>`,
  volume: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  carouselPrevH: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
  carouselNextH: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
  carouselPrevV: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`,
  carouselNextV: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`,
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trackTitle(file) {
  const name = String(file.original_filename || file.filename || file.name || 'Трек').trim();
  return name.replace(/\.[a-z0-9]+$/i, '') || name;
}

export function isAudioModelFile(file) {
  if (!file) return false;
  const role = file.role || file.file_role || '';
  const mime = file.mime_type || file.content_type || '';
  const name = file.original_filename || file.filename || file.name || '';
  return mediaKindFromMeta(role, mime, name) === 'audio' || String(role).toLowerCase() === 'audio';
}

export const AUDIO_TRACK_SORTS = ['model', 'name-asc', 'name-desc', 'date-new', 'date-old'];
export const AUDIO_TRACK_PLACEMENTS = ['bottom', 'right'];

export function normalizeAudioTrackSort(value) {
  return AUDIO_TRACK_SORTS.includes(value) ? value : 'model';
}

export function normalizeAudioTrackPlacement(value) {
  return AUDIO_TRACK_PLACEMENTS.includes(value) ? value : 'bottom';
}

function trackCreatedMs(track) {
  const raw = track?.created;
  if (raw == null || raw === '') return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function trackOrder(track) {
  const n = Number(track?.fileOrder);
  return Number.isFinite(n) ? n : 0;
}

function compareTrackTitle(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru', { sensitivity: 'base', numeric: true });
}

export function sortAudioTracks(tracks, sort) {
  const list = [...(tracks || [])];
  const mode = normalizeAudioTrackSort(sort);
  list.sort((a, b) => {
    if (mode === 'name-asc') return compareTrackTitle(a.title, b.title) || trackOrder(a) - trackOrder(b);
    if (mode === 'name-desc') return compareTrackTitle(b.title, a.title) || trackOrder(a) - trackOrder(b);
    if (mode === 'date-new') return trackCreatedMs(b) - trackCreatedMs(a) || trackOrder(a) - trackOrder(b);
    if (mode === 'date-old') return trackCreatedMs(a) - trackCreatedMs(b) || trackOrder(a) - trackOrder(b);
    return trackOrder(a) - trackOrder(b) || trackCreatedMs(a) - trackCreatedMs(b) || compareTrackTitle(a.title, b.title);
  });
  return list;
}

const PLAYER_CSS = `
.media-audio-root {
  width: 100%; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px; color: #E4E6EB; font-family: Inter, system-ui, sans-serif;
  background: linear-gradient(160deg, rgba(20,24,32,0.95), rgba(12,14,20,0.98));
  overflow: hidden;
}
.media-audio-search {
  width: 100%; box-sizing: border-box; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
  background: rgba(255,255,255,0.04); color: inherit;
  padding: 8px 10px; font-size: 12px; outline: none;
}
.media-audio-search:focus { border-color: rgba(0,224,255,0.45); }
.media-audio-body {
  flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px;
}
.media-audio-main {
  flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column;
  justify-content: center; gap: 8px; padding: 2px 0;
}
.media-audio-title {
  font-size: 13px; font-weight: 600; line-height: 1.35;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.media-audio-meta { font-size: 11px; opacity: 0.55; }
.media-audio-seek, .media-audio-vol {
  width: 100%; accent-color: #00E0FF; cursor: pointer;
}
.media-audio-times {
  display: flex; justify-content: space-between; font-size: 10px; opacity: 0.55;
}
.media-audio-controls {
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.media-audio-btn {
  border: none; border-radius: 999px; cursor: pointer;
  background: rgba(255,255,255,0.08); color: inherit;
  width: 34px; height: 34px; font-size: 14px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
}
.media-audio-btn:hover { background: rgba(0,224,255,0.18); }
.media-audio-btn--play {
  width: 44px; height: 44px; font-size: 16px;
  background: rgba(0,224,255,0.2);
}
.media-audio-btn--active {
  background: rgba(0,224,255,0.28); color: #00E0FF;
}
.media-audio-btn--active:hover { background: rgba(0,224,255,0.38); }
.media-audio-vol-row {
  display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.85;
}
.media-audio-carousel-wrap {
  flex: 0 0 auto; min-height: 0; max-height: 38%;
  display: flex; flex-direction: column; gap: 6px;
  border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;
}
.media-audio-carousel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  flex-shrink: 0;
}
.media-audio-list-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
  opacity: 0.5;
}
.media-audio-carousel-index {
  font-size: 11px; opacity: 0.55; font-variant-numeric: tabular-nums;
}
.media-audio-carousel-row {
  display: flex; align-items: stretch; gap: 6px; min-height: 0;
}
.media-audio-carousel-nav {
  flex-shrink: 0; align-self: center;
  width: 28px; height: 28px; font-size: 13px;
}
.media-audio-carousel {
  flex: 1; min-width: 0;
  display: flex; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  gap: 0;
}
.media-audio-carousel::-webkit-scrollbar { height: 4px; }
.media-audio-carousel::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.18); border-radius: 999px;
}
.media-audio-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  box-sizing: border-box;
  border: none; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,0.04); color: inherit;
  padding: 10px 12px; font-size: 12px; line-height: 1.35;
  text-align: left;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.media-audio-slide:hover { background: rgba(255,255,255,0.07); }
.media-audio-slide.is-active {
  background: rgba(0,224,255,0.14); color: #9aefff;
}
.media-audio-empty {
  font-size: 12px; opacity: 0.5; padding: 8px 4px;
}
@media (max-width: 420px) {
  .media-audio-carousel-wrap { max-height: 34%; }
  .media-audio-slide { padding: 8px 10px; }
}
.media-audio-root--tracks-right .media-audio-body {
  flex-direction: row;
  align-items: stretch;
}
.media-audio-root--tracks-right .media-audio-main {
  flex: 1 1 58%;
  min-width: 0;
}
.media-audio-root--tracks-right .media-audio-carousel-wrap {
  flex: 0 0 38%;
  max-width: 44%;
  max-height: none;
  min-width: 128px;
  min-height: 0;
  border-top: none;
  border-left: 1px solid rgba(255,255,255,0.08);
  padding-top: 0;
  padding-left: 10px;
}
.media-audio-root--tracks-right .media-audio-carousel-row {
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.media-audio-root--tracks-right .media-audio-carousel {
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  min-height: 0;
  height: 100%;
}
.media-audio-root--tracks-right .media-audio-carousel::-webkit-scrollbar {
  width: 4px;
  height: auto;
}
.media-audio-root--tracks-right .media-audio-slide {
  flex: 0 0 100%;
  width: 100%;
  min-height: 100%;
  height: 100%;
  white-space: normal;
  display: flex;
  align-items: center;
}
@media (max-width: 420px) {
  .media-audio-root--tracks-right .media-audio-carousel-wrap {
    flex: 0 0 42%;
    max-width: 48%;
    min-width: 108px;
  }
}
`;

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** @typedef {'off'|'all'|'one'} LoopMode */

export class MediaAudioPlayer {
  /**
   * @param {object} host — ImageWidget-like host
   */
  constructor(host) {
    this.host = host;
    /** @type {Array<{ key: string, modelId: number|null, fileId: number|null, title: string, raw: string }>} */
    this.tracks = [];
    /** @type {Array<{ key: string, modelId: number|null, fileId: number|null, title: string, raw: string }>} */
    this._allTracks = [];
    this.currentKey = '';
    this.search = '';
    this.volume = 0.85;
    this.playing = false;
    /** @type {HTMLElement|null} */
    this.root = null;
    /** @type {HTMLAudioElement|null} */
    this.audio = null;
    /** @type {Map<string, string>} */
    this.objectUrls = new Map();
    this._styleEl = null;
    this._loadingKey = '';
    this.playlistEnabled = true;
    this.showSearch = true;
    this.trackSort = 'model';
    this.trackPlacement = 'bottom';
    this._uiSignature = '';
    this._carouselKeys = '';
    this._carouselScrollTimer = 0;
    this._ignoreCarouselScroll = false;
    /** Shuffle mode — play tracks in random order */
    this.shuffle = false;
    /** @type {LoopMode} off = no loop, all = loop playlist, one = loop current track */
    this.loopMode = 'off';
    /** Saved playback position for restoring after data/settings reload (seconds) */
    this._savedCurrentTime = 0;
    /** Whether was playing before data reload */
    this._savedPlaying = false;
  }

  /**
   * @param {{ playlist?: boolean, showSearch?: boolean, trackSort?: string, trackPlacement?: string }} opts
   */
  setUiOptions(opts = {}) {
    const nextPlaylist = opts.playlist !== false;
    const nextSearch = nextPlaylist && opts.showSearch !== false;
    const nextSort = normalizeAudioTrackSort(opts.trackSort);
    const nextPlacement = normalizeAudioTrackPlacement(opts.trackPlacement);
    const signature = `${nextPlaylist ? 1 : 0}:${nextSearch ? 1 : 0}:${nextPlacement}`;
    const layoutChanged =
      this.playlistEnabled !== nextPlaylist ||
      this.showSearch !== nextSearch ||
      this.trackPlacement !== nextPlacement ||
      this._uiSignature !== signature;
    const sortChanged = this.trackSort !== nextSort;
    this.playlistEnabled = nextPlaylist;
    this.showSearch = nextSearch;
    this.trackSort = nextSort;
    this.trackPlacement = nextPlacement;
    this._uiSignature = signature;
    if (layoutChanged && this.root) {
      // Save playback state before rebuilding DOM
      this._savePlaybackState();
      this.root.remove();
      this.root = null;
      this.audio = null;
    }
    this._applyTrackMode();
    if (!layoutChanged && sortChanged && this.root) {
      this._carouselKeys = '';
      this._renderNowPlaying();
    }
  }

  /** Snapshot current playback position so it can be restored after reload/rebuild */
  _savePlaybackState() {
    if (this.audio) {
      this._savedCurrentTime = Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
      this._savedPlaying = this.playing;
    }
  }

  /** Restore position and optionally resume playing after mount */
  async _restorePlaybackState() {
    if (!this.audio || !this._savedCurrentTime) return;
    const seekTo = this._savedCurrentTime;
    const shouldPlay = this._savedPlaying;
    this._savedCurrentTime = 0;
    this._savedPlaying = false;
    if (!this.audio.src) {
      await this._ensureCurrentLoaded({ autoplay: false });
    }
    if (this.audio.readyState >= 1) {
      this.audio.currentTime = seekTo;
    } else {
      const onReady = () => {
        this.audio.currentTime = seekTo;
        this.audio.removeEventListener('loadedmetadata', onReady);
      };
      this.audio.addEventListener('loadedmetadata', onReady);
    }
    if (shouldPlay) {
      try { await this.audio.play(); } catch { /* autoplay blocked */ }
    }
  }

  _applyTrackMode() {
    const sorted = sortAudioTracks(this._allTracks, this.trackSort);
    if (this.playlistEnabled) {
      this.tracks = sorted;
    } else {
      const cur = sorted.find((t) => t.key === this.currentKey) || sorted[0] || null;
      this.tracks = cur ? [cur] : [];
      if (cur) this.currentKey = cur.key;
    }
  }

  _tracksOnRight() {
    return this.trackPlacement === 'right';
  }

  _syncPlacementUi() {
    if (!this.root) return;
    this.root.classList.toggle('media-audio-root--tracks-right', this._tracksOnRight());
    const vertical = this._tracksOnRight();
    const prev = this.root.querySelector('[data-act="carousel-prev"]');
    const next = this.root.querySelector('[data-act="carousel-next"]');
    if (prev) {
      prev.innerHTML = vertical ? SVG.carouselPrevV : SVG.carouselPrevH;
      prev.title = vertical ? 'Трек выше' : 'Предыдущий трек';
    }
    if (next) {
      next.innerHTML = vertical ? SVG.carouselNextV : SVG.carouselNextH;
      next.title = vertical ? 'Трек ниже' : 'Следующий трек';
    }
  }

  destroy() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
    for (const url of this.objectUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    this.objectUrls.clear();
    this.root = null;
    this._carouselKeys = '';
    window.clearTimeout(this._carouselScrollTimer);
    if (this._styleEl?.parentNode) this._styleEl.parentNode.removeChild(this._styleEl);
    this._styleEl = null;
  }

  /**
   * @param {number} modelId
   * @param {number|null} [preferFileId]
   * @param {{ title?: string, raw?: string }|null} [fallbackTrack]
   */
  async loadFromModel(modelId, preferFileId = null, fallbackTrack = null) {
    /** @type {typeof this.tracks} */
    let tracks = [];
    if (modelId != null && Number(modelId) > 0) {
      try {
        const { files } = await dataModelService.getModelFiles(modelId);
        tracks = (files || [])
          .filter(isAudioModelFile)
          .map((f) => {
            const fileId = Number(f.data_model_file_id ?? f.id);
            return {
              key: `mf:${modelId}:${fileId}`,
              modelId: Number(modelId),
              fileId,
              title: trackTitle(f),
              raw: modelFileUri(modelId, fileId),
              fileOrder: Number(f.file_order) || 0,
              created: f.created || '',
            };
          })
          .filter((t) => Number.isFinite(t.fileId) && t.fileId > 0);
      } catch (err) {
        console.warn('MediaAudioPlayer loadFromModel', err);
      }
    }

    if (!tracks.length && fallbackTrack?.raw) {
      tracks = [
        {
          key: `url:${fallbackTrack.raw}`,
          modelId: modelId != null ? Number(modelId) : null,
          fileId: preferFileId != null ? Number(preferFileId) : null,
          title: fallbackTrack.title || 'Трек',
          raw: fallbackTrack.raw,
          fileOrder: 0,
          created: '',
        },
      ];
    }

    this._allTracks = tracks;
    if (preferFileId != null && tracks.some((t) => t.fileId === Number(preferFileId))) {
      this.currentKey = tracks.find((t) => t.fileId === Number(preferFileId)).key;
    } else if (fallbackTrack?.raw && tracks.some((t) => t.raw === fallbackTrack.raw)) {
      this.currentKey = tracks.find((t) => t.raw === fallbackTrack.raw).key;
    } else if (!this.currentKey || !tracks.some((t) => t.key === this.currentKey)) {
      this.currentKey = tracks[0]?.key || '';
    }
    this._applyTrackMode();
  }

  /** @param {HTMLElement} container */
  mount(container) {
    if (!container) return;
    if (!this._styleEl) {
      this._styleEl = document.createElement('style');
      this._styleEl.setAttribute('data-media-audio-player', '1');
      this._styleEl.textContent = PLAYER_CSS;
      document.head.appendChild(this._styleEl);
    }

    if (!this.root || !container.contains(this.root)) {
      container.innerHTML = '';
      this.root = document.createElement('div');
      this.root.className = 'media-audio-root';
      const showList = this.playlistEnabled;
      const showSearch = this.playlistEnabled && this.showSearch;
      const showStep = this.playlistEnabled;
      this.root.innerHTML = `
        ${
          showSearch
            ? `<input class="media-audio-search" type="search" placeholder="Поиск по названию трека…" value="${esc(this.search)}" />`
            : ''
        }
        <div class="media-audio-body">
          <div class="media-audio-main">
            <div class="media-audio-title">—</div>
            <div class="media-audio-meta">0 треков</div>
            <input class="media-audio-seek" type="range" min="0" max="1000" value="0" />
            <div class="media-audio-times"><span data-cur>0:00</span><span data-dur>0:00</span></div>
            <div class="media-audio-controls">
              <button type="button" class="media-audio-btn${this.shuffle ? ' media-audio-btn--active' : ''}" data-act="shuffle" title="Случайный порядок">${SVG.shuffle}</button>
              ${
                showStep
                  ? `<button type="button" class="media-audio-btn" data-act="prev" title="Предыдущий">${SVG.prev}</button>`
                  : ''
              }
              <button type="button" class="media-audio-btn media-audio-btn--play" data-act="toggle" title="Play/Pause">${SVG.play}</button>
              ${
                showStep
                  ? `<button type="button" class="media-audio-btn" data-act="next" title="Следующий">${SVG.next}</button>`
                  : ''
              }
              <button type="button" class="media-audio-btn${this.loopMode !== 'off' ? ' media-audio-btn--active' : ''}" data-act="loop" title="${this._loopTitle()}">${this.loopMode === 'one' ? SVG.loopOne : SVG.loopAll}</button>
            </div>
            <div class="media-audio-vol-row">
              <span style="display:inline-flex;align-items:center;opacity:0.7;">${SVG.volume}</span>
              <input class="media-audio-vol" type="range" min="0" max="100" value="${Math.round(this.volume * 100)}" />
            </div>
            <audio preload="metadata" style="display:none"></audio>
          </div>
          ${
            showList
              ? `<div class="media-audio-carousel-wrap">
            <div class="media-audio-carousel-head">
              <div class="media-audio-list-label">Треки</div>
              <div class="media-audio-carousel-index" data-carousel-index></div>
            </div>
            <div class="media-audio-carousel-row">
              <button type="button" class="media-audio-btn media-audio-carousel-nav" data-act="carousel-prev" title="Предыдущий трек">${SVG.carouselPrevH}</button>
              <div class="media-audio-carousel" data-carousel></div>
              <button type="button" class="media-audio-btn media-audio-carousel-nav" data-act="carousel-next" title="Следующий трек">${SVG.carouselNextH}</button>
            </div>
          </div>`
              : ''
          }
        </div>
      `;
      container.appendChild(this.root);
      this.audio = this.root.querySelector('audio');
      this._bind();
    }

    this._syncPlacementUi();
    this._syncExtraButtons();
    if (this.audio) this.audio.volume = this.volume;
    this._renderList();
    this._renderNowPlaying();
    void this._ensureCurrentLoaded({ autoplay: false }).then(() => {
      void this._restorePlaybackState();
    });
  }

  _loopTitle() {
    if (this.loopMode === 'all') return 'Повтор плейлиста';
    if (this.loopMode === 'one') return 'Повтор трека';
    return 'Повтор выключен';
  }

  _syncExtraButtons() {
    const shuffleBtn = this.root?.querySelector('[data-act="shuffle"]');
    if (shuffleBtn) {
      shuffleBtn.classList.toggle('media-audio-btn--active', this.shuffle);
    }
    const loopBtn = this.root?.querySelector('[data-act="loop"]');
    if (loopBtn) {
      loopBtn.classList.toggle('media-audio-btn--active', this.loopMode !== 'off');
      loopBtn.innerHTML = this.loopMode === 'one' ? SVG.loopOne : SVG.loopAll;
      loopBtn.title = this._loopTitle();
    }
  }

  _bind() {
    const root = this.root;
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    const stop = (e) => e.stopPropagation();
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'].forEach((ev) => {
      root.addEventListener(ev, stop);
    });

    root.querySelector('.media-audio-search')?.addEventListener('input', (e) => {
      this.search = String(e.target.value || '');
      this._renderList();
    });

    root.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
      void this.toggle();
    });
    root.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
      void this.step(-1);
    });
    root.querySelector('[data-act="next"]')?.addEventListener('click', () => {
      void this.step(1);
    });
    root.querySelector('[data-act="carousel-prev"]')?.addEventListener('click', () => {
      void this.step(-1);
    });
    root.querySelector('[data-act="carousel-next"]')?.addEventListener('click', () => {
      void this.step(1);
    });
    root.querySelector('[data-act="shuffle"]')?.addEventListener('click', () => {
      this.shuffle = !this.shuffle;
      this._syncExtraButtons();
    });
    root.querySelector('[data-act="loop"]')?.addEventListener('click', () => {
      if (this.loopMode === 'off') this.loopMode = 'all';
      else if (this.loopMode === 'all') this.loopMode = 'one';
      else this.loopMode = 'off';
      this._syncExtraButtons();
    });

    const carousel = root.querySelector('[data-carousel]');
    carousel?.addEventListener('scroll', () => this._onCarouselScroll(), { passive: true });
    carousel?.addEventListener(
      'wheel',
      (event) => {
        if (!carousel) return;
        if (this._tracksOnRight()) {
          if (carousel.scrollHeight <= carousel.clientHeight) return;
          if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
          carousel.scrollTop += event.deltaX;
          event.preventDefault();
          return;
        }
        if (carousel.scrollWidth <= carousel.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        carousel.scrollLeft += event.deltaY;
        event.preventDefault();
      },
      { passive: false },
    );

    const seek = root.querySelector('.media-audio-seek');
    seek?.addEventListener('input', () => {
      if (!this.audio || !Number.isFinite(this.audio.duration)) return;
      const ratio = Number(seek.value) / 1000;
      this.audio.currentTime = ratio * this.audio.duration;
    });

    const vol = root.querySelector('.media-audio-vol');
    vol?.addEventListener('input', () => {
      this.volume = Math.max(0, Math.min(1, Number(vol.value) / 100));
      if (this.audio) this.audio.volume = this.volume;
    });

    this.audio?.addEventListener('timeupdate', () => this._syncProgress());
    this.audio?.addEventListener('loadedmetadata', () => this._syncProgress());
    this.audio?.addEventListener('ended', () => {
      if (this.loopMode === 'one') {
        this.audio.currentTime = 0;
        void this.audio.play().catch(() => {});
        return;
      }
      if (this.playlistEnabled) {
        const list = this.filteredTracks();
        const isLast = list.length > 0 && list[list.length - 1].key === this.currentKey;
        if (isLast && this.loopMode === 'off') {
          // Reached end of playlist with no loop — stop
          this.playing = false;
          this._syncPlayButton();
          return;
        }
        if (this.shuffle) {
          void this._stepShuffle({ autoplay: true });
        } else {
          void this.step(1, { autoplay: true });
        }
      } else {
        this.playing = false;
        this._syncPlayButton();
      }
    });
    this.audio?.addEventListener('play', () => {
      this.playing = true;
      this._syncPlayButton();
    });
    this.audio?.addEventListener('pause', () => {
      this.playing = false;
      this._syncPlayButton();
    });
  }

  filteredTracks() {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.tracks;
    return this.tracks.filter((t) => t.title.toLowerCase().includes(q));
  }

  _renderList() {
    this._renderCarousel();
  }

  _renderCarousel() {
    const carousel = this.root?.querySelector('[data-carousel]');
    if (!carousel) return;
    if (!this.playlistEnabled) {
      carousel.innerHTML = '';
      this._carouselKeys = '';
      this._syncCarouselIndex();
      return;
    }
    const items = this.filteredTracks();
    const keys = items.map((t) => t.key).join('|');
    if (!items.length) {
      carousel.innerHTML = `<div class="media-audio-empty">${
        this.tracks.length ? 'Ничего не найдено' : 'В модели нет аудиофайлов'
      }</div>`;
      this._carouselKeys = '';
      this._syncCarouselIndex();
      return;
    }

    if (keys !== this._carouselKeys) {
      this._carouselKeys = keys;
      carousel.innerHTML = items
        .map(
          (t) => `
      <button type="button" class="media-audio-slide media-audio-track${t.key === this.currentKey ? ' is-active' : ''}"
        data-track-key="${esc(t.key)}" title="${esc(t.title)}">${esc(t.title)}</button>`,
        )
        .join('');
      carousel.querySelectorAll('[data-track-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-track-key');
          void this.selectTrack(key, { autoplay: true });
        });
      });
    } else {
      carousel.querySelectorAll('[data-track-key]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-track-key') === this.currentKey);
      });
    }
    this._syncCarouselIndex();
    this._scrollCarouselToCurrent();
  }

  _syncCarouselIndex() {
    const el = this.root?.querySelector('[data-carousel-index]');
    if (!el) return;
    const items = this.filteredTracks();
    const idx = items.findIndex((t) => t.key === this.currentKey);
    el.textContent = items.length ? `${Math.max(idx, 0) + 1} / ${items.length}` : '0 / 0';
  }

  _scrollCarouselToCurrent() {
    const carousel = this.root?.querySelector('[data-carousel]');
    if (!carousel || !this.currentKey) return;
    const slide = [...carousel.querySelectorAll('[data-track-key]')].find(
      (el) => el.getAttribute('data-track-key') === this.currentKey,
    );
    if (!(slide instanceof HTMLElement)) return;
    this._ignoreCarouselScroll = true;
    if (this._tracksOnRight()) {
      carousel.scrollTo({ top: slide.offsetTop, behavior: 'smooth' });
    } else {
      carousel.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    }
    window.setTimeout(() => {
      this._ignoreCarouselScroll = false;
    }, 280);
  }

  _onCarouselScroll() {
    if (this._ignoreCarouselScroll) return;
    window.clearTimeout(this._carouselScrollTimer);
    this._carouselScrollTimer = window.setTimeout(() => {
      const carousel = this.root?.querySelector('[data-carousel]');
      if (!carousel) return;
      const slides = [...carousel.querySelectorAll('[data-track-key]')];
      if (!slides.length) return;
      const vertical = this._tracksOnRight();
      const center = vertical
        ? carousel.scrollTop + carousel.clientHeight / 2
        : carousel.scrollLeft + carousel.clientWidth / 2;
      let closest = slides[0];
      let best = Infinity;
      for (const slide of slides) {
        if (!(slide instanceof HTMLElement)) continue;
        const mid = vertical
          ? slide.offsetTop + slide.offsetHeight / 2
          : slide.offsetLeft + slide.offsetWidth / 2;
        const dist = Math.abs(mid - center);
        if (dist < best) {
          best = dist;
          closest = slide;
        }
      }
      const key = closest.getAttribute('data-track-key');
      if (key && key !== this.currentKey) {
        void this.selectTrack(key, { autoplay: this.playing });
      }
    }, 90);
  }

  _renderNowPlaying() {
    const track = this.tracks.find((t) => t.key === this.currentKey) || this.tracks[0];
    const titleEl = this.root?.querySelector('.media-audio-title');
    const metaEl = this.root?.querySelector('.media-audio-meta');
    if (titleEl) titleEl.textContent = track?.title || 'Нет трека';
    if (metaEl) {
      if (this.playlistEnabled) {
        metaEl.textContent = `${this._allTracks.length} ${this._allTracks.length === 1 ? 'трек' : 'треков'}`;
      } else {
        metaEl.textContent = 'Один трек';
      }
    }
    this._renderList();
    this._syncPlayButton();
  }

  _syncPlayButton() {
    const btn = this.root?.querySelector('[data-act="toggle"]');
    if (btn) btn.innerHTML = this.playing ? SVG.pause : SVG.play;
  }

  _syncProgress() {
    if (!this.root || !this.audio) return;
    const seek = this.root.querySelector('.media-audio-seek');
    const cur = this.root.querySelector('[data-cur]');
    const dur = this.root.querySelector('[data-dur]');
    const duration = this.audio.duration;
    if (seek && Number.isFinite(duration) && duration > 0) {
      seek.value = String(Math.round((this.audio.currentTime / duration) * 1000));
    }
    if (cur) cur.textContent = formatTime(this.audio.currentTime);
    if (dur) dur.textContent = formatTime(duration);
  }

  async _resolveTrackUrl(track) {
    if (!track) return '';
    if (this.objectUrls.has(track.key)) return this.objectUrls.get(track.key);

    if (track.modelId != null && track.fileId != null) {
      const rawBlob = await dataModelService.getModelFileBlob(track.modelId, track.fileId);
      const { blob } = coerceMediaBlob(rawBlob, '', `${track.title}.mp3`);
      const url = URL.createObjectURL(blob);
      this.objectUrls.set(track.key, url);
      return url;
    }

    // External / already-resolved URL (http, blob from host)
    if (/^https?:\/\//i.test(track.raw) || track.raw.startsWith('blob:') || track.raw.startsWith('data:')) {
      return track.raw;
    }
    return '';
  }

  async _ensureCurrentLoaded({ autoplay = false } = {}) {
    const track = this.tracks.find((t) => t.key === this.currentKey);
    if (!track || !this.audio) return;
    if (this._loadingKey === track.key && this.audio.src) {
      if (autoplay) {
        try {
          await this.audio.play();
        } catch {
          /* autoplay blocked */
        }
      }
      return;
    }
    this._loadingKey = track.key;
    try {
      const url = await this._resolveTrackUrl(track);
      if (!url || this.currentKey !== track.key) return;
      this.audio.src = url;
      this.audio.volume = this.volume;
      this.audio.load();
      if (autoplay) {
        try {
          await this.audio.play();
        } catch {
          /* autoplay blocked */
        }
      }
    } catch (err) {
      console.error('MediaAudioPlayer load track', err);
    }
  }

  async selectTrack(key, { autoplay = true } = {}) {
    if (!key || key === this.currentKey) {
      if (autoplay) await this.toggle(true);
      return;
    }
    this.currentKey = key;
    this._renderNowPlaying();
    await this._ensureCurrentLoaded({ autoplay });
  }

  async toggle(forcePlay) {
    if (!this.audio) return;
    if (!this.audio.src) {
      await this._ensureCurrentLoaded({ autoplay: true });
      return;
    }
    if (forcePlay === true || this.audio.paused) {
      try {
        await this.audio.play();
      } catch {
        /* ignore */
      }
    } else {
      this.audio.pause();
    }
  }

  async _stepShuffle({ autoplay = true } = {}) {
    const list = this.filteredTracks();
    if (!list.length) return;
    if (list.length === 1) {
      await this.selectTrack(list[0].key, { autoplay });
      return;
    }
    const candidates = list.filter((t) => t.key !== this.currentKey);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    await this.selectTrack(next.key, { autoplay });
  }

  async step(delta, { autoplay = true } = {}) {
    if (this.shuffle) {
      await this._stepShuffle({ autoplay });
      return;
    }
    const list = this.filteredTracks();
    if (!list.length) return;
    let idx = list.findIndex((t) => t.key === this.currentKey);
    if (idx < 0) idx = 0;
    const next = list[(idx + delta + list.length) % list.length];
    await this.selectTrack(next.key, { autoplay });
  }
}
