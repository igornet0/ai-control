import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  PhotoIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  MusicalNoteIcon,
  FilmIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import AuthorizedImage from './AuthorizedImage';
import { MediaBatchProvider } from '../../../hooks/useMediaBatch';
import { getAccessToken } from '../../../services/tokenRefresh';
import {
  dataModelService,
  inferMediaUploadRole,
  isAllowedMediaUploadFile,
  MEDIA_ACCEPT,
} from '../../../services/dataModelService';

function mediaKindOf(item) {
  const role = String(item?.role || item?.file_role || '').toLowerCase();
  if (role === 'video' || role === 'audio' || role === 'pdf' || role === 'image') return role;
  const mime = String(item?.mime_type || item?.content_type || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  const name = String(item?.original_filename || item?.filename || '').toLowerCase();
  if (/\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(name)) return 'video';
  if (/\.(mp3|wav|m4a|aac|flac|oga)$/i.test(name)) return 'audio';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return 'image';
}

function KindIcon({ kind, className }) {
  const style = { width: '2.5rem', height: '2.5rem' };
  if (kind === 'video') return <FilmIcon style={style} className={className} />;
  if (kind === 'audio') return <MusicalNoteIcon style={style} className={className} />;
  if (kind === 'pdf') return <DocumentIcon style={style} className={className} />;
  return <PhotoIcon style={style} className={className} />;
}

/** Fetch protected /api file as object URL (for video / audio / pdf preview). */
function useAuthorizedBlobUrl(src) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(!!src);
  const [error, setError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!src) {
        setUrl(null);
        setLoading(false);
        setError(true);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        if (ref.current) {
          URL.revokeObjectURL(ref.current);
          ref.current = null;
        }
        const token = getAccessToken();
        if (!token) throw new Error('No access token');
        const response = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-cache',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        ref.current = objectUrl;
        setUrl(objectUrl);
      } catch (err) {
        console.error('Authorized media load error:', err);
        if (!cancelled) {
          setError(true);
          setUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (ref.current) {
        URL.revokeObjectURL(ref.current);
        ref.current = null;
      }
    };
  }, [src]);

  return { url, loading, error };
}

function MediaPreviewBody({ item, modelId, isFullscreen }) {
  const kind = mediaKindOf(item);
  const contentPath = `/api/data-models/${modelId}/files/${item.id}/content`;
  const { url, loading, error } = useAuthorizedBlobUrl(
    kind === 'image' ? null : contentPath,
  );

  if (kind === 'image') {
    return (
      <AuthorizedImage
        src={contentPath}
        alt={item.original_filename}
        className="max-w-full max-h-full object-contain"
      />
    );
  }

  if (loading) {
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    );
  }
  if (error || !url) {
    return <div className="text-gray-400 text-sm">Не удалось загрузить превью</div>;
  }
  if (kind === 'video') {
    return (
      <video
        src={url}
        controls
        className="max-w-full max-h-full"
        style={{ maxHeight: isFullscreen ? '100%' : '70vh' }}
      />
    );
  }
  if (kind === 'audio') {
    return <audio src={url} controls className="w-full max-w-xl" />;
  }
  if (kind === 'pdf') {
    return (
      <iframe
        title={item.original_filename}
        src={url}
        className="w-full bg-white rounded"
        style={{ height: isFullscreen ? '100%' : '70vh', minHeight: '420px' }}
      />
    );
  }
  return null;
}

