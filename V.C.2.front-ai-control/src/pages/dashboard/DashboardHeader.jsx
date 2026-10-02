import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEditMode } from '../../context/EditModeContext';
import AdaptiveHeader from '../../components/AdaptiveHeader';
import { dashboardService } from '../../services/dashboardService';
import { publicDashboardLinkApi } from '../../services/publicDashboardLinkApi';
import {
  buildDashboardSheetPath,
  getFlowIdFromLocation,
  flowNavigateState,
  isFlowReadOnlyLocation,
} from '../../services/dashboardSheetNav.js';
import FullScreenIcon from '../../assets/full-screen.svg';
import styles from './DashboardHeader.module.css';

const DashboardHeader = ({ isAuthenticated, canEditDashboard }) => {
  const { isEditing, setIsEditing } = useEditMode();
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);
  /** /dashboard/:id/sheet/:sheetId */
  const isDashboardSheet = pathParts[0] === 'dashboard' && pathParts[2] === 'sheet';
  /** /share/:token/sheet/:sheetId */
  const isShareSheet = pathParts[0] === 'share' && pathParts[2] === 'sheet';
  const dashboardId = isDashboardSheet ? pathParts[1] : null;
  const shareToken = isShareSheet ? pathParts[1] : null;
  const sheetId = (isDashboardSheet || isShareSheet) ? pathParts[3] : null;
  const isFlowReadOnly = isFlowReadOnlyLocation(location);
  const flowId = getFlowIdFromLocation(location);
  const flowState = flowNavigateState(isFlowReadOnly ? flowId : null);

  const [loading, setLoading] = useState(true);
  const [dashboardName, setDashboardName] = useState('');

  // Загрузка информации о дашборде
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        if (isShareSheet && shareToken) {
          const b = await publicDashboardLinkApi.bootstrap(shareToken);
          const name = b?.dashboard?.name;
          setDashboardName(name || 'Панель (по ссылке)');
          return;
        }
        if (isDashboardSheet && dashboardId) {
          const dashboardData = await dashboardService.getDashboard(dashboardId);
          setDashboardName(dashboardData.name || `Панель ${dashboardId}`);
        }
      } catch (error) {
        console.error('Error loading dashboard for header:', error);
      } finally {
        setLoading(false);
      }
    };

    if ((isShareSheet && shareToken) || (isDashboardSheet && dashboardId)) {
      loadDashboard();
    }
  }, [isShareSheet, shareToken, isDashboardSheet, dashboardId]);

  const handleSheetChange = useCallback((e) => {
    const newSheetId = e.target.value;
    if (isShareSheet && shareToken) {
      navigate(buildDashboardSheetPath({ shareToken, sheetId: newSheetId }));
    } else if (dashboardId) {
      navigate(buildDashboardSheetPath({
        dashboardId,
        sheetId: newSheetId,
        flowId: isFlowReadOnly ? flowId : null,
      }), {
        state: flowState,
      });
    }
  }, [isShareSheet, shareToken, dashboardId, navigate, flowState, isFlowReadOnly, flowId]);

  const handleFullScreen = useCallback(() => {
    if (sheetId) {
      // Открываем лист в полноэкранном режиме
      const fullScreenUrl =
        isShareSheet && shareToken
          ? `/share/${encodeURIComponent(shareToken)}/sheet/${sheetId}/fullscreen`
          : `/dashboard/${dashboardId}/sheet/${sheetId}/fullscreen`;
      window.open(fullScreenUrl, '_blank', 'fullscreen=yes');
    }
  }, [isShareSheet, shareToken, dashboardId, sheetId]);

  const handleEditToggle = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, [setIsEditing]);

  const handleDashboardClick = useCallback(() => {
    if (isShareSheet && shareToken) {
      navigate(`/share/${encodeURIComponent(shareToken)}`);
    } else if (dashboardId) {
      navigate(`/dashboard/${dashboardId}`, {
        state: flowState,
      });
    }
  }, [isShareSheet, shareToken, dashboardId, navigate, flowState]);

  const dashboardControls = (
    <div className={styles.dashboardControls}>
      <h3 
        className={styles.dashboardTitle}
        onClick={handleDashboardClick}
        style={{ 
          cursor: 'pointer',
          transition: 'color 0.2s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => e.target.style.color = 'var(--color-accent-primary)'}
        onMouseLeave={(e) => e.target.style.color = 'var(--color-text-primary)'}
        title="Вернуться к редактору панели управления"
      >
        ← {dashboardName}
      </h3>
    </div>
  );

  return (
    <div className={styles.dashboardHeaderContainer}>
      {dashboardControls}
    </div>
  );
};

export default DashboardHeader;