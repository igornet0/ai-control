import React, { useState, useEffect, useMemo, useRef } from 'react';
import { financeService } from '../../../services/financeService';
import Notification from '../../../components/Notification';

const DOCUMENT_TYPES = [
  { value: 'receipt', label: 'Чек' },
  { value: 'act', label: 'Акт' },
  { value: 'table', label: 'Таблица' },
  { value: 'other', label: 'Прочее' },
];

const CATEGORIES = [
  'Услуги',
  'Консультации',
  'Подписка',
  'Проектные работы',
  'Цифровые продукты',
  'Прочее',
];

const initialForm = {
  payment_date: '',
  amount: '',
  category: '',
  supplier: '',
  document_type: 'receipt',
  comment: '',
};

export default function FinanceTab({ activeTab }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(-1);
  const [formExpanded, setFormExpanded] = useState(false);
  const [notification, setNotification] = useState(null);
  const supplierDropdownRef = useRef(null);

  const loadEntries = async () => {
    if (activeTab !== 'finance') return;
    setLoading(true);
    setError('');
    try {
      const data = await financeService.getEntries();
      setEntries(data);
    } catch (err) {
      console.error('Error loading income entries:', err);
      setError('Ошибка загрузки записей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [activeTab]);

  useEffect(() => {
    if (editingId) setFormExpanded(true);
  }, [editingId]);

  const uniqueSuppliers = useMemo(
    () => [...new Set(entries.map((e) => e.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [entries]
  );

  const supplierSuggestions = useMemo(() => {
    const q = form.supplier.trim().toLowerCase();
    if (!q) return [];
    return uniqueSuppliers.filter((s) => s.toLowerCase().includes(q)).slice(0, 10);
  }, [form.supplier, uniqueSuppliers]);

  useEffect(() => {
    if (supplierDropdownOpen && supplierSuggestions.length > 0) {
      setSupplierHighlightedIndex(0);
    } else {
      setSupplierHighlightedIndex(-1);
    }
  }, [supplierDropdownOpen, supplierSuggestions]);

  const handleSupplierSelect = (supplier) => {
    setForm((prev) => ({ ...prev, supplier }));
    setSupplierDropdownOpen(false);
    setSupplierHighlightedIndex(-1);
  };

  const handleSupplierBlur = () => {
    setTimeout(() => {
      setSupplierDropdownOpen(false);
      setSupplierHighlightedIndex(-1);
    }, 150);
  };

  const handleSupplierKeyDown = (e) => {
    if (!supplierDropdownOpen || supplierSuggestions.length === 0) {
      if (e.key === 'Escape') setSupplierDropdownOpen(false);
      return;
    }
    const n = supplierSuggestions.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSupplierHighlightedIndex((i) => (i < 0 ? 0 : (i + 1) % n));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSupplierHighlightedIndex((i) => (i <= 0 ? n - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter' && supplierHighlightedIndex >= 0 && supplierSuggestions[supplierHighlightedIndex]) {
      e.preventDefault();
      handleSupplierSelect(supplierSuggestions[supplierHighlightedIndex]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setSupplierDropdownOpen(false);
      setSupplierHighlightedIndex(-1);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'supplier') setSupplierDropdownOpen(true);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.payment_date || !form.amount || !form.category.trim() || !form.supplier.trim()) {
      setError('Заполните обязательные поля: дата, сумма, категория, поставщик');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        payment_date: form.payment_date,
        amount: parseFloat(form.amount),
        category: form.category.trim(),
        supplier: form.supplier.trim(),
        document_type: form.document_type,
        comment: form.comment.trim() || null,
      };
      const wasEditing = !!editingId;
      if (editingId) {
        await financeService.updateEntry(editingId, payload);
      } else {
        await financeService.createEntry(payload);
      }
      await loadEntries();
      resetForm();
      setFormExpanded(false);
      setNotification({
        message: wasEditing ? 'Запись обновлена' : 'Запись сохранена',
        type: 'success',
      });
    } catch (err) {
      console.error('Error saving income entry:', err);
      setError(err.response?.data?.detail?.toString?.() || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry) => {
    setForm({
      payment_date: entry.payment_date,
      amount: String(entry.amount),
      category: entry.category,
      supplier: entry.supplier,
      document_type: entry.document_type,
      comment: entry.comment || '',
    });
    setEditingId(entry.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись?')) return;
    try {
      await financeService.deleteEntry(id);
      await loadEntries();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError(err.response?.data?.detail?.toString?.() || 'Ошибка удаления');
    }
  };

  if (activeTab !== 'finance') return null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Учёт доходов
      </h2>

      <div className="card animate-slideInLeft">
        {!formExpanded ? (
          <button
            type="button"
            onClick={() => setFormExpanded(true)}
            className="w-full py-3 px-4 rounded-lg font-medium border border-dashed border-slate-500 text-slate-300 hover:bg-slate-700/40 hover:border-indigo-500/50 transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            <span>Новая запись о доходе</span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingId ? 'Редактировать запись' : 'Новая запись о доходе'}
              </h3>
              <button
                type="button"
                onClick={() => { setFormExpanded(false); if (editingId) resetForm(); }}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Свернуть
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Дата оплаты
              </label>
              <input
                type="date"
                name="payment_date"
                value={form.payment_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Сумма
              </label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Категория
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white"
              >
                <option value="">Выберите категорию</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div ref={supplierDropdownRef} className="relative">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Поставщик
              </label>
              <input
                type="text"
                name="supplier"
                value={form.supplier}
                onChange={handleChange}
                onFocus={() => setSupplierDropdownOpen(true)}
                onBlur={handleSupplierBlur}
                onKeyDown={handleSupplierKeyDown}
                required
                placeholder="Организация или ФИО"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white"
              />
              {supplierDropdownOpen && supplierSuggestions.length > 0 && (
                <ul
                  className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-600 bg-slate-800/95 shadow-xl backdrop-blur-sm flex flex-col"
                  style={{ borderColor: 'var(--color-border-muted)' }}
                >
                  {supplierSuggestions.map((s, idx) => (
                    <li key={s} className="list-none w-full flex-shrink-0 first:rounded-t-[7px] last:rounded-b-[7px] overflow-hidden">
                      <button
                        type="button"
                        className={`block w-full min-w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center box-border ${
                          idx === supplierHighlightedIndex
                            ? 'bg-indigo-500/25'
                            : 'hover:bg-slate-700/60'
                        }`}
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSupplierSelect(s);
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Тип документа
            </label>
            <select
              name="document_type"
              value={form.document_type}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white"
            >
              {DOCUMENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Комментарий
            </label>
            <textarea
              name="comment"
              value={form.comment}
              onChange={handleChange}
              rows={3}
              placeholder="Необязательно"
              className="w-full px-3 py-2 rounded-lg border bg-slate-800/50 border-slate-600 text-white resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {submitting ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { resetForm(); setFormExpanded(false); }}
                className="px-4 py-2 rounded-lg font-medium border border-slate-500 text-slate-300 hover:bg-slate-700/50"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
          </>
        )}
      </div>

      <div className="card animate-slideInRight">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Список записей
        </h3>
        {loading ? (
          <p className="text-slate-400">Загрузка...</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-400">Нет записей. Добавьте первую запись выше.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderColor: 'var(--color-border-muted)' }} className="border-b">
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Дата</th>
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Сумма</th>
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Категория</th>
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Поставщик</th>
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Тип док.</th>
                  <th className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>Комментарий</th>
                  <th className="py-2" style={{ color: 'var(--color-text-muted)' }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderColor: 'var(--color-border-muted)' }}
                    className="border-b border-slate-700/50"
                  >
                    <td className="py-3 pr-4" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.payment_date}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--color-text-primary)' }}>
                      {Number(entry.amount).toLocaleString('ru-RU')}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.category}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.supplier}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--color-text-primary)' }}>
                      {DOCUMENT_TYPES.find((t) => t.value === entry.document_type)?.label || entry.document_type}
                    </td>
                    <td className="py-3 pr-4 max-w-[200px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {entry.comment || '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(entry)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-indigo-500/50 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-400/60 transition-colors"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400/60 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
