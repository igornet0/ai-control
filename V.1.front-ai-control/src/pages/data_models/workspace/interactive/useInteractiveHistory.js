import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 50;

export function useInteractiveHistory(initialState) {
  const [state, setState] = useState(initialState);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const skipHistoryRef = useRef(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushState = useCallback((next) => {
    setState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (!skipHistoryRef.current) {
        pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), prev];
        futureRef.current = [];
      }
      skipHistoryRef.current = false;
      queueMicrotask(syncFlags);
      return resolved;
    });
  }, [syncFlags]);

  const replaceState = useCallback((next) => {
    skipHistoryRef.current = true;
    setState(typeof next === 'function' ? next : () => next);
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return false;
    setState((current) => {
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [current, ...futureRef.current];
      skipHistoryRef.current = true;
      queueMicrotask(syncFlags);
      return previous;
    });
    return true;
  }, [syncFlags]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false;
    setState((current) => {
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current, current];
      skipHistoryRef.current = true;
      queueMicrotask(syncFlags);
      return next;
    });
    return true;
  }, [syncFlags]);

  return {
    state,
    pushState,
    replaceState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
