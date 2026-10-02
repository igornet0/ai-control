import React from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { parseCallPartyRoomId } from '../../services/messagingEntityRefs';
import { useCallSessionOptional } from '../../context/CallSessionContext';
import { useMessagingAlerts } from '../../context/MessagingAlertsContext';
import { encodeCallDisplayName } from '../../calls/callDisplayName';
import { useAuth } from '../../context/AuthContext';
import styles from './CallInviteCard.module.css';

/**
 * @param {{ entityRef: { title?: string, url?: string }, onJoin?: (partyRoomId: string) => void }} props
 */
export default function CallInviteCard({ entityRef, onJoin }) {
  const call = useCallSessionOptional();
  const { user } = useAuth();
  const { dismissIncomingCall, incomingCall } = useMessagingAlerts();
  const partyRoomId = parseCallPartyRoomId(entityRef?.url);
  const title = entityRef?.title?.trim() || 'Видеозвонок';
  const alreadyIn =
    call?.active && call?.partyRoomId && partyRoomId && call.partyRoomId === partyRoomId;
  const ringing =
    incomingCall?.partyRoomId && partyRoomId && incomingCall.partyRoomId === partyRoomId;

  const handleJoin = () => {
    if (!partyRoomId || alreadyIn) return;
    dismissIncomingCall();
    if (onJoin) {
      onJoin(partyRoomId);
      return;
    }
    if (call?.joinCall) {
      void call.joinCall({
        partyRoomId,
        displayName: encodeCallDisplayName(user),
        selfUserId: user?.id,
        chatRoomId: entityRef?.id ?? null,
      });
    }
  };

  return (
    <div className={`${styles.card} ${ringing ? styles.cardRinging : ''}`}>
      <div className={styles.iconWrap} aria-hidden>
        <PhoneIcon />
      </div>
      <div className={styles.body}>
        <span className={styles.kind}>Видеозвонок</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>
          {alreadyIn
            ? 'Вы уже в этом звонке'
            : ringing
              ? 'Звонок… нажмите, чтобы ответить'
              : 'Идёт звонок — присоединитесь'}
        </span>
      </div>
      <button
        type="button"
        className={styles.joinBtn}
        disabled={!partyRoomId || alreadyIn}
        onClick={handleJoin}
      >
        {alreadyIn ? 'В звонке' : 'Присоединиться'}
      </button>
    </div>
  );
}
