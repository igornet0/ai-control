/**
 * Example formula templates for the Formula widget properties panel.
 * Expressions use source field names; DataCode codegen maps the primary field to `v`.
 */

function fieldNames(availableFields = []) {
  return (availableFields || [])
    .map((f) => (typeof f === 'string' ? f : f?.name))
    .filter(Boolean);
}

function pickNumericish(fields) {
  const preferred = fields.filter((name) =>
    /amount|price|qty|quantity|sum|total|cost|count|value|score|rate|percent|num|id/i.test(name),
  );
  return preferred.length ? preferred : fields;
}

/**
 * @param {Array<string|{name:string}>} availableFields
 * @returns {Array<{ id: string, label: string, hint: string, name: string, expression: string }>}
 */
export function buildFormulaTemplates(availableFields = []) {
  const fields = fieldNames(availableFields);
  const numeric = pickNumericish(fields);
  const a = numeric[0] || 'amount';
  const b = numeric[1] || (fields.find((f) => f !== a) || 'qty');

  const templates = [
    {
      id: 'vat',
      label: '× 1.2 (НДС)',
      hint: `${a} * 1.2`,
      name: `${a}_vat`,
      expression: `${a} * 1.2`,
    },
    {
      id: 'double',
      label: '× 2',
      hint: `${a} * 2`,
      name: `${a}_x2`,
      expression: `${a} * 2`,
    },
    {
      id: 'percent',
      label: '÷ 100',
      hint: `${a} / 100`,
      name: `${a}_pct`,
      expression: `${a} / 100`,
    },
    {
      id: 'negate',
      label: 'Минус',
      hint: `-${a}`,
      name: `${a}_neg`,
      expression: `-${a}`,
    },
  ];

  if (a && b && a !== b) {
    templates.push(
      {
        id: 'sum',
        label: 'Сумма полей',
        hint: `${a} + ${b}`,
        name: `${a}_plus_${b}`,
        expression: `${a} + ${b}`,
      },
      {
        id: 'diff',
        label: 'Разница',
        hint: `${a} - ${b}`,
        name: `${a}_minus_${b}`,
        expression: `${a} - ${b}`,
      },
      {
        id: 'product',
        label: 'Произведение',
        hint: `${a} * ${b}`,
        name: `${a}_times_${b}`,
        expression: `${a} * ${b}`,
      },
    );
  } else {
    templates.push({
      id: 'sum_example',
      label: 'Сумма полей',
      hint: 'amount + qty',
      name: 'total',
      expression: 'amount + qty',
    });
  }

  templates.push(
    {
      id: 'const',
      label: 'Константа',
      hint: '1',
      name: 'flag',
      expression: '1',
    },
    {
      id: 'passthrough',
      label: 'Копия поля',
      hint: a,
      name: `${a}_copy`,
      expression: a,
    },
  );

  return templates;
}
