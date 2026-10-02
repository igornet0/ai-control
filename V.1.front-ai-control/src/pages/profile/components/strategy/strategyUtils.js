/** Shared strategy helpers — Goal-centric progress & AI analysis. */

import { buildStrategyProposalFromProfile } from './companyProfileSchema';

export function goalProgress(goal) {
  if (!goal) return 0;
  if (goal.status === 'done') return 100;
  const milestones = goal.milestones || [];
  if (!milestones.length) {
    if (goal.status === 'in_progress') return 45;
    return 8;
  }
  const done = milestones.filter((m) => m.done).length;
  return Math.round((done / milestones.length) * 100);
}

export function goalsAggregate(goals = []) {
  const list = Array.isArray(goals) ? goals : [];
  const total = list.length;
  const done = list.filter((g) => g.status === 'done').length;
  const inProgress = list.filter((g) => g.status === 'in_progress').length;
  const planned = list.filter((g) => g.status === 'planned').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = list.filter(
    (g) => g.status !== 'done' && g.due_date && g.due_date < today
  ).length;
  const actions = list.reduce((n, g) => n + (g.milestones?.length || 0), 0);
  const actionsDone = list.reduce(
    (n, g) => n + (g.milestones || []).filter((m) => m.done).length,
    0
  );
  const progress = total
    ? Math.round(list.reduce((s, g) => s + goalProgress(g), 0) / total)
    : 0;
  return { total, done, inProgress, planned, overdue, actions, actionsDone, progress };
}

export function deptStatus(strategy, goals = []) {
  if (!strategy) return { key: 'empty', label: 'Не настроена', tone: 'muted' };

  const stored = String(strategy.status || '').toLowerCase();
  if (stored === 'attention' || stored === 'at_risk') {
    return { key: 'at_risk', label: 'Требует внимания', tone: 'warn' };
  }
  if (stored === 'draft') {
    return { key: 'draft', label: 'Черновик', tone: 'muted' };
  }
  if (stored === 'active') {
    return { key: 'active', label: 'Активна', tone: 'ok' };
  }

  // Fallback for strategies without saved status
  const agg = goalsAggregate(goals.length ? goals : strategy.goals || []);
  if (agg.overdue > 0) return { key: 'at_risk', label: 'Требует внимания', tone: 'warn' };
  if (agg.total === 0) return { key: 'draft', label: 'Черновик', tone: 'muted' };
  return { key: 'active', label: 'Активна', tone: 'ok' };
}

export const DEPT_STATUS_OPTIONS = [
  { value: 'active', label: 'Активна' },
  { value: 'attention', label: 'Требует внимания' },
  { value: 'draft', label: 'Черновик' },
];

export function extractPriorities(description) {
  if (!description) return [];
  return String(description)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*●]\s+/.test(l))
    .map((l) => l.replace(/^[-•*●]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** Split description into mission paragraph + bullet priorities. */
export function splitStrategyDescription(description) {
  const raw = String(description || '');
  if (!raw.trim()) return { mission: '', priorities: [] };
  const lines = raw.split(/\n/).map((l) => l.trimEnd());
  const priorities = [];
  const missionLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (missionLines.length) missionLines.push('');
      continue;
    }
    if (/^[-•*●]\s+/.test(trimmed)) {
      priorities.push(trimmed.replace(/^[-•*●]\s+/, '').trim());
    } else {
      missionLines.push(trimmed);
    }
  }
  return {
    mission: missionLines.join('\n').trim(),
    priorities: priorities.filter(Boolean).slice(0, 8),
  };
}

