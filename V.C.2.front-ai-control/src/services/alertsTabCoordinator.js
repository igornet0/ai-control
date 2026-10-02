import { isCallPopoutPath, isEmbeddedShell } from '../utils/embeddedShell.js';

export const ALERTS_TAB_CHANNEL = 'aicontrol-alerts-tab';
export const ALERTS_LEADER_LOCK = 'aicontrol-alerts-leader';
export const ALERTS_HEARTBEAT_MS = 1500;
export const ALERTS_HEARTBEAT_STALE_MS = 4000;

/**
 * Pick a presenter tab: prefer visible peers, then lowest tabId.
 * @param {Array<{ tabId: string, visible: boolean, ts: number }>} tabs
 * @param {number} [now]
 * @param {number} [staleMs]
 * @returns {string|null}
 */
export function pickAlertsLeader(tabs, now = Date.now(), staleMs = ALERTS_HEARTBEAT_STALE_MS) {
  const live = (tabs || []).filter(
    (tab) => tab?.tabId && now - Number(tab.ts || 0) < staleMs,
  );
  const visible = live.filter((tab) => tab.visible);
  const pool = visible.length ? visible : live;
  if (!pool.length) return null;
  return pool
    .slice()
    .sort((a, b) => String(a.tabId).localeCompare(String(b.tabId)))[0].tabId;
}

function newTabId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener('abort', resolve, { once: true });
  });
}

class AlertsTabCoordinator {
  constructor() {
    this.tabId = newTabId();
    this.leader = false;
    this.started = false;
    this.activePartyRoomId = null;
    this.leadershipListeners = new Set();
    this.messageListeners = new Set();
    this.peers = new Map();
    this.channel = null;
    this.lockAbort = null;
    this.heartbeatTimer = 0;
    this.hiddenAcquireTimer = 0;
  }

  isPresenter() {
    if (isEmbeddedShell()) return false;
    if (typeof window !== 'undefined' && isCallPopoutPath(window.location?.pathname)) {
      return false;
    }
    return this.leader;
  }

  _dispatchLocal(data) {
    this.messageListeners.forEach((fn) => {
      try {
        fn(data);
      } catch {
        /* ignore */
      }
    });
  }

  getActivePartyRoomId() {
    return this.activePartyRoomId;
  }

  setActivePartyRoomId(partyRoomId) {
    this.activePartyRoomId = partyRoomId ? String(partyRoomId) : null;
  }

  subscribeLeadership(fn) {
    this.leadershipListeners.add(fn);
    try {
      fn(this.isPresenter());
    } catch {
      /* ignore */
    }
    return () => this.leadershipListeners.delete(fn);
  }

