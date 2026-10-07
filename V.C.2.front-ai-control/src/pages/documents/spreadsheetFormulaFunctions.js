/**
 * Библиотека функций формул (имена Excel на английском и русском).
 * Каждая функция: { name, ru, min, max, ranges?, lazy?, category, description, syntax, fn }.
 *  - ranges: голая буква столбца в аргументах = весь столбец (СУММ(B));
 *  - lazy: получает узлы аргументов (ЕСЛИ, ЕСЛИОШИБКА… вычисляют только нужную ветку).
 */
import {
  EMPTY,
  RangeRef,
  compareValues,
  dateToExcelSerial,
  err,
  evalArg,
  excelSerialToDate,
  formatGeneralNumber,
  isEmpty,
  isError,
  isRange,
  parseDateTextToSerial,
  parseNumberText,
  toBool,
  toNumber,
  toScalar,
  toText,
  todayExcelSerial,
} from './spreadsheetFormulaEngine';

/* ───────────────────────────── помощники ───────────────────────────── */

/** Числа из аргументов: в диапазонах текст и логические пропускаются (как в Excel). */
function collectNumbers(args, ctx) {
  const nums = [];
  for (const a of args) {
    if (isRange(a)) {
      let failure = null;
      a.forEach((v) => {
        if (failure) return;
        if (isError(v)) failure = v;
        else if (typeof v === 'number') nums.push(v);
      });
      if (failure) return failure;
      continue;
    }
    if (isError(a)) return a;
    if (isEmpty(a)) continue;
    const n = toNumber(a, ctx);
    if (isError(n)) return n;
    nums.push(n);
  }
  return nums;
}

/** Все значения аргументов подряд (диапазоны разворачиваются). */
function collectValues(args) {
  const out = [];
  args.forEach((a) => {
    if (isRange(a)) a.forEach((v) => out.push(v));
    else out.push(a);
  });
  return out;
}

function firstError(values) {
  return values.find((v) => isError(v)) || null;
}

function num(v, ctx) {
  return toNumber(v, ctx);
}

/** Вычислить несколько числовых аргументов; первая ошибка возвращается. */
function nums(args, ctx, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const n = args[i] === undefined || isEmpty(args[i]) ? 0 : toNumber(args[i], ctx);
    if (isError(n)) return n;
    out.push(n);
  }
  return out;
}

function optNum(args, i, ctx, fallback) {
  if (args[i] === undefined || isEmpty(args[i])) return fallback;
  return toNumber(args[i], ctx);
}

function text(v, ctx) {
  return toText(v, ctx);
}

function roundHalfAway(n, digits) {
  const f = 10 ** digits;
  const scaled = Number((Math.abs(n) * f).toPrecision(15));
  return (Math.sign(n) * Math.round(scaled)) / f;
}

function requireRange(v) {
  return isRange(v) ? v : null;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardRegex(pattern) {
  let re = '';
  const s = String(pattern);
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '~' && i + 1 < s.length) {
      re += escapeRegex(s[i + 1]);
      i += 1;
    } else if (ch === '*') re += '[\\s\\S]*';
    else if (ch === '?') re += '[\\s\\S]';
    else re += escapeRegex(ch);
  }
  return new RegExp(`^${re}$`, 'i');
}

const hasWildcard = (s) => /(^|[^~])[*?]/.test(String(s));

/** Условие для СУММЕСЛИ / СЧЁТЕСЛИ: «>10», «<>да», «яб*», 5, ИСТИНА. */
function makeCriterion(rawCriterion, ctx) {
  const c = toScalar(rawCriterion, ctx);
  if (isError(c)) return () => false;
  if (isEmpty(c)) return (v) => isEmpty(v) || v === '';
  if (typeof c === 'number' || typeof c === 'boolean') {
    return (v) => !isError(v) && !isEmpty(v) && compareValues(v, c) === 0;
  }
  const m = String(c).match(/^(>=|<=|<>|>|<|=)?([\s\S]*)$/);
  const op = m[1] || '=';
  const operand = m[2];
  const operandNum = operand.trim() === '' ? null : parseNumberText(operand);

  if (operandNum != null) {
    const equal = (v) => (typeof v === 'number' && v === operandNum)
      || (typeof v === 'string' && parseNumberText(v) === operandNum);
    return (v) => {
      if (isError(v)) return false;
      switch (op) {
        case '=': return equal(v);
        case '<>': return !equal(v);
        default: {
          if (typeof v !== 'number') return false;
          if (op === '>') return v > operandNum;
          if (op === '<') return v < operandNum;
          if (op === '>=') return v >= operandNum;
          return v <= operandNum;
        }
      }
    };
  }

  const wild = hasWildcard(operand) ? wildcardRegex(operand) : null;
  const matchesText = (v) => {
    if (isError(v)) return false;
    if (operand === '') return isEmpty(v) || v === '';
    if (isEmpty(v)) return false;
    if (wild) return typeof v === 'string' && wild.test(v);
    return compareValues(v, operand) === 0;
  };
  return (v) => {
    switch (op) {
      case '=': return matchesText(v);
      case '<>': return !matchesText(v);
      default: {
        if (typeof v !== 'string' || isError(v)) return false;
        const cmp = compareValues(v, operand);
        if (op === '>') return cmp > 0;
        if (op === '<') return cmp < 0;
        if (op === '>=') return cmp >= 0;
        return cmp <= 0;
      }
    }
  };
}

/** Пары «диапазон, условие» → маска совпадений по ячейкам (rows × cols). */
function criteriaMask(pairs, ctx, rows, cols) {
  const mask = Array.from({ length: rows }, () => Array(cols).fill(true));
  for (const [rangeArg, critArg] of pairs) {
    const range = requireRange(rangeArg);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    if (range.rows !== rows || range.cols !== cols) return err('#VALUE!', 'Диапазоны разного размера');
    const test = makeCriterion(critArg, ctx);
    const values = range.toMatrix();
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        if (mask[i][j] && !test(values[i][j])) mask[i][j] = false;
      }
    }
  }
  return mask;
}

function pairsFrom(args, start) {
  const pairs = [];
  for (let i = start; i + 1 < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
  return pairs;
}

/** Значения диапазона по маске (только числа). */
function maskedNumbers(range, mask) {
  const values = range.toMatrix();
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values[i].length; j += 1) {
      if (mask[i][j] && typeof values[i][j] === 'number') out.push(values[i][j]);
    }
  }
  return out;
}

function conditionalAggregate(targetArg, pairs, ctx, reduce) {
  const target = requireRange(targetArg);
  if (!target) return err('#VALUE!', 'Ожидается диапазон');
  const mask = criteriaMask(pairs, ctx, target.rows, target.cols);
  if (isError(mask)) return mask;
  return reduce(maskedNumbers(target, mask));
}

const sum = (list) => list.reduce((a, b) => a + b, 0);

function lookupEquals(cellValue, lookup) {
  if (isError(cellValue)) return false;
  if (typeof lookup === 'string' && hasWildcard(lookup)) {
    return typeof cellValue === 'string' && wildcardRegex(lookup).test(cellValue);
  }
  return compareValues(cellValue, lookup) === 0;
}

/** Позиция в одномерном списке: точное или «наибольшее ≤» (matchType 1) / «наименьшее ≥» (-1). */
function findInList(list, lookup, matchType) {
  if (matchType === 0) {
    const idx = list.findIndex((v) => lookupEquals(v, lookup));
    return idx;
  }
  let best = -1;
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i];
    if (isEmpty(v) || isError(v)) continue;
    if (typeof v !== typeof lookup && !(typeof v === 'number' && typeof lookup === 'number')) continue;
    const cmp = compareValues(v, lookup);
    if (matchType > 0) {
      if (cmp <= 0) best = i;
      else break;
    } else if (cmp >= 0) best = i;
    else break;
  }
  return best;
}

function rangeColumn(range, j) {
  const m = range.toMatrix();
  return m.map((row) => row[j]);
}

function rangeRow(range, i) {
  return range.toMatrix()[i] || [];
}

function rangeAsList(range) {
  if (range.cols === 1) return rangeColumn(range, 0);
  if (range.rows === 1) return rangeRow(range, 0);
  return null;
}

/* ─────────────────────────── даты ─────────────────────────── */

