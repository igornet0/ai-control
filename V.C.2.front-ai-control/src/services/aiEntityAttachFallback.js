/**
 * Client-side helpers: openable entity cards when AI forgets / old backend.
 * Keep patterns aligned with src/app/services/ai/entity_links.py
 */

const LINK_REQUEST_RE =
  /ссылк|пришл\w*|прикреп\w*|скинь|перешли|карточк\w*|открой|открыть|attach|deep\s*link|send\s+(me\s+)?(a\s+|the\s+)?link/iu;

/** Cyrillic-safe "word" tail (JS \\w is ASCII-only). */
const CW = '[а-яёa-z0-9_]*';

const TASK_ID_RE = [
  new RegExp(`задач${CW}\\s*#\\s*(\\d{1,9})`, 'giu'),
  new RegExp(`задач${CW}\\s*(?:id|№)\\s*[:=]?\\s*(\\d{1,9})`, 'giu'),
  /(?:^|\n)\|\s*id\s*\|\s*(\d{1,9})\s*\|/gim,
  /(?:^|\n)id\s*[|\t:=\u2014\-]+\s*(\d{1,9})\b/gim,
  /\(id\s*[:=]?\s*(\d{1,9})\)/gi,
  /\/tasks\?task=(\d{1,9})/gi,
];

/**
 * @param {string|undefined|null} text
 */
export function wantsOpenableEntity(text) {
  return LINK_REQUEST_RE.test(String(text || ''));
}

/**
 * @param {string|undefined|null} text
 * @returns {number|null}
 */
export function extractTaskIdFromText(text) {
  const raw = String(text || '');
  for (const re of TASK_ID_RE) {
    re.lastIndex = 0;
    const m = re.exec(raw);
    if (m?.[1]) {
      const id = Number(m[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

/**
 * Walk messages newest-first; prefer assistant/user content mentioning a task.
 * @param {Array<{ role?: string, content?: string, meta?: { entity_refs?: Array<{type?:string,id?:number,title?:string}> } }>} messages
 * @returns {{ type: string, id: number, title: string, url: string }|null}
 */
export function findRecentTaskEntityRef(messages) {
  const rows = Array.isArray(messages) ? [...messages].reverse() : [];
  for (const m of rows) {
    const refs = m?.meta?.entity_refs;
    if (Array.isArray(refs)) {
      const task = refs.find((r) => r?.type === 'task' && r?.id != null);
      if (task) {
        const id = Number(task.id);
        return {
          type: 'task',
          id,
          title: String(task.title || `Задача #${id}`),
          url: task.url || `/tasks?task=${id}`,
        };
      }
    }
    const id = extractTaskIdFromText(m?.content);
    if (id != null) {
      const titleMatch = String(m.content || '').match(
        new RegExp(
          `задач${CW}\\s*#?\\s*\\d+[^\\n«"]*[«"]([^»"]+)[»"]|задач${CW}\\s*#\\s*\\d+\\s*[—\\-–]\\s*([^\\n]+)`,
          'iu'
        )
      );
      const title =
        (titleMatch && (titleMatch[1] || titleMatch[2])?.trim()) || `Задача #${id}`;
      return {
        type: 'task',
        id,
        title: title.slice(0, 120),
        url: `/tasks?task=${id}`,
      };
    }
  }
  return null;
}

/**
 * @param {{ type: string, id: number, title: string, url?: string }} ref
 */
export function formatOpenEntityReply(ref) {
  const title = ref.title || `${ref.type} #${ref.id}`;
  const path = ref.url || `/tasks?task=${ref.id}`;
  return (
    `Приглашает вас к задаче «${title}». Откройте по кнопке ниже.\n\n` +
    `**Открыть задачу:** [${title}](${path})`
  );
}

/**
 * If user asked for a link and assistant has no entity_refs, attach from history.
 * @param {object} assistantMessage
 * @param {string} userText
 * @param {Array} priorMessages
 */
export function withEntityAttachFallback(assistantMessage, userText, priorMessages) {
  if (!assistantMessage || !wantsOpenableEntity(userText)) return assistantMessage;
  const existing = assistantMessage.meta?.entity_refs;
  if (Array.isArray(existing) && existing.length) return assistantMessage;

  const ref = findRecentTaskEntityRef([
    ...(Array.isArray(priorMessages) ? priorMessages : []),
    assistantMessage,
  ]);
  if (!ref) return assistantMessage;

  const low = String(assistantMessage.content || '').toLowerCase();
  const refused =
    low.includes('не могу отправлять ссылк') ||
    low.includes('не могу присылать ссылк') ||
    low.includes('нет доступа к ui') ||
    low.includes('не знаю url') ||
    low.includes('не знаю базовый') ||
    low.includes('нет доступа к url');

  return {
    ...assistantMessage,
    content: refused || !String(assistantMessage.content || '').trim()
      ? formatOpenEntityReply(ref)
      : `${assistantMessage.content}\n\n${formatOpenEntityReply(ref)}`,
    meta: {
      ...(assistantMessage.meta || {}),
      entity_refs: [ref],
      source: assistantMessage.meta?.source || 'client_attach_fallback',
    },
  };
}
