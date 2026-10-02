import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';
import { strategyApiService } from '../../../../services/strategyApiService';
import { employeeService } from '../../../../services/employeeService';
import {
  AICommandBar,
  AIAnalysisPanel,
  GoalEditorModal,
} from './StrategyPrimitives';
import {
  StrategyHeader,
  StrategyOverview,
  CompanyStrategyBlock,
  StrategyMap,
  DepartmentStrategyCardCompact,
} from './StrategyBlocks';
import AIStrategyAgent from './AIStrategyAgent';
import DepartmentStrategyPanel from './DepartmentStrategyPanel';
import StrategyOnboarding, { CompanyContextCard } from './StrategyOnboarding';
import {
  buildStrategyInsights,
  goalsAggregate,
} from './strategyUtils';
import { formatContextPlainText, buildCompanyContextSummary } from './companyProfileSchema';

/**
 * Goal-centric Strategy workspace shared by executive / manager / employee.
 */
export default function StrategyWorkspace({
  mode = 'executive',
  context = null,
}) {
  const canEditCompany = mode === 'executive';
  const managedIds = context?.managed_department_ids || [];
  const ownDeptId = context?.department_id || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState(null);
  const [exists, setExists] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [deptStrategies, setDeptStrategies] = useState({});
  const [profile, setProfile] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [recalcPrompt, setRecalcPrompt] = useState(false);

  const [command, setCommand] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [focusDept, setFocusDept] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ title: '', description: '' });
  const [savingCompany, setSavingCompany] = useState(false);
  const [goalModal, setGoalModal] = useState(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const visibleDepartments = useMemo(() => {
    if (mode === 'executive') return departments;
    if (!ownDeptId) return [];
    return departments.filter((d) => d.id === ownDeptId);
  }, [mode, departments, ownDeptId]);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [csResponse, depts, profileRes, versionsRes] = await Promise.all([
        strategyApiService.getCompanyStrategy(),
        mode === 'executive'
          ? employeeService.getDepartments()
          : ownDeptId
            ? employeeService.getDepartments().then((all) => all.filter((d) => d.id === ownDeptId))
            : Promise.resolve([]),
        strategyApiService.getCompanyProfile().catch(() => ({ exists: false })),
        strategyApiService.getStrategyVersions().catch(() => []),
      ]);
      setExists(Boolean(csResponse.exists));
      setCompany(csResponse.strategy || null);
      setCompanyForm({
        title: csResponse.strategy?.title || '',
        description: csResponse.strategy?.description || '',
      });
      setDepartments(depts);
      setVersions(Array.isArray(versionsRes) ? versionsRes : []);

      const completed = Boolean(profileRes?.profile?.onboarding_completed);
      setProfileCompleted(completed);
      setProfile(profileRes?.profile?.data || null);
      if (canEditCompany && !completed && !csResponse.exists) {
        setShowOnboarding(true);
      }

      const entries = await Promise.all(
        depts.map(async (dept) => {
          try {
            const ds = await strategyApiService.getDeptStrategy(dept.id);
            return [dept.id, ds];
          } catch {
            return [dept.id, null];
          }
        })
      );
      setDeptStrategies(Object.fromEntries(entries));
    } catch {
      setError('Не удалось загрузить стратегию');
    } finally {
      setLoading(false);
    }
  }, [mode, ownDeptId, canEditCompany]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('strategy-ai-command')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const insights = useMemo(
    () =>
      buildStrategyInsights({
        company: exists ? company : null,
        departments: visibleDepartments,
        deptStrategies,
      }),
    [company, exists, visibleDepartments, deptStrategies]
  );

  const companyAgg = goalsAggregate(company?.goals);
  const selectedDept = visibleDepartments.find((d) => d.id === selectedDeptId) || null;
  const canEditSelectedDept =
    mode === 'executive' ||
    (mode === 'manager' &&
      selectedDept &&
      (managedIds.includes(selectedDept.id) || selectedDept.id === ownDeptId));

  const agentContext = useMemo(
    () => ({
      company,
      departments: visibleDepartments,
      deptStrategies,
      insights,
      companyProfile: profile,
      companyContextText: profile
        ? formatContextPlainText(buildCompanyContextSummary(profile))
        : null,
    }),
    [company, visibleDepartments, deptStrategies, insights, profile]
  );

  const askAi = (prompt, dept = null) => {
    setFocusDept(dept);
    setPendingPrompt(prompt || 'Проанализируй текущую стратегию');
  };

  const applyProposal = async (proposal) => {
    if (!proposal) return;

    const createGoalWithActions = async (strategyType, strategyId, g) => {
      const title = String(g.title || '').trim();
      if (!title) return null;
      const created = await strategyApiService.createGoal(strategyType, strategyId, {
        title,
        description: g.description || null,
        due_date: g.due_date || null,
        status: g.status || 'planned',
      });
      const actions = Array.isArray(g.actions) ? g.actions : [];
      for (const action of actions) {
        const actionTitle = String(action.title || action || '').trim();
        if (!actionTitle || !created?.id) continue;
        try {
          await strategyApiService.createMilestone(created.id, {
            title: actionTitle,
            due_date: action.due_date || null,
            done: false,
            create_as_task: false,
          });
        } catch {
          // non-blocking for individual actions
        }
      }
      return created;
    };

    if (proposal.type === 'add_goals') {
      const isDept =
        proposal.strategyType === 'department'
        || Boolean(proposal.departmentId);
      if (isDept) {
        const deptId = proposal.departmentId || focusDept?.id;
        if (!deptId) throw new Error('Не указан отдел для целей');
        const canEdit =
          mode === 'executive'
          || (mode === 'manager' && (managedIds.includes(deptId) || deptId === ownDeptId));
        if (!canEdit) throw new Error('Нет прав на стратегию отдела');
        const ds = await strategyApiService.updateDeptStrategy(deptId, {
          motivation: proposal.motivation || null,
          role_description: proposal.role_description || null,
          scope: proposal.scope || `Стратегия отдела: ${proposal.departmentName || ''}`.trim(),
        });
        const existingTitles = new Set(
          (ds?.goals || []).map((g) => String(g.title || '').trim().toLowerCase())
        );
        for (const g of proposal.goals || []) {
          const title = String(g.title || '').trim();
          if (!title || existingTitles.has(title.toLowerCase())) continue;
          await createGoalWithActions('department', ds.id, g);
        }
        await loadAll();
        setSelectedDeptId(deptId);
        return;
      }

      if (!canEditCompany) throw new Error('Нет прав на изменение целей компании');
      const strategyId = proposal.strategyId || company?.id;
      if (!strategyId) throw new Error('Стратегия компании не найдена');
      const existingTitles = new Set(
        (company?.goals || []).map((g) => String(g.title || '').trim().toLowerCase())
      );
      for (const g of proposal.goals || []) {
        const title = String(g.title || '').trim();
        if (!title || existingTitles.has(title.toLowerCase())) continue;
        await createGoalWithActions('company', strategyId, g);
      }
      await loadAll();
      return;
    }

    if (proposal.type === 'company_strategy') {
      if (!canEditCompany) throw new Error('Нет прав на изменение стратегии компании');
      const res = await strategyApiService.updateCompanyStrategy({
        title: proposal.title,
        description: proposal.description || null,
      });
      const strategyId = res?.strategy?.id;
      const existing = res?.strategy?.goals || [];
      const existingTitles = new Set(
        existing.map((g) => String(g.title || '').trim().toLowerCase())
      );
      const shouldAddGoals =
        strategyId &&
        Array.isArray(proposal.goals) &&
        proposal.goals.length &&
        (proposal.mergeGoals || !existing.length);
      if (shouldAddGoals) {
        for (const g of proposal.goals) {
          const title = String(g.title || '').trim();
          if (!title || existingTitles.has(title.toLowerCase())) continue;
          await createGoalWithActions('company', strategyId, g);
        }
      }
      try {
        await strategyApiService.createStrategyVersion({
          strategy_id: strategyId || null,
          source: proposal.source || 'ai',
          title: proposal.title,
          snapshot: {
            title: proposal.title,
            description: proposal.description,
            goals: proposal.goals || [],
          },
          note: proposal.source === 'onboarding'
            ? 'AI-generated from Company Context'
            : 'AI-generated recommendation',
        });
      } catch {
        // non-blocking
      }
      await loadAll();
      setShowOnboarding(false);
      return;
    }
    if (proposal.type === 'department_strategy') {
      const deptId = proposal.departmentId || focusDept?.id;
      const canEdit =
        mode === 'executive' ||
        (mode === 'manager' && (managedIds.includes(deptId) || deptId === ownDeptId));
      if (!canEdit) throw new Error('Нет прав на стратегию отдела');
      if (!deptId) throw new Error('Не указан отдел');
      const ds = await strategyApiService.updateDeptStrategy(deptId, {
        motivation: proposal.motivation || null,
        role_description: proposal.role_description || null,
        scope: proposal.scope || null,
      });
      const existingTitles = new Set(
        (ds?.goals || []).map((g) => String(g.title || '').trim().toLowerCase())
      );
      if (ds?.id && Array.isArray(proposal.goals)) {
        for (const g of proposal.goals) {
          const title = String(g.title || '').trim();
          if (!title || existingTitles.has(title.toLowerCase())) continue;
          await createGoalWithActions('department', ds.id, g);
        }
      }
      await loadAll();
      setSelectedDeptId(deptId);
      return;
    }
    await loadAll();
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await strategyApiService.updateCompanyStrategy({
        title: companyForm.title,
        description: companyForm.description || null,
      });
      setEditingCompany(false);
      await loadAll();
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSavingCompany(false);
    }
  };

  const openNewGoal = () => {
    if (!canEditCompany) return;
    if (!company?.id) {
      alert('Сначала сохраните стратегию компании — затем можно добавлять цели.');
      return;
    }
    setGoalModal({ title: '', description: '', due_date: '', status: 'planned' });
  };

  const openEditGoal = (g) => {
    if (!canEditCompany || !g) return;
    setGoalModal({
      id: g.id,
      title: g.title || '',
      description: g.description || '',
      due_date: g.due_date ? String(g.due_date).slice(0, 10) : '',
      status: g.status || 'planned',
    });
  };

  const saveCompanyGoal = async (e) => {
    e.preventDefault();
    if (!goalModal) return;
    if (!company?.id) {
      alert('Стратегия компании не найдена');
      return;
    }
    const title = String(goalModal.title || '').trim();
    if (!title) {
      alert('Укажите название цели');
      return;
    }
    setSavingGoal(true);
    try {
      const payload = {
        title,
        description: String(goalModal.description || '').trim() || null,
        due_date: goalModal.due_date || null,
        status: goalModal.status || 'planned',
      };
      if (goalModal.id) {
        await strategyApiService.updateGoal(goalModal.id, payload);
      } else {
        await strategyApiService.createGoal('company', company.id, payload);
      }
      setGoalModal(null);
      await loadAll();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : 'Ошибка сохранения цели');
    } finally {
      setSavingGoal(false);
    }
  };

  const deleteCompanyGoal = async () => {
    if (!goalModal?.id) return;
    if (!window.confirm('Удалить эту цель и связанные действия?')) return;
    setSavingGoal(true);
    try {
      await strategyApiService.deleteGoal(goalModal.id);
      setGoalModal(null);
      await loadAll();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : 'Ошибка удаления цели');
    } finally {
      setSavingGoal(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка стратегии...</div>;
  }
  if (error) {
    return <div className={styles.errorBox}>{error}</div>;
  }

  if (canEditCompany && showOnboarding && !skipOnboarding) {
    return (
      <div className={styles.root}>
        <StrategyHeader
          active={Boolean(exists)}
          canEdit={canEditCompany}
          onAskAi={() => {}}
          onAddGoal={() => {}}
        />
        <StrategyOnboarding
          initialData={profile}
          canEdit={canEditCompany}
          onSkip={() => {
            setSkipOnboarding(true);
            setShowOnboarding(false);
          }}
          onCompleted={async (data) => {
            setProfile(data);
            setProfileCompleted(true);
            await loadAll();
            setShowOnboarding(false);
            if (exists) setRecalcPrompt(true);
          }}
          onGenerateStrategy={async (proposal) => {
            try {
              await applyProposal(proposal);
            } catch (err) {
              alert(err?.message || 'Не удалось создать стратегию');
            }
          }}
        />
      </div>
    );
  }

  if (!exists && !editingCompany) {
    return (
      <div className={styles.root}>
        <StrategyHeader
          active={false}
          canEdit={canEditCompany}
          onAskAi={() => {
            if (canEditCompany && !profileCompleted) {
              setSkipOnboarding(false);
              setShowOnboarding(true);
            } else {
              askAi('Создай стратегию развития компании на следующий квартал');
            }
          }}
          onAddGoal={() => canEditCompany && setEditingCompany(true)}
        />
        {canEditCompany && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.btnAi}
              onClick={() => {
                setSkipOnboarding(false);
                setShowOnboarding(true);
              }}
            >
              <SparklesIcon className={styles.ico} aria-hidden />
              Настроить контекст компании
            </button>
            <button type="button" className={styles.btn} onClick={() => setEditingCompany(true)}>
              Создать стратегию вручную
            </button>
          </div>
        )}
        {!canEditCompany && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon} aria-hidden>
              <SparklesIcon />
            </div>
            <h2 className={styles.emptyTitle}>Стратегия ещё не настроена</h2>
            <p className={styles.emptyText}>Ожидаем заполнение контекста и стратегии руководством.</p>
          </div>
        )}
        <div className={styles.layout} data-strategy-layout="true">
          <div className={styles.mainCol}>
            {profileCompleted && profile && (
              <CompanyContextCard
                profileData={profile}
                canEdit={canEditCompany}
                onEdit={() => {
                  setSkipOnboarding(false);
                  setShowOnboarding(true);
                }}
                versions={versions}
              />
            )}
          </div>
        </div>
        <AIStrategyAgent
          context={agentContext}
          focusDept={focusDept}
          pendingPrompt={pendingPrompt}
          onConsumePrompt={() => setPendingPrompt(null)}
          onApplyProposal={applyProposal}
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <StrategyHeader
        active={exists}
        canEdit={canEditCompany}
        onAskAi={() => askAi('Какие цели сейчас под угрозой?')}
        onAddGoal={openNewGoal}
      />

      <AICommandBar
        value={command}
        onChange={setCommand}
        placeholder="Какие цели сейчас под угрозой?"
        onSubmit={() => {
          if (!command.trim()) return;
          askAi(command.trim());
          setCommand('');
        }}
      />

      <div className={styles.layout} data-strategy-layout="true">
        <div className={styles.mainCol}>
          {mode === 'executive' && (
            <AIAnalysisPanel
              insights={insights}
              onOpenDept={(id) => setSelectedDeptId(id)}
              onOpenGoal={(g) => openEditGoal(g)}
            />
          )}

          {mode === 'executive' && (
            <StrategyOverview
              companyAgg={companyAgg}
              deptCount={visibleDepartments.length}
              insight={insights[0]}
              onAskAi={() => askAi(insights[0]?.title || 'Разобрать стратегию')}
            />
          )}

          {profile && (
            <CompanyContextCard
              profileData={profile}
              canEdit={canEditCompany}
              onEdit={() => {
                if (exists) setRecalcPrompt(true);
                setSkipOnboarding(false);
                setShowOnboarding(true);
              }}
              versions={versions}
            />
          )}

          {recalcPrompt && (
            <div className={styles.proposal}>
              <p className={styles.proposalTitle}>Информация о компании изменилась</p>
              <p className={styles.analysisBody}>
                Пересчитать стратегические рекомендации AI?
              </p>
              <div className={styles.proposalActions}>
                <button
                  type="button"
                  className={styles.btnAi}
                  onClick={() => {
                    setRecalcPrompt(false);
                    askAi('На основе обновлённого Company Context предложи обновлённую стратегию компании');
                  }}
                >
                  Пересчитать
                </button>
                <button type="button" className={styles.btn} onClick={() => setRecalcPrompt(false)}>
                  Оставить текущую стратегию
                </button>
              </div>
            </div>
          )}

          <CompanyStrategyBlock
            strategy={company}
            canEdit={canEditCompany}
            editing={editingCompany}
            form={companyForm}
            setForm={setCompanyForm}
            saving={savingCompany}
            onEdit={() => setEditingCompany(true)}
            onCancel={() => setEditingCompany(false)}
            onSave={saveCompany}
            onImproveAi={() => askAi('Улучши стратегию компании и предложи цели')}
            onAddGoal={openNewGoal}
            onEditGoal={openEditGoal}
            onChanged={loadAll}
          />

          {mode === 'executive' && (
            <StrategyMap
              company={company}
              departments={visibleDepartments}
              deptStrategies={deptStrategies}
            />
          )}

          <section>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>
                {mode === 'executive' ? 'Отделы' : 'Стратегия отдела'}
              </h3>
            </div>
            <div className={styles.deptGrid}>
              {visibleDepartments.map((dept) => (
                <DepartmentStrategyCardCompact
                  key={dept.id}
                  department={dept}
                  strategy={deptStrategies[dept.id]}
                  onOpen={() => setSelectedDeptId(dept.id)}
                  onAskAi={() => askAi(`Проанализируй отдел ${dept.name}`, dept)}
                />
              ))}
              {!visibleDepartments.length && (
                <p className={styles.muted}>Нет доступных отделов.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <AIStrategyAgent
        context={agentContext}
        focusDept={focusDept}
        pendingPrompt={pendingPrompt}
        onConsumePrompt={() => setPendingPrompt(null)}
        onApplyProposal={applyProposal}
      />

      {selectedDept && (
        <DepartmentStrategyPanel
          department={selectedDept}
          strategy={deptStrategies[selectedDept.id]}
          canEdit={Boolean(canEditSelectedDept) || mode === 'executive'}
          onClose={() => setSelectedDeptId(null)}
          onChanged={loadAll}
          onAskAi={() => {
            askAi(`Проанализируй отдел ${selectedDept.name}`, selectedDept);
            setSelectedDeptId(null);
          }}
        />
      )}

      {goalModal && canEditCompany && (
        <GoalEditorModal
          goal={goalModal}
          saving={savingGoal}
          title={goalModal.id ? 'Изменить цель компании' : 'Новая цель компании'}
          onChange={setGoalModal}
          onSave={saveCompanyGoal}
          onCancel={() => setGoalModal(null)}
          onDelete={goalModal.id ? deleteCompanyGoal : undefined}
        />
      )}
    </div>
  );
}
