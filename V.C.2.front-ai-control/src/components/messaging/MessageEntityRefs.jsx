import React from 'react';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  LinkIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import CallInviteCard from '../calls/CallInviteCard';
import {
  entityRefKey,
  getEntityRefLabel,
  getEntityRefOpenLabel,
  openEntityRef,
} from '../../services/messagingEntityRefs';
import styles from '../../pages/profile/components/EmailTab.module.css';

const ENTITY_REF_ICONS = {
  document: DocumentTextIcon,
  template: DocumentTextIcon,
  task: ClipboardDocumentListIcon,
  project: FolderIcon,
  data_model: CubeIcon,
  dashboard: ChartBarIcon,
  dashboard_sheet: ChartBarIcon,
  dashboard_share: ChartBarIcon,
  employee: UserIcon,
};

/**
 * Shared entity cards for messaging / call / overview / editor AI chats.
 * Invitation-style: kind label + «Открыть …» action (opens object in new tab).
 * @param {{ entityRefs?: import('../../services/messagingEntityRefs').EntityRef[], className?: string, onJoinCall?: Function }} props
 */
export default function MessageEntityRefs({ entityRefs, className, onJoinCall }) {
  if (!entityRefs?.length) return null;
  const seen = new Set();
  const unique = entityRefs.filter((ref) => {
    const key = entityRefKey(ref);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return null;
  return (
    <div className={className}>
      {unique.map((ref) => {
        if (ref.type === 'call') {
          return (
            <CallInviteCard
              key={entityRefKey(ref)}
              entityRef={ref}
              onJoin={onJoinCall}
            />
          );
        }
        const Icon = ENTITY_REF_ICONS[ref.type] || LinkIcon;
        const kindLabel = getEntityRefLabel(ref);
        const buttonTitle = getEntityRefOpenLabel(ref);
        const objectTitle = String(ref.title || '').trim();
        const openTitle = objectTitle
          ? `${buttonTitle}: ${objectTitle}`
          : buttonTitle;
        return (
          <button
            key={entityRefKey(ref)}
            type="button"
            className={styles.entityRefCard}
            onClick={(e) => {
              e.stopPropagation();
              openEntityRef(ref);
            }}
            title={openTitle}
          >
            <Icon />
            <span className={styles.entityRefBody}>
              <span className={styles.entityRefKind}>{kindLabel}</span>
              <span className={styles.entityRefTitle}>{buttonTitle}</span>
              {objectTitle && objectTitle !== buttonTitle ? (
                <span className={styles.entityRefSubtitle}>{objectTitle}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
