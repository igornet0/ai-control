/** @vitest-environment node */

import { describe, expect, test } from 'vitest';
import {
  messageMentionsAi,
  splitAiMentions,
} from './messagingAiService.js';

describe('messagingAiService mention helpers', () => {
  test('detects @ai mentions', () => {
    expect(messageMentionsAi('@ai проанализируй задачи проекта')).toBe(true);
    expect(messageMentionsAi('привет @AI')).toBe(true);
    expect(messageMentionsAi('email@aicontrol.ru')).toBe(false);
  });

  test('splits mention tokens for render', () => {
    const parts = splitAiMentions('Сделай @ai сводку');
    expect(parts.some((p) => p.type === 'mention')).toBe(true);
    expect(parts.map((p) => p.value).join('')).toBe('Сделай @ai сводку');
  });
});
