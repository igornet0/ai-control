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
          <span className="text-gray-400 text-sm">No tags</span>
        ) : (
          tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
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
          placeholder="Add a tag..."
          className="flex-1 rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={handleAddTag}
          disabled={!newTag.trim() || tags.includes(newTag.trim())}
          className={`px-3 py-2 rounded-md text-white text-sm transition ${
            newTag.trim() && !tags.includes(newTag.trim())
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-600 cursor-not-allowed'
          }`}
        >
          Add
        </button>
      </div>

      {/* Список тегов */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="text-blue-600 hover:text-blue-800 text-sm font-bold"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-gray-400 text-sm text-center py-2">
          No tags added yet
        </div>
      )}
    </div>
  );
}