function dateArg(v, ctx) {
  const s = toScalar(v, ctx);
  if (typeof s === 'string') {
    const serial = parseDateTextToSerial(s);
    if (serial != null) return serial;
  }
  return toNumber(s, ctx);
}

function addMonths(serial, months, endOfMonth = false) {
  const { y, m, d } = excelSerialToDate(serial);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return dateToExcelSerial(ny, nm + 1, endOfMonth ? lastDay : Math.min(d, lastDay));
}

const isWeekend = (serial) => {
  const { wd } = excelSerialToDate(serial);
  return wd === 0 || wd === 6;
};

function holidaySet(arg) {
  const set = new Set();
  if (!arg) return set;
  collectValues([arg]).forEach((v) => {
    if (typeof v === 'number') set.add(Math.floor(v));
    else if (typeof v === 'string') {
      const s = parseDateTextToSerial(v);
      if (s != null) set.add(s);
    }
  });
  return set;
}

const RU_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const RU_MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const RU_WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/* ─────────────────────────── ТЕКСТ() ─────────────────────────── */

function formatDateByPattern(serial, pattern) {
  const { y, m, d, wd } = excelSerialToDate(serial);
  const p2 = (n) => String(n).padStart(2, '0');
  return pattern.replace(
    /(yyyy|гггг|yy|гг|mmmm|мммм|mmm|ммм|mm|мм|m|м|dddd|дддд|ddd|ддд|dd|дд|d|д)/gi,
    (tok) => {
      const t = tok.toLowerCase().replace(/г/g, 'y').replace(/м/g, 'm').replace(/д/g, 'd');
      switch (t) {
        case 'yyyy': return String(y);
        case 'yy': return p2(y % 100);
        case 'mmmm': return d ? RU_MONTHS_GEN[m - 1] : RU_MONTHS[m - 1];
        case 'mmm': return RU_MONTHS[m - 1].slice(0, 3);
        case 'mm': return p2(m);
        case 'm': return String(m);
        case 'dddd': return RU_WEEKDAYS[wd];
        case 'ddd': return RU_WEEKDAYS[wd].slice(0, 2);
        case 'dd': return p2(d);
        default: return String(d);
      }
    },
  );
}

