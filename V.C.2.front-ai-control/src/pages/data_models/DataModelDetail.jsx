import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataModelService, isModelMediaRole } from '../../services/dataModelService';
import FileManager from './components/FileManager';
import RelationshipViewer from './components/RelationshipViewer';
import ImageManager from './components/ImageManager';
import ApiKeysManager from './components/ApiKeysManager';
import ModelAccessPanel from './components/ModelAccessPanel';
import DataBridgeAutoRefreshPanel from './components/DataBridgeAutoRefreshPanel';
import ModelSchemaViewer from './components/ModelSchemaViewer';
import OverviewTablesPanel from './components/OverviewTablesPanel';
// import DataCodeEditor from '../datacode_editor/DataCodeEditor';
import { 
  ArrowLeftIcon, 
  CircleStackIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentTextIcon,
  LinkIcon,
  Cog6ToothIcon,
  FilmIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../task_manager/components/ConfirmDialog';

const DataModelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [model, setModel] = useState(null);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [schemaViewerOpen, setSchemaViewerOpen] = useState(false);
  const [datacode, setDatacode] = useState('');
  const [codeData, setCodeData] = useState({ tabs: [{ name: 'Tab 1', content: '' }], activeTab: 0 });
  const [codeVersion, setCodeVersion] = useState(0);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportJsonError, setExportJsonError] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyingModel, setCopyingModel] = useState(false);
  const emptyCodeData = { tabs: [{ name: 'Tab 1', content: '' }], activeTab: 0 };

  const resolveCodePayload = (payload) => {
    const maybeCode = payload?.code_data;
    if (maybeCode && Array.isArray(maybeCode.tabs)) {
      return {
        code: maybeCode,
        version: payload?.version || 0,
      };
    }
    return {
      code: emptyCodeData,
      version: payload?.version || 0,
    };
  };

  useEffect(() => {
    if (id) {
      loadModelData();
    }
  }, [id]);

  // Перезагружаем код при открытии вкладки datacode
  useEffect(() => {
    if (activeTab === 'datacode' && id) {
      loadCodeData();
    }
  }, [activeTab, id]);

  const loadCodeData = async () => {
    try {
            const codeData = await dataModelService.getModelCode(id);
            
      if (codeData && codeData.code_data) {
                setCodeData(codeData.code_data);
        setCodeVersion(codeData.version || 0);
        // Устанавливаем код первой вкладки для обратной совместимости
        if (codeData.code_data.tabs && codeData.code_data.tabs.length > 0) {
          setDatacode(codeData.code_data.tabs[0].content || '');
        }
      } else {
        const fallback = resolveCodePayload(codeData);
        setCodeData(fallback.code);
        setCodeVersion(fallback.version);
        setDatacode('');
      }
    } catch (error) {
      console.error('Error loading code data:', error);
      // Не показываем ошибку пользователю, просто используем текущий код
    }
  };

  const handleFilesChange = (newFiles) => {
    const dataFiles = newFiles.filter((file) => !isModelMediaRole(file.role));
    const mediaFiles = newFiles.filter((file) => isModelMediaRole(file.role));

    setFiles(dataFiles);
    setImages(mediaFiles);
  };

  const handleImagesChange = (newMedia) => {
    setImages(newMedia);
    setFiles((prev) => prev.filter((file) => !isModelMediaRole(file.role)));
  };

  const loadModelData = async () => {
    try {
      setLoading(true);
      const [modelResponse, filesData, codeData] = await Promise.all([
        dataModelService.getDataModel(id),
        dataModelService.getModelFiles(id).catch(() => ({ files: [] })),
        dataModelService.getModelCode(id).catch(() => ({ code_data: { tabs: [{ name: 'Tab 1', content: '' }], activeTab: 0 }, version: 0, exists: false }))
      ]);

      // API возвращает объект с полем data_model
      const modelData = modelResponse.data_model || modelResponse;
      
      setModel(modelData);

            
      // Разделяем data-файлы и медиа
      const allFiles = filesData.files || [];
      const dataFiles = allFiles.filter((file) => !isModelMediaRole(file.role));
      const mediaFiles = allFiles.filter((file) => isModelMediaRole(file.role));
      
      setFiles(dataFiles);
      setImages(mediaFiles);
      
      // Загружаем код модели данных
            const resolvedCode = resolveCodePayload(codeData);
      setCodeData(resolvedCode.code);
      setCodeVersion(resolvedCode.version);
      if (resolvedCode.code.tabs && resolvedCode.code.tabs.length > 0) {
        setDatacode(resolvedCode.code.tabs[0].content || '');
      } else {
        setDatacode('');
      }
    } catch (error) {
      setError('Не удалось загрузить данные модели');
      console.error('Error loading model:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveCode = async (newCodeData) => {
    try {
      if (!id) {
        console.warn('DataModelDetail: Cannot save code, no model id');
        return;
      }
      
            const response = await dataModelService.saveModelCode(id, newCodeData, true);
            
      // Используем code_data из ответа сервера, если он есть, иначе используем отправленные данные
      const savedCodeData = response.code_data || newCodeData;
      setCodeData(savedCodeData);
      setCodeVersion(response.version || 0);
      
      // Обновляем код первой вкладки для обратной совместимости
      if (savedCodeData.tabs && savedCodeData.tabs.length > 0) {
        setDatacode(savedCodeData.tabs[0].content || '');
      }
    } catch (error) {
      console.error('DataModelDetail: Error saving code:', error);
      setError('Не удалось сохранить код');
    }
  };

  const handleExportModelJson = async () => {
    if (!id) return;
    try {
      setExportingJson(true);
      setExportJsonError(null);
      const blob = await dataModelService.exportDataModelJson(id);
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data_model_${id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DataModelDetail: export JSON failed:', err);
      setExportJsonError('Не удалось экспортировать модель в JSON');
    } finally {
      setExportingJson(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Вы уверены, что хотите удалить эту модель данных?')) {
      try {
        await dataModelService.deleteDataModel(id);
        navigate('/data-models');
      } catch (error) {
        setError('Не удалось удалить модель данных');
        console.error('Error deleting model:', error);
      }
    }
  };

  const copyDataModel = async (includeData) => {
    setCopyingModel(true);
    try {
      const copied = await dataModelService.copyDataModel(id, { include_data: includeData });
      setShowCopyDialog(false);
      if (copied?.id) {
        navigate(`/data-models/${copied.id}`);
      }
    } catch (error) {
      setError('Не удалось скопировать модель данных');
      console.error('Error copying model:', error);
    } finally {
      setCopyingModel(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--gradient-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="card animate-scaleIn" style={{ padding: '3rem' }}>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">Загрузка модели данных...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--gradient-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="card animate-scaleIn" style={{ padding: '3rem' }}>
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <CircleStackIcon style={{ width: '3rem', height: '3rem' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ошибка загрузки</h2>
              <p className="text-gray-400 mb-4">{error || 'Модель данных не найдена'}</p>
              <button
                onClick={() => navigate('/data-models')}
                className="btn btn-secondary"
              >
                <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
                Вернуться к списку
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDatacodeTab = activeTab === 'datacode';
  const isOwner = Boolean(model.can_manage_access || Number(user?.id) === Number(model.owner_id));
  const canEdit = Boolean(model.can_edit || isOwner);
  
  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--gradient-secondary)', display: 'flex', flexDirection: 'column' }}>
      <div 
        className={`mx-auto flex-1 flex flex-col min-h-0 transition-all duration-300`}
        style={{ 
          maxWidth: isDatacodeTab ? '100%' : '1280px',
          width: '100%'
        }}
      >
        <div 
          className="card animate-scaleIn flex-1 flex flex-col min-h-0 transition-all duration-300" 
          style={{ 
            padding: isDatacodeTab ? '1.25rem' : '1.5rem',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          {/* Content Wrapper - центрирует контент при расширении */}
          <div 
            className="flex flex-col transition-all duration-300"
            style={{
              maxWidth: isDatacodeTab ? '100%' : '1280px',
              width: '100%',
              margin: '0 auto'
            }}
          >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/data-models')}
                className="btn btn-secondary btn-sm"
              >
                <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
                Назад
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gradient mb-2">{model.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {model.created && (
                    <span>Создано: {new Date(model.created).toLocaleDateString('ru-RU', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  )}
                  {model.updated && (
                    <>
                      <span>•</span>
                      <span>Обновлено: {new Date(model.updated).toLocaleDateString('ru-RU', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCopyDialog(true)}
                className="btn btn-secondary btn-sm"
                title="Копировать структуру"
              >
                <DocumentDuplicateIcon style={{ width: '1rem', height: '1rem' }} />
                Копировать
              </button>
              {canEdit && (
                <button
                  onClick={() => navigate(`/data-models/${id}/edit`)}
                  className="btn btn-primary btn-sm"
                >
                  <PencilIcon style={{ width: '1rem', height: '1rem' }} />
                  Редактировать
                </button>
              )}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="btn btn-danger btn-sm"
                >
                  <TrashIcon style={{ width: '1rem', height: '1rem' }} />
                  Удалить
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {model.description && (
            <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-gray-300">{model.description}</p>
            </div>
          )}

          {/* Tabs */}
          <div 
            className="flex border-b border-gray-700 mb-6 sticky top-0 z-10 transition-all duration-300 overflow-x-auto"
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'transparent',
              backgroundImage: 'linear-gradient(to bottom, rgba(31, 41, 55, 0.95) 0%, rgba(31, 41, 55, 0.98) 100%)',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
              paddingTop: '0.5rem',
              marginTop: '-0.5rem',
              paddingBottom: '0.5rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid rgba(55, 65, 81, 0.8)',
              width: '100%',
              justifyContent: 'flex-start',
              display: 'flex',
              flexWrap: 'nowrap',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {[
              { id: 'overview', name: 'Обзор', icon: EyeIcon },
              { id: 'files', name: 'Файлы', icon: DocumentTextIcon },
              { id: 'images', name: 'Медиа', icon: FilmIcon },
              { id: 'relationships', name: 'Связи', icon: LinkIcon },
              { id: 'config', name: 'Настройки', icon: Cog6ToothIcon }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <IconComponent style={{ width: '1rem', height: '1rem' }} />
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className={activeTab === 'datacode' ? 'flex-1 flex flex-col min-h-0' : 'space-y-6'}>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <OverviewTablesPanel
                  modelId={id}
                  onOpenSchema={() => setSchemaViewerOpen(true)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <DocumentTextIcon style={{ width: '1.5rem', height: '1.5rem' }} className="text-blue-400" />
                      <h3 className="font-semibold">Файлы</h3>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{files.length}</p>
                    <p className="text-sm text-gray-400">файлов в модели</p>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <FilmIcon style={{ width: '1.5rem', height: '1.5rem' }} className="text-pink-400" />
                      <h3 className="font-semibold">Медиа</h3>
                    </div>
                    <p className="text-2xl font-bold text-pink-400">{images.length}</p>
                    <p className="text-sm text-gray-400">медиафайлов в модели</p>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <LinkIcon style={{ width: '1.5rem', height: '1.5rem' }} className="text-purple-400" />
                      <h3 className="font-semibold">Связи</h3>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">
                      {Object.keys(model.relationships || {}).length}
                    </p>
                    <p className="text-sm text-gray-400">связанных моделей</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <FileManager 
                modelId={id}
                files={files}
                onFilesChange={handleFilesChange}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'images' && (
              <ImageManager 
                modelId={id}
                images={images}
                onImagesChange={handleImagesChange}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'relationships' && (
              <RelationshipViewer 
                modelId={id}
                relationships={model?.relationships || {}}
                onRelationshipsChange={(relationships) => setModel({...model, relationships})}
                canEdit={canEdit}
              />
            )}

            {/* {activeTab === 'datacode' && (
              <div style={{ 
                height: '100%',
                display: 'flex', 
                flexDirection: 'column',
                width: '100%',
                margin: isDatacodeTab ? '0' : '0 -3rem',
                padding: isDatacodeTab ? '0' : '0 3rem',
                flex: '1 1 auto',
                minHeight: 'calc(100vh - 400px)'
              }}>
                <DataCodeEditor 
                  isOpen={true}
                  onClose={() => {}}
                  code={datacode}
                  setCode={setDatacode}
                  embedded={true}
                  codeData={codeData}
                  onSave={handleSaveCode}
                  modelId={id}
                />
              </div>
            )} */}

            {activeTab === 'config' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleExportModelJson}
                    disabled={exportingJson}
                    className="btn btn-secondary btn-sm"
                  >
                    <ArrowDownTrayIcon style={{ width: '1rem', height: '1rem' }} />
                    {exportingJson ? 'Экспорт…' : 'Экспортировать модель в JSON'}
                  </button>
                </div>
                {exportJsonError && (
                  <p className="text-sm text-red-400 text-right">{exportJsonError}</p>
                )}
                <ModelAccessPanel
                  modelId={id}
                  model={model}
                  isOwner={isOwner}
                  onModelChange={setModel}
                />

                <DataBridgeAutoRefreshPanel
                  modelId={id}
                  model={model}
                  isOwner={isOwner}
                  onModelChange={setModel}
                />

                {isOwner && (
                  <div className="p-6 border border-gray-600 rounded-lg">
                    <ApiKeysManager modelId={id} />
                  </div>
                )}

                <details className="p-6 border border-gray-600 rounded-lg group">
                  <summary className="text-lg font-semibold cursor-pointer list-none flex items-center justify-between gap-3 select-none">
                    <span>Конфигурация обработки</span>
                    <span className="text-sm font-normal text-gray-400 group-open:hidden">показать</span>
                    <span className="text-sm font-normal text-gray-400 hidden group-open:inline">скрыть</span>
                  </summary>
                  <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto mt-4 max-h-[28rem]">
                    {JSON.stringify(model.processing_config || {}, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
          </div>
          {/* End Content Wrapper */}
        </div>
      </div>

      <ModelSchemaViewer
        modelId={id}
        modelName={model?.name}
        relationships={model?.relationships || {}}
        open={schemaViewerOpen}
        onClose={() => setSchemaViewerOpen(false)}
        canEdit={canEdit}
      />

      <ConfirmDialog
        open={showCopyDialog}
        title="Скопировать модель?"
        message={`Скопировать «${model?.name || ''}» в ваши модели. Только структура — виджеты и код без таблиц. Со структурой и данными — плюс скомпилированная SQLite и вложения.`}
        confirmLabel="Со структурой и данными"
        altConfirmLabel="Только структура"
        cancelLabel="Отмена"
        loading={copyingModel}
        onConfirm={() => copyDataModel(true)}
        onAltConfirm={() => copyDataModel(false)}
        onCancel={() => !copyingModel && setShowCopyDialog(false)}
      />
    </div>
  );
};

export default DataModelDetail;