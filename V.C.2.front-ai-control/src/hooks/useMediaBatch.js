import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMediaBatch, revokeMediaUrls } from '../services/mediaBatchService';

const EMPTY_MAP = new Map();

export const MediaBatchContext = createContext({
  urls: EMPTY_MAP,
  loading: false,
  error: null,
});

export function useMediaBatchMap() {
  return useContext(MediaBatchContext);
}

function itemsSignature(items) {
  if (!items?.length) return '';
  return items
    .map((item) => `${item.key}|${item.ref}|${item.preset || ''}|${item.w || ''}|${item.h || ''}|${item.model_id || item.modelId || ''}`)
    .join(';');
}

export function useMediaBatch(items, enabled = true) {
  const [urls, setUrls] = useState(EMPTY_MAP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const urlsRef = useRef(EMPTY_MAP);
  const signature = useMemo(() => itemsSignature(items), [items]);

  useEffect(() => {
    if (!enabled || !items?.length) {
      revokeMediaUrls(urlsRef.current);
      urlsRef.current = EMPTY_MAP;
      setUrls(EMPTY_MAP);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMediaBatch(items)
      .then((map) => {
        if (cancelled) {
          revokeMediaUrls(map);
          return;
        }
        revokeMediaUrls(urlsRef.current);
        urlsRef.current = map;
        setUrls(map);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setUrls(EMPTY_MAP);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signature, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    revokeMediaUrls(urlsRef.current);
  }, []);

  return { urls, loading, error };
}

export function MediaBatchProvider({ items, enabled = true, children }) {
  const value = useMediaBatch(items, enabled);
  return React.createElement(MediaBatchContext.Provider, { value }, children);
}

export function lookupMediaUrl(urls, key, ref) {
  if (!urls) return null;
  if (key && urls.has(key)) return urls.get(key);
  if (ref && urls.has(ref)) return urls.get(ref);
  return null;
}
