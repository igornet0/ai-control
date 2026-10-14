import React, { useState, useEffect } from 'react';
import { getAccessToken } from '../../../services/tokenRefresh';
import { 
  CalculatorIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  PlayIcon,
  StopIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const FormulaEditor = ({ modelId, formulas = {}, onFormulasChange }) => {
  const [editingFormula, setEditingFormula] = useState(null);
  const [newFormula, setNewFormula] = useState({
    name: '',
    expression: '',
    description: '',
    output_field: '',
    input_fields: []
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const formulaTypes = [
    { id: 'calculation', name: 'Вычисление', description: 'Математические операции' },
    { id: 'transformation', name: 'Преобразование', description: 'Изменение формата данных' },
    { id: 'aggregation', name: 'Агрегация', description: 'Суммирование и группировка' },
    { id: 'validation', name: 'Валидация', description: 'Проверка данных' },
    { id: 'conditional', name: 'Условная', description: 'Логические условия' }
  ];

  const handleAddFormula = () => {
    setEditingFormula('new');
    setNewFormula({
      name: '',
      expression: '',
      description: '',
      output_field: '',
      input_fields: [],
      type: 'calculation'
    });
  };

  const handleEditFormula = (formulaId) => {
    setEditingFormula(formulaId);
    setNewFormula({ ...formulas[formulaId] });
  };

  const handleSaveFormula = async () => {
    try {
      const updatedFormulas = { ...formulas };
      
      if (editingFormula === 'new') {
        const formulaId = `formula_${Date.now()}`;
        updatedFormulas[formulaId] = {
          ...newFormula,
          id: formulaId,
          created: new Date().toISOString(),
          status: 'active'
        };
      } else {
        updatedFormulas[editingFormula] = {
          ...updatedFormulas[editingFormula],
          ...newFormula,
          updated: new Date().toISOString()
        };
      }

      // Сохраняем на сервере
      const response = await fetch(`/api/data-models/${modelId}/formulas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ formulas: updatedFormulas })
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения формул');
      }

      if (onFormulasChange) {
        onFormulasChange(updatedFormulas);
      }

      setEditingFormula(null);
      setNewFormula({
        name: '',
        expression: '',
        description: '',
        output_field: '',
        input_fields: [],
        type: 'calculation'
      });
      
    } catch (error) {
      console.error('Error saving formula:', error);
      alert('Ошибка при сохранении формулы: ' + error.message);
    }
  };

  const handleDeleteFormula = async (formulaId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту формулу?')) {
      return;
    }

    try {
      const updatedFormulas = { ...formulas };
      delete updatedFormulas[formulaId];

      const response = await fetch(`/api/data-models/${modelId}/formulas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ formulas: updatedFormulas })
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления формулы');
      }

      if (onFormulasChange) {
        onFormulasChange(updatedFormulas);
      }
      
    } catch (error) {
      console.error('Error deleting formula:', error);
      alert('Ошибка при удалении формулы: ' + error.message);
    }
  };

  const handleTestFormula = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/data-models/${modelId}/formulas/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ 
          expression: newFormula.expression,
          input_fields: newFormula.input_fields
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка тестирования формулы');
      }

      const result = await response.json();
      setTestResult(result);
      
    } catch (error) {
      console.error('Error testing formula:', error);
      setTestResult({ 
        success: false, 
        error: 'Ошибка при тестировании формулы: ' + error.message 
      });
    } finally {
      setTesting(false);
    }
  };

  const getFormulaTypeInfo = (type) => {
    return formulaTypes.find(t => t.id === type) || formulaTypes[0];
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-500/20 text-green-400',
      'inactive': 'bg-gray-500/20 text-gray-400',
      'error': 'bg-red-500/20 text-red-400'
    };
    return colors[status] || colors['inactive'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Формулы и вычисления</h3>
        <button 
          onClick={handleAddFormula}
          className="btn btn-primary btn-sm"
        >
          <PlusIcon style={{ width: '1rem', height: '1rem' }} />
          Добавить формулу
        </button>
      </div>

      {/* Formulas List */}
      {Object.keys(formulas).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(formulas).map(([formulaId, formula]) => {
            const typeInfo = getFormulaTypeInfo(formula.type);
            return (
              <div key={formulaId} className="p-4 border border-gray-600 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{formula.name}</h4>
                    <p className="text-sm text-gray-400 mb-2">{formula.description}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(formula.status)}`}>
                        {formula.status}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                        {typeInfo.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditFormula(formulaId)}
                      className="btn btn-secondary btn-xs"
                    >
                      <PencilIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteFormula(formulaId)}
                      className="btn btn-danger btn-xs"
                    >
                      <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    </button>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="mb-1">
                    <span className="text-gray-400">Выражение:</span>
                    <code className="ml-2 text-blue-400">{formula.expression}</code>
                  </div>
                  <div>
                    <span className="text-gray-400">Результат:</span>
                    <span className="ml-2 text-green-400">{formula.output_field}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-600 rounded-lg">
          <CalculatorIcon style={{ width: '3rem', height: '3rem' }} className="mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-semibold mb-2">Формулы не настроены</h4>
          <p className="text-gray-400 mb-4">Добавьте формулы для вычислений и преобразования данных</p>
          <button 
            onClick={handleAddFormula}
            className="btn btn-primary"
          >
            <CalculatorIcon style={{ width: '1rem', height: '1rem' }} />
            Создать формулу
          </button>
        </div>
      )}

      {/* Formula Editor Modal */}
      {editingFormula && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {editingFormula === 'new' ? 'Новая формула' : 'Редактирование формулы'}
              </h3>
              <button
                onClick={() => setEditingFormula(null)}
                className="text-gray-400 hover:text-gray-300"
              >
                <XMarkIcon style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Название формулы</label>
                <input
                  type="text"
                  value={newFormula.name}
                  onChange={(e) => setNewFormula({ ...newFormula, name: e.target.value })}
                  className="form-input"
                  placeholder="Введите название формулы"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Описание</label>
                <textarea
                  value={newFormula.description}
                  onChange={(e) => setNewFormula({ ...newFormula, description: e.target.value })}
                  className="form-input"
                  rows="2"
                  placeholder="Описание назначения формулы"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тип формулы</label>
                <select
                  value={newFormula.type}
                  onChange={(e) => setNewFormula({ ...newFormula, type: e.target.value })}
                  className="form-input"
                >
                  {formulaTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Выражение</label>
                <textarea
                  value={newFormula.expression}
                  onChange={(e) => setNewFormula({ ...newFormula, expression: e.target.value })}
                  className="form-input font-mono"
                  rows="4"
                  placeholder="Например: SUM(field1, field2) * 1.2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Используйте имена полей в квадратных скобках: [field_name]
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Поле результата</label>
                <input
                  type="text"
                  value={newFormula.output_field}
                  onChange={(e) => setNewFormula({ ...newFormula, output_field: e.target.value })}
                  className="form-input"
                  placeholder="Название поля для результата"
                />
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded ${
                  testResult.success 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-red-500/20 border border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckIcon style={{ width: '1rem', height: '1rem' }} className="text-green-400" />
                    ) : (
                      <XMarkIcon style={{ width: '1rem', height: '1rem' }} className="text-red-400" />
                    )}
                    <span className="font-medium">
                      {testResult.success ? 'Тест прошел успешно' : 'Ошибка в формуле'}
                    </span>
                  </div>
                  {testResult.success ? (
                    <div>
                      <p className="text-sm text-green-400">Результат: {testResult.result}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-red-400">{testResult.error}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTestFormula}
                  disabled={testing || !newFormula.expression}
                  className="btn btn-secondary"
                >
                  {testing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Тестирование...
                    </>
                  ) : (
                    <>
                      <PlayIcon style={{ width: '1rem', height: '1rem' }} />
                      Тестировать
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleSaveFormula}
                  disabled={!newFormula.name || !newFormula.expression}
                  className="btn btn-primary flex-1"
                >
                  <CheckIcon style={{ width: '1rem', height: '1rem' }} />
                  Сохранить формулу
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaEditor;


