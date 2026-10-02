import React, { useEffect, useMemo, useState } from 'react';
import { teamService } from '../../../services/teamService';
import CustomSelect from '../selector/CustomSelect';
import EmployeeSearchPicker from './EmployeeSearchPicker';

const PERSONAL_TEAM_VALUE = 'none';
const UNASSIGNED_VALUE = 'none';

function activeMembers(team) {
  return (team?.members || []).filter((member) => member.is_active !== false);
}

function memberToEmployee(member) {
  if (!member) return null;
  return {
    id: member.user_id,
    name: member.user_name || member.user_email || `Сотрудник #${member.user_id}`,
    email: member.user_email,
  };
}

function mergeTeam(list, team) {
  if (!team?.id) return list;
  const exists = list.some((item) => item.id === team.id);
  if (exists) {
    return list.map((item) => (item.id === team.id ? { ...item, ...team } : item));
  }
  return [...list, team];
}

export default function TaskTeamAssigneeFields({
  teamId = null,
  teamName = '',
  executor = null,
  onTeamChange,
  onExecutorChange,
  disabled = false,
  variant = 'modal',
}) {
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const compact = variant === 'details';

  useEffect(() => {
    let cancelled = false;
    const loadTeams = async () => {
      try {
        setLoadingTeams(true);
        const data = await teamService.getTeams({ include_members: true });
        if (!cancelled) {
          setTeams(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error loading teams:', error);
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    };
    loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!teamId) return undefined;
    if (teams.some((team) => team.id === teamId)) return undefined;

    let cancelled = false;
    teamService.getTeam(teamId)
      .then((team) => {
        if (!cancelled && team) {
          setTeams((prev) => mergeTeam(prev, team));
        }
      })
      .catch((error) => {
        console.error('Error loading team:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, teams]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) || null,
    [teams, teamId],
  );
  const members = useMemo(() => activeMembers(selectedTeam), [selectedTeam]);

  const teamOptions = useMemo(() => {
    const options = [
      { value: PERSONAL_TEAM_VALUE, label: 'Без команды (личная задача)' },
    ];
    const seen = new Set();
    [...teams]
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
      .forEach((team) => {
        seen.add(team.id);
        options.push({
          value: String(team.id),
          label: team.name || `Команда #${team.id}`,
        });
      });
    if (teamId != null && !seen.has(teamId)) {
      options.push({
        value: String(teamId),
        label: teamName || `Команда #${teamId}`,
      });
    }
    return options;
  }, [teams, teamId, teamName]);

  const memberOptions = useMemo(() => ([
    { value: UNASSIGNED_VALUE, label: 'Без исполнителя' },
    ...members.map((member) => ({
      value: String(member.user_id),
      label: member.user_name || member.user_email || `Сотрудник #${member.user_id}`,
    })),
  ]), [members]);

  const handleTeamSelect = (value) => {
    const nextTeamId = value === PERSONAL_TEAM_VALUE ? null : Number(value);
    onTeamChange?.(Number.isNaN(nextTeamId) ? null : nextTeamId);

    if (!nextTeamId) return;
    const nextTeam = teams.find((team) => team.id === nextTeamId);
    const nextMembers = activeMembers(nextTeam);
    if (executor?.id && !nextMembers.some((member) => member.user_id === executor.id)) {
      onExecutorChange?.(null);
    }
  };

  const handleMemberSelect = (value) => {
    if (value === UNASSIGNED_VALUE) {
      onExecutorChange?.(null);
      return;
    }
    const member = members.find((item) => String(item.user_id) === String(value));
    onExecutorChange?.(memberToEmployee(member));
  };

  const labelClass = compact
    ? 'text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block'
    : 'text-slate-300';
  const hintClass = compact
    ? 'block text-[11px] text-slate-500 mt-1'
    : 'block text-xs text-slate-500 mt-0.5 mb-1';

  return (
    <>
      <div className={compact ? '' : 'md:col-span-2'}>
        <label className="block mb-2">
          <span className={labelClass}>Команда</span>
          <span className={hintClass}>
            Командная задача — исполнитель из участников. Личная — любой сотрудник.
          </span>
          <CustomSelect
            options={teamOptions}
            value={teamId == null ? PERSONAL_TEAM_VALUE : String(teamId)}
            onChange={handleTeamSelect}
            disabled={disabled || loadingTeams}
          />
          {loadingTeams && (
            <span className="text-xs text-slate-500 mt-1 block">Загрузка команд…</span>
          )}
        </label>
      </div>

      <div className={compact ? '' : 'md:col-span-2'}>
        <label className="block mb-2">
          <span className={labelClass}>Исполнитель</span>
          {teamId ? (
            <>
              <span className={hintClass}>
                {selectedTeam?.name
                  ? `Участники команды «${selectedTeam.name}»`
                  : 'Выберите сотрудника из команды'}
              </span>
              {members.length === 0 && !loadingTeams ? (
                <div className="mt-1 rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-400">
                  В команде нет участников
                </div>
              ) : (
                <CustomSelect
                  options={memberOptions}
                  value={executor?.id == null ? UNASSIGNED_VALUE : String(executor.id)}
                  onChange={handleMemberSelect}
                  disabled={disabled || loadingTeams || members.length === 0}
                />
              )}
            </>
          ) : (
            <>
              <span className={hintClass}>
                Личная задача — без привязки к команде
              </span>
              <EmployeeSearchPicker
                value={executor}
                onChange={onExecutorChange}
                disabled={disabled}
                placeholder="Выберите сотрудника"
              />
            </>
          )}
        </label>
      </div>
    </>
  );
}
