import { describe, expect, it } from 'vitest';
import {
  extractTaskIdFromText,
  findRecentTaskEntityRef,
  wantsOpenableEntity,
  withEntityAttachFallback,
} from './aiEntityAttachFallback';

describe('aiEntityAttachFallback', () => {
  it('detects link requests', () => {
    expect(wantsOpenableEntity('пришли ссылку')).toBe(true);
    expect(wantsOpenableEntity('задача ID 75')).toBe(false);
  });

  it('extracts task id from Задача #75 not interview #5', () => {
    const text =
      'Задача #75 — CustDev интервью #5\n| ID | 75 |\nКоманда (id: 5)';
    expect(extractTaskIdFromText(text)).toBe(75);
  });

  it('attaches card when assistant refuses links', () => {
    const prior = [
      {
        role: 'assistant',
        content: 'Задача #75 — CustDev интервью #5\n| ID | 75 |',
      },
    ];
    const assistant = {
      id: 1,
      role: 'assistant',
      content: 'К сожалению, я не могу отправлять ссылки — нет доступа к URL.',
      meta: {},
    };
    const out = withEntityAttachFallback(assistant, 'пришли ссылку', prior);
    expect(out.meta.entity_refs).toHaveLength(1);
    expect(out.meta.entity_refs[0].id).toBe(75);
    expect(out.meta.entity_refs[0].url).toBe('/tasks?task=75');
    expect(out.content).toMatch(/Открыть задачу/);
    expect(out.content).not.toMatch(/не могу отправлять/);
  });

  it('finds ref from history', () => {
    const ref = findRecentTaskEntityRef([
      { role: 'user', content: 'задача ID 75' },
      { role: 'assistant', content: 'Задача #75 — CustDev' },
    ]);
    expect(ref?.id).toBe(75);
  });
});
