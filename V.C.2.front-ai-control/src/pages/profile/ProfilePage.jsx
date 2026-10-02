// src/pages/profile/ProfilePage.jsx
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isPlatformAdmin } from '../../utils/isPlatformAdmin';

import ProfileSidebar from './components/ProfileSidebar';
import Profile from './components/Profile';
import FinanceTab from './components/FinanceTab';
import AdminPanel from './components/AdminPanel';
import EmployeesTab from './components/EmployeesTab';
import StrategyTab from './components/StrategyTab';
import EmailTab from './components/EmailTab';
import PrivacyTab from './components/PrivacyTab';
import pageStyles from './ProfilePage.module.css';
import { useMessagingAlerts } from '../../context/MessagingAlertsContext';
import {
  MMM_OPEN_DIRECT_EVENT,
  MMM_OPEN_MAIL_EVENT,
  MMM_OPEN_ROOM_EVENT,
} from '../../services/messagingNavigation';

const ProfilePage = ({ user, onLogout }) => {
  const location = useLocation();
  const { unreadTotal, requestBrowserPermission } = useMessagingAlerts();
  const [activeTab, setActiveTab] = useState('profile');
  const [pendingDmUserId, setPendingDmUserId] = useState(null);
  const [pendingOpenRoom, setPendingOpenRoom] = useState(null);

  const openEmailTab = (nextTab = 'email') => {
    setActiveTab(nextTab);
    requestBrowserPermission();
  };

  React.useEffect(() => {
    const dmUserId = location.state?.dmUserId;
    if (!dmUserId) return;
    openEmailTab('email');
    setPendingDmUserId(Number(dmUserId));
    window.history.replaceState({}, document.title);
  }, [location.state?.dmUserId]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const dm = params.get('dm');
    if (!dm) return;
    openEmailTab('email');
    setPendingDmUserId(Number(dm));
  }, [location.search]);

  React.useEffect(() => {
    const roomId = location.state?.openRoomId;
    if (!roomId) return;
    openEmailTab('email');
    setPendingOpenRoom({
      roomId: Number(roomId),
      messageId: location.state?.openMessageId
        ? Number(location.state.openMessageId)
        : null,
    });
    window.history.replaceState({}, document.title);
  }, [location.state?.openRoomId, location.state?.openMessageId]);

  React.useEffect(() => {
    const handler = (event) => {
      const userId = event.detail?.userId;
      if (!userId) return;
      openEmailTab('email');
      setPendingDmUserId(Number(userId));
    };
    const openMessaging = () => openEmailTab('email');
    window.addEventListener(MMM_OPEN_DIRECT_EVENT, handler);
    window.addEventListener(MMM_OPEN_ROOM_EVENT, openMessaging);
    window.addEventListener(MMM_OPEN_MAIL_EVENT, openMessaging);
    return () => {
      window.removeEventListener(MMM_OPEN_DIRECT_EVENT, handler);
      window.removeEventListener(MMM_OPEN_ROOM_EVENT, openMessaging);
      window.removeEventListener(MMM_OPEN_MAIL_EVENT, openMessaging);
    };
  }, []);

  return (
    <div className={pageStyles.layout} style={{ background: 'var(--gradient-secondary)' }}>
      <ProfileSidebar
        activeTab={activeTab}
        setActiveTab={(key) => {
          if (key === 'admin' && !isPlatformAdmin(user)) return;
          if (key === 'email') requestBrowserPermission();
          setActiveTab(key);
        }}
        onLogout={onLogout}
        user={user}
        badges={{ email: unreadTotal }}
      />
      <main
        className={`${pageStyles.main} ${
          activeTab === 'email' ? pageStyles.mainMessaging : ''
        }`}
      >
        <div
          className={`${pageStyles.content} ${
            activeTab === 'email' ? pageStyles.contentWide : ''
          }`}
        >
          <Profile
            activeTab={activeTab}
            user={user}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
          />
          <PrivacyTab activeTab={activeTab} user={user} />
          <FinanceTab activeTab={activeTab} />
          <EmployeesTab activeTab={activeTab} user={user} />
          <EmailTab
            activeTab={activeTab}
            user={user}
            pendingDmUserId={pendingDmUserId}
            onPendingDmHandled={() => setPendingDmUserId(null)}
            pendingOpenRoom={pendingOpenRoom}
            onPendingOpenRoomHandled={() => setPendingOpenRoom(null)}
          />
          <AdminPanel activeTab={activeTab} />
          <StrategyTab activeTab={activeTab} user={user} />
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
