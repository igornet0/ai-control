/**
 * Parse / clean AI Strategy Agent replies: markdown body + applyable proposals.
 */

function normalizeGoal(g, fallbackDescription = null) {
  if (!g) return null;
  if (typeof g === 'string') {
    const title = g.trim();
    return title ? { title, description: fallbackDescription, status: 'planned', due_date: null, actions: [] } : null;
  }
  const title = String(g.title || '').trim();
  if (!title) return null;
  const actions = [];
  const rawActions = g.actions || g.milestones || g.items || [];
  if (Array.isArray(rawActions)) {
    for (const a of rawActions) {
      if (typeof a === 'string' && a.trim()) {
        actions.push({ title: a.trim(), due_date: null });
      } else if (a && typeof a === 'object' && String(a.title || '').trim()) {
        actions.push({
          title: String(a.title).trim(),
          due_date: a.due_date || null,
        });
      }
    }
  }
  return {
    title,
    description: g.description || g.metric || fallbackDescription || null,
    due_date: g.due_date || null,
    status: g.status || 'planned',
    actions,
  };
}

function isProposalLike(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Boolean(
    obj.type
    || obj.goals
    || obj.title
    || obj.items
    || obj.description
    || obj.departmentId
    || obj.department_id
  );
}

function collectGoals(parts) {
  const goals = [];
  const seen = new Set();
  const pushGoal = (g) => {
    const n = normalizeGoal(g);
    if (!n) return;
    const key = n.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    goals.push(n);
  };

  for (const part of parts) {
    if (Array.isArray(part.goals)) part.goals.forEach(pushGoal);
    if (part.type === 'add_goals' && !part.goals?.length && part.title) {
      pushGoal({
        title: part.title,
        description: part.description || null,
        status: 'planned',
      });
    }
  }
  return goals;
}

function mergeProposalParts(parts, fallback = null) {
  const list = (Array.isArray(parts) ? parts : [parts]).filter(isProposalLike);
  if (!list.length) return fallback;

  const company = list.find((p) => p.type === 'company_strategy');
  const dept = list.find((p) => p.type === 'department_strategy');
  const addGoals = list.filter((p) => p.type === 'add_goals');
  const kpi = list.find((p) => p.type === 'kpi_suggestions');
  const plan = list.find((p) => p.type === 'action_plan');
  const goals = collectGoals(list);

  if (company) {
    return {
      ...fallback,
      ...company,
      type: 'company_strategy',
      title: company.title || fallback?.title,
      description: company.description ?? fallback?.description,
      goals: goals.length ? goals : company.goals || fallback?.goals || [],
      mergeGoals: company.mergeGoals !== false,
      source: company.source || 'ai',
    };
  }

  if (dept) {
    return {
      ...fallback,
      ...dept,
      type: 'department_strategy',
      departmentId: dept.departmentId || dept.department_id || fallback?.departmentId,
      departmentName: dept.departmentName || dept.department_name || fallback?.departmentName,
      motivation: dept.motivation ?? fallback?.motivation ?? null,
      role_description: dept.role_description ?? fallback?.role_description ?? null,
      scope: dept.scope ?? fallback?.scope ?? null,
      goals: goals.length ? goals : dept.goals || fallback?.goals || [],
      source: dept.source || 'ai',
    };
  }

  if (addGoals.length || goals.length) {
    const base = addGoals[0] || {};
    const strategyType = base.strategyType || base.strategy_type || fallback?.strategyType || 'company';
    const departmentId = base.departmentId || base.department_id || fallback?.departmentId || null;
    return {
      type: 'add_goals',
      strategyType: departmentId ? 'department' : strategyType,
      strategyId: base.strategyId || base.strategy_id || fallback?.strategyId || null,
      departmentId,
      departmentName: base.departmentName || base.department_name || fallback?.departmentName || null,
      goals,
      mergeGoals: true,
      source: 'ai',
    };
  }

  if (kpi) return { ...fallback, ...kpi, source: 'ai' };
  if (plan) return { ...fallback, ...plan, source: 'ai' };

  const first = list[0];
  return { ...fallback, ...first, source: first.source || 'ai' };
}

export function bindProposalToDepartment(proposal, dept) {
  if (!proposal || !dept?.id) return proposal;
  if (proposal.type === 'company_strategy') return proposal;

  const hasGoals = Array.isArray(proposal.goals) && proposal.goals.length > 0;
  if (
    proposal.type === 'add_goals'
    || proposal.type === 'department_strategy'
    || (hasGoals && !proposal.type)
  ) {
    return {
      ...proposal,
      type: 'department_strategy',
      strategyType: 'department',
      departmentId: proposal.departmentId || dept.id,
      departmentName: proposal.departmentName || dept.name,
      goals: proposal.goals || [],
      source: proposal.source || 'ai',
    };
  }

  return proposal;
}

/** Pull JSON object/array from fenced block or raw trailing JSON. */
export function extractJsonPayload(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const candidates = [];
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(candidates[i]);
    } catch {
      // try next
    }
  }
  return null;
}

export function parseProposalFromAiText(text, localProposal = null) {
  const payload = extractJsonPayload(text);
  if (payload == null) return localProposal;
  return mergeProposalParts(payload, localProposal);
}

/** Remove machine JSON from the human-readable markdown body. */
export function stripProposalJsonFromText(text) {
  let out = String(text || '');
  out = out.replace(/```(?:json)?\s*[\s\S]*?```/gi, '');
  out = out.replace(/\n\s*---\s*\n\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*$/m, '\n');
  out = out.replace(/(\n\s*)(\[[\s\S]*\]|\{[\s\S]*\})\s*$/m, (full, lead, jsonPart) => {
    try {
      JSON.parse(jsonPart);
      return '\n';
    } catch {
      return full;
    }
  });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function prepareAgentDisplayText(text) {
  return stripProposalJsonFromText(text);
}
