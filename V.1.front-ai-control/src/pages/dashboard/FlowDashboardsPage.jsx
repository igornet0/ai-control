import React from 'react';
import { useParams } from 'react-router-dom';
import ControlPanelWorkspace from './ControlPanelWorkspace';

const FlowDashboardsPage = ({ user, onLogout }) => {
  const { flowId } = useParams();
  return (
    <ControlPanelWorkspace
      defaultSection="flows"
      initialFlowId={flowId || null}
      user={user}
      onLogout={onLogout}
    />
  );
};

export default FlowDashboardsPage;
