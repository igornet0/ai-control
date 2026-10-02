import React, { useEffect, useState } from 'react';
import { getAvatarUrl, getInitials } from '../utils/getAvatarUrl';
import { lookupMediaUrl, useMediaBatchMap } from '../hooks/useMediaBatch';
import { fetchMediaVariantBlob } from '../services/mediaBatchService';

function isInlineSrc(src) {
  if (!src || typeof src !== 'string') return false;
  return src.startsWith('data:') || src.startsWith('blob:');
}

export default function Avatar({
  src,
  name,
  preset = 'avatar_md',
  batchKey,
  className = '',
  imgClassName = '',
  alt = '',
  size,
  rounded = 'full',
  fallback,
}) {
  const batch = useMediaBatchMap();
  const batched = lookupMediaUrl(batch?.urls, batchKey, src);
  const [url, setUrl] = useState(() => batched || (isInlineSrc(src) ? src : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (batched) {
      setUrl(batched);
      setFailed(false);
      return undefined;
    }
    if (isInlineSrc(src)) {
      setUrl(src);
      setFailed(false);
      return undefined;
    }
    if (!src) {
      setUrl(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setFailed(false);
    fetchMediaVariantBlob(src, { preset })
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackUrl = getAvatarUrl(src);
        setUrl(fallbackUrl);
        if (!fallbackUrl) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, preset, batched]);

  const radiusClass =
    rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-xl' : 'rounded-lg';
  const sizeStyle = size
    ? { width: size, height: size, minWidth: size, minHeight: size }
    : undefined;
  const initials = getInitials(name);

  if (url && !failed) {
    return (
      <span className={`${radiusClass} overflow-hidden inline-flex shrink-0 ${className}`} style={sizeStyle}>
        <img
          src={url}
          alt={alt}
          className={`w-full h-full object-cover block ${imgClassName}`}
          onError={() => {
            setFailed(true);
            setUrl(getAvatarUrl(src));
          }}
        />
      </span>
    );
  }

  if (fallback) return fallback;

  return (
    <span
      className={`${radiusClass} inline-flex items-center justify-center shrink-0 font-bold text-white ${className}`}
      style={sizeStyle}
      aria-hidden={alt ? undefined : true}
    >
      {initials}
    </span>
  );
}
