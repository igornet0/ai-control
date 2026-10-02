import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listProjectFiles } from '../../../services/filesService';
import { documentService } from '../../../services/documentService';
import { linkTaskAttachment, uploadTaskAttachments } from '../../../services/taskService';
import { getDocumentDisplayTitle } from '../../documents/documentsPageUtils';
import { CloseIcon, FilesIcon, SearchInput } from './TaskManagerIcons';

function formatFileSize(size) {
  if (size == null) return '—';
  const value = Number(size);
  if (Number.isNaN(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskAttachmentPickerModal({
  open,
  onClose,
  taskId,
  projectId = null,
  onLinked,
}) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('library');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    setTab('library');
    setQuery('');
    setError('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const loadItems = async () => {
      setLoading(true);
      setError('');
      try {
        const [filesData, docsData, templatesData, kindsData] = await Promise.all([
          listProjectFiles({
            search: query || undefined,
            limit: 100,
            sortBy: 'uploaded_at',
            sortOrder: 'desc',
          }),
          documentService.getDocuments(null, projectId ?? null, {
            linkedOnly: true,
            search: query || undefined,
            limit: 100,
          }),
          documentService.getTemplates(),
          documentService.getKinds(),
        ]);

        if (cancelled) return;

        const templates = Array.isArray(templatesData) ? templatesData : [];
        const kinds = Array.isArray(kindsData) ? kindsData : [];
        const kindNameById = (id) => kinds.find((k) => String(k.id) === String(id))?.name || '';

        const fileItems = (filesData?.items || [])
          .filter((file) => file.source !== 'task' || file.task_id !== taskId)
          .filter((file) => !projectId || file.project_id == null || Number(file.project_id) === Number(projectId))
          .map((file) => ({
            key: `file-${file.project_id}-${file.filename}`,
            kind: 'project_file',
            title: file.original_filename || file.filename,
            subtitle: file.project_name || file.task_title || 'Файл проекта',
            meta: formatFileSize(file.size),
            payload: {
              source_type: 'project_file',
              project_id: file.project_id,
              filename: file.filename,
              original_filename: file.original_filename || file.filename,
            },
          }));

        const docItems = (Array.isArray(docsData) ? docsData : []).map((doc) => ({
          key: `doc-${doc.id}`,
          kind: 'document',
          title: getDocumentDisplayTitle(doc, templates, kindNameById(doc.document_kind_id)),
          subtitle: doc.project_name || 'Документ',
          meta: kindNameById(doc.document_kind_id) || 'Документ',
          payload: {
            source_type: 'document',
            document_id: doc.id,
            document_title: getDocumentDisplayTitle(doc, templates, kindNameById(doc.document_kind_id)),
          },
        }));

        setItems([...fileItems, ...docItems]);
      } catch (err) {
        console.error('TaskAttachmentPickerModal load error:', err);
        if (!cancelled) {
          setError('Не удалось загрузить список файлов и документов');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [open, query, projectId, taskId]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q)
        || item.subtitle.toLowerCase().includes(q),
    );
  }, [items, query]);

  const handleSelectItem = async (item) => {
    try {
      setSubmitting(true);
      setError('');
      const data = await linkTaskAttachment(taskId, item.payload);
      onLinked?.(Array.isArray(data?.items) ? data.items : []);
      onClose();
    } catch (err) {
      console.error('Link attachment error:', err);
      setError(err.response?.data?.detail || 'Не удалось привязать файл');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFiles = async (fileList) => {
    if (!fileList?.length) return;
    try {
      setSubmitting(true);
      setError('');
      const data = await uploadTaskAttachments(taskId, fileList);
      onLinked?.(Array.isArray(data?.items) ? data.items : []);
      onClose();
    } catch (err) {
      console.error('Upload attachment error:', err);
      setError(err.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 p-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FilesIcon size="md" className="text-amber-300" />
              Привязать файл
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Выберите из файлов и документов или загрузите с компьютера
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-600/50"
            aria-label="Закрыть"
          >
            <CloseIcon size="md" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('library')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'library'
                ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Файлы и документы
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'upload'
                ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Загрузить свой
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-900/30 border border-red-700/40 text-red-200 text-sm">
            {error}
          </div>
        )}

        {tab === 'library' ? (
          <>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию…"
              className="mb-3"
            />
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <p className="text-sm text-slate-400 py-6 text-center">Загрузка…</p>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-6 text-center">
                  Нет доступных файлов или документов
                </p>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSelectItem(item)}
                    className="w-full text-left p-3 rounded-xl border border-slate-600/40 bg-slate-800/40 hover:bg-slate-700/40 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {item.subtitle}
                          {item.kind === 'document' ? ' · Документ' : ' · Файл'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">{item.meta}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="py-4">
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
              disabled={submitting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 rounded-xl border-2 border-dashed border-slate-600/60 bg-slate-800/30 hover:bg-slate-800/50 text-slate-300 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Загрузка…' : 'Нажмите, чтобы выбрать файлы на компьютере'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
