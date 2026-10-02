import { describe, expect, it } from 'vitest';
import {
  colorForUserId,
  getPresenceCursor,
  normalizePeer,
  removePresenceCursor,
  uniqueEmployees,
  upsertPresenceCursor,
} from '../src/presence/dashboardPresence.js';

describe('dashboardPresence', () => {
  it('assigns a stable color per user id', () => {
    const a = colorForUserId('42');
    const b = colorForUserId('42');
    const c = colorForUserId('43');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('dedupes employees by user id', () => {
    const peers = [
      normalizePeer({ client_id: 'a', user_id: '1', display_name: 'Ann' }),
      normalizePeer({ client_id: 'b', user_id: '1', display_name: 'Ann' }),
      normalizePeer({ client_id: 'c', user_id: '2', display_name: 'Bob' }),
    ];
    expect(uniqueEmployees(peers).map((p) => p.userId)).toEqual(['1', '2']);
  });

  it('keeps separate guests on the same share token', () => {
    const token = 'share:abc';
    const peers = [
      normalizePeer({ client_id: 'c1', user_id: token, display_name: 'Гость' }),
      normalizePeer({ client_id: 'c2', user_id: token, display_name: 'Гость' }),
    ];
    expect(uniqueEmployees(peers)).toHaveLength(2);
    expect(peers[0].color).not.toBe(peers[1].color);
  });

  it('stores cursor for follow-camera', () => {
    upsertPresenceCursor({ clientId: 'c9', x: 100, y: 200, visible: true });
    expect(getPresenceCursor('c9')).toMatchObject({ x: 100, y: 200 });
    removePresenceCursor('c9');
    expect(getPresenceCursor('c9')).toBeNull();
  });
});