  subscribeMessages(fn) {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  broadcast(payload) {
    if (!payload || typeof payload !== 'object') return;
    const message = { ...payload, tabId: this.tabId, ts: Date.now() };
    try {
      this.channel?.postMessage(message);
    } catch {
      /* ignore */
    }
    if (message.type && message.type !== 'hello') {
      this._dispatchLocal(message);
    }
  }

  broadcastCallConsumed(partyRoomId, extra = {}) {
    if (!partyRoomId) return;
    this.broadcast({
      type: 'call-consumed',
      partyRoomId: String(partyRoomId),
      ...extra,
    });
  }

  start() {
    if (this.started || typeof window === 'undefined') return;
    if (isEmbeddedShell() || isCallPopoutPath(window.location?.pathname)) return;
    this.started = true;
    try {
      this.channel = new BroadcastChannel(ALERTS_TAB_CHANNEL);
      this.channel.onmessage = (event) => this._onChannelMessage(event?.data);
    } catch {
      this.channel = null;
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('pagehide', this._onPageHide);
    this._startPresence();
    this._elect();
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('pagehide', this._onPageHide);
    this._clearTimers();
    this.lockAbort?.abort();
    this.lockAbort = null;
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
    this.peers.clear();
    this._setLeader(false);
  }

  _onVisibility = () => {
    this._announcePresence();
    this._elect();
  };

  _onPageHide = (event) => {
    if (event?.persisted) return;
    this.lockAbort?.abort();
    this._setLeader(false);
  };

  _clearTimers() {
    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = 0;
    window.clearTimeout(this.hiddenAcquireTimer);
    this.hiddenAcquireTimer = 0;
  }

  _setLeader(next) {
    const value = Boolean(next);
    if (this.leader === value) return;
    this.leader = value;
    this.leadershipListeners.forEach((fn) => {
      try {
        fn(this.isPresenter());
      } catch {
        /* ignore */
      }
    });
  }

  _hasOtherVisiblePeer() {
    const now = Date.now();
    for (const peer of this.peers.values()) {
      if (peer.tabId === this.tabId) continue;
      if (peer.visible && now - Number(peer.ts || 0) < ALERTS_HEARTBEAT_STALE_MS) {
        return true;
      }
    }
    return false;
  }

  _announcePresence() {
    const visible = document.visibilityState === 'visible';
    this.peers.set(this.tabId, { tabId: this.tabId, visible, ts: Date.now() });
    try {
      this.channel?.postMessage({
        type: 'hello',
        tabId: this.tabId,
        visible,
        ts: Date.now(),
      });
    } catch {
      /* ignore */
    }
  }

  _startPresence() {
    window.clearInterval(this.heartbeatTimer);
    this._announcePresence();
    this.heartbeatTimer = window.setInterval(() => {
      this._announcePresence();
      if (typeof navigator === 'undefined' || !navigator.locks?.request) {
        this._applyHeartbeatLeader();
      }
    }, ALERTS_HEARTBEAT_MS);
  }

  _onChannelMessage(data) {
    if (!data || data.tabId === this.tabId) return;
    if (data.type === 'hello') {
      this.peers.set(data.tabId, {
        tabId: data.tabId,
        visible: Boolean(data.visible),
        ts: Number(data.ts) || Date.now(),
      });
      if (typeof navigator === 'undefined' || !navigator.locks?.request) {
        this._applyHeartbeatLeader();
      } else if (
        data.visible &&
        document.visibilityState !== 'visible' &&
        this.leader
      ) {
        this._elect();
      }
      return;
    }
    this._dispatchLocal(data);
  }

  _elect() {
    window.clearTimeout(this.hiddenAcquireTimer);
    this.hiddenAcquireTimer = 0;
    this.lockAbort?.abort();
    this.lockAbort = new AbortController();
    const { signal } = this.lockAbort;

    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      const acquire = () => {
        if (signal.aborted) return;
        navigator.locks
          .request(ALERTS_LEADER_LOCK, { mode: 'exclusive', signal }, async () => {
            this._setLeader(true);
            await waitForAbort(signal);
            this._setLeader(false);
          })
          .catch(() => {
            if (!signal.aborted) this._setLeader(false);
          });
      };

      if (document.visibilityState === 'visible') {
        acquire();
        return;
      }

      this.hiddenAcquireTimer = window.setTimeout(() => {
        if (signal.aborted) return;
        if (document.visibilityState === 'visible') return;
        if (this._hasOtherVisiblePeer()) return;
        acquire();
      }, 250);
      return;
    }

    this._applyHeartbeatLeader();
  }

  _applyHeartbeatLeader() {
    const now = Date.now();
    for (const [id, peer] of this.peers) {
      if (now - Number(peer.ts || 0) >= ALERTS_HEARTBEAT_STALE_MS) this.peers.delete(id);
    }
    const leaderId = pickAlertsLeader([...this.peers.values()], now);
    this._setLeader(leaderId === this.tabId);
  }
}

export const alertsTabCoordinator = new AlertsTabCoordinator();

export function isAlertsPresenter() {
  return alertsTabCoordinator.isPresenter();
}
