import React, { useState, useRef, useCallback } from 'react';
import styles from './FileSelectorModal.module.css';
import { IconArchive, IconFile, IconFolder, IconTable } from './WidgetPanelIcons';

/**
 * FileSelectorModal - Модальное окно для выбора файлов (CSV, Excel, архив, папка)
 */
const FileSelectorModal = ({ isOpen, onClose, onFileSelect }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [archiveContents, setArchiveContents] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const archiveInputRef = useRef(null);
  const selectedArchiveRef = useRef(null);

  // Проверка типа файла
  const isCSVFile = (file) => file.name.toLowerCase().endsWith('.csv');
  const isExcelFile = (file) => {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.xlsx') || ext.endsWith('.xls');
  };
  const isArchiveFile = (file) => {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.zip') || ext.endsWith('.rar') || ext.endsWith('.7z');
  };

  // Форматирование размера файла
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Обработка выбора файла
  const handleFileSelect = useCallback((file) => {
    if (isCSVFile(file) || isExcelFile(file)) {
      // Прямой выбор CSV/Excel файла
      onFileSelect(file, { type: 'file' });
      onClose();
    } else if (isArchiveFile(file)) {
      // Сохраняем архив целиком
      selectedArchiveRef.current = file;
      onFileSelect(file, { 
        type: 'archive',
        archiveName: file.name,
        archiveSize: file.size
      });
      onClose();
    } else {
      alert('Поддерживаются только файлы CSV, Excel или архивы (ZIP, RAR, 7Z)');
    }
  }, [onFileSelect, onClose]);

  // Загрузка содержимого архива
  const loadArchiveContents = async (file) => {
    setLoading(true);
    try {
      // Для ZIP архивов используем JSZip
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Сохраняем ссылку на архив
        selectedArchiveRef.current = file;
        
        // Импорт JSZip (уже установлен через exceljs)
        const JSZip = (await import('jszip')).default || (await import('jszip'));
        const zip = await JSZip.loadAsync(file);
        
        const contents = [];
        zip.forEach((relativePath, file) => {
          if (!file.dir) {
            contents.push({
              name: relativePath.split('/').pop(),
              path: relativePath,
              size: file._data?.uncompressedSize || 0,
              isDirectory: false
            });
          }
        });

        // Группируем по папкам
        const folderStructure = buildFolderStructure(contents);
        setArchiveContents({
          name: file.name,
          files: contents,
          structure: folderStructure,
          zipInstance: zip,
          totalFiles: contents.length,
          dataFiles: contents.filter(f => 
            isCSVFile({ name: f.name }) || isExcelFile({ name: f.name })
          )
        });
        setCurrentPath([]);
      } else {
        alert('Пока поддерживаются только ZIP архивы. Для RAR и 7Z требуется дополнительная библиотека.');
      }
    } catch (error) {
      console.error('Error loading archive:', error);
      alert('Ошибка при открытии архива: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Построение структуры папок
  const buildFolderStructure = (files) => {
    const structure = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = structure;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: 'folder', children: {} };
        }
        current = current[part].children;
      }
      const fileName = parts[parts.length - 1];
      current[fileName] = { type: 'file', ...file };
    });
    return structure;
  };

  // Обработка выбора архива целиком (кнопка "Выбрать весь архив")
  const handleSelectFullArchive = () => {
    if (selectedArchiveRef.current) {
      onFileSelect(selectedArchiveRef.current, { 
        type: 'archive',
        archiveName: selectedArchiveRef.current.name,
        archiveSize: selectedArchiveRef.current.size
      });
      onClose();
    }
  };

  // Обработка выбора папки
  const handleFolderSelect = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Получаем имя папки из первого файла
    const firstFile = files[0];
    const folderPath = firstFile.webkitRelativePath.split('/')[0] || 'Папка';
    
    // Создаем объект, представляющий папку
    const folderData = {
      name: folderPath,
      files: files,
      fileCount: files.length,
      dataFiles: files.filter(f => isCSVFile(f) || isExcelFile(f))
    };

    // Возвращаем папку целиком
    onFileSelect(folderData, { 
      type: 'folder',
      folderName: folderPath,
      totalFiles: files.length,
      dataFilesCount: folderData.dataFiles.length
    });
    onClose();
  }, [onFileSelect, onClose]);

  // Рендеринг структуры папок архива (только для просмотра)
  const renderFolderStructure = (structure, path = []) => {
    const items = [];
    
    // Сначала папки, потом файлы
    const folders = [];
    const files = [];
    
    Object.keys(structure).sort().forEach(key => {
      const item = structure[key];
      if (item.type === 'folder') {
        folders.push({ key, item, path: [...path, key] });
      } else {
        files.push({ key, item, path: [...path, key] });
      }
    });

    // Рендерим папки
    folders.forEach(({ key, item, path: currentPath }) => {
      const fullPath = currentPath.join('/');
      items.push(
        <div key={fullPath} className={styles.folderItem}>
          <div className={styles.folderHeader}>
            <span className={styles.folderIcon}><IconFolder /></span>
            <span className={styles.folderName}>{key}</span>
          </div>
          {item.children && (
            <div className={styles.folderChildren}>
              {renderFolderStructure(item.children, currentPath)}
            </div>
          )}
        </div>
      );
    });

    // Рендерим файлы (только для просмотра)
    files.forEach(({ key, item, path: currentPath }) => {
      const fullPath = currentPath.join('/');
      const isDataFile = isCSVFile({ name: key }) || isExcelFile({ name: key });
      items.push(
        <div 
          key={fullPath} 
          className={styles.fileItem}
        >
          <span className={styles.fileIcon}>
            <IconTable />
          </span>
          <span className={styles.fileName}>{key}</span>
          <span className={styles.fileSize}>{formatFileSize(item.size || 0)}</span>
        </div>
      );
    });

    return items;
  };


  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Выбор источника данных</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Загрузка...</span>
            </div>
          )}

          {!archiveContents && selectedFiles.length === 0 && !loading && (
            <div className={styles.selectOptions}>
              <div className={styles.optionCard}>
                <h3><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><IconFile />Выбрать файл</span></h3>
                <p>CSV или Excel файл</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleFileSelect(file);
                  }}
                  style={{ display: 'none' }}
                />
                <button
                  className={styles.optionButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выбрать файл
                </button>
              </div>

              <div className={styles.optionCard}>
                <h3><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><IconFolder />Выбрать папку</span></h3>
                <p>Папка с CSV или Excel файлами</p>
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  style={{ display: 'none' }}
                />
                <button
                  className={styles.optionButton}
                  onClick={() => folderInputRef.current?.click()}
                >
                  Выбрать папку
                </button>
              </div>

              <div className={styles.optionCard}>
                <h3><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><IconArchive />Выбрать архив</span></h3>
                <p>ZIP архив с файлами</p>
                <input
                  ref={archiveInputRef}
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleFileSelect(file);
                  }}
                  style={{ display: 'none' }}
                />
                <button
                  className={styles.optionButton}
                  onClick={() => archiveInputRef.current?.click()}
                >
                  Выбрать архив
                </button>
              </div>
            </div>
          )}

          {archiveContents && !loading && (
            <div className={styles.archiveView}>
              <div className={styles.archiveHeader}>
                <button
                  className={styles.backButton}
                  onClick={() => {
                    setArchiveContents(null);
                    setCurrentPath([]);
                    selectedArchiveRef.current = null;
                  }}
                >
                  ← Назад
                </button>
                <h3>Архив: {archiveContents.name}</h3>
                <button
                  className={styles.selectArchiveButton}
                  onClick={handleSelectFullArchive}
                >
                  Выбрать весь архив
                </button>
              </div>
              <div className={styles.archiveInfo}>
                <p>Просмотр содержимого архива. Вы можете выбрать весь архив целиком или отдельный файл.</p>
              </div>
              <div className={styles.archiveContents}>
                {renderFolderStructure(archiveContents.structure)}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default FileSelectorModal;
