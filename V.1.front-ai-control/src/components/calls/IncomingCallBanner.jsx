import React from 'react';
import { PhoneIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useMessagingAlerts } from '../../context/MessagingAlertsContext';
import { useCallSessionOptional } from '../../context/CallSessionContext';
import { encodeCallDisplayName } from '../../calls/callDisplayName';
import { useAuth } from '../../context/AuthContext';
import { messagingService } from '../../services/messagingService';
import { partyhomeService } from '../../services/partyhomeService';
import { requestOpenRoom } from '../../services/messagingNavigation';
import styles from './IncomingCallBanner.module.css';

export default function IncomingCallBanner() {
  const { incomingCall, dismissIncomingCall } = useMessagingAlerts();
  const call = useCallSessionOptional();
  const { user } = useAuth();

  if (!incomingCall?.partyRoomId) return null;

  const handleJoin = async () => {
    const { partyRoomId, roomId, messageId } = incomingCall;
    dismissIncomingCall();
    try {
      let members = [];
      try {
        members = await messagingService.getRoomMembers(roomId);
      } catch {
        members = [];
      }
      await call?.joinCall?.({
        partyRoomId,
        chatRoomId: roomId,
        displayName: encodeCallDisplayName(user),
        selfUserId: user?.id,
        expectedMembers: (members || []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
        })),
      });
      requestOpenRoom(roomId, { messageId });
    } catch (err) {
      console.error('[incoming-call] join failed', err);
    }
  };

  const handleDecline = () => {
    const roomId = incomingCall.partyRoomId;
    dismissIncomingCall();
    if (roomId) {
      void partyhomeService.postRoomEvent(roomId, 'declined').catch(() => {});
    }
  };

  return (
    <div className={styles.banner} role="alertdialog" aria-label="Входящий видеозвонок">
      <div className={styles.icon} aria-hidden>
        <PhoneIcon />
      </div>
      <div className={styles.body}>
        <strong>Входящий видеозвонок</strong>
        <span>{incomingCall.title || 'Видеозвонок'}</span>
      </div>
      <button type="button" className={styles.join} onClick={() => void handleJoin()}>
        Присоединиться
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDecline}
        aria-label="Отклонить"
        title="Отклонить"
      >
        <XMarkIcon />
      </button>
    </div>
  );
}
