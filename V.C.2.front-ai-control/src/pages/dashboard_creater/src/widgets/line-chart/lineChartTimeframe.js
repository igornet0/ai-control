/**
 * Универсальные таймфреймы для линейного графика (клиентская агрегация и слоты кнопок).
 * Выравнивание бакетов: локальное календарное для пресетов 1m/5m/15m/1h/1d/1w/1mo/1y,
 * для кастомного интервала — чистое деление epoch (intervalMs).
 */

export const MS_SECOND = 1000;
export const MS_MIN = 60000;
export const MS_HOUR = 3600000;
export const MS_DAY = 86400000;

/** Минимальный интервал (1 с). */
export const TIMEFRAME_MS_MIN = MS_SECOND;
/** Максимальный интервал (~400 дней). */
export const TIMEFRAME_MS_MAX = MS_DAY * 400;

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   intervalMs: number;
 *   isCustom?: boolean;
 * }} Timeframe
 */

/** @type {Record<string, Timeframe>} */
export const LINE_TIMEFRAME_PRESETS = {
    raw: { id: 'raw', label: 'Исходные', intervalMs: 0, isCustom: false },
    '1m': { id: '1m', label: '1 мин', intervalMs: MS_MIN, isCustom: false },
    '5m': { id: '5m', label: '5 мин', intervalMs: 5 * MS_MIN, isCustom: false },
    '15m': { id: '15m', label: '15 мин', intervalMs: 15 * MS_MIN, isCustom: false },
    '1h': { id: '1h', label: '1 ч', intervalMs: MS_HOUR, isCustom: false },
    '1d': { id: '1d', label: '1 д', intervalMs: MS_DAY, isCustom: false },
    /** Календарная неделя (пн…вс), ближайший понедельник 00:00 локальное. */
    '1w': { id: '1w', label: '1 нед', intervalMs: 7 * MS_DAY, isCustom: false },
    /** Календарный месяц; для SQL-бакетов на сервере используется ~30 суток. */
    '1mo': { id: '1mo', label: '1 мес', intervalMs: 30 * MS_DAY, isCustom: false },
    /** Календарный год; для SQL-бакетов на сервере — 365 суток. */
    '1y': { id: '1y', label: '1 г', intervalMs: 365 * MS_DAY, isCustom: false },
};

const PRESET_IDS = new Set(Object.keys(LINE_TIMEFRAME_PRESETS));

/** Порядок пресетов в палитре «добавить». */
export const LINE_TIMEFRAME_PRESET_ORDER = [
    '1m',
    '5m',
    '15m',
    '1h',
    '1d',
    '1w',
    '1mo',
    '1y',
];

/**
 * Слот кнопки: id пресета или "c:&lt;мс&gt;" для фиксированного интервала.
 * @param {number} intervalMs
 */
export function encodeCustomTimeframeSlot(intervalMs) {
    const ms = Math.round(Number(intervalMs));
    return `c:${ms}`;
}

/**
 * @param {unknown} slot
 * @returns {{ kind: 'preset', id: string } | { kind: 'customSlot', intervalMs: number } | null}
 */
export function decodeTimeframeSlot(slot) {
    const s = String(slot ?? '').trim();
    if (!s || s === 'raw') return null;
    if (LINE_TIMEFRAME_PRESETS[s] && LINE_TIMEFRAME_PRESETS[s].intervalMs > 0) {
        return { kind: 'preset', id: s };
    }
    const m = /^c:(\d+)$/.exec(s);
    if (!m) return null;
    const intervalMs = parseInt(m[1], 10);
    if (!Number.isFinite(intervalMs) || intervalMs < TIMEFRAME_MS_MIN || intervalMs > TIMEFRAME_MS_MAX) {
        return null;
    }
    return { kind: 'customSlot', intervalMs };
}

/**
 * @param {unknown} slot
 */
export function formatTimeframeSlotLabel(slot) {
    const dec = decodeTimeframeSlot(slot);
    if (!dec) return String(slot ?? '');
    if (dec.kind === 'preset') return LINE_TIMEFRAME_PRESETS[dec.id].label;
    return humanizeCustomInterval(dec.intervalMs);
}

/**
 * @param {unknown} slot
 * @param {{ id: string, intervalMs: number, isCustom: boolean }} resolved — из resolveActiveTimeframe
 */
export function isTimeframeSlotActive(slot, resolved) {
    const dec = decodeTimeframeSlot(slot);
    if (!dec || !resolved) return false;
    if (dec.kind === 'preset') return !resolved.isCustom && resolved.id === dec.id;
    return resolved.isCustom === true && Number(resolved.intervalMs) === dec.intervalMs;
}

/**
 * Парсинг строки вида "7m", "3h", "2d", "2w", "3mo", "1y", "45s".
 * @param {string} raw
 * @returns {{ intervalMs: number, error?: string }}
 */
