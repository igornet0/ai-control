import React, { useCallback, useEffect, useState } from 'react';
import { connectionService } from '../../../services/connectionService';
import styles from './SmbFileBrowserModal.module.css';
import { IconFile, IconFolder } from './WidgetPanelIcons';

const DATA_FILE_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);
const ARCHIVE_FILE_EXTENSIONS = new Set(['zip', 'rar', '7z']);

const isMacOsMetadataEntry = (name) => {
  if (!name) return false;
  if (name === '.DS_Store' || name === '._.DS_Store') return true;
  return name.startsWith('._');
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
};

const isDataFile = (name) => {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return DATA_FILE_EXTENSIONS.has(ext);
};

const isArchiveFile = (name) => {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return ARCHIVE_FILE_EXTENSIONS.has(ext);
};

const base64ToFile = (base64, fileName, mimeType) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, {
    type: mimeType || 'application/octet-stream',
    lastModified: Date.now(),
  });
};

const SmbFileBrowserModal = ({
  isOpen,
  onClose,
  connectionId,
  connectionName,
  shareName,
  mode = 'file',
  onFileSelect,
  onFolderSelect,
}) => {
  const isFolderMode = mode === 'folder';
  const isArchiveMode = mode === 'archive';
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadDirectory = useCallback(async (path = '') => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    setSelectedItem(null);
    try {
      const result = await connectionService.browseConnection(connectionId, path);
      if (!result?.success) {
        throw new Error(result?.error || 'Не удалось загрузить содержимое папки');
      }
      setCurrentPath(result.current_path || '');
      setItems(
        (Array.isArray(result.items) ? result.items : []).filter(
          (item) => !isMacOsMetadataEntry(item?.name),
        ),
      );
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки папки');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPath('');
      setItems([]);
      setError(null);
      setSelectedItem(null);
      return;
    }
    loadDirectory('');
  }, [isOpen, connectionId, loadDirectory]);

  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const navigateToPath = (segmentIndex) => {
    if (segmentIndex < 0) {
      loadDirectory('');
      return;
    }
    const nextPath = pathSegments.slice(0, segmentIndex + 1).join('/');
    loadDirectory(nextPath);
  };

  const handleItemClick = (item) => {
    if (item.type === 'directory') {
      if (isFolderMode) {
        setSelectedItem(item);
        return;
      }
      loadDirectory(item.path);
      return;
    }
    if (!isDataFile(item.name) && !(isArchiveMode && isArchiveFile(item.name))) {
      return;
    }
    setSelectedItem(item);
  };

  const handleItemDoubleClick = (item) => {
    if (item.type === 'directory') {
      loadDirectory(item.path);
    }
  };

  const handleSelect = async () => {
    if (isFolderMode) {
      const dirPath = selectedItem?.type === 'directory'
        ? selectedItem.path
        : currentPath;
      onFolderSelect?.({
        path: dirPath,
        name: dirPath.split('/').filter(Boolean).pop() || 'Корень',
      });
      onClose();
      return;
    }

    if (!selectedItem || selectedItem.type !== 'file') return;
    setSelecting(true);
    setError(null);
    try {
      const result = await connectionService.readConnectionFile(connectionId, selectedItem.path);
      if (!result?.success) {
        throw new Error(result?.error || 'Не удалось скачать файл');
      }
      const file = base64ToFile(
        result.content_base64,
        result.name || selectedItem.name,
        result.mime_type,
      );
      onFileSelect({
        path: result.path || selectedItem.path,
        name: result.name || selectedItem.name,
        size: result.size || selectedItem.size || file.size,
        file,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки файла');
    } finally {
      setSelecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              {isFolderMode ? 'Папки на SMB-шаре' : isArchiveMode ? 'Архивы на SMB-шаре' : 'Файлы на SMB-шаре'}
            </h2>
            <div className={styles.modalSubtitle}>
              {connectionName || 'Подключение'}
              {shareName ? ` · ${shareName}` : ''}
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.breadcrumbs}>
          <button type="button" className={styles.breadcrumbItem} onClick={() => navigateToPath(-1)}>
            Корень
          </button>
          {pathSegments.map((segment, index) => (
            <React.Fragment key={`${segment}-${index}`}>
              <span className={styles.breadcrumbSeparator}>/</span>
              <button
                type="button"
                className={styles.breadcrumbItem}
                onClick={() => navigateToPath(index)}
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className={styles.modalBody}>
          {loading && (
            <div className={styles.stateMessage}>Загрузка содержимого...</div>
          )}

          {!loading && error && (
            <div className={styles.errorMessage}>{error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className={styles.stateMessage}>Папка пуста</div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className={styles.fileList}>
              {items.map((item) => {
                const selectable = isFolderMode
                  ? item.type === 'directory'
                  : item.type === 'file' && (isArchiveMode ? isArchiveFile(item.name) : isDataFile(item.name));
                const isSelected = selectedItem?.path === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`${styles.fileItem} ${isSelected ? styles.fileItemSelected : ''} ${!selectable && item.type === 'file' ? styles.fileItemDisabled : ''}`}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    title={
                      item.type === 'directory'
                        ? (isFolderMode ? 'Выбрать папку' : 'Открыть папку')
                        : selectable
                          ? (isArchiveMode ? 'Выбрать архив' : 'Выбрать файл')
                          : (isArchiveMode ? 'Поддерживаются только ZIP, RAR и 7Z' : 'Поддерживаются только CSV и Excel')
                    }
                  >
                    <span className={styles.fileIcon}>
                      {item.type === 'directory' ? <IconFolder /> : <IconFile />}
                    </span>
                    <span className={styles.fileName}>{item.name}</span>
                    {item.type === 'file' && item.size != null && (
                      <span className={styles.fileSize}>{formatFileSize(item.size)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.footerHint}>
            {isFolderMode
              ? (selectedItem?.type === 'directory'
                ? `Выбрана папка: ${selectedItem.name}`
                : currentPath
                  ? `Текущая папка: ${currentPath || 'Корень'}`
                  : 'Выберите папку или используйте текущую')
              : (selectedItem
                ? `Выбран: ${selectedItem.name}`
                : 'Выберите CSV или Excel файл')}
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSelect}
              disabled={isFolderMode ? selecting : (!selectedItem || selecting)}
            >
              {selecting
                ? 'Загрузка...'
                : (isFolderMode ? 'Выбрать папку' : 'Выбрать файл')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmbFileBrowserModal;
