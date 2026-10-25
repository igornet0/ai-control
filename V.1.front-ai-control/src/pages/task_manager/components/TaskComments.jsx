import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrashIcon,
  EyeSlashIcon,
  EyeIcon,
  ArrowUturnLeftIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import {
  getTaskComments,
  addTaskComment,
  deleteTaskComment,
  updateTaskComment,
  setTaskCommentHidden,
} from '../../../services/taskService';
import { CommentsIcon, EmptyCommentsIcon } from './TaskManagerIcons';
import {
  buildCommentTree,
  flattenCommentTree,
  countCommentsInTree,
  COMMENTS_COLLAPSE_LIMIT,
} from '../utils/commentTreeUtils';

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isCommentEdited(comment) {
  if (!comment?.created || !comment?.updated) return false;
  const created = new Date(comment.created).getTime();
  const updated = new Date(comment.updated).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 1000;
}

function CommentItem({
  comment,
  depth,
  currentUserId,
  canModerate,
  replyToId,
  setReplyToId,
  onDelete,
  onToggleHidden,
  onUpdate,
}) {
  const isReplying = replyToId === comment.id;
  const hidden = Boolean(comment.is_hidden);
  const isAuthor = currentUserId != null && comment.author_id === currentUserId;
  const canDelete = canModerate || isAuthor;
  const edited = isCommentEdited(comment);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.content) {
      setIsEditing(false);
      setEditText(comment.content);
      return;
    }
    try {
      setSaving(true);
      await onUpdate(comment.id, trimmed);
      setIsEditing(false);
    } catch {
      // error logged in parent
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(comment.content);
    setIsEditing(false);
  };

  return (
    <div
      className={`border-l-2 pl-4 py-2 bg-slate-800/20 rounded-r-lg hover:bg-slate-800/30 transition-all duration-200 ${
        hidden ? 'border-slate-600/50 opacity-60' : 'border-blue-500/50'
      }`}
      style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 1.25}rem` : 0 }}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-xs text-white font-semibold shadow-md">
            {comment.author_name ? comment.author_name.split(' ').map((n) => n[0]).join('') : 'U'}
          </div>
          <span className="text-sm font-medium text-slate-200 truncate">
            {comment.author_name || 'Неизвестный пользователь'}
          </span>
          {comment.is_support_reply && (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">{comment.support_signature || 'Служба поддержки'}</span>
          )}
          {hidden && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">Скрыт</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-end text-right mr-1">
            <span className="text-xs text-slate-400">{formatDate(comment.created)}</span>
            {edited && (
              <span className="text-xs text-slate-500" title={`Изменено ${formatDate(comment.updated)}`}>
                изм. {formatDate(comment.updated)}
              </span>
            )}
          </div>
          {!hidden && !isEditing && (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-blue-300"
              title="Ответить"
              onClick={() => setReplyToId(isReplying ? null : comment.id)}
            >
              <ArrowUturnLeftIcon className="h-4 w-4" />
            </button>
          )}
          {isAuthor && !hidden && !isEditing && (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-green-300"
              title="Изменить комментарий"
              onClick={() => {
                setEditText(comment.content);
                setIsEditing(true);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-amber-300"
              title={hidden ? 'Показать комментарий' : 'Скрыть комментарий'}
              onClick={() => onToggleHidden(comment)}
            >
              {hidden ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-red-400"
              title="Удалить комментарий"
              onClick={() => onDelete(comment.id)}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="ml-10 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-lg border border-slate-600/50 bg-slate-800/50 p-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            rows={3}
            disabled={saving}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!editText.trim() || saving}
              className="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              onClick={handleSaveEdit}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              disabled={saving}
              className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
              onClick={handleCancelEdit}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <p className={`text-sm ml-10 leading-relaxed ${hidden ? 'text-slate-500 italic' : 'text-slate-300'}`}>
          {hidden && !canModerate && !isAuthor ? 'Комментарий скрыт модератором' : comment.content}
        </p>
      )}
    </div>
  );
}

export default function TaskComments({ taskId, task, currentUser, canModerate = false }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const currentUserId = currentUser?.id ?? null;
  const [replyToReporter, setReplyToReporter] = useState(false);
  const inputRef = useRef(null);
  const canReplyToReporter = Boolean(task?.permissions?.is_support_staff)
    && task?.creator_id != null && task.creator_id !== currentUserId;

  useEffect(() => {
    if (taskId) {
      loadComments();
    }
  }, [taskId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await getTaskComments(taskId);
      setComments(Array.isArray(commentsData) ? commentsData : []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const flatComments = useMemo(() => flattenCommentTree(commentTree), [commentTree]);
  const totalCount = useMemo(() => countCommentsInTree(commentTree), [commentTree]);
  const visibleFlat = expanded ? flatComments : flatComments.slice(0, COMMENTS_COLLAPSE_LIMIT);
  const hiddenCount = Math.max(0, totalCount - COMMENTS_COLLAPSE_LIMIT);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await addTaskComment(taskId, {
        content: newComment.trim(),
        is_internal: false,
        parent_id: replyToId || null,
      });
      setNewComment('');
      setReplyToId(null);
      setReplyToReporter(false);
      await loadComments();
      if (totalCount + 1 > COMMENTS_COLLAPSE_LIMIT) {
        setExpanded(true);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;
    try {
      await deleteTaskComment(taskId, commentId);
      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleUpdateComment = async (commentId, content) => {
    try {
      await updateTaskComment(taskId, commentId, content);
      await loadComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  };

  const handleToggleHidden = async (comment) => {
    try {
      await setTaskCommentHidden(taskId, comment.id, !comment.is_hidden);
      await loadComments();
    } catch (error) {
      console.error('Error updating comment visibility:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400 bg-slate-800/30 backdrop-blur-sm rounded-lg border border-slate-700/50">
        Загрузка комментариев...
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-700/50">
      <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
        <CommentsIcon size="md" />
        <span>Комментарии</span>
        {totalCount > 0 && (
          <span className="text-sm font-normal text-slate-400">({totalCount})</span>
        )}
      </h3>

      {canReplyToReporter && (
        <button
          type="button"
          onClick={() => {
            setReplyToId(null);
            setReplyToReporter(true);
            inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 ${replyToReporter ? 'ring-2 ring-emerald-400/60' : ''}`}
        >
          Ответить сотруднику
        </button>
      )}

      <form onSubmit={handleSubmitComment} className="mb-4">
        {replyToReporter && !replyToId && (
          <div className="mb-2 flex items-center justify-between text-xs text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg">
            <span>Ответ сотруднику {task?.creator_name || `#${task?.creator_id}`} — уведомление придёт ему в чат</span>
            <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => setReplyToReporter(false)}>
              Отмена
            </button>
          </div>
        )}
        {replyToId && (
          <div className="mb-2 flex items-center justify-between text-xs text-blue-300 bg-blue-500/10 px-3 py-2 rounded-lg">
            <span>Ответ на комментарий #{replyToId}</span>
            <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => setReplyToId(null)}>
              Отмена
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyToId ? 'Напишите ответ...' : replyToReporter ? 'Напишите ответ сотруднику...' : 'Добавьте комментарий...'}
            className="flex-1 rounded-lg border border-slate-600/50 bg-slate-800/50 backdrop-blur-sm p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-slate-500/50"
            rows={2}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className={`px-4 py-3 rounded-lg text-white font-medium transition-all duration-200 ${
              newComment.trim() && !submitting
                ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg'
                : 'bg-slate-700/50 cursor-not-allowed opacity-60'
            }`}
          >
            {submitting ? 'Отправка...' : replyToId ? 'Ответить' : replyToReporter ? 'Ответить сотруднику' : 'Отправить'}
          </button>
        </div>
      </form>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {flatComments.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-6 bg-slate-800/20 rounded-lg border border-slate-700/30">
            <EmptyCommentsIcon size="2xl" className="mx-auto mb-2 text-slate-500" />
            <p>Пока нет комментариев. Будьте первым!</p>
          </div>
        ) : (
          <>
            {visibleFlat.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={comment.depth}
                currentUserId={currentUserId}
                canModerate={canModerate}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                onDelete={handleDeleteComment}
                onToggleHidden={handleToggleHidden}
                onUpdate={handleUpdateComment}
              />
            ))}
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                className="w-full py-2 text-sm text-blue-300 hover:text-blue-200 bg-slate-800/30 rounded-lg border border-slate-700/50"
                onClick={() => setExpanded(true)}
              >
                Показать ещё {hiddenCount} из {totalCount} комментариев
              </button>
            )}
            {expanded && totalCount > COMMENTS_COLLAPSE_LIMIT && (
              <button
                type="button"
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setExpanded(false)}
              >
                Свернуть
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
