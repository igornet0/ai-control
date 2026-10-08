import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  PaperClipIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { listProjectFiles } from '../../../services/filesService';
import { documentService } from '../../../services/documentService';
import { linkTaskAttachment, uploadTaskAttachments } from '../../../services/taskService';
import { getDocumentDisplayTitle } from '../../documents/documentsPageUtils';
import { isSpreadsheetDocument } from '../../documents/templateTypeUtils';
import { CloseIcon, SearchInput } from './TaskManagerIcons';

const TABS = [
  { id: 'documents', label: 'Документы и таблицы' },
  { id: 'files', label: 'Файлы' },
  { id: 'upload', label: 'С компьютера' },
];

const DOC_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'document', label: 'Документы' },
  { id: 'table', label: 'Таблицы' },
];

export const KIND_ICON = {
  document: { Icon: DocumentTextIcon, className: 'text-sky-300 bg-sky-500/10' },
  table: { Icon: TableCellsIcon, className: 'text-emerald-300 bg-emerald-500/10' },
  file: { Icon: PaperClipIcon, className: 'text-amber-300 bg-amber-500/10' },
};

const SEARCH_DEBOUNCE_MS = 250;

function formatFileSize(size) {
  if (size == null) return '';
  const value = Number(size);
  if (Number.isNaN(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Ключ, по которому видно, что источник уже привязан к задаче. */
function linkKeyFromPayload(payload) {
  if (payload.source_type === 'document') return `document:${payload.document_id}`;
  if (payload.source_type === 'project_file') return `project_file:${payload.project_id}:${payload.filename}`;
  if (payload.source_type === 'task_file') return `task_file:${payload.source_task_id}:${payload.filename}`;
  return null;
}

function linkKeyFromAttachment(attachment) {
  if (attachment.source_type === 'document') return `document:${attachment.document_id}`;
  if (attachment.source_type === 'project_file') {
    return `project_file:${attachment.project_id}:${attachment.source_filename}`;
  }
  if (attachment.source_type === 'task_file') {
    return `task_file:${attachment.source_task_id}:${attachment.source_filename}`;
  }
  return null;
}

/**
 * Привязка к задаче: документа или таблицы 2А, файла проекта или другой задачи,
 * либо загрузка файла с компьютера.
 */
export default function TaskAttachmentPickerModal({
  open,
  onClose,
  taskId,
  projectId = null,
  linkedAttachments = [],
  onLinked,
}) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('documents');
  const [docFilter, setDocFilter] = useState('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [templates, setTemplates] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [submittingKey, setSubmittingKey] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('documents');
    setDocFilter('all');
    setQuery('');
    setError('');
  }, [open]);

  // Esc закрывает только это окно, а не окно задачи под ним
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (!submittingKey) onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose, submittingKey]);

  // Шаблоны и виды нужны, чтобы отличить таблицу от документа и подписать документ без названия
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    Promise.all([documentService.getTemplates(), documentService.getKinds()])
      .then(([templatesData, kindsData]) => {
        if (cancelled) return;
        setTemplates(Array.isArray(templatesData) ? templatesData : []);
        setKinds(Array.isArray(kindsData) ? kindsData : []);
      })
      .catch((err) => console.error('TaskAttachmentPickerModal templates error:', err));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setDocsLoading(true);
    documentService
      .getDocuments(null, null, { accessible: true, search: debouncedQuery || undefined, limit: 100 })
      .then((data) => {
        if (!cancelled) setDocuments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('TaskAttachmentPickerModal documents error:', err);
        if (!cancelled) {
          setDocuments([]);
          setError('Не удалось загрузить документы');
        }
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setFilesLoading(true);
    listProjectFiles({
      search: debouncedQuery || undefined,
      limit: 100,
      sortBy: 'uploaded_at',
      sortOrder: 'desc',
    })
      .then((data) => {
        if (!cancelled) setFiles(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err) => {
        console.error('TaskAttachmentPickerModal files error:', err);
        if (!cancelled) {
          setFiles([]);
          setError('Не удалось загрузить файлы');
        }
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  const linkedKeys = useMemo(
    () => new Set(linkedAttachments.map(linkKeyFromAttachment).filter(Boolean)),
    [linkedAttachments],
  );

  const documentItems = useMemo(() => {
    const kindNameById = (id) => kinds.find((k) => String(k.id) === String(id))?.name || '';
    const items = documents.map((doc) => {
      const kind = isSpreadsheetDocument(doc, templates) ? 'table' : 'document';
      const title = getDocumentDisplayTitle(doc, templates, kindNameById(doc.document_kind_id));
      const payload = {
        source_type: 'document',
        document_id: doc.id,
        document_title: title,
        document_kind: kind,
      };
      return {
        key: `doc-${doc.id}`,
        kind,
        title,
        subtitle: [
          kind === 'table' ? 'Таблица' : 'Документ',
          doc.project_name ? `проект «${doc.project_name}»` : doc.department_name,
          doc.author_name,
        ].filter(Boolean).join(' · '),
        meta: formatDate(doc.updated || doc.created),
        inProject: projectId != null && Number(doc.project_id) === Number(projectId),
        payload,
      };
    });
    // Документы проекта задачи — первыми
    return items.sort((a, b) => Number(b.inProject) - Number(a.inProject));
  }, [documents, templates, kinds, projectId]);

  const fileItems = useMemo(() => (
    files
      // Ссылки на документы из других задач показываем во вкладке документов, а не как файлы
      .filter((file) => !(file.source === 'task' && file.source_type === 'document'))
      .filter((file) => !(file.source === 'task' && Number(file.task_id) === Number(taskId)))
      .map((file) => {
        const fromTask = file.source === 'task';
        const payload = fromTask
          ? {
            source_type: 'task_file',
            source_task_id: file.task_id,
            filename: file.filename,
          }
          : {
            source_type: 'project_file',
            project_id: file.project_id,
            filename: file.filename,
            original_filename: file.original_filename || file.filename,
          };
        return {
          key: `${fromTask ? 'task' : 'project'}-${fromTask ? file.task_id : file.project_id}-${file.filename}`,
          kind: 'file',
          title: file.original_filename || file.filename,
          subtitle: fromTask
            ? `Из задачи «${file.task_title || `#${file.task_id}`}»`
            : `Проект «${file.project_name || `#${file.project_id}`}»`,
          meta: formatFileSize(file.size),
          payload,
        };
      })
  ), [files, taskId]);

  const visibleDocuments = docFilter === 'all'
    ? documentItems
    : documentItems.filter((item) => item.kind === docFilter);

  const handleSelectItem = async (item) => {
    if (submittingKey) return;
    try {
      setSubmittingKey(item.key);
      setError('');
      const data = await linkTaskAttachment(taskId, item.payload);
      onLinked?.(Array.isArray(data?.items) ? data.items : []);
      onClose();
    } catch (err) {
      console.error('Link attachment error:', err);
      setError(err.response?.data?.detail || 'Не удалось привязать');
    } finally {
      setSubmittingKey(null);
    }
  };

  const handleUploadFiles = async (fileList) => {
    if (!fileList?.length || submittingKey) return;
    try {
      setSubmittingKey('upload');
      setError('');
      const data = await uploadTaskAttachments(taskId, fileList);
      onLinked?.(Array.isArray(data?.items) ? data.items : []);
      onClose();
    } catch (err) {
      console.error('Upload attachment error:', err);
      setError(err.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setSubmittingKey(null);
    }
  };

  if (!open) return null;

  const renderList = (items, loading, emptyText) => {
    if (loading && items.length === 0) {
      return <p className="text-sm text-slate-400 py-10 text-center">Загрузка…</p>;
    }
    if (items.length === 0) {
      return <p className="text-sm text-slate-500 py-10 text-center">{emptyText}</p>;
    }
    return (
      <ul className="space-y-1">
        {items.map((item) => {
          const { Icon, className: iconClass } = KIND_ICON[item.kind];
          const alreadyLinked = linkedKeys.has(linkKeyFromPayload(item.payload));
          const isSubmitting = submittingKey === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                disabled={alreadyLinked || Boolean(submittingKey)}
                onClick={() => handleSelectItem(item)}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/80 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium truncate ${alreadyLinked ? 'text-slate-400' : 'text-slate-100'}`}>
                    {item.title}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">{item.subtitle}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500 text-right">
                  {alreadyLinked ? (
                    <span className="text-emerald-300">Уже привязан</span>
                  ) : isSubmitting ? (
                    <span className="text-blue-300">Привязываю…</span>
                  ) : (
                    item.meta
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={() => !submittingKey && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-attachment-picker-title"
        className="w-full max-w-2xl max-h-[calc(100vh-1rem)] sm:max-h-[min(42rem,calc(100vh-4rem))] flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 px-5 pt-4 border-b border-slate-700/60 bg-slate-800/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="task-attachment-picker-title" className="text-lg font-semibold text-slate-100">
                Привязать к задаче
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Документ или таблица из 2А, файл проекта или задачи, или файл с компьютера
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              aria-label="Закрыть"
            >
              <CloseIcon size="md" />
            </button>
          </div>

          <div role="tablist" className="flex gap-1 mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((item) => {
              const active = tab === item.id;
              const count = item.id === 'documents'
                ? documentItems.length
                : item.id === 'files' ? fileItems.length : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                      active ? 'bg-blue-500/20 text-blue-200' : 'bg-slate-700/70 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-200 text-sm">
            {error}
          </div>
        )}

        {tab !== 'upload' && (
          <div className="shrink-0 px-5 pt-3 pb-2 space-y-2">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'documents' ? 'Поиск по названию или номеру…' : 'Поиск по имени файла…'}
              inputClassName="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 rounded-lg py-2.5"
            />
            {tab === 'documents' && (
              <div className="flex gap-1.5">
                {DOC_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setDocFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      docFilter === filter.id
                        ? 'bg-slate-200 text-slate-900'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
          {tab === 'documents' && renderList(
            visibleDocuments,
            docsLoading,
            debouncedQuery ? 'Ничего не найдено' : 'Нет доступных документов и таблиц',
          )}
          {tab === 'files' && renderList(
            fileItems,
            filesLoading,
            debouncedQuery ? 'Ничего не найдено' : 'Нет файлов в проектах и задачах',
          )}
          {tab === 'upload' && (
            <div className="px-3 py-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleUploadFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={Boolean(submittingKey)}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleUploadFiles(e.dataTransfer.files);
                }}
                className={`w-full py-12 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 text-slate-300 transition-colors disabled:opacity-50 ${
                  dragOver
                    ? 'border-blue-400 bg-blue-500/10'
                    : 'border-slate-600/70 bg-slate-800/30 hover:bg-slate-800/60'
                }`}
              >
                <ArrowUpTrayIcon className="w-7 h-7 text-slate-400" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {submittingKey === 'upload' ? 'Загрузка…' : 'Выберите файлы или перетащите их сюда'}
                </span>
                <span className="text-xs text-slate-500">Можно несколько файлов сразу</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