export function parseCustomTimeframeInput(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return { intervalMs: 0, error: 'Пусто' };
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(mo|[smhdwy])$/i);
    if (!m) return { intervalMs: 0, error: 'Формат: число + s|m|h|d|w|mo|y (например 7m, 2w)' };
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return { intervalMs: 0, error: 'Число должно быть > 0' };
    let ms =
        u === 's'
            ? n * MS_SECOND
            : u === 'm'
              ? n * MS_MIN
              : u === 'h'
                ? n * MS_HOUR
                : u === 'w'
                  ? n * 7 * MS_DAY
                  : u === 'mo'
                    ? n * 30 * MS_DAY
                    : u === 'y'
                      ? n * 365 * MS_DAY
                      : n * MS_DAY;
    if (!Number.isFinite(ms)) return { intervalMs: 0, error: 'Некорректное значение' };
    ms = Math.round(ms);
    if (ms < TIMEFRAME_MS_MIN) return { intervalMs: 0, error: `Минимум ${TIMEFRAME_MS_MIN} мс` };
    if (ms > TIMEFRAME_MS_MAX) return { intervalMs: 0, error: 'Слишком большой интервал' };
    return { intervalMs: ms };
}

/**
 * Начало бакета для timestamp (локальное календарное выравнивание для известных пресетов).
 * @param {number} timestampMs
 * @param {string} presetId
 * @param {number} intervalMs
 */
export function bucketStartMs(timestampMs, presetId, intervalMs) {
    if (!Number.isFinite(timestampMs) || intervalMs <= 0) return timestampMs;
    const id = String(presetId || '');
    const d = new Date(timestampMs);

    if (id === '1d' || intervalMs === MS_DAY) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    if (id === '1h' || intervalMs === MS_HOUR) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0).getTime();
    }
    if (id === '1m' || intervalMs === MS_MIN) {
        return new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            d.getHours(),
            d.getMinutes(),
            0,
            0,
        ).getTime();
    }
    if (id === '5m' || intervalMs === 5 * MS_MIN) {
        const totalMin = d.getHours() * 60 + d.getMinutes();
        const floored = Math.floor(totalMin / 5) * 5;
        const hh = Math.floor(floored / 60);
        const mm = floored % 60;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
    }
    if (id === '15m' || intervalMs === 15 * MS_MIN) {
        const totalMin = d.getHours() * 60 + d.getMinutes();
        const floored = Math.floor(totalMin / 15) * 15;
        const hh = Math.floor(floored / 60);
        const mm = floored % 60;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
    }

    if (id === '1w') {
        const day = d.getDay();
        const daysFromMonday = day === 0 ? 6 : day - 1;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysFromMonday, 0, 0, 0, 0).getTime();
    }

    if (id === '1mo') {
        return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }

    if (id === '1y') {
        return new Date(d.getFullYear(), 0, 1).getTime();
    }

    return Math.floor(timestampMs / intervalMs) * intervalMs;
}

/**
 * Разрешить текущий таймфрейм из настроек виджета (после normalizeLineConfig).
 * @param {Record<string, unknown>} timeframeCfg — merged.timeframe
 * @returns {Timeframe}
 */
export function resolveActiveTimeframe(timeframeCfg) {
    const cfg = timeframeCfg && typeof timeframeCfg === 'object' ? timeframeCfg : {};
    const enabled = cfg.enabled === true;
    if (!enabled) {
        return { ...LINE_TIMEFRAME_PRESETS.raw };
    }

    let id = String(cfg.id || 'raw').toLowerCase();
    if (id === 'custom') {
        let ms = Number(cfg.customIntervalMs);
        if (!Number.isFinite(ms) || ms <= 0) {
            return { ...LINE_TIMEFRAME_PRESETS.raw };
        }
        ms = Math.round(clampIntervalMs(ms));
        return {
            id: 'custom',
            label: humanizeCustomInterval(ms),
            intervalMs: ms,
            isCustom: true,
        };
    }

    const preset = LINE_TIMEFRAME_PRESETS[id];
    if (preset && preset.intervalMs > 0) {
        return { ...preset, isCustom: false };
    }

    return { ...LINE_TIMEFRAME_PRESETS.raw };
}

function clampIntervalMs(ms) {
    return Math.min(TIMEFRAME_MS_MAX, Math.max(TIMEFRAME_MS_MIN, ms));
}

function humanizeCustomInterval(ms) {
    if (ms % MS_DAY === 0 && ms >= MS_DAY) {
        const d = ms / MS_DAY;
        if (d % 365 === 0 && d >= 365) return `${d / 365} г`;
        if (d % 30 === 0 && d >= 30) return `${d / 30} мес`;
        if (d % 7 === 0 && d >= 7) return `${d / 7} нед`;
        return `${d} д`;
    }
    if (ms % MS_HOUR === 0 && ms >= MS_HOUR) return `${ms / MS_HOUR} ч`;
    if (ms % MS_MIN === 0 && ms >= MS_MIN) return `${ms / MS_MIN} мин`;
    if (ms % MS_SECOND === 0) return `${ms / MS_SECOND} с`;
    return `${ms} мс`;
}

/**
 * @param {string} id
 */
export function isValidPresetId(id) {
    return PRESET_IDS.has(String(id || ''));
}
