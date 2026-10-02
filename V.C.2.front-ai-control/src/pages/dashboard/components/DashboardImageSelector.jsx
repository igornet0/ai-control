import React, { useState, useEffect, useMemo } from 'react';
import { PhotoIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { dashboardService } from '../../../services/dashboardService';
import { dataModelService } from '../../../services/dataModelService';
import AuthorizedImage from '../../data_models/components/AuthorizedImage';
import { MediaBatchProvider } from '../../../hooks/useMediaBatch';
import styles from './DashboardImageSelector.module.css';

const DashboardImageSelector = ({
  dashboardId,
  currentImageUrl,
  onImageSelect,
  onClose,
  title = 'Выбор изображения для дашборда',
  subtitle = 'Выберите файл из моделей данных, привязанных к дашборду, или удалите текущее изображение.',
  titleId = 'dashboard-image-selector-title',
}) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageUrl, setSelectedImageUrl] = useState(currentImageUrl);

  useEffect(() => {
    setSelectedImageUrl(currentImageUrl);
  }, [currentImageUrl]);

  useEffect(() => {
    loadDashboardDataModels();
  }, [dashboardId]);

  const loadDashboardDataModels = async () => {
    try {
      setLoading(true);
      const dataModels = await dashboardService.getDashboardDataModels(dashboardId);

      const allImages = [];
      for (const dataModel of dataModels) {
        try {
          const modelId = dataModel.id;
          if (!modelId) {
            console.warn('No model ID found for data model:', dataModel);
            continue;
          }

          const modelImages = await dataModelService.getModelImages(modelId);
          allImages.push(
            ...modelImages.map((img) => ({
              ...img,
              modelName: dataModel.name || 'Unknown Model',
              modelId,
            })),
          );
        } catch (error) {
          console.warn(`Failed to load images for model ${dataModel.id}:`, error);
        }
      }

      setImages(allImages);
    } catch (error) {
      console.error('Error loading dashboard data models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (imageUrl) => {
    setSelectedImageUrl(imageUrl);
  };

  const handleConfirm = () => {
    if (onImageSelect) {
      onImageSelect(selectedImageUrl);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageUrl(null);
  };

  const contentUrl = (modelId, fileId) =>
    `/api/data-models/${modelId}/files/${fileId}/content`;

  const thumbBatchItems = useMemo(
    () =>
      images.map((image) => ({
        key: `thumb:${image.modelId}:${image.id}`,
        ref: contentUrl(image.modelId, image.id),
        preset: 'selector_thumb',
      })),
    [images],
  );

  if (loading) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-busy="true">
        <div className={styles.loadingCard}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.loadingText}>Загрузка изображений…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <MediaBatchProvider items={thumbBatchItems}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h3 id={titleId} className={styles.title}>
              {title}
            </h3>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Закрыть" aria-label="Закрыть">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.column}>
            <h4 className={styles.sectionLabel}>Предпросмотр</h4>
            <div className={styles.previewBox}>
              {selectedImageUrl ? (
                <div className={styles.previewBoxInner}>
                  <AuthorizedImage
                    src={selectedImageUrl}
                    alt="Предварительный просмотр"
                    className={styles.previewImage}
                    preset="dashboard_cover"
                  />
                </div>
              ) : (
                <div className={styles.previewPlaceholder}>
                  <PhotoIcon />
                  <p>Выберите изображение справа</p>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleConfirm}
                className={`btn btn-primary ${styles.applyBtn}`}
                disabled={selectedImageUrl === undefined}
              >
                <CheckIcon className="w-4 h-4" />
                Применить
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className={`btn btn-secondary ${styles.removeBtn}`}
                disabled={!currentImageUrl}
              >
                Удалить изображение
              </button>
            </div>
          </div>

          <div className={styles.column}>
            <h4 className={styles.sectionLabel}>Доступные изображения</h4>
            <div className={styles.galleryScroll}>
              {images.length === 0 ? (
                <div className={styles.emptyState}>
                  <PhotoIcon />
                  <p>Нет доступных изображений</p>
                  <p className={styles.emptyHint}>Подключите к дашборду модели данных с файлами-изображениями.</p>
                </div>
              ) : (
                <div className={styles.thumbGrid}>
                  {images.map((image) => {
                    const url = contentUrl(image.modelId, image.id);
                    const isSelected = selectedImageUrl === url;
                    return (
                      <div
                        key={image.id}
                        role="button"
                        tabIndex={0}
                        className={`${styles.thumb} ${isSelected ? styles.thumbSelected : ''}`}
                        onClick={() => handleImageSelect(url)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleImageSelect(url);
                          }
                        }}
                      >
                        <AuthorizedImage
                          src={url}
                          alt={image.filename}
                          className={styles.thumbImage}
                          preset="selector_thumb"
                          batchKey={`thumb:${image.modelId}:${image.id}`}
                        />
                        <div className={styles.thumbName}>{image.filename}</div>
                        <div className={styles.thumbModel}>{image.modelName}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </MediaBatchProvider>
    </div>
  );
};

export default DashboardImageSelector;
