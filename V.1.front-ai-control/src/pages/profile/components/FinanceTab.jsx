import React, { useState, useEffect, useMemo, useRef } from 'react';
import { financeService } from '../../../services/financeService';
import Notification from '../../../components/Notification';
import FinanceOverview from './FinanceOverview';
import styles from './ProfileTabs.module.css';

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

export default function FinanceTab({ activeTab, onOpenPlan }) {
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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
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
    setConfirmDeleteId(null);
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

  const totalAmount = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className={styles.page}>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Финансы</span>
          <h2 className={styles.title}>Учёт доходов</h2>
          <p className={styles.subtitle}>Фиксируйте поступления, поставщиков и подтверждающие документы.</p>
        </div>
        {entries.length > 0 && (
          <div className={`${styles.badge} ${styles.badgeInfo}`}>
            Итого: {totalAmount.toLocaleString('ru-RU')} ₽
          </div>
        )}
      </header>

      <FinanceOverview onOpenPlan={onOpenPlan} />

      <section className={styles.card}>
        {!formExpanded ? (
          <button
            type="button"
            onClick={() => setFormExpanded(true)}
            className={`${styles.btn} ${styles.btnGhost} ${styles.addCta}`}
          >
            <span>+</span>
            <span>Новая запись о доходе</span>
          </button>
        ) : (
          <>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                {editingId ? 'Редактировать запись' : 'Новая запись о доходе'}
              </h3>
              <button
                type="button"
                onClick={() => { setFormExpanded(false); if (editingId) resetForm(); }}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                Свернуть
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className={styles.errorBox} style={{ marginBottom: 'var(--spacing-4)' }}>{error}</div>}
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Дата оплаты<span className={styles.required}>*</span></span>
                  <input
                    type="date"
                    name="payment_date"
                    value={form.payment_date}
                    onChange={handleChange}
                    required
                    className={styles.input}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Сумма, ₽<span className={styles.required}>*</span></span>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className={styles.input}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Категория<span className={styles.required}>*</span></span>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    className={styles.input}
                  >
                    <option value="">Выберите категорию</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
                <div ref={supplierDropdownRef} className={styles.field}>
                  <label className={styles.label} htmlFor="finance-supplier">
                    Поставщик<span className={styles.required}>*</span>
                  </label>
                  <input
                    id="finance-supplier"
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
                    className={styles.input}
                  />
                  {supplierDropdownOpen && supplierSuggestions.length > 0 && (
                    <ul className={styles.suggestions}>
                      {supplierSuggestions.map((s, idx) => (
                        <li
                          key={s}
                          className={`${styles.suggestion} ${idx === supplierHighlightedIndex ? styles.suggestionActive : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSupplierSelect(s);
                          }}
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className={styles.field}>
                  <span className={styles.label}>Тип документа</span>
                  <select
                    name="document_type"
                    value={form.document_type}
                    onChange={handleChange}
                    className={styles.input}
                  >
                    {DOCUMENT_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.label}>Комментарий</span>
                  <textarea
                    name="comment"
                    value={form.comment}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Необязательно"
                    className={styles.input}
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { resetForm(); setFormExpanded(false); }}
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    Отмена
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {submitting ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            Список записей
            {entries.length > 0 && <span className={styles.counter}>{entries.length}</span>}
          </h3>
        </div>
        {!formExpanded && error && <div className={styles.errorBox} style={{ marginBottom: 'var(--spacing-4)' }}>{error}</div>}
        {loading ? (
          <div className={styles.loader}>
            <span className={styles.spinner} />
            Загрузка...
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>💰</div>
            <p className={styles.emptyTitle}>Пока нет записей</p>
            <p>Добавьте первую запись о доходе — она появится здесь.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Категория</th>
                  <th>Поставщик</th>
                  <th>Тип док.</th>
                  <th>Комментарий</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Дата">{entry.payment_date}</td>
                    <td data-label="Сумма" className={styles.amount}>
                      {Number(entry.amount).toLocaleString('ru-RU')} ₽
                    </td>
                    <td data-label="Категория"><span className={styles.chip}>{entry.category}</span></td>
                    <td data-label="Поставщик" style={{ color: 'var(--color-text-primary)' }}>{entry.supplier}</td>
                    <td data-label="Тип док.">
                      {DOCUMENT_TYPES.find((t) => t.value === entry.document_type)?.label || entry.document_type}
                    </td>
                    <td data-label="Комментарий" className={styles.muted}>
                      {entry.comment || '—'}
                    </td>
                    <td className={styles.rowActions}>
                      {confirmDeleteId === entry.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                          >
                            Да, удалить
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
