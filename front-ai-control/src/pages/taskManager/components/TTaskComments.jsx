import React, { useState, useEffect } from 'react';
import { getTaskComments, addTaskComment } from '../../../services/taskService';

export default function TaskComments({ taskId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  useEffect(() => {
    if (taskId) {
      loadComments();
    }
  }, [taskId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await getTaskComments(taskId);
      setComments(commentsData);
      setApiAvailable(true);
    } catch (error) {
      console.error('Error loading comments:', error);
      if (error.response?.status === 404) {
        setApiAvailable(false);
        setComments([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !apiAvailable) return;

    try {
      setSubmitting(true);
      const commentData = {
        content: newComment.trim(),
        author_id: currentUser?.id,
        task_id: taskId
      };

      await addTaskComment(taskId, commentData);
      setNewComment('');
      await loadComments(); // Перезагружаем комментарии
    } catch (error) {
      console.error('Error adding comment:', error);
      if (error.response?.status === 404) {
        setApiAvailable(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  // Если API недоступен, показываем заглушку
  if (!apiAvailable) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Comments</h3>
        <div className="text-center text-gray-400 text-sm py-4">
          Comments feature is not available yet
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Comments</h3>
        <div className="text-center text-gray-400 text-sm py-4">
          Loading comments...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Comments</h3>
      
      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmitComment} className="mb-4">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={2}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className={`px-4 py-2 rounded-md text-white transition ${
              newComment.trim() && !submitting
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>

      {/* Список комментариев */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border-l-2 border-gray-600 pl-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">
                    {comment.author_name ? comment.author_name.split(' ').map(n => n[0]).join('') : 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-300">
                    {comment.author_name || 'Unknown User'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-300 ml-8">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
