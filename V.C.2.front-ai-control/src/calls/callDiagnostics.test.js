import { describe, expect, it } from 'vitest';
import { formatCallDiagnosticsText } from './callDiagnostics.js';

describe('formatCallDiagnosticsText', () => {
  it('includes error and peer webrtc state', () => {
    const text = formatCallDiagnosticsText({
      at: '2026-08-17T00:00:00.000Z',
      partyRoomId: 'room-1',
      mediaMode: 'mesh',
      status: 'active',
      error: 'ICE failed',
      selfPeerId: 'aaa',
      userAgent: 'TestAgent',
      peers: [{ id: 'bbb', name: 'Bob', webrtc: { connection: 'failed', ice: 'disconnected' } }],
    });
    expect(text).toContain('ICE failed');
    expect(text).toContain('room-1');
    expect(text).toContain('connection=failed');
    expect(text).toContain('TestAgent');
  });
});