function groupDigits(intPart, sep) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function formatNumberByPattern(n, pattern) {
  const core = pattern.match(/[#0][#0.,\s ]*[#0]|[#0]/);
  if (!core) return pattern;
  const prefix = pattern.slice(0, core.index);
  const suffix = pattern.slice(core.index + core[0].length);
  const isPercent = suffix.includes('%');
  const value = isPercent ? n * 100 : n;
  const body = core[0];
  // Десятичный разделитель: «.», а «,» — только если это не разделитель тысяч («#,##0»).
  let decMatch = body.match(/\.([0#]+)$/);
  if (!decMatch && !body.includes('.')) {
    const commaTail = body.match(/,([0#]+)$/);
    const hasSpaceGroups = /[\s ]/.test(body);
    const looksLikeThousands = commaTail
      && commaTail[1].length === 3
      && body.slice(0, body.length - commaTail[0].length).includes('#');
    if (commaTail && (hasSpaceGroups || !looksLikeThousands)) decMatch = commaTail;
  }
  const decimalsMin = decMatch ? (decMatch[1].match(/0/g) || []).length : 0;
  const decimalsMax = decMatch ? decMatch[1].length : 0;
  const decimalSep = decMatch ? body[body.length - decMatch[1].length - 1] : '.';
  const intSection = decMatch ? body.slice(0, body.length - decMatch[0].length) : body;
  const groupSepMatch = intSection.match(/[,\s ]/);
  const groupSep = groupSepMatch ? groupSepMatch[0] : '';
  const minIntDigits = (intSection.match(/0/g) || []).length;

  let fixed = roundHalfAway(Math.abs(value), decimalsMax).toFixed(decimalsMax);
  if (decimalsMax > decimalsMin) {
    const [ip, fp = ''] = fixed.split('.');
    let trimmed = fp;
    while (trimmed.length > decimalsMin && trimmed.endsWith('0')) trimmed = trimmed.slice(0, -1);
    fixed = trimmed ? `${ip}.${trimmed}` : ip;
  }
  let [intPart, fracPart] = fixed.split('.');
  if (intPart === '0' && minIntDigits === 0 && fracPart) intPart = '';
  intPart = intPart.padStart(minIntDigits, '0');
  if (groupSep) intPart = groupDigits(intPart, groupSep === ',' && decimalSep === ',' ? ' ' : groupSep);
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${prefix}${intPart}${fracPart ? decimalSep + fracPart : ''}${suffix}`;
}

function formatText(value, pattern, ctx) {
  const fmt = String(pattern);
  if (/[дмгdy]/i.test(fmt.replace(/"[^"]*"/g, '')) && !/^[#0.,\s%]+$/.test(fmt)) {
    const serial = dateArg(value, ctx);
    if (isError(serial)) return serial;
    return formatDateByPattern(serial, fmt);
  }
  const n = toNumber(value, ctx);
  if (isError(n)) return toText(value, ctx);
  return formatNumberByPattern(n, fmt);
}

/* ─────────────────────────── определения ─────────────────────────── */

const F = [];
const def = (spec) => F.push(spec);

// —— Математика ——
def({
  name: 'SUM', ru: ['СУММ'], min: 1, ranges: true, category: 'math',
  description: 'Сумма чисел', syntax: 'СУММ(B2:B10; C5; 100)',
  fn: (a, ctx) => { const n = collectNumbers(a, ctx); return isError(n) ? n : sum(n); },
});
def({
  name: 'AVERAGE', ru: ['СРЗНАЧ', 'AVG', 'СРЕДНЕЕ'], min: 1, ranges: true, category: 'math',
  description: 'Среднее арифметическое (пустые ячейки не учитываются)', syntax: 'СРЗНАЧ(B2:B10)',
  fn: (a, ctx) => {
    const n = collectNumbers(a, ctx);
    if (isError(n)) return n;
    return n.length ? sum(n) / n.length : err('#DIV/0!');
  },
});
def({
  name: 'MIN', ru: ['МИН', 'МИНИМУМ'], min: 1, ranges: true, category: 'math',
  description: 'Наименьшее число', syntax: 'МИН(B2:B10)',
  fn: (a, ctx) => { const n = collectNumbers(a, ctx); return isError(n) ? n : (n.length ? Math.min(...n) : 0); },
});
def({
  name: 'MAX', ru: ['МАКС', 'МАКСИМУМ'], min: 1, ranges: true, category: 'math',
  description: 'Наибольшее число', syntax: 'МАКС(B2:B10)',
  fn: (a, ctx) => { const n = collectNumbers(a, ctx); return isError(n) ? n : (n.length ? Math.max(...n) : 0); },
});
def({
  name: 'COUNT', ru: ['СЧЁТ', 'СЧЕТ'], min: 1, ranges: true, category: 'math',
  description: 'Количество ячеек с числами', syntax: 'СЧЁТ(B2:B10)',
  fn: (a, ctx) => {
    let count = 0;
    a.forEach((arg) => {
      if (isRange(arg)) arg.forEach((v) => { if (typeof v === 'number') count += 1; });
      else if (typeof arg === 'number' || (typeof arg === 'string' && parseNumberText(arg) != null)) count += 1;
    });
    return count;
  },
});
def({
  name: 'COUNTA', ru: ['СЧЁТЗ', 'СЧЕТЗ', 'КОЛИЧЕСТВО'], min: 1, ranges: true, category: 'math',
  description: 'Количество непустых ячеек', syntax: 'СЧЁТЗ(A2:A10)',
  fn: (a) => collectValues(a).filter((v) => !isEmpty(v)).length,
});
def({
  name: 'COUNTBLANK', ru: ['СЧИТАТЬПУСТОТЫ'], min: 1, max: 1, ranges: true, category: 'math',
  description: 'Количество пустых ячеек', syntax: 'СЧИТАТЬПУСТОТЫ(A2:A10)',
  fn: (a) => collectValues(a).filter((v) => isEmpty(v) || v === '').length,
});
def({
  name: 'PRODUCT', ru: ['ПРОИЗВЕД'], min: 1, ranges: true, category: 'math',
  description: 'Произведение чисел', syntax: 'ПРОИЗВЕД(B2:B5)',
  fn: (a, ctx) => { const n = collectNumbers(a, ctx); return isError(n) ? n : (n.length ? n.reduce((x, y) => x * y, 1) : 0); },
});
def({
  name: 'SUMPRODUCT', ru: ['СУММПРОИЗВ'], min: 1, ranges: true, category: 'math',
  description: 'Сумма произведений соответствующих элементов', syntax: 'СУММПРОИЗВ(B2:B10; C2:C10)',
  fn: (a, ctx) => {
    const ranges = a.map((x) => (isRange(x) ? x : null));
    if (ranges.some((r) => !r)) {
      const n = collectNumbers(a, ctx);
      return isError(n) ? n : n.reduce((x, y) => x * y, 1);
    }
    const { rows, cols } = ranges[0];
    if (ranges.some((r) => r.rows !== rows || r.cols !== cols)) return err('#VALUE!', 'Диапазоны разного размера');
    const mats = ranges.map((r) => r.toMatrix());
    let total = 0;
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        let p = 1;
        for (const m of mats) {
          const v = m[i][j];
          if (isError(v)) return v;
          p *= typeof v === 'number' ? v : 0;
        }
        total += p;
      }
    }
    return total;
  },
});
def({
  name: 'SUMSQ', ru: ['СУММКВ'], min: 1, ranges: true, category: 'math',
  description: 'Сумма квадратов', syntax: 'СУММКВ(B2:B10)',
  fn: (a, ctx) => { const n = collectNumbers(a, ctx); return isError(n) ? n : sum(n.map((x) => x * x)); },
});
def({
  name: 'ROUND', ru: ['ОКРУГЛ'], min: 1, max: 2, category: 'math',
  description: 'Округление до указанного числа знаков', syntax: 'ОКРУГЛ(B2; 2)',
  fn: (a, ctx) => { const v = nums(a, ctx, 2); return isError(v) ? v : roundHalfAway(v[0], Math.trunc(v[1])); },
});
def({
  name: 'ROUNDUP', ru: ['ОКРУГЛВВЕРХ'], min: 1, max: 2, category: 'math',
  description: 'Округление от нуля', syntax: 'ОКРУГЛВВЕРХ(B2; 0)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    const f = 10 ** Math.trunc(v[1]);
    return (Math.sign(v[0]) * Math.ceil(Number((Math.abs(v[0]) * f).toPrecision(15)))) / f;
  },
});
def({
  name: 'ROUNDDOWN', ru: ['ОКРУГЛВНИЗ'], min: 1, max: 2, category: 'math',
  description: 'Округление к нулю', syntax: 'ОКРУГЛВНИЗ(B2; 0)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    const f = 10 ** Math.trunc(v[1]);
    return (Math.sign(v[0]) * Math.floor(Number((Math.abs(v[0]) * f).toPrecision(15)))) / f;
  },
});
def({
  name: 'INT', ru: ['ЦЕЛОЕ'], min: 1, max: 1, category: 'math',
  description: 'Округление вниз до целого', syntax: 'ЦЕЛОЕ(B2)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.floor(v); },
});
def({
  name: 'TRUNC', ru: ['ОТБР'], min: 1, max: 2, category: 'math',
  description: 'Отбрасывает дробную часть', syntax: 'ОТБР(B2; 1)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    const f = 10 ** Math.trunc(v[1]);
    return Math.trunc(v[0] * f) / f;
  },
});
def({
  name: 'ABS', ru: [], min: 1, max: 1, category: 'math',
  description: 'Модуль числа', syntax: 'ABS(B2)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.abs(v); },
});
def({
  name: 'SIGN', ru: ['ЗНАК'], min: 1, max: 1, category: 'math',
  description: 'Знак числа: 1, 0 или -1', syntax: 'ЗНАК(B2)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.sign(v); },
});
def({
  name: 'MOD', ru: ['ОСТАТ'], min: 2, max: 2, category: 'math',
  description: 'Остаток от деления', syntax: 'ОСТАТ(10; 3)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    if (v[1] === 0) return err('#DIV/0!');
    return v[0] - v[1] * Math.floor(v[0] / v[1]);
  },
});
def({
  name: 'QUOTIENT', ru: ['ЧАСТНОЕ'], min: 2, max: 2, category: 'math',
  description: 'Целая часть от деления', syntax: 'ЧАСТНОЕ(10; 3)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    return v[1] === 0 ? err('#DIV/0!') : Math.trunc(v[0] / v[1]);
  },
});
def({
  name: 'POWER', ru: ['СТЕПЕНЬ'], min: 2, max: 2, category: 'math',
  description: 'Возведение в степень', syntax: 'СТЕПЕНЬ(2; 10)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    const r = v[0] ** v[1];
    return Number.isFinite(r) ? r : err('#NUM!');
  },
});
def({
  name: 'SQRT', ru: ['КОРЕНЬ'], min: 1, max: 1, category: 'math',
  description: 'Квадратный корень', syntax: 'КОРЕНЬ(16)',
  fn: (a, ctx) => { const v = num(a[0], ctx); if (isError(v)) return v; return v < 0 ? err('#NUM!') : Math.sqrt(v); },
});
def({
  name: 'EXP', ru: [], min: 1, max: 1, category: 'math',
  description: 'e в степени', syntax: 'EXP(1)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.exp(v); },
});
def({
  name: 'LN', ru: [], min: 1, max: 1, category: 'math',
  description: 'Натуральный логарифм', syntax: 'LN(10)',
  fn: (a, ctx) => { const v = num(a[0], ctx); if (isError(v)) return v; return v <= 0 ? err('#NUM!') : Math.log(v); },
});
def({
  name: 'LOG', ru: [], min: 1, max: 2, category: 'math',
  description: 'Логарифм по основанию (по умолчанию 10)', syntax: 'LOG(8; 2)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    const base = optNum(a, 1, ctx, 10);
    if (isError(base)) return base;
    if (v <= 0 || base <= 0 || base === 1) return err('#NUM!');
    return Math.log(v) / Math.log(base);
  },
});
def({
  name: 'LOG10', ru: [], min: 1, max: 1, category: 'math',
  description: 'Десятичный логарифм', syntax: 'LOG10(1000)',
  fn: (a, ctx) => { const v = num(a[0], ctx); if (isError(v)) return v; return v <= 0 ? err('#NUM!') : Math.log10(v); },
});
def({
  name: 'PI', ru: ['ПИ'], min: 0, max: 0, category: 'math',
  description: 'Число π', syntax: 'ПИ()',
  fn: () => Math.PI,
});
def({
  name: 'CEILING', ru: ['ОКРВВЕРХ'], min: 1, max: 2, category: 'math',
  description: 'Округление вверх до кратного', syntax: 'ОКРВВЕРХ(B2; 5)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    const s = optNum(a, 1, ctx, 1);
    if (isError(s)) return s;
    return s === 0 ? 0 : Math.ceil(Number((v / s).toPrecision(15))) * s;
  },
});
def({
  name: 'FLOOR', ru: ['ОКРВНИЗ'], min: 1, max: 2, category: 'math',
  description: 'Округление вниз до кратного', syntax: 'ОКРВНИЗ(B2; 5)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    const s = optNum(a, 1, ctx, 1);
    if (isError(s)) return s;
    if (s === 0) return err('#DIV/0!');
    return Math.floor(Number((v / s).toPrecision(15))) * s;
  },
});
def({
  name: 'MROUND', ru: ['ОКРУГЛТ'], min: 2, max: 2, category: 'math',
  description: 'Округление до ближайшего кратного', syntax: 'ОКРУГЛТ(B2; 5)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    if (v[1] === 0) return 0;
    if (Math.sign(v[0]) * Math.sign(v[1]) < 0) return err('#NUM!');
    return roundHalfAway(v[0] / v[1], 0) * v[1];
  },
});
def({
  name: 'EVEN', ru: ['ЧЁТН', 'ЧЕТН'], min: 1, max: 1, category: 'math',
  description: 'Округление до ближайшего чётного от нуля', syntax: 'ЧЁТН(3)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    const r = Math.ceil(Math.abs(v) / 2) * 2;
    return Math.sign(v) * r;
  },
});
def({
  name: 'ODD', ru: ['НЕЧЁТ', 'НЕЧЕТ'], min: 1, max: 1, category: 'math',
  description: 'Округление до ближайшего нечётного от нуля', syntax: 'НЕЧЁТ(2)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    let r = Math.ceil(Math.abs(v));
    if (r % 2 === 0) r += 1;
    return (v < 0 ? -1 : 1) * r;
  },
});
def({
  name: 'RAND', ru: ['СЛЧИС'], min: 0, max: 0, category: 'math',
  description: 'Случайное число от 0 до 1', syntax: 'СЛЧИС()',
  fn: () => Math.random(),
});
def({
  name: 'RANDBETWEEN', ru: ['СЛУЧМЕЖДУ'], min: 2, max: 2, category: 'math',
  description: 'Случайное целое в диапазоне', syntax: 'СЛУЧМЕЖДУ(1; 100)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 2);
    if (isError(v)) return v;
    const lo = Math.ceil(v[0]);
    const hi = Math.floor(v[1]);
    return hi < lo ? err('#NUM!') : lo + Math.floor(Math.random() * (hi - lo + 1));
  },
});

// —— Статистика ——
def({
  name: 'MEDIAN', ru: ['МЕДИАНА'], min: 1, ranges: true, category: 'stat',
  description: 'Медиана', syntax: 'МЕДИАНА(B2:B10)',
  fn: (a, ctx) => {
    const n = collectNumbers(a, ctx);
    if (isError(n)) return n;
    if (!n.length) return err('#NUM!');
    const s = [...n].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },
});
const kth = (largest) => (a, ctx) => {
  const n = collectNumbers([a[0]], ctx);
  if (isError(n)) return n;
  const k = num(a[1], ctx);
  if (isError(k)) return k;
  const idx = Math.ceil(k) - 1;
  if (idx < 0 || idx >= n.length) return err('#NUM!');
  const s = [...n].sort((x, y) => (largest ? y - x : x - y));
  return s[idx];
};
def({
  name: 'LARGE', ru: ['НАИБОЛЬШИЙ'], min: 2, max: 2, ranges: true, category: 'stat',
  description: 'k-е по величине значение', syntax: 'НАИБОЛЬШИЙ(B2:B10; 2)', fn: kth(true),
});
def({
  name: 'SMALL', ru: ['НАИМЕНЬШИЙ'], min: 2, max: 2, ranges: true, category: 'stat',
  description: 'k-е наименьшее значение', syntax: 'НАИМЕНЬШИЙ(B2:B10; 2)', fn: kth(false),
});
const variance = (sample) => (a, ctx) => {
  const n = collectNumbers(a, ctx);
  if (isError(n)) return n;
  const count = n.length;
  if (count < (sample ? 2 : 1)) return err('#DIV/0!');
  const mean = sum(n) / count;
  return sum(n.map((x) => (x - mean) ** 2)) / (count - (sample ? 1 : 0));
};
def({
  name: 'VAR', ru: ['ДИСП', 'VAR.S', 'ДИСП.В'], min: 1, ranges: true, category: 'stat',
  description: 'Дисперсия по выборке', syntax: 'ДИСП(B2:B10)', fn: variance(true),
});
def({
  name: 'VARP', ru: ['ДИСПР', 'VAR.P', 'ДИСП.Г'], min: 1, ranges: true, category: 'stat',
  description: 'Дисперсия генеральной совокупности', syntax: 'ДИСПР(B2:B10)', fn: variance(false),
});
def({
  name: 'STDEV', ru: ['СТАНДОТКЛОН', 'STDEV.S', 'СТАНДОТКЛОН.В'], min: 1, ranges: true, category: 'stat',
  description: 'Стандартное отклонение по выборке', syntax: 'СТАНДОТКЛОН(B2:B10)',
  fn: (a, ctx) => { const v = variance(true)(a, ctx); return isError(v) ? v : Math.sqrt(v); },
});
def({
  name: 'STDEVP', ru: ['СТАНДОТКЛОНП', 'STDEV.P', 'СТАНДОТКЛОН.Г'], min: 1, ranges: true, category: 'stat',
  description: 'Стандартное отклонение генеральной совокупности', syntax: 'СТАНДОТКЛОНП(B2:B10)',
  fn: (a, ctx) => { const v = variance(false)(a, ctx); return isError(v) ? v : Math.sqrt(v); },
});
def({
  name: 'RANK', ru: ['РАНГ', 'RANK.EQ', 'РАНГ.РВ'], min: 2, max: 3, category: 'stat',
  description: 'Ранг числа в списке', syntax: 'РАНГ(B2; B$2:B$10; 0)',
  fn: (a, ctx) => {
    const v = num(a[0], ctx);
    if (isError(v)) return v;
    const list = collectNumbers([a[1]], ctx);
    if (isError(list)) return list;
    const asc = optNum(a, 2, ctx, 0);
    if (isError(asc)) return asc;
    if (!list.includes(v)) return err('#N/A');
    return 1 + list.filter((x) => (asc ? x < v : x > v)).length;
  },
});

// —— Условные агрегаты ——
def({
  name: 'SUMIF', ru: ['СУММЕСЛИ'], min: 2, max: 3, ranges: true, category: 'math',
  description: 'Сумма по условию', syntax: 'СУММЕСЛИ(A2:A10; ">100"; B2:B10)',
  fn: (a, ctx) => conditionalAggregate(a[2] && !isEmpty(a[2]) ? a[2] : a[0], [[a[0], a[1]]], ctx, sum),
});
def({
  name: 'SUMIFS', ru: ['СУММЕСЛИМН'], min: 3, ranges: true, category: 'math',
  description: 'Сумма по нескольким условиям', syntax: 'СУММЕСЛИМН(C2:C10; A2:A10; "Москва"; B2:B10; ">5")',
  fn: (a, ctx) => conditionalAggregate(a[0], pairsFrom(a, 1), ctx, sum),
});
def({
  name: 'COUNTIF', ru: ['СЧЁТЕСЛИ', 'СЧЕТЕСЛИ'], min: 2, max: 2, ranges: true, category: 'math',
  description: 'Количество ячеек по условию', syntax: 'СЧЁТЕСЛИ(A2:A10; "да")',
  fn: (a, ctx) => {
    const range = requireRange(a[0]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    const mask = criteriaMask([[a[0], a[1]]], ctx, range.rows, range.cols);
    return isError(mask) ? mask : mask.flat().filter(Boolean).length;
  },
});
def({
  name: 'COUNTIFS', ru: ['СЧЁТЕСЛИМН', 'СЧЕТЕСЛИМН'], min: 2, ranges: true, category: 'math',
  description: 'Количество по нескольким условиям', syntax: 'СЧЁТЕСЛИМН(A2:A10; "да"; B2:B10; ">5")',
  fn: (a, ctx) => {
    const range = requireRange(a[0]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    const mask = criteriaMask(pairsFrom(a, 0), ctx, range.rows, range.cols);
    return isError(mask) ? mask : mask.flat().filter(Boolean).length;
  },
});
const avgOrDiv0 = (list) => (list.length ? sum(list) / list.length : err('#DIV/0!'));
def({
  name: 'AVERAGEIF', ru: ['СРЗНАЧЕСЛИ'], min: 2, max: 3, ranges: true, category: 'math',
  description: 'Среднее по условию', syntax: 'СРЗНАЧЕСЛИ(A2:A10; "да"; B2:B10)',
  fn: (a, ctx) => conditionalAggregate(a[2] && !isEmpty(a[2]) ? a[2] : a[0], [[a[0], a[1]]], ctx, avgOrDiv0),
});
def({
  name: 'AVERAGEIFS', ru: ['СРЗНАЧЕСЛИМН'], min: 3, ranges: true, category: 'math',
  description: 'Среднее по нескольким условиям', syntax: 'СРЗНАЧЕСЛИМН(C2:C10; A2:A10; "да")',
  fn: (a, ctx) => conditionalAggregate(a[0], pairsFrom(a, 1), ctx, avgOrDiv0),
});
def({
  name: 'MAXIFS', ru: ['МАКСЕСЛИ'], min: 3, ranges: true, category: 'math',
  description: 'Максимум по условиям', syntax: 'МАКСЕСЛИ(C2:C10; A2:A10; "да")',
  fn: (a, ctx) => conditionalAggregate(a[0], pairsFrom(a, 1), ctx, (l) => (l.length ? Math.max(...l) : 0)),
});
def({
  name: 'MINIFS', ru: ['МИНЕСЛИ'], min: 3, ranges: true, category: 'math',
  description: 'Минимум по условиям', syntax: 'МИНЕСЛИ(C2:C10; A2:A10; "да")',
  fn: (a, ctx) => conditionalAggregate(a[0], pairsFrom(a, 1), ctx, (l) => (l.length ? Math.min(...l) : 0)),
});

// —— Логика ——
def({
  name: 'IF', ru: ['ЕСЛИ'], min: 1, max: 3, lazy: true, category: 'logic',
  description: 'Если условие истинно — второй аргумент, иначе третий', syntax: 'ЕСЛИ(B2>100; "много"; "мало")',
  fn: (nodes, ctx) => {
    const cond = toBool(evalArg(nodes[0], ctx), ctx);
    if (isError(cond)) return cond;
    const branch = cond ? nodes[1] : nodes[2];
    if (!branch) return cond ? true : false;
    if (branch.type === 'missing') return 0;
    return evalArg(branch, ctx);
  },
});
def({
  name: 'IFS', ru: ['ЕСЛИМН'], min: 2, lazy: true, category: 'logic',
  description: 'Первое истинное условие из списка', syntax: 'ЕСЛИМН(B2>90; "A"; B2>70; "B"; ИСТИНА; "C")',
  fn: (nodes, ctx) => {
    for (let i = 0; i + 1 < nodes.length; i += 2) {
      const cond = toBool(evalArg(nodes[i], ctx), ctx);
      if (isError(cond)) return cond;
      if (cond) return evalArg(nodes[i + 1], ctx);
    }
    return err('#N/A', 'Ни одно условие не выполнено');
  },
});
def({
  name: 'IFERROR', ru: ['ЕСЛИОШИБКА'], min: 2, max: 2, lazy: true, category: 'logic',
  description: 'Значение или запасное, если ошибка', syntax: 'ЕСЛИОШИБКА(B2/C2; 0)',
  fn: (nodes, ctx) => {
    const v = toScalar(evalArg(nodes[0], ctx), ctx);
    return isError(v) ? evalArg(nodes[1], ctx) : v;
  },
});
def({
  name: 'IFNA', ru: ['ЕСНД'], min: 2, max: 2, lazy: true, category: 'logic',
  description: 'Значение или запасное, если #N/A', syntax: 'ЕСНД(ВПР(...); "нет")',
  fn: (nodes, ctx) => {
    const v = toScalar(evalArg(nodes[0], ctx), ctx);
    return isError(v) && v.code === '#N/A' ? evalArg(nodes[1], ctx) : v;
  },
});
const logicalValues = (args, ctx) => {
  const out = [];
  for (const arg of args) {
    if (isRange(arg)) {
      let failure = null;
      arg.forEach((v) => {
        if (failure) return;
        if (isError(v)) failure = v;
        else if (typeof v === 'boolean') out.push(v);
        else if (typeof v === 'number') out.push(v !== 0);
      });
      if (failure) return failure;
    } else {
      const b = toBool(arg, ctx);
      if (isError(b)) return b;
      out.push(b);
    }
  }
  return out.length ? out : err('#VALUE!');
};
def({
  name: 'AND', ru: ['И'], min: 1, ranges: true, category: 'logic',
  description: 'ИСТИНА, если все условия истинны', syntax: 'И(B2>0; C2="да")',
  fn: (a, ctx) => { const v = logicalValues(a, ctx); return isError(v) ? v : v.every(Boolean); },
});
def({
  name: 'OR', ru: ['ИЛИ'], min: 1, ranges: true, category: 'logic',
  description: 'ИСТИНА, если хотя бы одно условие истинно', syntax: 'ИЛИ(B2>100; C2="да")',
  fn: (a, ctx) => { const v = logicalValues(a, ctx); return isError(v) ? v : v.some(Boolean); },
});
def({
  name: 'XOR', ru: ['ИСКЛИЛИ'], min: 1, ranges: true, category: 'logic',
  description: 'Исключающее ИЛИ', syntax: 'ИСКЛИЛИ(B2>0; C2>0)',
  fn: (a, ctx) => { const v = logicalValues(a, ctx); return isError(v) ? v : v.filter(Boolean).length % 2 === 1; },
});
def({
  name: 'NOT', ru: ['НЕ'], min: 1, max: 1, category: 'logic',
  description: 'Логическое отрицание', syntax: 'НЕ(B2>0)',
  fn: (a, ctx) => { const v = toBool(a[0], ctx); return isError(v) ? v : !v; },
});
def({ name: 'TRUE', ru: ['ИСТИНА'], min: 0, max: 0, category: 'logic', description: 'Логическое ИСТИНА', syntax: 'ИСТИНА()', fn: () => true });
def({ name: 'FALSE', ru: ['ЛОЖЬ'], min: 0, max: 0, category: 'logic', description: 'Логическое ЛОЖЬ', syntax: 'ЛОЖЬ()', fn: () => false });
def({
  name: 'SWITCH', ru: ['ПЕРЕКЛЮЧ'], min: 3, lazy: true, category: 'logic',
  description: 'Выбор значения по совпадению', syntax: 'ПЕРЕКЛЮЧ(A2; 1; "один"; 2; "два"; "другое")',
  fn: (nodes, ctx) => {
    const v = toScalar(evalArg(nodes[0], ctx), ctx);
    if (isError(v)) return v;
    let i = 1;
    for (; i + 1 < nodes.length; i += 2) {
      const candidate = toScalar(evalArg(nodes[i], ctx), ctx);
      if (!isError(candidate) && compareValues(v, candidate) === 0) return evalArg(nodes[i + 1], ctx);
    }
    return i < nodes.length ? evalArg(nodes[i], ctx) : err('#N/A');
  },
});
def({
  name: 'CHOOSE', ru: ['ВЫБОР'], min: 2, lazy: true, category: 'logic',
  description: 'Значение из списка по номеру', syntax: 'ВЫБОР(2; "a"; "b"; "c")',
  fn: (nodes, ctx) => {
    const idx = toNumber(evalArg(nodes[0], ctx), ctx);
    if (isError(idx)) return idx;
    const i = Math.trunc(idx);
    if (i < 1 || i >= nodes.length) return err('#VALUE!', 'Номер вне списка');
    return evalArg(nodes[i], ctx);
  },
});

// —— Проверки ——
const firstScalar = (a, ctx) => toScalar(a[0], ctx);
def({ name: 'ISBLANK', ru: ['ЕПУСТО'], min: 1, max: 1, category: 'info', description: 'Ячейка пуста', syntax: 'ЕПУСТО(B2)', fn: (a, ctx) => isEmpty(firstScalar(a, ctx)) });
def({ name: 'ISNUMBER', ru: ['ЕЧИСЛО'], min: 1, max: 1, category: 'info', description: 'Значение — число', syntax: 'ЕЧИСЛО(B2)', fn: (a, ctx) => typeof firstScalar(a, ctx) === 'number' });
def({ name: 'ISTEXT', ru: ['ЕТЕКСТ'], min: 1, max: 1, category: 'info', description: 'Значение — текст', syntax: 'ЕТЕКСТ(B2)', fn: (a, ctx) => typeof firstScalar(a, ctx) === 'string' });
def({ name: 'ISLOGICAL', ru: ['ЕЛОГИЧ'], min: 1, max: 1, category: 'info', description: 'Значение — логическое', syntax: 'ЕЛОГИЧ(B2)', fn: (a, ctx) => typeof firstScalar(a, ctx) === 'boolean' });
def({ name: 'ISERROR', ru: ['ЕОШИБКА'], min: 1, max: 1, category: 'info', description: 'Значение — ошибка', syntax: 'ЕОШИБКА(B2/C2)', fn: (a, ctx) => isError(firstScalar(a, ctx)) });
def({ name: 'ISNA', ru: ['ЕНД'], min: 1, max: 1, category: 'info', description: 'Значение — #N/A', syntax: 'ЕНД(ВПР(...))', fn: (a, ctx) => { const v = firstScalar(a, ctx); return isError(v) && v.code === '#N/A'; } });
def({
  name: 'ISEVEN', ru: ['ЕЧЁТН', 'ЕЧЕТН'], min: 1, max: 1, category: 'info', description: 'Число чётное', syntax: 'ЕЧЁТН(B2)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.trunc(v) % 2 === 0; },
});
def({
  name: 'ISODD', ru: ['ЕНЕЧЁТ', 'ЕНЕЧЕТ'], min: 1, max: 1, category: 'info', description: 'Число нечётное', syntax: 'ЕНЕЧЁТ(B2)',
  fn: (a, ctx) => { const v = num(a[0], ctx); return isError(v) ? v : Math.abs(Math.trunc(v) % 2) === 1; },
});
def({ name: 'NA', ru: ['НД'], min: 0, max: 0, category: 'info', description: 'Ошибка #N/A', syntax: 'НД()', fn: () => err('#N/A') });

// —— Текст ——
const joinText = (values, ctx) => {
  let out = '';
  for (const v of values) {
    const t = text(v, ctx);
    if (isError(t)) return t;
    out += t;
  }
  return out;
};
def({
  name: 'CONCATENATE', ru: ['СЦЕПИТЬ'], min: 1, category: 'text',
  description: 'Объединяет тексты', syntax: 'СЦЕПИТЬ(A2; " "; B2)',
  fn: (a, ctx) => joinText(a, ctx),
});
def({
  name: 'CONCAT', ru: ['СЦЕП'], min: 1, ranges: true, category: 'text',
  description: 'Объединяет тексты и диапазоны', syntax: 'СЦЕП(A2:C2)',
  fn: (a, ctx) => joinText(collectValues(a), ctx),
});
def({
  name: 'TEXTJOIN', ru: ['ОБЪЕДИНИТЬ'], min: 3, ranges: true, category: 'text',
  description: 'Объединяет с разделителем', syntax: 'ОБЪЕДИНИТЬ(", "; ИСТИНА; A2:A10)',
  fn: (a, ctx) => {
    const sep = text(a[0], ctx);
    if (isError(sep)) return sep;
    const skip = toBool(a[1], ctx);
    if (isError(skip)) return skip;
    const parts = [];
    for (const v of collectValues(a.slice(2))) {
      const t = text(v, ctx);
      if (isError(t)) return t;
      if (skip && t === '') continue;
      parts.push(t);
    }
    return parts.join(sep);
  },
});
const textFn = (name, ru, description, syntax, map) => def({
  name, ru, min: 1, max: 1, category: 'text', description, syntax,
  fn: (a, ctx) => { const t = text(a[0], ctx); return isError(t) ? t : map(t); },
});
textFn('LEN', ['ДЛСТР'], 'Длина текста', 'ДЛСТР(A2)', (t) => t.length);
textFn('UPPER', ['ПРОПИСН'], 'Все буквы прописные', 'ПРОПИСН(A2)', (t) => t.toUpperCase());
textFn('LOWER', ['СТРОЧН'], 'Все буквы строчные', 'СТРОЧН(A2)', (t) => t.toLowerCase());
textFn('PROPER', ['ПРОПНАЧ'], 'Каждое слово с прописной', 'ПРОПНАЧ(A2)', (t) => t.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, p, ch) => p + ch.toUpperCase()));
textFn('TRIM', ['СЖПРОБЕЛЫ'], 'Убирает лишние пробелы', 'СЖПРОБЕЛЫ(A2)', (t) => t.replace(/\s+/g, ' ').trim());
textFn('CODE', ['КОДСИМВ'], 'Код первого символа', 'КОДСИМВ(A2)', (t) => (t ? t.codePointAt(0) : err('#VALUE!')));
def({
  name: 'LEFT', ru: ['ЛЕВСИМВ'], min: 1, max: 2, category: 'text',
  description: 'Первые символы текста', syntax: 'ЛЕВСИМВ(A2; 3)',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    if (isError(t)) return t;
    const n = optNum(a, 1, ctx, 1);
    if (isError(n)) return n;
    return n < 0 ? err('#VALUE!') : t.slice(0, Math.trunc(n));
  },
});
def({
  name: 'RIGHT', ru: ['ПРАВСИМВ'], min: 1, max: 2, category: 'text',
  description: 'Последние символы текста', syntax: 'ПРАВСИМВ(A2; 3)',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    if (isError(t)) return t;
    const n = optNum(a, 1, ctx, 1);
    if (isError(n)) return n;
    if (n < 0) return err('#VALUE!');
    return Math.trunc(n) === 0 ? '' : t.slice(-Math.trunc(n));
  },
});
def({
  name: 'MID', ru: ['ПСТР'], min: 3, max: 3, category: 'text',
  description: 'Часть текста', syntax: 'ПСТР(A2; 2; 5)',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    if (isError(t)) return t;
    const v = nums(a.slice(1), ctx, 2);
    if (isError(v)) return v;
    if (v[0] < 1 || v[1] < 0) return err('#VALUE!');
    return t.substr(Math.trunc(v[0]) - 1, Math.trunc(v[1]));
  },
});
def({
  name: 'SUBSTITUTE', ru: ['ПОДСТАВИТЬ'], min: 3, max: 4, category: 'text',
  description: 'Заменяет текст', syntax: 'ПОДСТАВИТЬ(A2; "старое"; "новое")',
  fn: (a, ctx) => {
    const [t, from, to] = [text(a[0], ctx), text(a[1], ctx), text(a[2], ctx)];
    const e = firstError([t, from, to]);
    if (e) return e;
    if (!from) return t;
    if (a[3] === undefined) return t.split(from).join(to);
    const nth = num(a[3], ctx);
    if (isError(nth)) return nth;
    let idx = -1;
    for (let i = 0; i < nth; i += 1) {
      idx = t.indexOf(from, idx + 1);
      if (idx < 0) return t;
    }
    return t.slice(0, idx) + to + t.slice(idx + from.length);
  },
});
def({
  name: 'REPLACE', ru: ['ЗАМЕНИТЬ'], min: 4, max: 4, category: 'text',
  description: 'Заменяет символы по позиции', syntax: 'ЗАМЕНИТЬ(A2; 1; 3; "abc")',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    const repl = text(a[3], ctx);
    const v = nums(a.slice(1, 3), ctx, 2);
    const e = firstError([t, repl, v]);
    if (e) return e;
    const start = Math.trunc(v[0]) - 1;
    return t.slice(0, start) + repl + t.slice(start + Math.trunc(v[1]));
  },
});
const findFn = (caseSensitive) => (a, ctx) => {
  const needle = text(a[0], ctx);
  const hay = text(a[1], ctx);
  const e = firstError([needle, hay]);
  if (e) return e;
  const start = optNum(a, 2, ctx, 1);
  if (isError(start)) return start;
  const from = Math.trunc(start) - 1;
  if (from < 0 || from > hay.length) return err('#VALUE!');
  if (!caseSensitive && hasWildcard(needle)) {
    const re = new RegExp(wildcardRegex(needle).source.slice(1, -1), 'i');
    const m = re.exec(hay.slice(from));
    return m ? from + m.index + 1 : err('#VALUE!', 'Текст не найден');
  }
  const idx = caseSensitive
    ? hay.indexOf(needle, from)
    : hay.toLowerCase().indexOf(needle.toLowerCase(), from);
  return idx < 0 ? err('#VALUE!', 'Текст не найден') : idx + 1;
};
def({ name: 'FIND', ru: ['НАЙТИ'], min: 2, max: 3, category: 'text', description: 'Позиция текста (с учётом регистра)', syntax: 'НАЙТИ("б"; A2)', fn: findFn(true) });
def({ name: 'SEARCH', ru: ['ПОИСК'], min: 2, max: 3, category: 'text', description: 'Позиция текста (без учёта регистра, * и ?)', syntax: 'ПОИСК("б"; A2)', fn: findFn(false) });
def({
  name: 'TEXT', ru: ['ТЕКСТ'], min: 2, max: 2, category: 'text',
  description: 'Число или дата в текст по формату', syntax: 'ТЕКСТ(B2; "# ##0,00") или ТЕКСТ(C2; "ДД.ММ.ГГГГ")',
  fn: (a, ctx) => {
    const fmt = text(a[1], ctx);
    if (isError(fmt)) return fmt;
    const v = toScalar(a[0], ctx);
    if (isError(v)) return v;
    return formatText(v, fmt, ctx);
  },
});
def({
  name: 'VALUE', ru: ['ЗНАЧЕН'], min: 1, max: 1, category: 'text',
  description: 'Текст в число', syntax: 'ЗНАЧЕН("12,5")',
  fn: (a, ctx) => toNumber(a[0], ctx),
});
def({
  name: 'REPT', ru: ['ПОВТОР'], min: 2, max: 2, category: 'text',
  description: 'Повторяет текст', syntax: 'ПОВТОР("-"; 10)',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    const n = num(a[1], ctx);
    const e = firstError([t, n]);
    if (e) return e;
    return n < 0 ? err('#VALUE!') : t.repeat(Math.trunc(n));
  },
});
def({
  name: 'EXACT', ru: ['СОВПАД'], min: 2, max: 2, category: 'text',
  description: 'Точное совпадение текстов', syntax: 'СОВПАД(A2; B2)',
  fn: (a, ctx) => {
    const x = text(a[0], ctx);
    const y = text(a[1], ctx);
    const e = firstError([x, y]);
    return e || x === y;
  },
});
def({
  name: 'CHAR', ru: ['СИМВОЛ'], min: 1, max: 1, category: 'text',
  description: 'Символ по коду', syntax: 'СИМВОЛ(10)',
  fn: (a, ctx) => { const n = num(a[0], ctx); return isError(n) ? n : String.fromCodePoint(Math.trunc(n)); },
});

// —— Поиск и ссылки ——
def({
  name: 'VLOOKUP', ru: ['ВПР'], min: 3, max: 4, category: 'lookup',
  description: 'Ищет значение в первом столбце и возвращает из указанного', syntax: 'ВПР(A2; Прайс!A:C; 3; ЛОЖЬ)',
  fn: (a, ctx) => {
    const lookup = toScalar(a[0], ctx);
    if (isError(lookup)) return lookup;
    const range = requireRange(a[1]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    const col = num(a[2], ctx);
    if (isError(col)) return col;
    const j = Math.trunc(col) - 1;
    if (j < 0 || j >= range.cols) return err('#REF!', 'Номер столбца вне диапазона');
    const approx = a[3] === undefined || isEmpty(a[3]) ? true : toBool(a[3], ctx);
    if (isError(approx)) return approx;
    const idx = findInList(rangeColumn(range, 0), lookup, approx ? 1 : 0);
    return idx < 0 ? err('#N/A') : range.get(idx, j);
  },
});
def({
  name: 'HLOOKUP', ru: ['ГПР'], min: 3, max: 4, category: 'lookup',
  description: 'Ищет значение в первой строке и возвращает из указанной', syntax: 'ГПР(A1; A1:F3; 2; ЛОЖЬ)',
  fn: (a, ctx) => {
    const lookup = toScalar(a[0], ctx);
    if (isError(lookup)) return lookup;
    const range = requireRange(a[1]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    const row = num(a[2], ctx);
    if (isError(row)) return row;
    const i = Math.trunc(row) - 1;
    if (i < 0 || i >= range.rows) return err('#REF!', 'Номер строки вне диапазона');
    const approx = a[3] === undefined || isEmpty(a[3]) ? true : toBool(a[3], ctx);
    if (isError(approx)) return approx;
    const idx = findInList(rangeRow(range, 0), lookup, approx ? 1 : 0);
    return idx < 0 ? err('#N/A') : range.get(i, idx);
  },
});
def({
  name: 'XLOOKUP', ru: ['ПРОСМОТРX', 'ПРОСМОТРХ'], min: 3, max: 6, category: 'lookup',
  description: 'Ищет значение и возвращает соответствующее из другого диапазона', syntax: 'ПРОСМОТРX(A2; Прайс!A:A; Прайс!C:C; "нет")',
  fn: (a, ctx) => {
    const lookup = toScalar(a[0], ctx);
    if (isError(lookup)) return lookup;
    const where = requireRange(a[1]);
    const ret = requireRange(a[2]);
    if (!where || !ret) return err('#VALUE!', 'Ожидается диапазон');
    const list = rangeAsList(where);
    if (!list) return err('#VALUE!', 'Диапазон поиска — одна строка или столбец');
    const mode = optNum(a, 4, ctx, 0);
    const searchMode = optNum(a, 5, ctx, 1);
    if (isError(mode) || isError(searchMode)) return isError(mode) ? mode : searchMode;
    const order = list.map((_, i) => i);
    if (searchMode < 0) order.reverse();
    let idx = -1;
    if (mode === 0 || mode === 2) {
      idx = order.find((i) => lookupEquals(list[i], lookup)) ?? -1;
    } else {
      let best = -1;
      order.forEach((i) => {
        const v = list[i];
        if (isEmpty(v) || isError(v)) return;
        const cmp = compareValues(v, lookup);
        if (cmp === 0 && best < 0) best = i;
        if (best >= 0 && compareValues(list[best], lookup) === 0) return;
        if ((mode === -1 && cmp < 0) || (mode === 1 && cmp > 0)) {
          if (best < 0 || (mode === -1 ? compareValues(v, list[best]) > 0 : compareValues(v, list[best]) < 0)) best = i;
        }
      });
      idx = best;
    }
    if (idx < 0) return a[3] !== undefined && !isEmpty(a[3]) ? a[3] : err('#N/A');
    if (where.cols === 1 && ret.rows === where.rows) return ret.cols === 1 ? ret.get(idx, 0) : new RangeRef(ctx, ret.model, ret.r0 + idx, ret.c0, ret.r0 + idx, ret.c1);
    if (where.rows === 1 && ret.cols === where.cols) return ret.rows === 1 ? ret.get(0, idx) : new RangeRef(ctx, ret.model, ret.r0, ret.c0 + idx, ret.r1, ret.c0 + idx);
    return err('#VALUE!', 'Диапазоны разного размера');
  },
});
def({
  name: 'INDEX', ru: ['ИНДЕКС'], min: 2, max: 3, category: 'lookup',
  description: 'Значение по номеру строки и столбца', syntax: 'ИНДЕКС(A2:C10; 3; 2)',
  fn: (a, ctx) => {
    const range = requireRange(a[0]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    let r = optNum(a, 1, ctx, 0);
    let c = optNum(a, 2, ctx, 0);
    if (isError(r)) return r;
    if (isError(c)) return c;
    r = Math.trunc(r);
    c = Math.trunc(c);
    if (a.length === 2 && range.rows === 1) {
      c = r;
      r = 1;
    }
    if (r < 0 || c < 0 || r > range.rows || c > range.cols) return err('#REF!');
    if (r === 0 && c === 0) return range;
    if (r === 0) return new RangeRef(ctx, range.model, range.r0, range.c0 + c - 1, range.r1, range.c0 + c - 1);
    if (c === 0) {
      if (range.cols === 1) return range.get(r - 1, 0);
      return new RangeRef(ctx, range.model, range.r0 + r - 1, range.c0, range.r0 + r - 1, range.c1);
    }
    return range.get(r - 1, c - 1);
  },
});
def({
  name: 'MATCH', ru: ['ПОИСКПОЗ'], min: 2, max: 3, category: 'lookup',
  description: 'Позиция значения в строке или столбце', syntax: 'ПОИСКПОЗ(A2; B2:B10; 0)',
  fn: (a, ctx) => {
    const lookup = toScalar(a[0], ctx);
    if (isError(lookup)) return lookup;
    const range = requireRange(a[1]);
    if (!range) return err('#VALUE!', 'Ожидается диапазон');
    const list = rangeAsList(range);
    if (!list) return err('#N/A');
    const type = optNum(a, 2, ctx, 1);
    if (isError(type)) return type;
    const idx = findInList(list, lookup, Math.sign(type));
    return idx < 0 ? err('#N/A') : idx + 1;
  },
});
def({
  name: 'ROW', ru: ['СТРОКА'], min: 0, max: 1, category: 'lookup',
  description: 'Номер строки', syntax: 'СТРОКА() или СТРОКА(B5)',
  fn: (a, ctx) => (a.length && isRange(a[0]) ? a[0].r0 + 1 : ctx.row + 1),
});
def({
  name: 'COLUMN', ru: ['СТОЛБЕЦ'], min: 0, max: 1, category: 'lookup',
  description: 'Номер столбца', syntax: 'СТОЛБЕЦ() или СТОЛБЕЦ(C1)',
  fn: (a, ctx) => (a.length && isRange(a[0]) ? a[0].c0 + 1 : ctx.col + 1),
});
def({
  name: 'ROWS', ru: ['ЧСТРОК'], min: 1, max: 1, category: 'lookup',
  description: 'Число строк в диапазоне', syntax: 'ЧСТРОК(A2:A10)',
  fn: (a) => (isRange(a[0]) ? a[0].rows : 1),
});
def({
  name: 'COLUMNS', ru: ['ЧИСЛСТОЛБ'], min: 1, max: 1, category: 'lookup',
  description: 'Число столбцов в диапазоне', syntax: 'ЧИСЛСТОЛБ(A2:D2)',
  fn: (a) => (isRange(a[0]) ? a[0].cols : 1),
});

// —— Даты ——
def({
  name: 'DATE', ru: ['ДАТА'], min: 3, max: 3, category: 'date',
  description: 'Дата из года, месяца и дня', syntax: 'ДАТА(2026; 1; 15)',
  fn: (a, ctx) => {
    const v = nums(a, ctx, 3);
    if (isError(v)) return v;
    let y = Math.trunc(v[0]);
    if (y >= 0 && y < 1900) y += 1900;
    return dateToExcelSerial(y, Math.trunc(v[1]), Math.trunc(v[2]));
  },
});
def({ name: 'TODAY', ru: ['СЕГОДНЯ'], min: 0, max: 0, category: 'date', description: 'Сегодняшняя дата', syntax: 'СЕГОДНЯ()', fn: () => todayExcelSerial() });
def({
  name: 'NOW', ru: ['ТДАТА'], min: 0, max: 0, category: 'date', description: 'Текущие дата и время', syntax: 'ТДАТА()',
  fn: () => {
    const now = new Date();
    const day = todayExcelSerial();
    return day + (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  },
});
const datePart = (name, ru, description, pick) => def({
  name, ru, min: 1, max: 1, category: 'date', description, syntax: `${ru[0]}(C2)`,
  fn: (a, ctx) => { const s = dateArg(a[0], ctx); return isError(s) ? s : pick(excelSerialToDate(s)); },
});
datePart('YEAR', ['ГОД'], 'Год из даты', (d) => d.y);
datePart('MONTH', ['МЕСЯЦ'], 'Месяц из даты', (d) => d.m);
datePart('DAY', ['ДЕНЬ'], 'День месяца из даты', (d) => d.d);
def({
  name: 'WEEKDAY', ru: ['ДЕНЬНЕД'], min: 1, max: 2, category: 'date',
  description: 'День недели (тип 2: пн=1 … вс=7)', syntax: 'ДЕНЬНЕД(C2; 2)',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    if (isError(s)) return s;
    const type = optNum(a, 1, ctx, 1);
    if (isError(type)) return type;
    const { wd } = excelSerialToDate(s);
    if (type === 2) return wd === 0 ? 7 : wd;
    if (type === 3) return wd === 0 ? 6 : wd - 1;
    return wd + 1;
  },
});
def({
  name: 'WEEKNUM', ru: ['НОМНЕДЕЛИ'], min: 1, max: 2, category: 'date',
  description: 'Номер недели в году', syntax: 'НОМНЕДЕЛИ(C2; 2)',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    if (isError(s)) return s;
    const type = optNum(a, 1, ctx, 1);
    if (isError(type)) return type;
    const { y } = excelSerialToDate(s);
    const jan1 = dateToExcelSerial(y, 1, 1);
    const { wd } = excelSerialToDate(jan1);
    const offset = type === 2 ? (wd + 6) % 7 : wd;
    return Math.floor((s - jan1 + offset) / 7) + 1;
  },
});
def({
  name: 'DATEDIF', ru: ['РАЗНДАТ'], min: 3, max: 3, category: 'date',
  description: 'Разница между датами: "Y", "M", "D", "YM", "MD", "YD"', syntax: 'РАЗНДАТ(C2; СЕГОДНЯ(); "Y")',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    const e = dateArg(a[1], ctx);
    const unit = text(a[2], ctx);
    const bad = firstError([s, e, unit]);
    if (bad) return bad;
    if (s > e) return err('#NUM!', 'Начальная дата позже конечной');
    const A = excelSerialToDate(s);
    const B = excelSerialToDate(e);
    let months = (B.y - A.y) * 12 + (B.m - A.m);
    if (B.d < A.d) months -= 1;
    switch (unit.toUpperCase()) {
      case 'Y': return Math.floor(months / 12);
      case 'M': return months;
      case 'D': return e - s;
      case 'YM': return months % 12;
      case 'MD': return B.d >= A.d ? B.d - A.d : e - addMonths(s, months);
      case 'YD': {
        let start = dateToExcelSerial(B.y, A.m, A.d);
        if (start > e) start = dateToExcelSerial(B.y - 1, A.m, A.d);
        return e - start;
      }
      default: return err('#NUM!', 'Неизвестная единица');
    }
  },
});
def({
  name: 'EDATE', ru: ['ДАТАМЕС'], min: 2, max: 2, category: 'date',
  description: 'Дата через N месяцев', syntax: 'ДАТАМЕС(C2; 3)',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    const m = num(a[1], ctx);
    const e = firstError([s, m]);
    return e || addMonths(s, Math.trunc(m));
  },
});
def({
  name: 'EOMONTH', ru: ['КОНМЕСЯЦА'], min: 2, max: 2, category: 'date',
  description: 'Последний день месяца через N месяцев', syntax: 'КОНМЕСЯЦА(C2; 0)',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    const m = num(a[1], ctx);
    const e = firstError([s, m]);
    return e || addMonths(s, Math.trunc(m), true);
  },
});
def({
  name: 'DAYS', ru: ['ДНИ'], min: 2, max: 2, category: 'date',
  description: 'Количество дней между датами', syntax: 'ДНИ(D2; C2)',
  fn: (a, ctx) => {
    const e = dateArg(a[0], ctx);
    const s = dateArg(a[1], ctx);
    const bad = firstError([e, s]);
    return bad || Math.trunc(e) - Math.trunc(s);
  },
});
def({
  name: 'NETWORKDAYS', ru: ['ЧИСТРАБДНИ'], min: 2, max: 3, ranges: true, category: 'date',
  description: 'Рабочие дни между датами', syntax: 'ЧИСТРАБДНИ(C2; D2; Праздники!A:A)',
  fn: (a, ctx) => {
    let s = dateArg(a[0], ctx);
    let e = dateArg(a[1], ctx);
    const bad = firstError([s, e]);
    if (bad) return bad;
    const sign = s > e ? -1 : 1;
    if (s > e) [s, e] = [e, s];
    const holidays = holidaySet(a[2]);
    let count = 0;
    for (let d = Math.trunc(s); d <= Math.trunc(e); d += 1) {
      if (!isWeekend(d) && !holidays.has(d)) count += 1;
    }
    return sign * count;
  },
});
def({
  name: 'WORKDAY', ru: ['РАБДЕНЬ'], min: 2, max: 3, ranges: true, category: 'date',
  description: 'Дата через N рабочих дней', syntax: 'РАБДЕНЬ(C2; 10)',
  fn: (a, ctx) => {
    const s = dateArg(a[0], ctx);
    const n = num(a[1], ctx);
    const bad = firstError([s, n]);
    if (bad) return bad;
    const holidays = holidaySet(a[2]);
    let d = Math.trunc(s);
    let left = Math.abs(Math.trunc(n));
    const step = n < 0 ? -1 : 1;
    while (left > 0) {
      d += step;
      if (!isWeekend(d) && !holidays.has(d)) left -= 1;
    }
    return d;
  },
});
def({
  name: 'DATEVALUE', ru: ['ДАТАЗНАЧ'], min: 1, max: 1, category: 'date',
  description: 'Текст даты в дату', syntax: 'ДАТАЗНАЧ("01.03.2026")',
  fn: (a, ctx) => {
    const t = text(a[0], ctx);
    if (isError(t)) return t;
    const s = parseDateTextToSerial(t);
    return s == null ? err('#VALUE!', 'Не дата') : s;
  },
});

/* ─────────────────────────── реестр ─────────────────────────── */

export const FORMULA_FUNCTIONS = F;

const normalizeName = (name) => String(name ?? '').trim().toUpperCase().replace(/Ё/g, 'Е');
const REGISTRY = new Map();
F.forEach((spec) => {
  [spec.name, ...(spec.ru || [])].forEach((n) => REGISTRY.set(normalizeName(n), spec));
});

export function lookupFormulaFunction(name) {
  return REGISTRY.get(normalizeName(name)) || null;
}

/** Нужно для форматирования в ТЕКСТ() и тестов. */
export { formatGeneralNumber, formatNumberByPattern, formatDateByPattern };
