import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TrashIcon, ArrowDownTrayIcon, LinkIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { employeeService } from '../../../../services/employeeService';
import { documentService } from '../../../../services/documentService';
import { formatApiError } from '../../../../utils/formatApiError';

export const EMPLOYEE_DOC_CATEGORIES = [
  { value: 'contract', label: 'Трудовой договор' },
  { value: 'order', label: 'Приказ' },
  { value: 'application', label: 'Заявление' },
  { value: 'passport', label: 'Паспортные данные' },
  { value: 'education', label: 'Образование' },
  { value: 'certificate', label: 'Справка / сертификат' },
  { value: 'nda', label: 'NDA / соглашение' },
  { value: 'other', label: 'Прочее' },
];

export const EMPLOYEE_DOC_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.png,.jpg,.jpeg';

const categoryLabel = (value) =>
  EMPLOYEE_DOC_CATEGORIES.find((c) => c.value === value)?.label || value;

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

const inputCls = 'rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white text-sm';

/** Поиск документа платформы для привязки к сотруднику. */
export function PlatformDocumentPicker({ onPick, disabled }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      documentService
        .getDocuments(null, null, { accessible: true, search: q, limit: 20 })
        .then((data) => {
          if (cancelled) return;
          setResults(Array.isArray(data) ? data : data?.items || []);
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найти документ платформы (от 2 символов)..."
        className={`w-full ${inputCls}`}
      />
      {loading && <p className="text-xs text-slate-500">Поиск...</p>}
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/60">
          {results.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(doc);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-50"
              >
                {doc.title || doc.number || `Документ #${doc.id}`}
                {doc.number && doc.title ? <span className="text-slate-500"> · №{doc.number}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Личное дело сотрудника: загруженные файлы и привязанные документы платформы. */
export default function EmployeeDocumentsModal({ employee, canManage = true, onClose }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [uploadCategory, setUploadCategory] = useState('contract');
  const [uploadTitle, setUploadTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    setError('');
    try {
      const data = await employeeService.getEmployeeDocuments(employee.id, {
        search: search.trim() || undefined,
        category: category || undefined,
      });
      setDocs(data);
    } catch (err) {
      setError(formatApiError(err, 'Ошибка загрузки документов'));
    } finally {
      setLoading(false);
    }
  }, [employee, search, category]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (!employee) return null;

  const run = async (fn, fallback) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(formatApiError(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    run(async () => {
      await employeeService.uploadEmployeeDocuments(employee.id, files, {
        title: files.length === 1 ? uploadTitle.trim() : '',
        category: uploadCategory,
      });
      setUploadTitle('');
    }, 'Ошибка загрузки файла').finally(() => {
      if (fileRef.current) fileRef.current.value = '';
    });
  };

  const handleLink = (doc) =>
    run(
      () =>
        employeeService.linkEmployeeDocument(employee.id, {
          document_id: doc.id,
          title: uploadTitle.trim() || undefined,
          category: uploadCategory,
        }),
      'Ошибка привязки документа',
    );

  const handleDownload = async (doc) => {
    try {
      const blob = await employeeService.downloadEmployeeDocument(employee.id, doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename || doc.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(formatApiError(err, 'Ошибка скачивания'));
    }
  };

  const handleDelete = (doc) =>
    run(async () => {
      await employeeService.deleteEmployeeDocument(employee.id, doc.id);
      setConfirmId(null);
    }, 'Ошибка удаления');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-xl"
        style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b" style={{ borderColor: 'var(--color-border-muted)' }}>
          <div>
            <h3 className="text-xl font-bold text-white">Документы сотрудника</h3>
            <p className="text-sm text-slate-400">{employee.name}{employee.email ? ` · ${employee.email}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {canManage && (
            <div className="rounded-xl border border-slate-700 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className={inputCls}>
                  {EMPLOYEE_DOC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Название (необязательно)"
                  className={inputCls}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" multiple accept={EMPLOYEE_DOC_ACCEPT} onChange={handleUpload} className="hidden" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  <PaperClipIcon className="w-4 h-4" />
                  {busy ? 'Загрузка...' : 'Загрузить файлы'}
                </button>
                <span className="text-xs text-slate-500">PDF, Word, Excel, изображения · до 20 МБ</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" />Привязать документ платформы</p>
                <PlatformDocumentPicker onPick={handleLink} disabled={busy} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, файлу, номеру..."
              className={`flex-1 min-w-[200px] ${inputCls}`}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">Все категории</option>
              {EMPLOYEE_DOC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-slate-400 text-sm">Загрузка...</p>
          ) : docs.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Документов нет</p>
          ) : (
            <ul className="divide-y divide-slate-700/60 rounded-xl border border-slate-700">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {doc.document_id ? <LinkIcon className="inline w-3.5 h-3.5 mr-1 text-indigo-300" /> : null}
                      {doc.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      <span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 mr-2">{categoryLabel(doc.category)}</span>
                      {doc.document_id
                        ? `Документ платформы${doc.document_title && doc.document_title !== doc.title ? `: ${doc.document_title}` : ''}`
                        : [doc.original_filename, formatSize(doc.size)].filter(Boolean).join(' · ')}
                      {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString('ru-RU')}` : ''}
                      {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ''}
                    </p>
                  </div>
                  {doc.document_id ? (
                    <a
                      href={`/documents/${doc.document_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded bg-slate-700/60 text-slate-200 hover:bg-slate-600"
                    >
                      Открыть
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded text-slate-300 hover:bg-slate-700/60"
                      title="Скачать"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (confirmId === doc.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(doc)}
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 rounded text-slate-300 hover:bg-slate-700/60">
                        Нет
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(doc.id)}
                      className="p-1.5 rounded text-red-400 hover:bg-red-500/20"
                      title="Удалить"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
