import React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import Avatar from '../../../../components/Avatar';
import { useAuth } from '../../../../context/AuthContext';
import { requestDirectMessage } from '../../../../services/messagingNavigation';

function buildDescription(employee) {
  if (employee?.description?.trim()) {
    return employee.description.trim();
  }
  const parts = [];
  if (employee?.team_role) parts.push(employee.team_role);
  if (employee?.department_name) parts.push(employee.department_name);
  return parts.length > 0 ? parts.join(' · ') : 'Описание не указано';
}

export default function EmployeeHoverCard({ employee, loading = false }) {
  const { user: currentUser } = useAuth();

  if (!employee && !loading) return null;

  const name = employee?.name || '—';
  const canMessage = employee?.id && employee.id !== currentUser?.id;

  const handleMessage = (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestDirectMessage(employee.id);
  };

  return (
    <div
      className="w-72 rounded-xl border border-slate-600/80 bg-slate-900/95 backdrop-blur-md shadow-2xl p-4 pointer-events-auto"
      style={{ background: 'var(--gradient-surface)' }}
    >
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-4">Загрузка...</p>
      ) : (
        <>
          <div className="flex items-start gap-3 mb-3">
            <Avatar
              src={employee?.avatar}
              name={name}
              preset="avatar_md"
              className="w-14 h-14 border-2 border-slate-600/50 bg-gradient-to-br from-indigo-500 to-purple-600 text-lg"
              alt={name}
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-white leading-tight truncate">{name}</h4>
              {employee?.is_online && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  онлайн
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Email</p>
              <p className="text-slate-200 break-all">{employee?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Телефон</p>
              <p className="text-slate-200">{employee?.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Описание</p>
              <p className="text-slate-300 text-sm leading-relaxed">{buildDescription(employee)}</p>
            </div>
          </div>

          {canMessage && (
            <button
              type="button"
              onClick={handleMessage}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/25 hover:border-indigo-400/60"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4 shrink-0" />
              Написать сообщение
            </button>
          )}
        </>
      )}
    </div>
  );
}
