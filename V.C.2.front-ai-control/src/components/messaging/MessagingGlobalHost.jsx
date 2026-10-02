import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useMessagingAlerts } from '../../context/MessagingAlertsContext';
import CallOverlay from '../calls/CallOverlay';
import IncomingCallBanner from '../calls/IncomingCallBanner';
import MessagingChatToast from './MessagingChatToast';
import toastStyles from './MessagingChatToast.module.css';
import MessagingMiniChat from './MessagingMiniChat';

export default function MessagingGlobalHost() {
  const location = useLocation();
  const isCallPopout = location.pathname === '/call';
  const {
    chatToasts,
    dismissChatToast,
    openMiniChat,
    closeMiniChat,
    miniChat,
  } = useMessagingAlerts();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {!isCallPopout && <IncomingCallBanner />}
      {!isCallPopout && chatToasts?.length > 0 && (
        <div className={toastStyles.stack}>
          {chatToasts.map((toast) => (
            <MessagingChatToast
              key={toast.id}
              toast={toast}
              onDismiss={dismissChatToast}
              onOpen={(item) => {
                dismissChatToast(item.id);
                openMiniChat(item.roomId, item.messageId);
              }}
            />
          ))}
        </div>
      )}
      {!isCallPopout && miniChat?.open && miniChat.roomId != null && (
        <MessagingMiniChat
          roomId={miniChat.roomId}
          focusMessageId={miniChat.focusMessageId}
          onClose={closeMiniChat}
        />
      )}
      {!isCallPopout && <CallOverlay />}
    </>,
    document.body
  );
}
