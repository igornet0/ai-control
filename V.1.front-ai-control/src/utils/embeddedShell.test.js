import { describe, expect, it } from 'vitest';
import { isCallPopoutPath, isEmbeddedPath } from './embeddedShell.js';
import {
  ALERTS_TAB_CHANNEL,
  pickAlertsLeader,
} from '../services/alertsTabCoordinator.js';
import { CALL_HANDOFF_CHANNEL } from '../calls/callDisplayName.js';

describe('embeddedShell', () => {
  it('detects embed routes', () => {
    expect(isEmbeddedPath('/embed/dashboard-widget')).toBe(true);
    expect(isEmbeddedPath('/profile')).toBe(false);
  });

  it('detects call popout', () => {
    expect(isCallPopoutPath('/call')).toBe(true);
    expect(isCallPopoutPath('/call/abc')).toBe(true);
    expect(isCallPopoutPath('/profile')).toBe(false);
  });
});

describe('pickAlertsLeader', () => {
  it('prefers a visible tab', () => {
    const now = 10_000;
    const leader = pickAlertsLeader(
      [
        { tabId: 'a', visible: false, ts: now },
        { tabId: 'b', visible: true, ts: now },
      ],
      now,
    );
    expect(leader).toBe('b');
  });

  it('uses lowest tabId when none are visible', () => {
    const now = 10_000;
    const leader = pickAlertsLeader(
      [
        { tabId: 'z', visible: false, ts: now },
        { tabId: 'm', visible: false, ts: now },
      ],
      now,
    );
    expect(leader).toBe('m');
  });

  it('ignores stale heartbeats', () => {
    const now = 20_000;
    const leader = pickAlertsLeader(
      [
        { tabId: 'old', visible: true, ts: 1000 },
        { tabId: 'fresh', visible: false, ts: now },
      ],
      now,
      4000,
    );
    expect(leader).toBe('fresh');
  });

  it('uses a channel separate from call pop-out handoff', () => {
    expect(ALERTS_TAB_CHANNEL).toBe('aicontrol-alerts-tab');
    expect(ALERTS_TAB_CHANNEL).not.toBe(CALL_HANDOFF_CHANNEL);
  });
});
