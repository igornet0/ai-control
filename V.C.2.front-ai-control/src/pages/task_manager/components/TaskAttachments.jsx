import React, { useEffect, useRef, useState } from 'react';
import {
  deleteTaskAttachment,
  downloadTaskAttachment,
  getTaskAttachments,
} from '../../../services/taskService';
import { FilesIcon, IconWithText } from './TaskManagerIcons';
import TaskAttachmentPickerModal, { KIND_ICON } from './TaskAttachmentPickerModal';
import { confirmAction } from '../../../components/shared/confirmAction';

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

/** document | table | file — для иконки и подписи */
function getAttachmentKind(attachment) {
  if (attachment.source_type !== 'document') return 'file';
  return attachment.document_kind === 'table' ? 'table' : 'document';
}

/** Что произойдёт при отвязке: документ и оригиналы файлов остаются, загруженный файл удаляется. */
function getUnlinkConfirmText(attachment) {
  const title = `Отвязать «${getAttachmentLabel(attachment)}» от задачи?`;
  if (attachment.source_type === 'document') {
    const what = attachment.document_kind === 'table' ? 'Сама таблица' : 'Сам документ';
    return { title, message: `${what} останется в 2А.` };
  }
  if (attachment.source_type === 'project_file') {
    return { title, message: 'Файл в проекте останется.' };
  }
  if (attachment.source_type === 'task_file') {
    return { title, message: 'Файл в исходной задаче останется.' };
  }
  return { title, message: 'Файл был загружен только в эту задачу и будет удалён.' };
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
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
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
      // Родителю (он перезагружает список задач) сообщаем только о реальных изменениях
      const changed = JSON.stringify(attachmentsRef.current) !== JSON.stringify(items);
      setAttachments(items);
      if (changed) onAttachmentsChange?.(items);
    } catch (err) {
      console.error('Error loading task attachments:', err);
      setError('Не удалось загрузить список файлов');
    } finally {
      setLoading(false);
    }
  };

  // Всегда сверяемся с сервером: он убирает ссылки на удалённые документы,
  // а данные списка задач могут быть устаревшими
  useEffect(() => {
    if (!taskId) return;
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

  const handleUnlink = async (attachment) => {
    const { title, message } = getUnlinkConfirmText(attachment);
    if (!(await confirmAction({ title, message, confirmLabel: 'Отвязать', danger: true }))) {
      return;
    }
    try {
      setError('');
      await deleteTaskAttachment(taskId, attachment.filename);
      const next = attachments.filter((item) => item.filename !== attachment.filename);
      setAttachments(next);
      onAttachmentsChange?.(next);
    } catch (err) {
      console.error('Error unlinking attachment:', err);
      setError(err.response?.data?.detail || 'Не удалось отвязать');
    }
  };

  return (
    <div className={embedded
      ? ''
      : 'mb-4 p-4 bg-slate-800/30 backdrop-blur-sm rounded-lg border border-slate-700/50'
    }>
      <div className={`flex items-center justify-between gap-3 ${embedded ? 'mb-2.5' : 'mb-3'}`}>
        {embedded ? (
          <h3 className="text-sm font-semibold text-slate-200">Файлы</h3>
        ) : (
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <FilesIcon size="md" className="text-amber-300" />
            <span>Файлы задачи</span>
          </h3>
        )}
        {canUpload && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={embedded
              ? 'px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600/80 text-slate-100 text-xs font-medium transition-colors'
              : 'px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600/80 to-blue-700/80 hover:from-blue-700/80 hover:to-blue-800/80 text-white text-sm font-medium'}
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

      {loading && attachments.length === 0 ? (
        <p className="text-sm text-slate-400">Загрузка файлов…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          Пока ничего не привязано. Нажмите «Привязать файл», чтобы добавить документ или таблицу 2А, файл проекта или файл с компьютера.
        </p>
      ) : (
        <ul className={embedded ? 'space-y-1' : 'space-y-2'}>
          {attachments.map((attachment) => {
            const isDocument = attachment.source_type === 'document';
            const kind = getAttachmentKind(attachment);
            const { Icon, className: iconClass } = KIND_ICON[kind];
            return (
              <li
                key={attachment.filename}
                className={embedded
                  ? 'group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800/60 transition-colors'
                  : 'flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-600/40 bg-slate-800/40'}
              >
                {embedded && (
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {getAttachmentLabel(attachment)}
                  </p>
                  <p className={`text-xs text-slate-400 ${embedded ? 'mt-0.5 truncate' : 'mt-1'}`}>
                    {kind === 'table' ? 'Таблица' : isDocument ? 'Документ' : formatFileSize(attachment.size)}
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
                      onClick={() => handleUnlink(attachment)}
                      title="Убрать из задачи"
                      className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-red-200 hover:bg-red-900/30 text-xs font-medium transition-colors"
                    >
                      Отвязать
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
            Можно привязать документ или таблицу 2А, файл проекта или другой задачи, либо загрузить с компьютера
          </IconWithText>
        </p>
      )}

      <TaskAttachmentPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        taskId={taskId}
        projectId={projectId}
        linkedAttachments={attachments}
        onLinked={handleLinked}
      />
    </div>
  );
}
