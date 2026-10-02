import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  CheckIcon,
  ChartBarIcon,
  TableCellsIcon,
  DocumentTextIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { widgetService } from '../../services/widgetService';
import { dataModelService } from '../../services/dataModelService';
import styles from './WidgetEditor.module.css';

const WidgetEditor = () => {
  const navigate = useNavigate();
  const { id, sheetId, widgetId } = useParams();
  
  const [widget, setWidget] = useState(null);
  const [dataModels, setDataModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Форма виджета
  const [formData, setFormData] = useState({
    name: '',
    widget_type: '',
    data_source: '',
    data_config: {},
    position_x: 0,
    position_y: 0,
    width: 400,
    height: 300,
    refresh_interval: 60
  });

  const widgetTypes = [
    { id: 'bar_chart', name: 'Столбчатая диаграмма', icon: ChartBarIcon },
    { id: 'line_chart', name: 'Линейный график', icon: ChartBarIcon },
    { id: 'pie_chart', name: 'Круговая диаграмма', icon: ChartBarIcon },
    { id: 'table', name: 'Таблица', icon: TableCellsIcon },
    { id: 'rect', name: 'Прямоугольник', icon: DocumentTextIcon },
    { id: 'container', name: 'Контейнер', icon: DocumentTextIcon },
    { id: 'filter', name: 'Фильтр', icon: Cog6ToothIcon },
  ];

  // Загрузка данных виджета
  useEffect(() => {
    const loadWidgetData = async () => {
      try {
        setLoading(true);
        
        // Загружаем виджет
        const widgetData = await widgetService.getWidget(widgetId);
        setWidget(widgetData.widget);
        
        // Устанавливаем данные формы
        setFormData({
          name: widgetData.widget.name || '',
          widget_type: widgetData.widget.widget_type || '',
          data_source: widgetData.widget.data_source || '',
          data_config: widgetData.widget.data_config || {},
          position_x: widgetData.widget.position_x || 0,
          position_y: widgetData.widget.position_y || 0,
          width: widgetData.widget.width || 400,
          height: widgetData.widget.height || 300,
          refresh_interval: widgetData.widget.refresh_interval || 60
        });
        
        // Загружаем модели данных
        const dataModelsData = await dataModelService.getDataModels();
        setDataModels(dataModelsData.data_models || []);
        
      } catch (error) {
        console.error('Error loading widget data:', error);
        alert('Ошибка загрузки данных виджета');
      } finally {
        setLoading(false);
      }
    };

    if (widgetId) {
      loadWidgetData();
    }
  }, [widgetId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfigChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      data_config: {
        ...prev.data_config,
        [field]: value
      }
    }));
  };

  const saveWidget = async () => {
    try {
      setSaving(true);
      await widgetService.updateWidget(widgetId, formData);
      alert('Виджет успешно сохранен!');
    } catch (error) {
      console.error('Error saving widget:', error);
      alert('Ошибка сохранения виджета');
    } finally {
      setSaving(false);
    }
  };

  const renderConfigFields = () => {
    const { widget_type, data_config } = formData;
    
    switch (widget_type) {
      case 'bar_chart':
      case 'line_chart':
      case 'pie_chart':
        return (
          <div className={styles.configSection}>
            <h3 className={styles.configTitle}>Настройки графика</h3>
            <div className={styles.configGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Данные (через запятую)</label>
                <input
                  type="text"
                  value={Array.isArray(data_config.data) ? data_config.data.join(', ') : ''}
                  onChange={(e) => {
                    const values = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                    handleConfigChange('data', values);
                  }}
                  className={styles.input}
                  placeholder="10, 20, 30, 40"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Подписи (через запятую)</label>
                <input
                  type="text"
                  value={Array.isArray(data_config.labels) ? data_config.labels.join(', ') : ''}
                  onChange={(e) => {
                    const labels = e.target.value.split(',').map(l => l.trim()).filter(l => l);
                    handleConfigChange('labels', labels);
                  }}
                  className={styles.input}
                  placeholder="Q1, Q2, Q3, Q4"
                />
              </div>
            </div>
          </div>
        );
        
      case 'table':
        return (
          <div className={styles.configSection}>
            <h3 className={styles.configTitle}>Настройки таблицы</h3>
            <div className={styles.configGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Колонки (через запятую)</label>
                <input
                  type="text"
                  value={Array.isArray(data_config.columns) ? data_config.columns.join(', ') : ''}
                  onChange={(e) => {
                    const columns = e.target.value.split(',').map(c => c.trim()).filter(c => c);
                    handleConfigChange('columns', columns);
                  }}
                  className={styles.input}
                  placeholder="Name, Value, Status"
                />
              </div>
            </div>
          </div>
        );
        
      case 'rect':
        return (
          <div className={styles.configSection}>
            <h3 className={styles.configTitle}>Настройки прямоугольника</h3>
            <div className={styles.configGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Текст</label>
                <input
                  type="text"
                  value={data_config.text || ''}
                  onChange={(e) => handleConfigChange('text', e.target.value)}
                  className={styles.input}
                  placeholder="Введите текст"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Цвет фона</label>
                <input
                  type="color"
                  value={data_config.backgroundColor || '#32e87f'}
                  onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
                  className={styles.colorInput}
                />
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className={styles.configSection}>
            <p className={styles.noConfig}>Для данного типа виджета дополнительные настройки не требуются.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className={styles.widgetEditor}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
            <div style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)' }}>
              Загрузка виджета...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.widgetEditor}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            onClick={() => navigate(`/dashboard/${id}/sheet/${sheetId}`)}
            className="btn btn-secondary"
          >
            <ArrowLeftIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            Назад к листу
          </button>
          <h1 className={styles.title}>
            Настройка виджета: {widget?.name || 'Новый виджет'}
          </h1>
          <button
            onClick={saveWidget}
            disabled={saving}
            className="btn btn-primary"
          >
            <CheckIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>

        <div className={styles.editorGrid}>
          {/* Основные настройки */}
          <div className={styles.settingsPanel}>
            <h2 className={styles.panelTitle}>Основные настройки</h2>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Название виджета</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={styles.input}
                placeholder="Введите название виджета"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Тип виджета</label>
              <select
                value={formData.widget_type}
                onChange={(e) => handleInputChange('widget_type', e.target.value)}
                className={styles.select}
                disabled
              >
                <option value="">Выберите тип виджета</option>
                {widgetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Источник данных</label>
              <select
                value={formData.data_source}
                onChange={(e) => handleInputChange('data_source', e.target.value)}
                className={styles.select}
              >
                <option value="">Статические данные</option>
                {dataModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Интервал обновления (секунды)</label>
              <input
                type="number"
                value={formData.refresh_interval}
                onChange={(e) => handleInputChange('refresh_interval', parseInt(e.target.value))}
                className={styles.input}
                min="10"
                max="3600"
              />
            </div>
          </div>

          {/* Настройки размера и позиции */}
          <div className={styles.settingsPanel}>
            <h2 className={styles.panelTitle}>Размер и позиция</h2>
            
            <div className={styles.configGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>X позиция</label>
                <input
                  type="number"
                  value={formData.position_x}
                  onChange={(e) => handleInputChange('position_x', parseInt(e.target.value))}
                  className={styles.input}
                  min="0"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Y позиция</label>
                <input
                  type="number"
                  value={formData.position_y}
                  onChange={(e) => handleInputChange('position_y', parseInt(e.target.value))}
                  className={styles.input}
                  min="0"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Ширина</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => handleInputChange('width', parseInt(e.target.value))}
                  className={styles.input}
                  min="100"
                  max="800"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Высота</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', parseInt(e.target.value))}
                  className={styles.input}
                  min="100"
                  max="600"
                />
              </div>
            </div>
          </div>

          {/* Настройки конфигурации */}
          <div className={styles.settingsPanel}>
            <h2 className={styles.panelTitle}>Конфигурация данных</h2>
            {renderConfigFields()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetEditor;