const ImageManager = ({ modelId, images = [], onImagesChange, canEdit = true }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDragOver = useCallback((e) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDragOver(true);
  }, [canEdit]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const uploadMediaFiles = async (files) => {
    if (!canEdit || !files.length) return;

    setUploading(true);
    const concurrency = 3;
    let index = 0;
    let firstError = null;

    const worker = async () => {
      while (index < files.length) {
        const current = index;
        index += 1;
        const file = files[current];
        try {
          const role = inferMediaUploadRole(file);
          await dataModelService.uploadModelFile(modelId, file, {}, null, null, null, role);
        } catch (error) {
          firstError = firstError || error;
          console.error('Error uploading media:', file?.name, error);
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
      );
      if (firstError) {
        throw firstError;
      }

      const refreshed = await dataModelService.getModelMedia(modelId);
      if (onImagesChange) {
        onImagesChange(refreshed);
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Ошибка при загрузке медиа: ' + (error?.message || error));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!canEdit) return;

      const droppedFiles = Array.from(e.dataTransfer.files || []);
      const mediaFiles = droppedFiles.filter(isAllowedMediaUploadFile);

      if (mediaFiles.length !== droppedFiles.length) {
        alert('Некоторые файлы не поддерживаются как медиа и будут пропущены');
      }

      void uploadMediaFiles(mediaFiles);
    },
    [modelId, canEdit],
  );

  const handleFileSelect = useCallback(
    (e) => {
      if (!canEdit) return;
      const selectedFiles = Array.from(e.target.files || []);
      const mediaFiles = selectedFiles.filter(isAllowedMediaUploadFile);

      if (mediaFiles.length !== selectedFiles.length) {
        alert('Некоторые файлы не поддерживаются как медиа и будут пропущены');
      }

      void uploadMediaFiles(mediaFiles);
      e.target.value = '';
    },
    [modelId, canEdit],
  );

  const handleMediaDelete = async (mediaId) => {
    if (!canEdit) return;
    if (!window.confirm('Удалить этот медиафайл?')) {
      return;
    }

    try {
      await dataModelService.deleteModelFile(modelId, mediaId);

      if (onImagesChange) {
        onImagesChange(images.filter((item) => item.id !== mediaId));
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Ошибка при удалении: ' + (error?.message || error));
    }
  };

  const handlePreview = (item) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewItem(null);
    setIsFullscreen(false);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getContentUrl = (item) => `/api/data-models/${modelId}/files/${item.id}/content`;

  const galleryBatchItems = useMemo(
    () =>
      (images || [])
        .filter((item) => mediaKindOf(item) === 'image')
        .map((item) => ({
          key: `gallery:${modelId}:${item.id}`,
          ref: `/api/data-models/${modelId}/files/${item.id}/content`,
          preset: 'selector_thumb',
        })),
    [images, modelId],
  );

  const kindLabel = (kind) =>
    ({ image: 'Изображение', video: 'Видео', audio: 'Аудио', pdf: 'PDF' }[kind] || 'Медиа');

  return (
    <div className="space-y-6">
      {canEdit ? (
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <PhotoIcon
          style={{ width: '3rem', height: '3rem' }}
          className={`mx-auto mb-4 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`}
        />
        <h3 className="text-lg font-semibold mb-2">
          {isDragOver ? 'Отпустите файлы здесь' : 'Загрузите медиа'}
        </h3>
        <p className="text-gray-400 mb-4">
          Перетащите файлы сюда или нажмите для выбора
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Изображения, видео, аудио, PDF — до 200&nbsp;MB. Форматы: JPG, PNG, GIF, WebP, SVG, MP4,
          WebM, MOV, MP3, WAV, PDF и др.
        </p>
        <input
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          onChange={handleFileSelect}
          className="hidden"
          id="media-upload"
        />
        <label htmlFor="media-upload" className="btn btn-primary cursor-pointer">
          <DocumentArrowUpIcon style={{ width: '1rem', height: '1rem' }} />
          Выбрать медиафайлы
        </label>
      </div>
      ) : (
        <p className="text-sm text-gray-400">Режим просмотра — загрузка и удаление медиа недоступны.</p>
      )}

      {images.length > 0 && (
        <MediaBatchProvider items={galleryBatchItems}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Медиа модели ({images.length})</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((item) => {
              const kind = mediaKindOf(item);
              return (
                <div
                  key={item.id}
                  className="group relative bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors"
                >
                  <div className="aspect-square relative overflow-hidden bg-gray-900 flex items-center justify-center">
                    {kind === 'image' ? (
                      <AuthorizedImage
                        src={getContentUrl(item)}
                        alt={item.original_filename}
                        className="w-full h-full object-cover"
                        preset="selector_thumb"
                        batchKey={`gallery:${modelId}:${item.id}`}
                        onError={(e) => {
                          console.error('Image load error:', e);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400 px-2">
                        <KindIcon kind={kind} className="text-gray-300" />
                        <span className="text-xs uppercase tracking-wide">{kindLabel(kind)}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePreview(item)}
                          title="Просмотр"
                          type="button"
                        >
                          <EyeIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                        </button>
                        {canEdit && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleMediaDelete(item.id)}
                          title="Удалить"
                          type="button"
                        >
                          <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                        </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="font-medium text-sm truncate" title={item.original_filename}>
                      {item.original_filename}
                    </h4>
                    <p className="text-xs text-gray-400">
                      {kindLabel(kind)} · {formatFileSize(item.file_size)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </MediaBatchProvider>
      )}

      {uploading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Загрузка медиа...</p>
        </div>
      )}

      {isPreviewOpen && previewItem && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 ${
            isFullscreen ? 'p-0' : 'p-4'
          }`}
        >
          <div
            className={`relative bg-gray-900 rounded-lg ${
              isFullscreen ? 'w-full h-full' : 'max-w-4xl max-h-full w-full'
            }`}
          >
            <button
              onClick={handleClosePreview}
              className="absolute top-4 right-4 z-10 btn btn-secondary btn-sm"
              type="button"
            >
              <XMarkIcon style={{ width: '1rem', height: '1rem' }} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute top-4 right-16 z-10 btn btn-secondary btn-sm"
              type="button"
            >
              <MagnifyingGlassIcon style={{ width: '1rem', height: '1rem' }} />
            </button>

            <div
              className={`${
                isFullscreen ? 'h-full' : 'max-h-[80vh]'
              } flex items-center justify-center p-8`}
            >
              <MediaPreviewBody
                item={previewItem}
                modelId={modelId}
                isFullscreen={isFullscreen}
              />
            </div>

            {!isFullscreen && (
              <div className="p-4 border-t border-gray-700">
                <h3 className="font-semibold mb-2">{previewItem.original_filename}</h3>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>
                    {kindLabel(mediaKindOf(previewItem))} · {formatFileSize(previewItem.file_size)}
                  </span>
                  <span>
                    Загружено:{' '}
                    {previewItem.created
                      ? new Date(previewItem.created).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageManager;
