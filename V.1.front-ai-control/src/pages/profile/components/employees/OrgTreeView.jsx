import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../../services/employeeService';
import EmployeeHoverTrigger from './EmployeeHoverTrigger';

function TreeNode({ node, depth = 0, onSelect }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children?.length > 0;

  return (
    <div className="ml-0" style={{ marginLeft: depth * 16 }}>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-700/30 cursor-pointer"
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect?.(node);
        }}
      >
        {hasChildren && (
          <span className="text-slate-400 w-4">{expanded ? '▼' : '▶'}</span>
        )}
        {!hasChildren && <span className="w-4" />}
        <div className="flex-1">
          <span className="text-white font-medium">{node.name}</span>
          <span className="text-slate-500 text-xs ml-2">
            {node.employee_count} сотр. · {node.team_count} команд
          </span>
          {node.manager_name && (
            <span className="text-slate-400 text-xs ml-2">· {node.manager_name}</span>
          )}
        </div>
      </div>
      {expanded && node.teams?.length > 0 && (
        <div className="ml-8 mb-2">
          {node.teams.map((t) => (
            <div key={t.id} className="text-sm text-indigo-300 py-0.5">↳ Команда: {t.name}</div>
          ))}
        </div>
      )}
      {expanded && node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function OrgTreeView() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptEmployees, setDeptEmployees] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeService.getOrgTree()
      .then(setTree)
      .catch(() => setError('Ошибка загрузки дерева отделов'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectDept = async (node) => {
    setSelectedDept(node);
    try {
      const emps = await employeeService.getEmployees({ department_id: node.id });
      setDeptEmployees(emps);
    } catch {
      setDeptEmployees([]);
    }
  };

  if (loading) return <p className="text-slate-400">Загрузка оргструктуры...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Оргструктура компании</h2>
      <p className="text-slate-400 text-sm mb-6">Дерево отделов, команд и сотрудников</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-muted)', background: 'var(--gradient-surface)' }}>
          <h3 className="text-white font-semibold mb-3">Отделы</h3>
          {tree.length === 0 ? (
            <p className="text-slate-500">Отделы не созданы</p>
          ) : (
            tree.map((node) => (
              <TreeNode key={node.id} node={node} onSelect={handleSelectDept} />
            ))
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-muted)', background: 'var(--gradient-surface)' }}>
          <h3 className="text-white font-semibold mb-3">
            {selectedDept ? `Сотрудники: ${selectedDept.name}` : 'Выберите отдел'}
          </h3>
          {selectedDept && deptEmployees.length === 0 && (
            <p className="text-slate-500">Нет сотрудников в отделе</p>
          )}
          <div className="space-y-2">
            {deptEmployees.map((emp) => (
              <div key={emp.id} className="flex justify-between text-sm py-2 border-b border-slate-700/50">
                <EmployeeHoverTrigger employee={emp} className="inline-block">
                  <span className="text-white hover:text-indigo-300 transition-colors">{emp.name}</span>
                </EmployeeHoverTrigger>
                <span className="text-slate-400">{emp.team_role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
