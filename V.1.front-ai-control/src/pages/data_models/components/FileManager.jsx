import React, { useState, useCallback } from 'react';
import { 
  DocumentArrowUpIcon, 
  DocumentTextIcon, 
  TrashIcon, 
  EyeIcon,
  PencilIcon,
  FolderIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import FilePreviewModal from './FilePreviewModal';
import { dataModelService } from '../../../services/dataModelService';
import FileTypeIcon from './FileTypeIcon';
import { getAccessToken } from '../../../services/tokenRefresh';

const FileManager = ({ modelId, files = [], onFilesChange, canEdit = true }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [isExcelSettingsOpen, setIsExcelSettingsOpen] = useState(false);

  const handleDragOver = useCallback((e) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDragOver(true);
  }, [canEdit]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const isExcelFile = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    return ['xlsx', 'xls'].includes(extension);
  };

  const uploadFiles = useCallback(async (filesToUpload, uploadSettings = null) => {
    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = filesToUpload.map(async (fileItem) => {
        // Получаем data_schema из настроек загрузки
        const dataSchema = uploadSettings?.dataSchema || {};
        
        // Извлекаем файл и относительный путь
        const file = fileItem.file || fileItem;
        const relativePath = fileItem.filename || fileItem.relativePath || null;
        
        // Загрузка файла через вкладку "Файлы" НЕ должна создавать виджеты на workspace.
        const widgetId = null;
        
        // Используем dataModelService для загрузки файла с data_schema, relative_path и widget_id
        const result = await dataModelService.uploadModelFile(modelId, file, dataSchema, null, relativePath, widgetId);
        
        // API возвращает файл в разных форматах, нормализуем его
        // Если result содержит file_id, создаем объект файла
        if (result.file_id) {
          const displayName = result.original_filename || result.filename || file.name;
          const linkId = result.data_model_file_id ?? result.file_id;
          return {
            id: linkId,
            file_id: result.file_id,
            data_model_file_id: result.data_model_file_id ?? linkId,
            filename: displayName,
            original_filename: displayName,
            file_size: result.file_size,
            file_path: result.file_path,
            widget_id: widgetId,
            role: 'data',
          };
        }
        return result.file || result;
      });

      const results = await Promise.all(uploadPromises);
      
      // Обновляем список файлов, добавляя новые к существующим
      if (onFilesChange) {
        onFilesChange([...files, ...results]);
      }
      
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Ошибка при загрузке файлов: ' + error.message);
    } finally {
      setUploading(false);
    }
  }, [files, modelId, onFilesChange]);

  const isCSVFile = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    return extension === 'csv';
  };

  const handleFileUpload = useCallback(async (uploadedFiles) => {
    if (uploadedFiles.length === 0) return;

    // Разделяем файлы на Excel/CSV и остальные
    const excelFiles = uploadedFiles.filter(isExcelFile);
    const csvFiles = uploadedFiles.filter(isCSVFile);
    const otherFiles = uploadedFiles.filter(file => !isExcelFile(file) && !isCSVFile(file));

    // Если есть Excel или CSV файлы, показываем модальное окно настроек для первого
    if (excelFiles.length > 0 || csvFiles.length > 0) {
      const fileToConfigure = excelFiles[0] || csvFiles[0];
      setExcelFile(fileToConfigure);
      setIsExcelSettingsOpen(true);
      // Сохраняем остальные файлы для последующей загрузки
      const remainingFiles = [
        ...(excelFiles.length > 0 ? excelFiles.slice(1) : []),
        ...(csvFiles.length > 0 ? csvFiles.slice(1) : []),
        ...otherFiles
      ];
      if (remainingFiles.length > 0) {
        setSelectedFiles(remainingFiles);
      }
      return;
    }

    // Если нет Excel/CSV файлов, загружаем как обычно
    await uploadFiles(otherFiles);
  }, [uploadFiles]);

  const handleExcelUpload = useCallback(async (file, uploadSettings) => {
    setIsExcelSettingsOpen(false);
    
    // Загружаем Excel файл с настройками
    await uploadFiles([file], uploadSettings);
    
    // Если есть другие файлы, загружаем их тоже
    if (selectedFiles.length > 0) {
      await uploadFiles(selectedFiles);
      setSelectedFiles([]);
    }
    
    setExcelFile(null);
  }, [uploadFiles, selectedFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  }, [handleFileUpload, canEdit]);

  const handleFileSelect = useCallback((e) => {
    if (!canEdit) return;
    const selectedFiles = Array.from(e.target.files);
    handleFileUpload(selectedFiles);
  }, [handleFileUpload, canEdit]);

  const handleFileDelete = async (fileId) => {
    if (!canEdit) return;
    if (!window.confirm('Вы уверены, что хотите удалить этот файл?')) {
      return;
    }

    try {
      const response = await fetch(`/api/data-models/${modelId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления файла');
      }

      // Обновляем список файлов
      if (onFilesChange) {
        onFilesChange(files.filter(file => file.id !== fileId));
      }
      
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Ошибка при удалении файла: ' + error.message);
    }
  };

  const handleFileRoleChange = async (fileId, newRole) => {
    try {
      const response = await fetch(`/api/data-models/${modelId}/files/${fileId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Ошибка изменения роли файла');
      }

      // Обновляем список файлов
      if (onFilesChange) {
        onFilesChange(files.map(file => 
          file.id === fileId ? { ...file, role: newRole } : file
        ));
      }
      
    } catch (error) {
      console.error('Error changing file role:', error);
      alert('Ошибка при изменении роли файла: ' + error.message);
    }
  };

  // file icons: see <FileTypeIcon />

  const getRoleColor = (role) => {
    const colors = {
      'data': 'bg-blue-500/20 text-blue-400',
      'schema': 'bg-green-500/20 text-green-400',
      'config': 'bg-purple-500/20 text-purple-400',
      'formula': 'bg-orange-500/20 text-orange-400',
      'image': 'bg-pink-500/20 text-pink-400'
    };
    return colors[role] || 'bg-gray-500/20 text-gray-400';
  };

  const getRoleName = (role) => {
    const names = {
      'data': 'Данные',
      'schema': 'Схема',
      'config': 'Конфигурация',
      'formula': 'Формула',
      'image': 'Изображение'
    };
    return names[role] || role;
  };

  const handleFilePreview = (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  };


  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {canEdit ? (
      <div 
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-all bg-slate-800/30 ${
          isDragOver 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-600 hover:border-gray-500 hover:bg-slate-800/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <DocumentArrowUpIcon 
          className={`w-16 h-16 mx-auto mb-4 transition-colors ${
            isDragOver ? 'text-blue-400' : 'text-gray-400'
          }`} 
        />
        <h3 className="text-xl font-semibold text-white mb-2">
          {isDragOver ? 'Отпустите файлы здесь' : 'Загрузите файлы'}
        </h3>
        <p className="text-gray-400 mb-6 text-sm">
          Перетащите файлы сюда или нажмите кнопку ниже для выбора
        </p>
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json,.txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors"
        >
          <DocumentArrowUpIcon className="w-5 h-5" />
          Выбрать файлы
        </label>
      </div>
      ) : (
        <p className="text-sm text-gray-400">Режим просмотра — загрузка и удаление файлов недоступны.</p>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Файлы модели ({files.length})</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div 
                key={file.id} 
                className="group relative bg-slate-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 hover:bg-slate-800 transition-all duration-200"
              >
                {/* File Info Section */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 text-cyan-300">
                    <FileTypeIcon filename={file.original_filename || file.filename || file.name} size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="font-medium text-white truncate mb-1" 
                      title={file.original_filename || file.filename || file.name || 'Без имени'}
                    >
                      {file.original_filename || file.filename || file.name || 'Без имени'}
                    </h4>
                    <p className="text-sm text-gray-400 mb-2">
                      {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Размер неизвестен'}
                      {file.file_type && ` • ${file.file_type.toUpperCase()}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(file.role)}`}>
                        {getRoleName(file.role)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons - Horizontal at bottom */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-700/50 mt-3">
                  <button 
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                    onClick={() => handleFilePreview(file)}
                    title="Просмотр"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  
                  {canEdit && (
                  <button 
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    onClick={() => handleFileDelete(file.id)}
                    title="Удалить"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-400">Загрузка файлов...</p>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen || isExcelSettingsOpen}
        onClose={() => {
          if (isPreviewOpen) {
            handleClosePreview();
          }
          if (isExcelSettingsOpen) {
            setIsExcelSettingsOpen(false);
            setExcelFile(null);
            setSelectedFiles([]);
          }
        }}
        file={isExcelSettingsOpen ? excelFile : previewFile}
        modelId={modelId}
        onUpload={isExcelSettingsOpen ? handleExcelUpload : undefined}
        isUploadMode={isExcelSettingsOpen}
      />
    </div>
  );
};

export default FileManager;


