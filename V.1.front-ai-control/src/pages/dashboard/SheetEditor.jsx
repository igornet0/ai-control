import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CanvasApp } from '../canvas_editor';
import DashboardHeader from './DashboardHeader';
import { sheetService } from '../../services/sheetService';
import { dashboardService } from '../../services/dashboardService';
import { canEditDashboard } from '../../utils/dashboardUtils';
import { useEditMode } from '../../context/EditModeContext';
import styles from './SheetEditor.module.css';

const SheetEditor = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id, sheetId } = useParams();
  const { isEditing } = useEditMode();
  const [forceUpdate, setForceUpdate] = useState(0);
  const [expansionCount, setExpansionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  
  const MAX_EXPANSIONS = 10;

        
  // Проверяем, находимся ли мы на sheet странице
  const isSheetPage = location.pathname.includes('/dashboard/') && location.pathname.includes('/sheet/');
  
  // Загрузка layout_config и проверка прав на редактирование при монтировании
  useEffect(() => {
    const loadSheetLayout = async () => {
      if (!sheetId || !id) return;
      
      try {
        setIsLoading(true);
        
        // Загружаем данные листа
        const sheetData = await sheetService.getSheet(sheetId);
        const sheet = sheetData.sheet || sheetData;
        const layoutConfig = sheet?.layout_config || {};
        const count = layoutConfig.expansionCount || 0;
        setExpansionCount(count);
        
        // Загружаем данные дашборда для проверки прав
        const dashboardData = await dashboardService.getDashboard(id);
        const hasEditPermissions = canEditDashboard(dashboardData, user);
        setCanEdit(hasEditPermissions);
      } catch (error) {
        console.error('Error loading sheet layout:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isSheetPage && sheetId && id) {
      loadSheetLayout();
    }
  }, [sheetId, id, isSheetPage, user]);

  // Принудительно перерендериваем компонент при изменении маршрута
  useEffect(() => {
            setForceUpdate(prev => prev + 1);
  }, [location.pathname, isSheetPage]);

  // Обработчик расширения листа
  const handleExpandSheet = async () => {
    if (!sheetId || !isEditing || expansionCount >= MAX_EXPANSIONS) return;
    
    try {
      setIsSaving(true);
      const sheetData = await sheetService.getSheet(sheetId);
      const sheet = sheetData.sheet || sheetData;
      
      if (!sheet) {
        throw new Error('Sheet not found');
      }
      
      const currentLayoutConfig = sheet.layout_config || {};
      const newExpansionCount = (currentLayoutConfig.expansionCount || 0) + 1;
      
      const updatedLayoutConfig = {
        ...currentLayoutConfig,
        expansionCount: newExpansionCount
      };
      
      // Передаем все поля листа, чтобы не потерять данные
      await sheetService.updateSheet(sheetId, {
        name: sheet.name,
        description: sheet.description || '',
        order_index: sheet.order_index || 0,
        layout_config: updatedLayoutConfig,
        is_active: sheet.is_active !== undefined ? sheet.is_active : true
      });
      
      setExpansionCount(newExpansionCount);
    } catch (error) {
      console.error('Error expanding sheet:', error);
      alert('Ошибка при расширении листа: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
    } finally {
      setIsSaving(false);
    }
  };

  // Обработчик уменьшения листа
  const handleCollapseSheet = async () => {
    if (!sheetId || !isEditing || expansionCount <= 0) return;
    
    try {
      setIsSaving(true);
      const sheetData = await sheetService.getSheet(sheetId);
      const sheet = sheetData.sheet || sheetData;
      
      if (!sheet) {
        throw new Error('Sheet not found');
      }
      
      const currentLayoutConfig = sheet.layout_config || {};
      const newExpansionCount = Math.max(0, (currentLayoutConfig.expansionCount || 0) - 1);
      
      const updatedLayoutConfig = {
        ...currentLayoutConfig,
        expansionCount: newExpansionCount
      };
      
      // Передаем все поля листа, чтобы не потерять данные
      await sheetService.updateSheet(sheetId, {
        name: sheet.name,
        description: sheet.description || '',
        order_index: sheet.order_index || 0,
        layout_config: updatedLayoutConfig,
        is_active: sheet.is_active !== undefined ? sheet.is_active : true
      });
      
      setExpansionCount(newExpansionCount);
    } catch (error) {
      console.error('Error collapsing sheet:', error);
      alert('Ошибка при уменьшении листа: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
    } finally {
      setIsSaving(false);
    }
  };

  // Если мы не на sheet странице, не рендерим компонент
  if (!isSheetPage) {
        return null;
  }
  
  return (
    <div className={styles.sheetEditor}>
      <DashboardHeader 
        isAuthenticated={!!user} 
        canEditDashboard={canEdit}
      />
      <div 
        className={styles.canvasContainer}
        style={{
          height: `calc(100vh - 80px + ${expansionCount * 300}px)`
        }}
      >
        <CanvasApp 
          key={`canvas-${id}-${sheetId}-${forceUpdate}`}
          user={user}
          onLogout={onLogout}
          dashboardId={id}
          sheetId={sheetId}
          expansionCount={expansionCount}
        />
      </div>
      {isEditing && (
        <div className={styles.sheetControls}>
          {expansionCount < MAX_EXPANSIONS && (
            <button
              className={styles.expandButton}
              onClick={handleExpandSheet}
              disabled={isSaving || isLoading || expansionCount >= MAX_EXPANSIONS}
            >
              {isSaving ? 'Сохранение...' : 'Расширить лист'}
            </button>
          )}
          {expansionCount > 0 && (
            <button
              className={styles.collapseButton}
              onClick={handleCollapseSheet}
              disabled={isSaving || isLoading || expansionCount <= 0}
            >
              {isSaving ? 'Сохранение...' : 'Уменьшить лист'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SheetEditor;
