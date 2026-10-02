import React, { useEffect, useState } from 'react';
import {
  deleteTaskAttachment,
  downloadTaskAttachment,
  getTaskAttachments,
} from '../../../services/taskService';
import { FilesIcon, IconWithText } from './TaskManagerIcons';
import TaskAttachmentPickerModal from './TaskAttachmentPickerModal';

function formatFileSize(size) {
  if (size == null) return '—';
  const value = Number(size);
  if (Number.isNaN(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getAttachmentLabel(attachment) {
  if (attachment.source_type === 'document') {
    return attachment.original_filename || `Документ #${attachment.document_id}`;
  }
  return attachment.original_filename || attachment.filename;
}

export default function TaskAttachments({
  taskId,
  projectId = null,
  initialAttachments = [],
  currentUser,
  canUpload = true,
  canDelete = false,
  embedded = false,
  onAttachmentsChange,
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments, taskId]);

  const refreshAttachments = async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTaskAttachments(taskId);
      const items = Array.isArray(data?.items) ? data.items : [];
      setAttachments(items);
      onAttachmentsChange?.(items);
    } catch (err) {
      console.error('Error loading task attachments:', err);
      setError('Не удалось загрузить список файлов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) return;
    if (initialAttachments.length > 0) return;
    refreshAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleLinked = (items) => {
    setAttachments(items);
    onAttachmentsChange?.(items);
  };

  const handleOpen = (attachment) => {
    if (attachment.source_type === 'document' && attachment.document_id) {
      window.open(`/documents?document=${attachment.document_id}`, '_blank', 'noopener,noreferrer');
      return;
    }
    handleDownload(attachment);
  };

  const handleDownload = async (attachment) => {
    try {
      await downloadTaskAttachment(
        taskId,
        attachment.filename,
        attachment.original_filename,
      );
    } catch (err) {
      console.error('Error downloading attachment:', err);
      setError('Не удалось скачать файл');
    }
  };

  const canDeleteAttachment = (attachment) => {
    if (!currentUser) return false;
    return canDelete || attachment.uploaded_by === currentUser.id;
  };

  const handleDelete = async (attachment) => {
    const label = getAttachmentLabel(attachment);
    if (!window.confirm(`Удалить «${label}»?`)) {
      return;
    }
    try {
      setError('');
      await deleteTaskAttachment(taskId, attachment.filename);
      const next = attachments.filter((item) => item.filename !== attachment.filename);
      setAttachments(next);
      onAttachmentsChange?.(next);
    } catch (err) {
      console.error('Error deleting attachment:', err);
      setError(err.response?.data?.detail || 'Не удалось удалить файл');
    }
  };

  return (
    <div className={embedded
      ? ''
      : 'mb-4 p-4 bg-slate-800/30 backdrop-blur-sm rounded-lg border border-slate-700/50'
    }>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <FilesIcon size="md" className="text-amber-300" />
          <span>Файлы задачи</span>
        </h3>
        {canUpload && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600/80 to-blue-700/80 hover:from-blue-700/80 hover:to-blue-800/80 text-white text-sm font-medium"
          >
            Привязать файл
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-900/30 border border-red-700/40 text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Загрузка файлов…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          Нет привязанных файлов. Нажмите «Привязать файл», чтобы выбрать из документов или загрузить свой.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => {
            const isDocument = attachment.source_type === 'document';
            return (
              <li
                key={attachment.filename}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-600/40 bg-slate-800/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {getAttachmentLabel(attachment)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isDocument ? 'Документ' : formatFileSize(attachment.size)}
                    {attachment.uploaded_by_name ? ` · ${attachment.uploaded_by_name}` : ''}
                    {attachment.uploaded_at ? ` · ${formatUploadedAt(attachment.uploaded_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpen(attachment)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600/70 text-slate-100 text-xs font-medium"
                  >
                    {isDocument ? 'Открыть' : 'Скачать'}
                  </button>
                  {canDeleteAttachment(attachment) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(attachment)}
                      className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/50 text-red-200 text-xs font-medium"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canUpload && (
        <p className="text-xs text-slate-500 mt-3">
          <IconWithText icon={FilesIcon} className="text-xs text-slate-500">
            Можно привязать документ, файл проекта или загрузить с компьютера
          </IconWithText>
        </p>
      )}

      <TaskAttachmentPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        taskId={taskId}
        projectId={projectId}
        onLinked={handleLinked}
      />
    </div>
  );
}
