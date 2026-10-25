import React, { useState } from 'react';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';
import Avatar from '../../../components/Avatar';
import ProfileWidgetsBoard from './ProfileWidgetsBoard';
import styles from './ProfileTabs.module.css';

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
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.avatarWrap}>
          <Avatar
            src={user.avatar}
            name={user.name || user.login || 'U'}
            preset="avatar_lg"
            className={`${styles.avatar} bg-gradient-to-br from-indigo-500 to-purple-600`}
          />
          <label
            className={`${styles.avatarOverlay} ${uploading ? styles.avatarOverlayBusy : ''}`}
            title="Сменить аватар"
          >
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
            <span>{uploading ? '⏳' : '📷'}</span>
          </label>
          {!uploading && <span className={styles.avatarEdit} aria-hidden="true">✎</span>}
        </div>

        <div className={styles.heroInfo}>
          <span className={styles.eyebrow}>Профиль</span>
          <h1 className={styles.heroName}>{user.name || user.login || 'User'}</h1>
          <p className={styles.heroEmail}>{user.email || 'user@example.com'}</p>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
            <span className={`${styles.badge} ${styles.badgeInfo}`}>{user.role || 'User'}</span>
          </div>
          {error && <div className={styles.inlineError}>{error}</div>}
        </div>
      </section>

      <ProfileWidgetsBoard />
    </div>
  );
}
