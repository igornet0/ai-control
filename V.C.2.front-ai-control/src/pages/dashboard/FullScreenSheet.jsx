import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { sheetService } from '../../services/sheetService';
import { widgetService } from '../../services/widgetService';
import styles from './FullScreenSheet.module.css';

const FullScreenSheet = () => {
  const { id, sheetId } = useParams();
  const navigate = useNavigate();
  
  const [sheet, setSheet] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загрузка данных листа
  useEffect(() => {
    const loadSheetData = async () => {
      try {
        setLoading(true);
        
        // Загружаем лист
        const sheetData = await sheetService.getSheet(sheetId);
        setSheet(sheetData.sheet || sheetData);
        
        // Загружаем виджеты листа
        const widgetsData = await widgetService.getSheetWidgets(sheetId);
        setWidgets(widgetsData.widgets || []);
        
      } catch (error) {
        console.error('Error loading sheet data:', error);
        alert('Ошибка загрузки данных листа');
      } finally {
        setLoading(false);
      }
    };

    if (sheetId) {
      loadSheetData();
    }
  }, [sheetId]);

  const handleClose = () => {
    // Закрываем полноэкранный режим
    window.close();
  };

  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.fullScreenContainer}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Загрузка листа...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.fullScreenContainer}>
      {/* Заголовок с кнопкой закрытия */}
      <div className={styles.header}>
        <h1 className={styles.title}>{sheet?.name || 'Лист'}</h1>
        <button
          onClick={handleClose}
          className={styles.closeButton}
          title="Закрыть (Esc)"
        >
          <XMarkIcon style={{ width: '1.5rem', height: '1.5rem' }} />
        </button>
      </div>

      {/* Контент листа */}
      <div className={styles.content}>
        {widgets.length > 0 ? (
          <div className={styles.widgetsGrid}>
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className={styles.widgetContainer}
                style={{
                  gridColumn: `span ${Math.ceil(widget.width / 100)}`,
                  gridRow: `span ${Math.ceil(widget.height / 100)}`,
                  left: widget.position_x,
                  top: widget.position_y
                }}
              >
                <div className={styles.widgetHeader}>
                  <h3 className={styles.widgetTitle}>{widget.name}</h3>
                  <span className={styles.widgetType}>
                    {widget.widget_type.replace('_', ' ')}
                  </span>
                </div>
                
                <div className={styles.widgetContent}>
                  {/* Здесь будет рендеринг виджета */}
                  <div className={styles.widgetPlaceholder}>
                    <p>Виджет: {widget.name}</p>
                    <p>Тип: {widget.widget_type}</p>
                    <p>Размер: {widget.width} × {widget.height}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Виджеты не найдены</p>
            <button
              onClick={() => navigate(`/dashboard/${id}/sheet/${sheetId}`)}
              className="btn btn-primary"
            >
              Добавить виджеты
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullScreenSheet;

