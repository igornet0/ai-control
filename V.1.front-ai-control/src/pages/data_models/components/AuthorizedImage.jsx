import React, { useState, useEffect, useRef } from 'react';
import { ImagePlaceholderIcon } from './FileTypeIcon';
import { lookupMediaUrl, useMediaBatchMap } from '../../../hooks/useMediaBatch';
import { fetchMediaVariantBlob } from '../../../services/mediaBatchService';
import { getAccessToken } from '../../../services/tokenRefresh';

const AuthorizedImage = ({
  src,
  alt,
  className,
  onError,
  preset,
  width,
  height,
  batchKey,
  ...props
}) => {
  const batch = useMediaBatchMap();
  const batched = lookupMediaUrl(batch?.urls, batchKey, src);
  const [imageUrl, setImageUrl] = useState(batched || null);
  const [loading, setLoading] = useState(!batched && !!src);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (batched) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setImageUrl(batched);
      setLoading(false);
      setError(false);
      return undefined;
    }

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        const token = getAccessToken();
        if (!token) {
          throw new Error('No access token found');
        }

        let blob;
        if (preset || width || height) {
          blob = await fetchMediaVariantBlob(src, { preset, w: width, h: height });
        } else {
          let fullUrl = src;
          if (src.startsWith('http://') || src.startsWith('https://')) {
            fullUrl = src;
          }
          const response = await fetch(fullUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'force-cache',
          });

          if (!response.ok) {
            let errorText = '';
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorText = errorData.detail || errorData.message || JSON.stringify(errorData);
              } else {
                errorText = await response.text();
              }
            } catch {
              errorText = response.statusText;
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorText = await response.text();
            try {
              const errorData = JSON.parse(errorText);
              throw new Error(`Server error: ${errorData.detail || errorData.message || errorText}`);
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Server error:')) throw e;
              throw new Error(`Server returned JSON error: ${errorText}`);
            }
          }

          blob = await response.blob();
        }

        if (!blob || blob.size === 0) {
          throw new Error('Empty blob received - file might be empty or not found on server');
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setImageUrl(url);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        if (onError) {
          onError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (src) {
      loadImage();
    } else {
      setLoading(false);
      setError(true);
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, preset, width, height, batched, batchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-700`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-700`}>
        <div className="text-gray-400 text-center">
          <div className="mb-2 flex justify-center text-cyan-300">
            <ImagePlaceholderIcon size={28} />
          </div>
          <div className="text-xs">Ошибка загрузки</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      {...props}
    />
  );
};

export default AuthorizedImage;