/** Heuristic AI insights from live strategy data (no backend required). */
export function buildStrategyInsights({ company, departments = [], deptStrategies = {} }) {
  const insights = [];
  const companyGoals = company?.goals || [];
  const companyAgg = goalsAggregate(companyGoals);

  if (!company) {
    insights.push({
      severity: 'info',
      title: 'Стратегия не настроена',
      body: 'Опишите цель компании — AI поможет превратить её в цели, KPI и действия отделов.',
      action: 'create_strategy',
    });
    return insights;
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueGoals = companyGoals.filter(
    (g) => g.status !== 'done' && g.due_date && g.due_date < today
  );
  if (overdueGoals.length) {
    insights.push({
      severity: 'warn',
      title: 'Просроченные цели компании',
      body: `${overdueGoals.length} цел${overdueGoals.length === 1 ? 'ь' : 'и'} компании просрочены. Рекомендую пересмотреть дедлайны или перераспределить действия.`,
      action: 'review_overdue',
      goals: overdueGoals.map((g) => ({
        id: g.id,
        title: g.title,
        due_date: g.due_date,
        status: g.status,
        description: g.description,
      })),
    });
  }

  const emptyDepts = departments.filter((d) => !deptStrategies[d.id]);
  if (emptyDepts.length) {
    insights.push({
      severity: 'warn',
      title: 'Отделы без стратегии',
      body: 'У этих отделов нет стратегии — связь Company Goal → Department Goal разорвана. Откройте отдел, чтобы настроить.',
      action: 'fill_depts',
      departments: emptyDepts.map((d) => ({ id: d.id, name: d.name })),
    });
  }

  for (const dept of departments) {
    const ds = deptStrategies[dept.id];
    if (!ds) continue;
    const goals = ds.goals || [];
    const agg = goalsAggregate(goals);
    const goalsWithoutActions = goals.filter((g) => !(g.milestones || []).length && g.status !== 'done');
    if (goalsWithoutActions.length) {
      insights.push({
        severity: 'warn',
        title: `${dept.name}: цели без действий`,
        body: `${goalsWithoutActions.length} цел${goalsWithoutActions.length === 1 ? 'ь' : 'и'} без инициатив. Goal → Action → Tasks не заполнена.`,
        departmentId: dept.id,
        action: 'add_actions',
        goals: goalsWithoutActions.map((g) => ({
          id: g.id,
          title: g.title,
          due_date: g.due_date,
          status: g.status,
        })),
      });
    }
    if (agg.progress < 40 && agg.total > 0) {
      insights.push({
        severity: 'warn',
        title: `${dept.name} отстаёт`,
        body: `Прогресс отдела ${agg.progress}%. Основной bottleneck — выполнение целей и связанных действий.`,
        departmentId: dept.id,
        action: 'dept_plan',
      });
    }
  }

  if (!insights.length) {
    insights.push({
      severity: 'ok',
      title: 'Стратегия в рабочем состоянии',
      body: companyAgg.total
        ? `Общий прогресс ${companyAgg.progress}%. Компания движется по плану — можно углубить KPI и связи между отделами.`
        : 'Базовая стратегия задана. Добавьте стратегические цели и свяжите их с отделами.',
      action: 'improve',
    });
  }

  return insights.slice(0, 5);
}

export function buildLocalAgentReply(prompt, ctx = {}) {
  const q = String(prompt || '').toLowerCase();
  const {
    company,
    departments = [],
    deptStrategies = {},
    focusDept = null,
    companyContextText = null,
    companyProfile = null,
  } = ctx;
  const insights = buildStrategyInsights({ company, departments, deptStrategies });
  const companyAgg = goalsAggregate(company?.goals);
  const { mission, priorities } = splitStrategyDescription(company?.description);
  const existingGoalTitles = new Set(
    (company?.goals || []).map((g) => String(g.title || '').trim().toLowerCase())
  );

  const suggestGoals = () => {
    const candidates = [];
    if (companyProfile) {
      const fromProfile = buildStrategyProposalFromProfile(companyProfile);
      (fromProfile.goals || []).forEach((g) => candidates.push(g));
    }
    priorities.forEach((p) => {
      const title = p.length > 60 ? p.slice(0, 57) + '…' : p;
      candidates.push({
        title,
        description: `Стратегический приоритет: ${p}`,
        status: 'planned',
      });
    });
    if (!candidates.length) {
      candidates.push(
        { title: 'Увеличить активных клиентов на 20%', status: 'planned' },
        { title: 'Снизить churn на 10%', status: 'planned' },
        { title: 'Выпустить 3 ключевые функции продукта', status: 'planned' },
      );
    }
    return candidates
      .filter((g) => g.title && !existingGoalTitles.has(g.title.trim().toLowerCase()))
      .slice(0, 5);
  };

  if (/улучш|improve|пересчит|обновл.*стратег/.test(q) && company) {
    const nextGoals = suggestGoals();
    const nextDescription = [
      mission || company.description || company.title,
      ...(priorities.length
        ? priorities.map((p) => `• ${p}`)
        : ['• Рост выручки', '• Развитие продукта', '• Автоматизация процессов'].map((p) => p)),
    ].join('\n');
    return {
      text: [
        `Текущая стратегия: «${company.title}».`,
        `Прогресс ${companyAgg.progress}% · целей ${companyAgg.total} · действий ${companyAgg.actions}.`,
        nextGoals.length
          ? `\nПредлагаю усилить стратегию и добавить ${nextGoals.length} цел${nextGoals.length === 1 ? 'ь' : 'и'} (подтвердите перед записью):`
          : '\nЦели уже покрывают приоритеты. Можно углубить KPI и связи с отделами.',
      ].join(' '),
      proposal: {
        type: 'company_strategy',
        title: company.title,
        description: nextDescription,
        goals: nextGoals,
        mergeGoals: true,
        source: 'ai',
      },
    };
  }

  if (/созда(й|ть).*стратег|настро(й|ить).*стратег|create strategy/.test(q)) {
    if (companyProfile) {
      const proposal = buildStrategyProposalFromProfile(companyProfile);
      return {
        text: companyContextText
          ? `Использую подтверждённый контекст компании.\n\nПредлагаю стратегию на основе ваших ответов (без выдуманных фактов):`
          : 'Предлагаю стратегию на основе профиля компании:',
        proposal: { ...proposal, mergeGoals: !company },
      };
    }
    if (company) {
      return buildLocalAgentReply('Улучши стратегию компании', ctx);
    }
    return {
      text: 'Сначала заполните контекст компании (опросник). Без него AI не должен выдумывать данные о компании.\n\nМогу предложить черновик-шаблон — подтвердите перед записью:',
      proposal: {
        type: 'company_strategy',
        title: 'Рост и устойчивость платформы 2A',
        description: [
          'Создать ведущую BI-платформу для управления бизнесом',
          '• Рост выручки',
          '• Увеличение клиентской базы',
          '• Развитие продукта',
          '• Автоматизация процессов',
        ].join('\n'),
        goals: [
          { title: 'Увеличить активных клиентов на 20%', status: 'planned' },
          { title: 'Снизить churn на 10%', status: 'planned' },
          { title: 'Выпустить 3 ключевые функции продукта', status: 'planned' },
          { title: 'Увеличить автоматизацию внутренних процессов', status: 'planned' },
        ],
        source: 'ai',
      },
    };
  }

  if (/предлож.*цел|добав.*цел|цел(и|ь) компан|propose goals/.test(q)) {
    const goals = suggestGoals();
    if (!company?.id) {
      return {
        text: 'Сначала нужна стратегия компании — тогда смогу предложить цели к ней.',
        proposal: null,
      };
    }
    if (!goals.length) {
      return {
        text: 'Все очевидные цели уже добавлены. Могу найти слабые места или предложить план действий.',
        proposal: null,
      };
    }
    return {
      text: `На основе стратегии «${company.title}» предлагаю добавить цели:`,
      proposal: {
        type: 'add_goals',
        strategyType: 'company',
        strategyId: company.id,
        goals,
        source: 'ai',
      },
    };
  }

  if (/слаб|риск|угроз|bottleneck|отста/.test(q)) {
    const lines = insights
      .filter((i) => i.severity === 'warn')
      .map((i) => `• ${i.title}: ${i.body}`);
    const gaps = [];
    if (company && companyAgg.total === 0) {
      gaps.push('• У стратегии нет целей — Goal → Action цепочка пуста.');
    }
    if (company && companyAgg.actions === 0 && companyAgg.total > 0) {
      gaps.push('• У целей нет действий (milestones).');
    }
    const body = [...gaps, ...lines];
    const gapGoals = company?.id ? suggestGoals() : [];
    return {
      text: body.length
        ? `Нашёл разрывы в цепочке Goal → Actions:\n\n${body.join('\n\n')}${
            gapGoals.length ? '\n\nМогу добавить недостающие цели — нажмите «Предложить цели».' : ''
          }`
        : 'Критических слабых мест не видно. Можно углубить KPI и зависимости между отделами.',
      proposal:
        companyAgg.total === 0 && company?.id
          ? {
              type: 'add_goals',
              strategyType: 'company',
              strategyId: company.id,
              goals: gapGoals.length ? gapGoals : suggestGoals(),
              source: 'ai',
            }
          : null,
    };
  }

  if (/kpi|кпи|метрик/.test(q)) {
    return {
      text: focusDept
        ? `Для отдела «${focusDept.name}» предлагаю KPI:`
        : `Для стратегии «${company?.title || 'компании'}» предлагаю KPI:`,
      proposal: {
        type: 'kpi_suggestions',
        items: focusDept
          ? [
              { name: 'Прогресс целей', value: `${goalsAggregate(deptStrategies[focusDept.id]?.goals).progress}%` },
              { name: 'Действия выполнены', value: String(goalsAggregate(deptStrategies[focusDept.id]?.goals).actionsDone) },
              { name: 'Просроченные цели', value: String(goalsAggregate(deptStrategies[focusDept.id]?.goals).overdue) },
            ]
          : [
              { name: 'Общий прогресс', value: `${companyAgg.progress}%` },
              { name: 'Цели компании', value: String(companyAgg.total) },
              { name: 'Действия', value: String(companyAgg.actions) },
              { name: 'Приоритеты', value: String(priorities.length) },
            ],
      },
    };
  }

  if (/отдел|department|цел(и|ь) отдел/.test(q)) {
    const missing = departments.filter((d) => !deptStrategies[d.id]);
    return {
      text: missing.length
        ? `Без стратегии: ${missing.map((d) => d.name).join(', ')}. Предлагаю шаблон для первого отдела.`
        : 'У отделов есть стратегии. Могу предложить цели, связанные с company goals.',
      proposal: missing[0]
        ? {
            type: 'department_strategy',
            departmentId: missing[0].id,
            departmentName: missing[0].name,
            motivation: `Поддержать стратегию компании: ${company?.title || 'рост и устойчивость'}`,
            role_description: `Отдел «${missing[0].name}» отвечает за свою зону вклада в company goals`,
            scope: 'Операционные инициативы, метрики и задачи команды',
            goals: [
              { title: `Связать цели ${missing[0].name} с company goals`, status: 'planned' },
              { title: 'Закрыть разрыв Goal → Action', status: 'planned' },
            ],
          }
        : null,
    };
  }

  if (/план|следующ|квартал|недел/.test(q)) {
    return {
      text: `На следующий период рекомендую фокус:\n\n${insights
        .slice(0, 3)
        .map((i) => `• ${i.title}`)
        .join('\n')}\n\nПредлагаю 3 действия:`,
      proposal: {
        type: 'action_plan',
        items: [
          companyAgg.total === 0 ? 'Добавить стратегические цели компании' : 'Закрыть просроченные цели компании',
          'Добавить actions к целям без инициатив',
          'Синхронизировать KPI отделов с company goals',
        ],
      },
    };
  }

  const top = insights[0];
  return {
    text: [
      company
        ? `Стратегия «${company.title}»: прогресс ${companyAgg.progress}% · goals ${companyAgg.done}/${companyAgg.total} · actions ${companyAgg.actionsDone}/${companyAgg.actions}.`
        : 'Стратегия компании ещё не задана.',
      top ? `\n\nКлючевой insight: ${top.title}. ${top.body}` : '',
      '\n\nМогу: улучшить стратегию, предложить цели, найти слабые места, проверить отделы или сформировать KPI.',
    ].join(''),
    proposal: null,
  };
}

export function statusLabel(status) {
  if (status === 'done') return 'Выполнено';
  if (status === 'in_progress') return 'В работе';
  return 'Запланировано';
}
