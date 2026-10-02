import React, { useState } from 'react';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';
import Avatar from '../../../components/Avatar';
import ProfileWidgetsBoard from './ProfileWidgetsBoard';

/**
 * Страница профиля пользователя. Отображается только при activeTab === 'profile'.
 */
export default function Profile({ activeTab, user }) {
  const { updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (activeTab !== 'profile') return null;

  const handleAvatarUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const updatedUser = await authService.uploadAvatar(file);
      updateUser(updatedUser);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError('Ошибка загрузки аватара');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="card animate-slideInLeft">
        <div className="flex items-center gap-4 sm:gap-6 flex-col sm:flex-row sm:space-x-0">
          <div className="relative group">
            <Avatar
              src={user.avatar}
              name={user.name || user.login || 'U'}
              preset="avatar_lg"
              className="w-20 h-20 border-2 border-indigo-500 bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl"
            />
            <label className={`absolute inset-0 rounded-full bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : ''}`}>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="avatar-upload"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleAvatarUpload(file);
                  }
                }}
              />
              <span className="text-white text-xs">
                {uploading ? '⏳' : '📷'}
              </span>
            </label>
            {error && (
              <div className="absolute -bottom-8 left-0 right-0 text-xs text-red-500 text-center">
                {error}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {user.name || user.login || 'User'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {user.email || 'user@example.com'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300">
                Active
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300">
                {user.role || 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ProfileWidgetsBoard />
    </div>
  );
}
