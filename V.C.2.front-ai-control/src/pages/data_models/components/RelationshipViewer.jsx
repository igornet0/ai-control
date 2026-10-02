import React, { useState, useEffect, useMemo } from 'react';
import { 
  LinkIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { dataModelService } from '../../../services/dataModelService';
import { getAccessToken } from '../../../services/tokenRefresh';

const WIDGET_TYPE_LABELS = {
  'data-source': 'Источник данных',
  'data-model': 'Модель данных',
  'processing-block': 'Обработка',
  formula: 'Формула',
  relationship: 'Связь',
};

function getWidgetDisplayName(widget, fallbackId) {
  if (!widget) return `Виджет (id: ${fallbackId})`;
  const settings = widget.widget_config?.settings || {};
  const name = settings.name?.trim();
  if (name) return `${name} (id: ${widget.id ?? fallbackId})`;
  const typeLabel = WIDGET_TYPE_LABELS[widget.widget_type] || widget.widget_type || 'Виджет';
  return `${typeLabel} (id: ${widget.id ?? fallbackId})`;
}

const RelationshipViewer = ({ modelId, relationships = {}, onRelationshipsChange, canEdit = true }) => {
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    target_model_id: '',
    relationship_type: 'one_to_one',
    source_field: '',
    target_field: '',
    description: '',
    is_active: true
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [modelWidgets, setModelWidgets] = useState([]);
  const [loading, setLoading] = useState(false);

  const widgetsById = useMemo(() => {
    const map = {};
    for (const widget of modelWidgets) {
      if (widget?.id == null) continue;
      map[String(widget.id)] = widget;
    }
    return map;
  }, [modelWidgets]);

  const getWidgetLabel = (widgetId) => getWidgetDisplayName(widgetsById[String(widgetId)], widgetId);

  const relationshipEntries = Object.entries(relationships || {});
  const looksLikeModelRelationship = (rel) => {
    if (!rel || typeof rel !== 'object') return false;
    return (
      rel.target_model_id !== undefined ||
      rel.relationship_type !== undefined ||
      rel.source_field !== undefined ||
      rel.target_field !== undefined
    );
  };

  // В текущем приложении поле `model.relationships` иногда содержит "connection" виджетов:
  // { from, to, fromType, toType, settings } — тогда target_model_id/is_active/relationship_type отсутствуют.
  const hasAnyModelRelationships = relationshipEntries.some(([, rel]) => looksLikeModelRelationship(rel));

  useEffect(() => {
    loadAvailableModels();
  }, []);

  useEffect(() => {
    if (!modelId) {
      setModelWidgets([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await dataModelService.getDataModelWidgets(modelId);
        if (!cancelled) {
          setModelWidgets(Array.isArray(data) ? data : data?.widgets || []);
        }
      } catch (error) {
        console.error('Error loading model widgets:', error);
        if (!cancelled) setModelWidgets([]);
      }
    })();
    return () => { cancelled = true; };
  }, [modelId]);

  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/data-models', {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.data_models || []);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setLoading(false);
    }
  };

  const relationshipTypes = [
    { id: 'one_to_one', name: 'Один к одному', description: 'Каждая запись связана с одной записью' },
    { id: 'one_to_many', name: 'Один ко многим', description: 'Одна запись связана с несколькими' },
    { id: 'many_to_one', name: 'Многие к одному', description: 'Несколько записей связаны с одной' },
    { id: 'many_to_many', name: 'Многие ко многим', description: 'Множественные связи' },
    { id: 'lookup', name: 'Справочник', description: 'Связь для получения дополнительных данных' },
    { id: 'calculation', name: 'Вычисляемая', description: 'Связь для вычислений между моделями' }
  ];

  const handleAddRelationship = () => {
    if (!canEdit) return;
    setEditingRelationship('new');
    setNewRelationship({
      target_model_id: '',
      relationship_type: 'one_to_one',
      source_field: '',
      target_field: '',
      description: '',
      is_active: true
    });
  };

  const handleEditRelationship = (relationshipId) => {
    if (!canEdit) return;
    setEditingRelationship(relationshipId);
    setNewRelationship({ ...relationships[relationshipId] });
  };

  const handleSaveRelationship = async () => {
    if (!canEdit) return;
    try {
      const updatedRelationships = { ...relationships };
      
      if (editingRelationship === 'new') {
        const relationshipId = `rel_${Date.now()}`;
        updatedRelationships[relationshipId] = {
          ...newRelationship,
          id: relationshipId,
          created: new Date().toISOString(),
          source_model_id: modelId
        };
      } else {
        updatedRelationships[editingRelationship] = {
          ...updatedRelationships[editingRelationship],
          ...newRelationship,
          updated: new Date().toISOString()
        };
      }

      // Сохраняем на сервере
      const response = await fetch(`/api/data-models/${modelId}/relationships`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ relationships: updatedRelationships })
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения связей');
      }

      if (onRelationshipsChange) {
        onRelationshipsChange(updatedRelationships);
      }

      setEditingRelationship(null);
      setNewRelationship({
        target_model_id: '',
        relationship_type: 'one_to_one',
        source_field: '',
        target_field: '',
        description: '',
        is_active: true
      });
      
    } catch (error) {
      console.error('Error saving relationship:', error);
      alert('Ошибка при сохранении связи: ' + error.message);
    }
  };

  const handleDeleteRelationship = async (relationshipId) => {
    if (!canEdit) return;
    if (!window.confirm('Вы уверены, что хотите удалить эту связь?')) {
      return;
    }

    try {
      const updatedRelationships = { ...relationships };
      delete updatedRelationships[relationshipId];

      const response = await fetch(`/api/data-models/${modelId}/relationships`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ relationships: updatedRelationships })
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления связи');
      }

      if (onRelationshipsChange) {
        onRelationshipsChange(updatedRelationships);
      }
      
    } catch (error) {
      console.error('Error deleting relationship:', error);
      alert('Ошибка при удалении связи: ' + error.message);
    }
  };

  const getRelationshipTypeInfo = (type) => {
    return relationshipTypes.find(t => t.id === type) || relationshipTypes[0];
  };

  const getStatusColor = (isActive) => {
    return isActive 
      ? 'bg-green-500/20 text-green-400' 
      : 'bg-gray-500/20 text-gray-400';
  };

  const getTargetModelName = (targetModelId) => {
    const model = availableModels.find(m => m.id === parseInt(targetModelId));
    return model ? model.name : `Модель ${targetModelId}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Связи с другими моделями</h3>
        {hasAnyModelRelationships ? (
          canEdit ? (
          <button
            onClick={handleAddRelationship}
            className="btn btn-primary btn-sm"
          >
            <PlusIcon style={{ width: '1rem', height: '1rem' }} />
            Добавить связь
          </button>
          ) : null
        ) : (
          <div className="text-sm text-gray-400 max-w-xl">
            В данных модели связи сохранены в формате connection (полей `target_model_id`/`is_active`/`relationship_type` нет).
          </div>
        )}
      </div>

      {/* Relationships List */}
      {relationshipEntries.length > 0 ? (
        <div className="space-y-4">
          {hasAnyModelRelationships ? (
            Object.entries(relationships).map(([relationshipId, relationship]) => {
              const typeInfo = getRelationshipTypeInfo(relationship.relationship_type);
              const isActive = relationship.is_active ?? true; // если поле отсутствует — считаем связь активной
              return (
                <div key={relationshipId} className="p-4 border border-gray-600 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <LinkIcon style={{ width: '1.5rem', height: '1.5rem' }} className="text-blue-400" />
                        <h4 className="font-medium">
                          {relationship.target_model_id != null ? getTargetModelName(relationship.target_model_id) : 'Модель —'}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(isActive)}`}>
                          {isActive ? 'Активна' : 'Неактивна'}
                        </span>
                      </div>
                      {relationship.description && (
                        <p className="text-sm text-gray-400 mb-2">{relationship.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                          {typeInfo.name}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-gray-400">
                          <span>{relationship.source_field}</span>
                          <ArrowRightIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                          <span>{relationship.target_field}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {canEdit && (
                      <>
                      <button
                        onClick={() => handleEditRelationship(relationshipId)}
                        className="btn btn-secondary btn-xs"
                      >
                        <PencilIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                      <button
                        onClick={() => handleDeleteRelationship(relationshipId)}
                        className="btn btn-danger btn-xs"
                      >
                        <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                      </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // Fallback: в `relationships` лежат connection-объекты виджетов ({from, to, fromType, toType, settings})
            Object.entries(relationships).map(([relationshipId, relationship]) => {
              const isActive = relationship.is_active ?? true;
              const from = relationship.from ?? '—';
              const to = relationship.to ?? '—';
              const settings =
                relationship.settings && typeof relationship.settings === 'object' ? relationship.settings : {};
              const selectedFields = Array.isArray(settings.selectedFields) ? settings.selectedFields : [];
              return (
                <div key={relationshipId} className="p-4 border border-gray-600 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <LinkIcon style={{ width: '1.5rem', height: '1.5rem' }} className="text-blue-400" />
                        <h4 className="font-medium">Связь виджетов</h4>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(isActive)}`}>
                          {isActive ? 'Активна' : 'Неактивна'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2 flex items-center gap-2 flex-wrap">
                        <span>{getWidgetLabel(from)}</span>
                        <ArrowRightIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                        <span>{getWidgetLabel(to)}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                          connection
                        </span>
                        <div className="text-sm text-gray-400">
                          {(Array.isArray(selectedFields) && selectedFields.length > 0)
                            ? `selectedFields: ${selectedFields.length}`
                            : 'fields: —'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {canEdit && (
                      <button
                        onClick={() => handleDeleteRelationship(relationshipId)}
                        className="btn btn-danger btn-xs"
                      >
                        <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-600 rounded-lg">
          <LinkIcon style={{ width: '3rem', height: '3rem' }} className="mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-semibold mb-2">Связи не настроены</h4>
          <p className="text-gray-400 mb-4">Создайте связи с другими моделями данных для комплексного анализа</p>
          {canEdit && (
          <button 
            onClick={handleAddRelationship}
            className="btn btn-primary"
          >
            <LinkIcon style={{ width: '1rem', height: '1rem' }} />
            Создать связь
          </button>
          )}
        </div>
      )}

      {/* Relationship Editor Modal */}
      {editingRelationship && hasAnyModelRelationships && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {editingRelationship === 'new' ? 'Новая связь' : 'Редактирование связи'}
              </h3>
              <button
                onClick={() => setEditingRelationship(null)}
                className="text-gray-400 hover:text-gray-300"
              >
                <TrashIcon style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Целевая модель</label>
                <select
                  value={newRelationship.target_model_id}
                  onChange={(e) => setNewRelationship({ ...newRelationship, target_model_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Выберите модель</option>
                  {availableModels
                    .filter(model => model.id !== parseInt(modelId))
                    .map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тип связи</label>
                <select
                  value={newRelationship.relationship_type}
                  onChange={(e) => setNewRelationship({ ...newRelationship, relationship_type: e.target.value })}
                  className="form-input"
                >
                  {relationshipTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Поле источника</label>
                  <input
                    type="text"
                    value={newRelationship.source_field}
                    onChange={(e) => setNewRelationship({ ...newRelationship, source_field: e.target.value })}
                    className="form-input"
                    placeholder="Название поля в текущей модели"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Поле цели</label>
                  <input
                    type="text"
                    value={newRelationship.target_field}
                    onChange={(e) => setNewRelationship({ ...newRelationship, target_field: e.target.value })}
                    className="form-input"
                    placeholder="Название поля в целевой модели"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Описание</label>
                <textarea
                  value={newRelationship.description}
                  onChange={(e) => setNewRelationship({ ...newRelationship, description: e.target.value })}
                  className="form-input"
                  rows="3"
                  placeholder="Описание назначения связи"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newRelationship.is_active}
                  onChange={(e) => setNewRelationship({ ...newRelationship, is_active: e.target.checked })}
                  className="form-checkbox"
                />
                <label htmlFor="is_active" className="text-sm">Активная связь</label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingRelationship(null)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                
                <button
                  onClick={handleSaveRelationship}
                  disabled={!newRelationship.target_model_id || !newRelationship.source_field || !newRelationship.target_field}
                  className="btn btn-primary flex-1"
                >
                  Сохранить связь
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelationshipViewer;


