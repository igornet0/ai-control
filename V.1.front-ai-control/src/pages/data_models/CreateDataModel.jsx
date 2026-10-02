import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataModelService } from '../../services/dataModelService';
import { persistWorkspaceState } from './workspace/widgetDbSync.js';
import { 
  ArrowLeftIcon, 
  CircleStackIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import styles from './CreateDataModel.module.css';
import FilePreviewModal from './components/FilePreviewModal';
// import DataCodeEditor from '../datacode_editor/DataCodeEditor';
import DataModelWorkspace from './workspace/DataModelWorkspace';
import { normalizeConnection } from './workspace/widgetIdUtils.js';

const CreateDataModel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic info, 2: Workspace
  const [workspaceData, setWorkspaceData] = useState(null);
  const [createdModelId, setCreatedModelId] = useState(null); // ID созданной модели
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error'
  const [lastSavedData, setLastSavedData] = useState({ name: '', description: '' });
  
  // Основные данные модели
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    data_type: 'file',
    data_source: '',
    data_schema: {},
    is_public: false
  });
  
  // Debug: Log form data changes
  useEffect(() => {
      }, [formData]);

  // Очистка debounce таймера при размонтировании компонента
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Данные файла
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [startRow, setStartRow] = useState(1);
  const [headerRow, setHeaderRow] = useState(1);
  const [previewRows, setPreviewRows] = useState(50);
  const [previewData, setPreviewData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [columnNames, setColumnNames] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isTransposed, setIsTransposed] = useState(false);
  
  // Excel листы
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  
  // FilePreviewModal state
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [tempFile, setTempFile] = useState(null);
  
  // DataCodeEditor state
  const [isDataCodeEditorOpen, setIsDataCodeEditorOpen] = useState(false);
  const [dataCodeContent, setDataCodeContent] = useState('');
  
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  // Загрузка данных модели в режиме редактирования
  useEffect(() => {
    if (isEditMode && id) {
      setCreatedModelId(parseInt(id, 10)); // Устанавливаем ID модели в режиме редактирования
      loadModelForEdit(id);
    }
  }, [isEditMode, id]);

  const loadModelForEdit = async (modelId) => {
    try {
      setLoading(true);
      const [model, filesData, widgetsData] = await Promise.all([
        dataModelService.getDataModel(modelId),
        dataModelService.getModelFiles(modelId).catch(() => ({ files: [] })),
        dataModelService.getDataModelWidgets(modelId).catch(() => [])
      ]);

      const canEditModel = Boolean(
        model?.can_edit ||
        model?.is_owner ||
        model?.can_manage_access ||
        (user?.id != null && Number(user.id) === Number(model?.owner_id))
      );
      if (!canEditModel) {
        setError('Недостаточно прав для редактирования модели (нужен доступ «Редактирование»).');
        navigate(`/data-models/${modelId}`, { replace: true });
        return;
      }
      // Получаем схему данных из первого файла данных
      const allFiles = filesData.files || [];
      const firstDataFile = allFiles.find(file => file.role === 'data' && file.data_schema);
      const dataSchema = firstDataFile?.data_schema || {};
      
      setFormData({
        name: model.name || '',
        description: model.description || '',
        data_type: 'file', // Всегда 'file' для UI
        data_source: '', // Больше не используется
        data_schema: dataSchema,
        is_public: model.is_public || false
      });

      // Инициализируем lastSavedData при загрузке модели
      setLastSavedData({
        name: model.name || '',
        description: model.description || ''
      });

      // Загружаем схему из файла
      if (dataSchema && Object.keys(dataSchema).length > 0) {
        setHeaders(dataSchema.headers || []);
        setSelectedFields(dataSchema.headers || []);
        setColumnNames(dataSchema.columnNames || {});
        setStartRow(dataSchema.startRow || 1);
        setHeaderRow(dataSchema.headerRow || 1);
        setPreviewRows(50);
        setIsTransposed(dataSchema.isTransposed || false);
        
        // Если есть информация о листах Excel
        if (dataSchema.excelSheet) {
          setSelectedSheet(dataSchema.excelSheet);
        }
        if (dataSchema.availableSheets) {
          setExcelSheets(dataSchema.availableSheets);
        }
        
        // В режиме редактирования исходные данные будут загружены при загрузке файла
        // setOriginalData и setOriginalHeaders будут установлены в processExcelData
      }
      
      // Преобразуем виджеты из формата API в формат workspace
      if (widgetsData && widgetsData.length > 0) {
        const workspaceWidgets = widgetsData.map(widget => {
          const widgetConfig = widget.widget_config || {};
          const widgetSettings = widgetConfig.settings || {};
          
          // Ищем файл для этого виджета по widget_id
          const widgetFile = allFiles.find(file => file.widget_id === widget.id);
          
          // Если найден файл, восстанавливаем selectedFile и настройки из data_schema
          if (widgetFile) {
            const dataSchema = widgetFile.data_schema || {};
            const fileInfo = {
              name: widgetFile.original_filename || widgetFile.filename || '',
              size: widgetFile.file_size || 0,
              type: widgetFile.mime_type || 'application/octet-stream',
              uploadedFile: {
                file_id: widgetFile.file_id,
                data_model_file_id: widgetFile.id,
                filename: widgetFile.filename,
                original_filename: widgetFile.original_filename,
                file_size: widgetFile.file_size
              }
            };
            
            // Восстанавливаем настройки из data_schema (не затираем колонки из widget_config)
            const schemaColumns = dataSchema.headers || dataSchema.selectedFields || [];
            const settingsColumns = widgetSettings.selectedColumns
              || widgetSettings.fileColumns
              || widgetSettings.originalFileColumns
              || [];
            const mergedColumns = schemaColumns.length ? schemaColumns : settingsColumns;

            widgetSettings.selectedFile = fileInfo;
            widgetSettings.sourcePath = fileInfo.name;
            widgetSettings.sourceType = widgetSettings.sourceType || 'file';
            widgetSettings.selectedColumns = mergedColumns;
            widgetSettings.fileColumns = mergedColumns;
            widgetSettings.fieldRenames = Object.keys(dataSchema.columnNames || {}).length
              ? (dataSchema.columnNames || {})
              : (widgetSettings.fieldRenames || {});
            widgetSettings.startRow = dataSchema.startRow || 1;
            widgetSettings.headerRow = dataSchema.headerRow || 1;
            widgetSettings.isTransposed = dataSchema.isTransposed || false;
            
            // Восстанавливаем настройки Excel, если есть
            if (dataSchema.excelSheet) {
              widgetSettings.excelSheet = dataSchema.excelSheet;
            }
            if (dataSchema.availableSheets) {
              widgetSettings.excelSheets = dataSchema.availableSheets;
            }
            if (dataSchema.excelHeaderRow) {
              widgetSettings.excelHeaderRow = dataSchema.excelHeaderRow;
            }
            
                      }
          
          return {
            id: widget.id,
            type: widget.widget_type,
            x: widget.position_x,
            y: widget.position_y,
            width: widget.width,
            config: widgetConfig,
            settings: widgetSettings, // Восстанавливаем settings с восстановленным файлом
            styles: widgetConfig.styles || {},
            dataSource: widget.data_source,
            dataConfig: widget.data_config || {},
            orderIndex: widget.order_index,
            isVisible: widget.is_visible,
            refreshInterval: widget.refresh_interval,
            connections: [] // Будет восстановлено из relationships
          };
        });
        
        // Загружаем связи из relationships
        let connections = [];
        if (model.relationships && typeof model.relationships === 'object') {
          connections = Object.values(model.relationships)
            .filter(rel => rel && rel.from && rel.to)
            .map(rel => normalizeConnection({
              id: rel.id || `conn_${rel.from}_${rel.to}`,
              from: rel.from,
              to: rel.to,
              fromType: rel.fromType || 'output',
              toType: rel.toType || 'input',
              settings: rel.settings || {}
            }));
        }
        
        // Если есть workspace_data, объединяем с виджетами из БД
        if (workspaceData) {
          setWorkspaceData({
            ...workspaceData,
            widgets: workspaceWidgets,
            connections: connections
          });
        } else {
          setWorkspaceData({
            workspace: {},
            widgets: workspaceWidgets,
            connections: connections
          });
        }
      } else if (model.relationships && typeof model.relationships === 'object') {
        // Если нет виджетов, но есть связи, загружаем их
        const connections = Object.values(model.relationships)
          .filter(rel => rel && rel.from && rel.to)
          .map(rel => normalizeConnection({
            id: rel.id || `conn_${rel.from}_${rel.to}`,
            from: rel.from,
            to: rel.to,
            fromType: rel.fromType || 'output',
            toType: rel.toType || 'input',
            settings: rel.settings || {}
          }));
        
        setWorkspaceData(prev => ({
          ...prev,
          connections: connections
        }));
      }
      
    } catch (error) {
      setError('Не удалось загрузить модель данных для редактирования');
      console.error('Error loading model for edit:', error);
    } finally {
      setLoading(false);
    }
  };

  const processFile = useCallback((uploadedFile) => {
    if (!uploadedFile) return;

        
    // Проверяем размер файла (30MB = 30 * 1024 * 1024 байт)
    const maxFileSize = 30 * 1024 * 1024; // 30MB
    if (uploadedFile.size > maxFileSize) {
      const fileSizeMB = (uploadedFile.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);
      setError(`Файл слишком большой: ${fileSizeMB}MB. Максимальный размер: ${maxSizeMB}MB`);
      return;
    }
    
    // Открываем FilePreviewModal для настройки файла
    setTempFile(uploadedFile);
    setIsFilePreviewOpen(true);
  }, []);

  const handleFileUpload = useCallback((event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      processFile(uploadedFile);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  // Создание модели после настройки файла
  const handleSubmitAfterFileConfig = useCallback(async (uploadedFile, fileDataSchema) => {
    if (!formData.name || formData.name.trim() === '') {
      setError('Название модели обязательно для заполнения');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Подготавливаем данные модели
      const modelData = {
        name: formData.name,
        description: formData.description,
        is_public: formData.is_public
      };
      
      // Создаем или обновляем модель данных
      let result;
      if (isEditMode) {
        result = await dataModelService.updateDataModel(id, modelData);
      } else {
        result = await dataModelService.createDataModel(modelData);
      }
      
      const modelId = result.data_model_id || result.data_model?.id || result.id;
      if (uploadedFile && modelId) {
              }
      navigate('/data-models');
    } catch (error) {
      setError('Не удалось создать модель данных');
      console.error('Error creating data model:', error);
    } finally {
      setLoading(false);
    }
  }, [formData, isEditMode, id, navigate]);
  
  // Обработчик загрузки файла из FilePreviewModal
  const handleFileConfigured = useCallback(async (uploadedFile, uploadSettings) => {
        
    // Сохраняем файл
    setFile(uploadedFile);
    
    // Сохраняем настройки из FilePreviewModal
    if (uploadSettings && uploadSettings.dataSchema) {
      const { dataSchema } = uploadSettings;
      const { headers: settingsHeaders, selectedFields: settingsFields, columnNames: settingsColumnNames, headerRow: settingsHeaderRow, startRow: settingsStartRow, excelSheet: settingsSheet, availableSheets, isTransposed: settingsIsTransposed } = dataSchema;
      
      // Сохраняем настройки
      setHeaders(settingsHeaders || []);
      setSelectedFields(settingsFields || settingsHeaders || []);
      setColumnNames(settingsColumnNames || {});
      setHeaderRow(settingsHeaderRow || 1);
      setStartRow(settingsStartRow || 1);
      setIsTransposed(settingsIsTransposed || false);
      setExcelSheets(availableSheets || []);
      setSelectedSheet(settingsSheet || '');
      
      // Закрываем модальное окно
      setIsFilePreviewOpen(false);
      setTempFile(null);
      
      // Сразу создаем модель и загружаем файл
      await handleSubmitAfterFileConfig(uploadedFile, dataSchema);
    } else {
      // Закрываем модальное окно
      setIsFilePreviewOpen(false);
      setTempFile(null);
    }
  }, [handleSubmitAfterFileConfig]);

  const handleFieldToggle = (field) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleColumnNameChange = (originalName, newName) => {
    setColumnNames(prev => ({
      ...prev,
      [originalName]: newName
    }));
  };

  const getDisplayName = (originalName) => {
    return columnNames[originalName] || originalName;
  };


  const handleStartRowChange = (value) => {
    const rowNum = parseInt(value);
    if (rowNum >= 1 && rowNum <= data.length) {
      setStartRow(rowNum);
      setPreviewData(data.slice(rowNum - 1, rowNum - 1 + previewRows));
    }
  };

  const handlePreviewRowsChange = (value) => {
    const rowsNum = parseInt(value);
    if (rowsNum >= 1 && rowsNum <= 100) {
      setPreviewRows(rowsNum);
      setPreviewData(data.slice(startRow - 1, startRow - 1 + rowsNum));
    }
  };

  // Debounce ref для автоматического сохранения
  const debounceRef = useRef(null);

  const autoSaveModelData = useCallback(async (name, description) => {
    // Определить ID модели для сохранения
    const modelIdToUse = createdModelId || (isEditMode ? id : null);
    
    // Проверить, что модель существует и данные изменились
    if (!modelIdToUse) return;
    
    const trimmedName = name.trim();
    if (trimmedName === lastSavedData.name && description === lastSavedData.description) return;
    
    // Не сохраняем, если название пустое
    if (!trimmedName) return;
    
    setSaveStatus('saving');
    
    try {
      const modelData = {
        name: trimmedName,
        description: description || ''
      };
      
      await dataModelService.updateDataModel(modelIdToUse, modelData);
      setLastSavedData({ name: trimmedName, description: description || '' });
      setSaveStatus('saved');
      
      // Скрыть статус "saved" через 2 секунды
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Error auto-saving model data:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }, [createdModelId, isEditMode, id, lastSavedData]);

  // Debounced версия функции сохранения
  const debouncedAutoSave = useCallback((name, description) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      autoSaveModelData(name, description);
    }, 1000);
  }, [autoSaveModelData]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // Автоматическое сохранение для name и description
      if ((name === 'name' || name === 'description') && (createdModelId || isEditMode)) {
        debouncedAutoSave(
          name === 'name' ? value : newFormData.name,
          name === 'description' ? value : newFormData.description
        );
      }
      
      return newFormData;
    });
  };
  
  const handleKeyDown = (e) => {
    // Предотвращаем отправку формы при нажатии Enter
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
          }
  };

  const generateJSON = () => {
    if (formData.data_type === 'file' && data.length > 0) {
      const filteredData = data.slice(startRow - 1).map(row => {
        const filteredRow = {};
        selectedFields.forEach(field => {
          const displayName = getDisplayName(field);
          filteredRow[displayName] = row[field];
        });
        return filteredRow;
      });
      return filteredData;
    }
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Если мы не на шаге 2, не создаем модель
    if (currentStep !== 2) {
      console.warn('Submit called but not on step 2, ignoring');
      return;
    }
    
    // Проверяем, что все обязательные поля заполнены
    if (!formData.name || formData.name.trim() === '') {
      setError('Название модели обязательно для заполнения');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Подготавливаем данные модели
      const modelData = {
        name: formData.name,
        description: formData.description,
        is_public: formData.is_public,
        workspace_data: workspaceData // Сохраняем данные workspace
      };
      
            
      // Дополнительная проверка данных перед отправкой
      if (!modelData.name || modelData.name.trim() === '') {
        throw new Error('Название модели не может быть пустым');
      }

      // Создаем или обновляем модель данных
      let result;
      if (isEditMode) {
        result = await dataModelService.updateDataModel(id, modelData);
      } else {
        // Если модель уже создана при переходе на шаг 2, обновляем ее
        if (createdModelId) {
          result = await dataModelService.updateDataModel(createdModelId, modelData);
        } else {
          result = await dataModelService.createDataModel(modelData);
          const modelId = result.id || result.data_model_id || result.data_model?.id;
          if (modelId) {
            setCreatedModelId(modelId);
          }
        }
      }
      
            
      // Редирект после успешного создания
      setTimeout(() => {
        navigate('/data-models');
      }, 500);
      
    } catch (error) {
      setError('Не удалось создать модель данных');
      console.error('Error creating data model:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
            
    if (currentStep < 2) {
      // Если переходим на шаг 2, создаем модель в БД (если еще не создана)
      if (currentStep === 1 && !isEditMode && !createdModelId) {
        // Проверяем, что название заполнено
        if (!formData.name || formData.name.trim() === '') {
          setError('Название модели обязательно для заполнения');
          return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
          // Создаем модель данных в БД
          const modelData = {
            name: formData.name,
            description: formData.description,
            is_public: formData.is_public
          };
          
                    
          const result = await dataModelService.createDataModel(modelData);
          const modelId = result.id || result.data_model_id || result.data_model?.id;
          
          if (modelId) {
            setCreatedModelId(modelId);
            // Инициализируем lastSavedData после создания модели
            setLastSavedData({
              name: formData.name,
              description: formData.description
            });
                      } else {
            throw new Error('Не удалось получить ID созданной модели');
          }
          
          // Переходим на следующий шаг
          setCurrentStep(currentStep + 1);
                  } catch (error) {
          setError('Не удалось создать модель данных: ' + (error.message || 'Неизвестная ошибка'));
          console.error('Error creating data model:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // Если модель уже создана или в режиме редактирования, просто переходим на следующий шаг
        setCurrentStep(currentStep + 1);
              }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    const result = (() => {
      switch (currentStep) {
        case 1:
          return formData.name.trim() !== '';
        case 2:
          // Можно сохранить модель даже без виджетов
          return true;
        default:
          return false;
      }
    })();
    
        return result;
  };

  return (
    <>
      {currentStep === 2 ? (
        <div style={{ height: '100vh', width: '100%', position: 'fixed', top: 0, left: 0, zIndex: 1000 }}>
          <DataModelWorkspace
            modelId={createdModelId || (isEditMode ? id : null)} // Передаем ID модели в workspace
            onSave={async (data) => {
              const modelIdToUse = createdModelId || (isEditMode ? id : null);
              if (!modelIdToUse) return;

              try {
                await persistWorkspaceState(modelIdToUse, data);
              } catch (error) {
                console.error('Error saving widgets and connections:', error);
              }
            }}
            initialData={workspaceData}
            modelName={formData.name}
            onBack={() => {
              // Если модель была создана и мы не в режиме редактирования,
              // переходим в режим редактирования при нажатии "Назад"
              if (createdModelId && !isEditMode) {
                navigate(`/data-models/${createdModelId}/edit`);
              } else {
                setCurrentStep(1);
              }
            }}
            onSaveAndExit={async () => {
              if (!formData.name || formData.name.trim() === '') {
                setError('Название модели обязательно для заполнения');
                return;
              }

              setLoading(true);
              setError(null);

              try {
                const modelIdToUse = createdModelId || (isEditMode ? id : null);
                // Canvas widgets/connections are already flushed by DataModelWorkspace.
                // Only sync model metadata, then leave the editor.
                if (modelIdToUse) {
                  await dataModelService.updateDataModel(modelIdToUse, {
                    name: formData.name,
                    description: formData.description,
                    is_public: formData.is_public,
                  });
                }

                navigate('/data-models');
              } catch (error) {
                setError('Не удалось сохранить модель данных');
                console.error('Error saving data model on exit:', error);
              } finally {
                setLoading(false);
              }
            }}
          />
        </div>
      ) : (
        <div className="min-h-screen p-6" style={{ background: 'var(--gradient-secondary)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="card animate-scaleIn">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={() => navigate('/data-models')}
                  className="btn btn-secondary btn-sm"
                >
                  <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
                  Назад
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gradient mb-2">
                    {isEditMode ? 'Редактировать модель данных' : 'Создать модель данных'}
                  </h1>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {isEditMode 
                      ? 'Измените настройки источника данных' 
                      : 'Настройте источник данных для ваших панелей управления'
                    }
                  </p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-4">
                  {[1, 2].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        currentStep >= step 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {currentStep > step ? <CheckIcon style={{ width: '1rem', height: '1rem' }} /> : step}
                      </div>
                      {step < 2 && (
                        <div className={`w-16 h-1 mx-2 ${
                          currentStep > step ? 'bg-blue-500' : 'bg-gray-300'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gradient">
                  {currentStep === 1 && 'Основная информация'}
                  {currentStep === 2 && 'Создание модели данных'}
                </h2>
                {currentStep === 2 && (
                  <p className="text-sm text-gray-400 mt-2">
                    Создайте модель данных, добавляя виджеты источников данных, блоки обработки и связи между ними
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span>{error}</span>
                    <button 
                      onClick={() => setError(null)}
                      className="text-red-300 hover:text-red-100 transition-colors"
                    >
                      <XMarkIcon style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-8">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Название модели *
                    {saveStatus === 'saving' && (
                      <span className="ml-2 text-xs text-gray-400">Сохранение...</span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="ml-2 text-xs text-green-400">✓ Сохранено</span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="ml-2 text-xs text-red-400">Ошибка сохранения</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Введите название модели данных"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Описание
                    {saveStatus === 'saving' && (
                      <span className="ml-2 text-xs text-gray-400">Сохранение...</span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="ml-2 text-xs text-green-400">✓ Сохранено</span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="ml-2 text-xs text-red-400">Ошибка сохранения</span>
                    )}
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Опишите назначение и содержимое модели данных"
                    rows="3"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_public"
                      checked={formData.is_public}
                      onChange={handleInputChange}
                      className="rounded"
                    />
                    <span className="text-sm">Сделать модель публичной</span>
                  </label>
                  <p className="text-xs text-gray-400">
                    Публичные модели доступны всем пользователям
                  </p>
                </div>
              </div>
            )}


            {/* Progress Bar for File Upload */}
            {isUploading && (
              <div className="space-y-4 pt-6 border-t border-gray-700">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Загрузка файла</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Загружается файл: {file?.name}
                  </p>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                
                <div className="text-center">
                  <span className="text-sm text-gray-400">
                    {uploadProgress}% загружено
                  </span>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep === 1 && (
              <div className="flex gap-4 pt-6 border-t border-gray-700">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="btn btn-secondary"
                  >
                    Назад
                  </button>
                )}
                
                {currentStep < 2 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceedToNext() || loading}
                    className="btn btn-primary flex-1"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Создание...
                      </>
                    ) : (
                      <>
                      {isEditMode ? 'Редактировать модель данных' : 'Создать'}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !canProceedToNext()}
                    className="btn btn-primary flex-1"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {isEditMode ? 'Сохранение...' : 'Создание...'}
                      </>
                    ) : (
                      <>
                        <CircleStackIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                        {isEditMode ? 'Сохранить изменения' : 'Создать модель данных'}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* FilePreviewModal для настройки файла */}
      <FilePreviewModal
        isOpen={isFilePreviewOpen}
        onClose={() => {
          setIsFilePreviewOpen(false);
          setTempFile(null);
        }}
        file={tempFile}
        modelId={null} // modelId не нужен при создании
        onUpload={handleFileConfigured}
        isUploadMode={true}
      />
      
      {/* DataCodeEditor для редактирования Datacode */}
      {/* <DataCodeEditor
        isOpen={isDataCodeEditorOpen}
        onClose={() => {
          // Сохраняем код в data_source при закрытии редактора
          setFormData(prev => ({ ...prev, data_source: dataCodeContent }));
          setIsDataCodeEditorOpen(false);
        }}
        code={dataCodeContent}
        setCode={setDataCodeContent}
      /> */}
    </>
  );
};

export default CreateDataModel;
