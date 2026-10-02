import React, { useState } from 'react';

export default function TaskTags({ tags = [], onTagsChange, readOnly = false }) {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    
    const updatedTags = [...tags, newTag.trim()];
    onTagsChange(updatedTags);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    onTagsChange(updatedTags);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-slate-400 text-sm">Нет тегов</span>
        ) : (
          tags.map((tag, index) => (
            <span
              key={index}
              className="px-2.5 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full border border-blue-700/50"
            >
              {tag}
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Поле добавления тега */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Добавить тег..."
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:border-slate-500"
        />
        <button
          onClick={handleAddTag}
          disabled={!newTag.trim() || tags.includes(newTag.trim())}
          className={`px-4 py-2.5 rounded-lg text-white text-sm transition-all duration-200 ${
            newTag.trim() && !tags.includes(newTag.trim())
              ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          Добавить
        </button>
      </div>

      {/* Список тегов */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full border border-blue-700/50 hover:bg-blue-800/50 transition-colors duration-200"
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="text-blue-400 hover:text-red-400 text-sm font-bold transition-colors duration-200 rounded-full hover:bg-blue-800/50 w-4 h-4 flex items-center justify-center"
              title="Удалить тег"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-slate-500 text-sm text-center py-2 italic">
          Теги не добавлены
        </div>
      )}
    </div>
  );
}
