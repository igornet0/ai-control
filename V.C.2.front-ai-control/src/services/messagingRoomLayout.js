const STORAGE_PREFIX = 'mmm-room-layout';

function normalizeActivity(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const activity = {};
  Object.entries(raw).forEach(([key, value]) => {
    const id = Number(key);
    const ts = Number(value);
    if (Number.isFinite(id) && Number.isFinite(ts)) {
      activity[id] = ts;
    }
  });
  return activity;
}

export function loadRoomLayout(userId) {
  if (!userId) return { pinned: [], activity: {} };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}-${userId}`);
    if (!raw) return { pinned: [], activity: {} };
    const parsed = JSON.parse(raw);
    return {
      pinned: Array.isArray(parsed.pinned)
        ? parsed.pinned.map(Number).filter((id) => Number.isFinite(id))
        : [],
      activity: normalizeActivity(parsed.activity),
    };
  } catch {
    return { pinned: [], activity: {} };
  }
}

export function saveRoomLayout(userId, layout) {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}-${userId}`,
      JSON.stringify({
        pinned: layout.pinned || [],
        activity: layout.activity || {},
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function syncLayoutWithRooms(layout, rooms) {
  const idSet = new Set(rooms.map((room) => room.id));
  const activity = { ...layout.activity };

  rooms.forEach((room) => {
    if (activity[room.id] == null) {
      activity[room.id] = room.created_at
        ? new Date(room.created_at).getTime()
        : 0;
    }
  });

  Object.keys(activity).forEach((key) => {
    const id = Number(key);
    if (!idSet.has(id)) {
      delete activity[id];
    }
  });

  return {
    pinned: layout.pinned.filter((id) => idSet.has(id)),
    activity,
  };
}

export function applyRoomLayout(rooms, layout, getDisplayName) {
  const pinnedSet = new Set(layout.pinned);
  const activity = layout.activity || {};

  return [...rooms].sort((a, b) => {
    const aPinned = pinnedSet.has(a.id);
    const bPinned = pinnedSet.has(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    if (aPinned && bPinned) {
      return layout.pinned.indexOf(a.id) - layout.pinned.indexOf(b.id);
    }

    const aActivity = activity[a.id] ?? 0;
    const bActivity = activity[b.id] ?? 0;
    if (aActivity !== bActivity) return bActivity - aActivity;

    return String(getDisplayName(a)).localeCompare(String(getDisplayName(b)), 'ru');
  });
}

export function toggleRoomPin(layout, roomId) {
  const isPinned = layout.pinned.includes(roomId);
  if (isPinned) {
    return {
      ...layout,
      pinned: layout.pinned.filter((id) => id !== roomId),
      activity: {
        ...layout.activity,
        [roomId]: Date.now(),
      },
    };
  }
  return {
    ...layout,
    pinned: [roomId, ...layout.pinned.filter((id) => id !== roomId)],
  };
}

export function reorderPinnedRooms(pinned, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return pinned;
  if (!pinned.includes(fromId) || !pinned.includes(toId)) return pinned;

  const next = [...pinned];
  const fromIndex = next.indexOf(fromId);
  const toIndex = next.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0) return pinned;

  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

export function bumpRoomActivity(layout, roomId, timestamp = Date.now()) {
  const ts = Number(timestamp);
  if (!Number.isFinite(roomId) || !Number.isFinite(ts)) return layout;
  const prev = layout.activity?.[roomId] ?? 0;
  if (ts <= prev) return layout;
  return {
    ...layout,
    activity: {
      ...layout.activity,
      [roomId]: ts,
    },
  };
}
