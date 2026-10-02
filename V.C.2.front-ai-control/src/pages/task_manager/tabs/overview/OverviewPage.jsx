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

export default function OverviewPage({ user }) {
  const model = useOverviewLiveState(user);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
          <OverviewIcon size="lg" className="text-cyan-400" />
          Обзор
        </h1>
        <div className="text-sm text-slate-400 hidden lg:flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
          Настройте порядок и размер виджетов ниже
        </div>
      </div>

      {model.loading ? (
        <div className="text-slate-400 mt-8">Загрузка...</div>
      ) : (
        <div className="mt-8">
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
