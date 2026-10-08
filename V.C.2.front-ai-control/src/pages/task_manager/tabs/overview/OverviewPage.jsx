import React from 'react';
import DraggableGrid from '../../../../components/DraggableGrid';
import { OverviewIcon } from '../../components/TaskManagerIcons';
import {
  OverviewChecklistWidget,
  OverviewNotesWidget,
  OverviewOverdueWidget,
  OverviewPrioritiesWidget,
  OverviewProjectsWidget,
  OverviewScheduleWidget,
  OverviewUpcomingWidget,
  OverviewWidgetModals,
} from './OverviewLiveWidgets';
import { OverviewAiAnalysisWidget } from './OverviewAiAnalysisWidget';
import { OverviewAiChatWidget } from './OverviewAiChatWidget';
import { useOverviewLiveState } from './useOverviewLiveState';
import './overviewWidget.css';
import '../statistics/statisticsWidget.css';

export default function OverviewPage({ user }) {
  const model = useOverviewLiveState(user);

  return (
    <div>
      <header className="stat-page-header">
        <h1 className="stat-page-header__title">
          <OverviewIcon size="lg" className="text-cyan-400" />
          Обзор
        </h1>
        <p className="stat-page-header__subtitle">Приоритеты, сроки, проекты и заметки — всё на одном экране</p>
      </header>

      {model.loading ? (
        <div className="stat-loading">Загрузка…</div>
      ) : (
        <div>
          {model.dataError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {model.dataError}
            </div>
          )}
          {model.overviewSaveError && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {model.overviewSaveError}
            </div>
          )}

          <DraggableGrid user={user} enableDragAndDrop={true}>
            <OverviewPrioritiesWidget cardId="priorities" model={model} />
            <OverviewOverdueWidget cardId="overdue" model={model} />
            <OverviewUpcomingWidget cardId="upcoming" model={model} />
            <OverviewProjectsWidget cardId="projects" model={model} />
            <OverviewNotesWidget cardId="notes" model={model} />
            <OverviewChecklistWidget cardId="checklist" model={model} />
            <OverviewScheduleWidget cardId="time-management" model={model} />
            <OverviewAiAnalysisWidget cardId="ai-analysis" model={model} />
            <OverviewAiChatWidget cardId="ai-chat" model={model} />
          </DraggableGrid>
        </div>
      )}

      <OverviewWidgetModals model={model} />
    </div>
  );
}
