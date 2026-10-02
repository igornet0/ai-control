import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUturnLeftIcon,
  ArrowDownIcon,
  ArrowPathRoundedSquareIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InboxIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  LinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PhoneIcon,
  XMarkIcon,
  UsersIcon,
  UserPlusIcon,
  PlusIcon,
  Bars3Icon,
  BookmarkIcon,
  MagnifyingGlassIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon, BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { messagingService } from '../../../services/messagingService';
import {
  AI_ASSISTANT_USER_ID,
  messageMentionsAi,
  messagingAiService,
  splitAiMentions,
} from '../../../services/messagingAiService';
import { employeeService } from '../../../services/employeeService';
import { partyhomeService } from '../../../services/partyhomeService';
import Avatar from '../../../components/Avatar';
import { MediaBatchProvider, lookupMediaUrl, useMediaBatchMap } from '../../../hooks/useMediaBatch';
import { formatUnreadCount, showBrowserNotification } from '../../../services/browserNotifications';
import { useMessagingAlerts } from '../../../context/MessagingAlertsContext';
import { useCallSession } from '../../../context/CallSessionContext';
import { MMM_OPEN_MAIL_EVENT, MMM_OPEN_ROOM_EVENT } from '../../../services/messagingNavigation';
import {
  buildCallEntityRef,
  getEntityRefLabel,
  getEntityRefOpenLabel,
  openEntityRef,
} from '../../../services/messagingEntityRefs';
import { encodeCallDisplayName } from '../../../calls/callDisplayName';
import CallInviteCard from '../../../components/calls/CallInviteCard';
import { getAttachmentPreviewKind } from '../../../services/messagingAttachmentPreview';
import {
  applyRoomLayout,
  bumpRoomActivity as bumpRoomActivityInLayout,
  loadRoomLayout,
  reorderPinnedRooms,
  saveRoomLayout,
  syncLayoutWithRooms,
  toggleRoomPin,
} from '../../../services/messagingRoomLayout';
import EntityAttachPicker from './EntityAttachPicker';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import CreateRoomModal from './CreateRoomModal';
import AddRoomMembersModal from './AddRoomMembersModal';
import RenameRoomModal from './RenameRoomModal';
import DeleteRoomConfirmModal from './DeleteRoomConfirmModal';
import EmployeeHoverTrigger from './employees/EmployeeHoverTrigger';
import Notification from '../../../components/Notification';
import MailPane from './MailPane';
import AiAgentChat from './AiAgentChat';
import { aiAgentService } from '../../../services/aiAgentService';
import MarkdownContent from '../../../components/MarkdownContent';
import styles from './EmailTab.module.css';

const ROOM_TYPE_LABELS = {
  department: 'Отдел',
  team: 'Команда',
  project: 'Проект',
  executive: 'Руководство',
  management: 'Менеджеры',
  cross_department: 'Общий чат',
  custom: 'Свой чат',
  direct: 'Личные',
  notification: 'Уведомления',
};

const ROOM_TONE = {
  department: styles.toneDepartment,
  team: styles.toneTeam,
  project: styles.toneProject,
  executive: styles.toneExecutive,
  management: styles.toneManagement,
  cross_department: styles.toneCross,
  custom: styles.toneCustom,
  direct: styles.toneDirect,
  notification: styles.toneNotification,
};


const NEAR_BOTTOM_PX = 80;
const COMPOSER_MAX_LINES = 10;

function getDirectPeerId(room, currentUserId) {
  if (room?.peer?.id) return room.peer.id;
  if (room?.room_type !== 'direct' || !room?.slug) return null;
  const match = String(room.slug).match(/^direct:(\d+)-(\d+)$/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === currentUserId) return b;
  if (b === currentUserId) return a;
  return null;
}

function getRoomDisplayName(room, currentUser) {
  if (room?.room_type !== 'direct') return room?.name || '';
  if (room?.peer?.name) return room.peer.name;
  const parts = String(room?.name || '')
    .split('↔')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 2 && currentUser?.name) {
    return parts.find((part) => part !== currentUser.name) || parts[0];
  }
  return parts[0] || room?.name || '';
}

function RoomAvatar({ room, tone, peerAvatars, currentUser }) {
  const displayName = getRoomDisplayName(room, currentUser);
  const isDirect = room?.room_type === 'direct';
  const peerId = isDirect ? getDirectPeerId(room, currentUser?.id) : null;
  const avatarPath = peerId ? peerAvatars?.[peerId] : null;
  const avatarClass = `${styles.roomAvatar} ${isDirect ? styles.roomAvatarDirect : ''} ${tone}`;

  return (
    <Avatar
      src={avatarPath}
      name={displayName}
      preset="avatar_md"
      batchKey={peerId ? `avatar:${peerId}` : undefined}
      className={`${avatarClass} ${avatarPath ? styles.roomAvatarImageWrap : ''}`}
      imgClassName={styles.roomAvatarImage}
      rounded={isDirect ? 'full' : 'lg'}
    />
  );
}

function MemberAvatar({ member, avatarPath, className = '' }) {
  return (
    <Avatar
      src={avatarPath}
      name={member?.name}
      preset="avatar_md"
      batchKey={member?.id ? `avatar:${member.id}` : undefined}
      className={`${styles.memberAvatar} ${avatarPath ? styles.memberAvatarImageWrap : ''} ${className}`}
      imgClassName={styles.memberAvatarImage}
    />
  );
}

function MessageAuthorAvatar({ authorId, authorProfiles, peerAvatars }) {
  if (authorId == null || authorId === '') return null;

  if (Number(authorId) === AI_ASSISTANT_USER_ID) {
    return (
      <div className={styles.bubbleAvatarTrigger} title="AI Ассистент">
        <div className={`${styles.bubbleAvatar} ${styles.aiAssistantAvatar}`} aria-hidden>
          AI
        </div>
      </div>
    );
  }

  const profile = authorProfiles[authorId] || { id: authorId, name: null };
  const avatarPath = peerAvatars[authorId] ?? profile.avatar;
  const avatarInner = (
    <Avatar
      src={avatarPath}
      name={profile.name}
      preset="avatar_sm"
      batchKey={`avatar:${authorId}`}
      className={`${styles.bubbleAvatar} ${avatarPath ? styles.bubbleAvatarImageWrap : ''}`}
      imgClassName={styles.bubbleAvatarImage}
    />
  );

  return (
    <EmployeeHoverTrigger
      employee={profile}
      className={styles.bubbleAvatarTrigger}
      clickToPin
      profileSource="chat"
    >
      {avatarInner}
    </EmployeeHoverTrigger>
  );
}

function MessageContentWithMentions({ content, asMarkdown = false }) {
  if (asMarkdown) {
    return (
      <div className={`${styles.bubbleText} ${styles.bubbleMarkdown}`}>
        <MarkdownContent>{content}</MarkdownContent>
      </div>
    );
  }
  const parts = splitAiMentions(content);
  return (
    <div className={styles.bubbleText}>
      {parts.map((part, idx) => (
        part.type === 'mention' ? (
          <span key={`m-${idx}`} className={styles.aiMention}>{part.value}</span>
        ) : (
          <React.Fragment key={`t-${idx}`}>{part.value}</React.Fragment>
        )
      ))}
    </div>
  );
}

function memberRoleLabel(member) {
  if (member?.role === 'owner') return 'Владелец';
  if (member?.role === 'admin') return 'Администратор';
  if (member?.role === 'member') return 'Участник';
  if (member?.team_role) return member.team_role;
  return member?.role || '—';
}

function isManageableCustomRoom(room) {
  return room?.room_type === 'custom' && !room?.is_system;
}

function getMyRoomRole(room, roomMembers, userId) {
  if (room?.my_role) return room.my_role;
  if (!userId || !roomMembers?.length) return null;
  return roomMembers.find((member) => member.id === userId)?.role || null;
}

function isRoomOwner(room, roomMembers, userId) {
  return getMyRoomRole(room, roomMembers, userId) === 'owner';
}

function isRoomAdminOrOwner(room, roomMembers, userId) {
  const role = getMyRoomRole(room, roomMembers, userId);
  return role === 'owner' || role === 'admin';
}

function canRemoveRoomMember(room, actorRole, member, currentUserId) {
  if (!isManageableCustomRoom(room)) return false;
  if (member.role === 'owner') return false;
  if (member.id === currentUserId) {
    return actorRole !== 'owner';
  }
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return member.role === 'member';
  return false;
}

function canChangeRoomMemberRole(room, roomMembers, userId, member) {
  return (
    isManageableCustomRoom(room) &&
    isRoomOwner(room, roomMembers, userId) &&
    member.role !== 'owner'
  );
}

function formatMessageTime(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Сегодня';
  if (sameDay(d, yesterday)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}


function previewText(content, max = 80) {
  const t = String(content || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function storeReadCursors(readCursorsRef, roomId, readCursors) {
  if (!roomId) return;
  const map = {};
  (readCursors || []).forEach((c) => {
    map[c.user_id] = c.last_read_message_id || 0;
  });
  readCursorsRef.current[roomId] = map;
}

function recomputeOwnMessagesRead(messages, readCursorsRef, roomId, myId) {
  const cursors = readCursorsRef.current[roomId] || {};
  const otherIds = Object.keys(cursors)
    .map(Number)
    .filter((id) => id !== myId);
  if (otherIds.length === 0) return messages;
  return messages.map((m) => {
    if (m.author_id !== myId) return m;
    const read = otherIds.every((uid) => (cursors[uid] || 0) >= m.id);
    return { ...m, read_by_others: read };
  });
}

function MessageReadStatus({ readByOthers }) {
  if (readByOthers == null) return null;
  const title = readByOthers ? 'Прочитано' : 'Отправлено';
  if (!readByOthers) {
    return (
      <span className={styles.readChecks} title={title} aria-hidden>
        <CheckIcon className={styles.readCheck} />
      </span>
    );
  }
  return (
    <span className={`${styles.readChecks} ${styles.readChecksRead}`} title={title} aria-hidden>
      <CheckIcon className={styles.readCheck} />
      <CheckIcon className={`${styles.readCheck} ${styles.readCheckSecond}`} />
    </span>
  );
}

function attachmentSrc(att) {
  return messagingService.getAttachmentUrl(att.id);
}

function entityRefKey(ref) {
  return `${ref.type}:${ref.id}${ref.dashboard_id ? `:${ref.dashboard_id}` : ''}${ref.url ? `:${ref.url}` : ''}`;
}

const ENTITY_REF_ICONS = {
  document: DocumentTextIcon,
  task: ClipboardDocumentListIcon,
  dashboard: ChartBarIcon,
  dashboard_sheet: ChartBarIcon,
  dashboard_share: ChartBarIcon,
  employee: UserIcon,
};

function MessageEntityRefs({ entityRefs, className, onJoinCall }) {
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
        const openTitle = objectTitle && objectTitle !== buttonTitle
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

function buildImageSlides(attachments) {
  return (attachments || [])
    .filter((att) => getAttachmentPreviewKind(att) === 'image')
    .map((att) => ({
      id: att.id,
      src: attachmentSrc(att),
      name: att.original_filename,
    }));
}

const PREVIEW_KIND_LABELS = {
  pdf: 'PDF',
  video: 'Видео',
  csv: 'CSV',
  excel: 'Excel',
  word: 'Word',
  text: 'Текст',
};

const ATTACHMENT_KIND_PREFIXES = {
  image: 'Фото',
  pdf: 'PDF',
  video: 'Видео',
  csv: 'CSV',
  excel: 'Excel',
  word: 'Word',
  text: 'Текст',
};

function attachmentPreviewLabel(att) {
  const kind = getAttachmentPreviewKind(att);
  const name = att.original_filename || 'файл';
  const prefix = ATTACHMENT_KIND_PREFIXES[kind] || 'Файл';
  return `${prefix} · ${name}`;
}

function buildMessagePreview(message, max = 60) {
  if (!message) return 'Нет сообщений';
  const text = String(message.content || '').replace(/\s+/g, ' ').trim();
  if (text) return previewText(text, max);

  const attachments = message.attachments || [];
  const entityRefs = message.entity_refs || [];

  if (attachments.length === 1) {
    return attachmentPreviewLabel(attachments[0]);
  }
  if (attachments.length > 1) {
    const allImages = attachments.every((att) => getAttachmentPreviewKind(att) === 'image');
    return allImages ? `${attachments.length} фото` : `${attachments.length} вложения`;
  }
  if (entityRefs.length === 1) {
    const title = entityRefs[0].title?.trim();
    return title
      ? `${getEntityRefLabel(entityRefs[0])}: ${previewText(title, max - 20)}`
      : getEntityRefLabel(entityRefs[0]);
  }
  if (entityRefs.length > 1) {
    return `${entityRefs.length} ссылки`;
  }
  return 'Сообщение';
}

function shouldReplaceRoomLastMessage(candidate, current) {
  if (!current) return true;
  if (!candidate) return false;
  const candId = Number(candidate.id) || 0;
  const curId = Number(current.id) || 0;
  if (candId === curId) return true;
  return candId > curId;
}

function ImageLightbox({ gallery, onClose, onChangeIndex }) {
  const thumbsRef = useRef(null);
  const { images, index } = gallery;
  const current = images[index];
  const hasMultiple = images.length > 1;

  const goPrev = useCallback(() => {
    onChangeIndex((index - 1 + images.length) % images.length);
  }, [images.length, index, onChangeIndex]);

  const goNext = useCallback(() => {
    onChangeIndex((index + 1) % images.length);
  }, [images.length, index, onChangeIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (!hasMultiple) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, hasMultiple, onClose]);

  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip || !hasMultiple) return;
    const active = strip.querySelector(`[data-thumb-index="${index}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [index, hasMultiple]);

  if (!current) return null;

  return (
    <div
      className={styles.lightboxBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображений"
    >
      <div className={styles.lightboxPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.lightboxHead}>
          <div className={styles.lightboxHeadInfo}>
            <span className={styles.lightboxTitle}>{current.name}</span>
            {hasMultiple && (
              <span className={styles.lightboxCounter}>
                {index + 1} / {images.length}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.lightboxStage}>
          {hasMultiple && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
              onClick={goPrev}
              aria-label="Предыдущее изображение"
            >
              <ChevronLeftIcon />
            </button>
          )}
          <img
            key={current.id ?? current.src}
            src={current.src}
            alt={current.name}
            className={styles.lightboxImage}
          />
          {hasMultiple && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
              onClick={goNext}
              aria-label="Следующее изображение"
            >
              <ChevronRightIcon />
            </button>
          )}
        </div>

        {hasMultiple && (
          <div className={styles.lightboxThumbs} ref={thumbsRef}>
            {images.map((img, i) => (
              <button
                key={img.id ?? i}
                type="button"
                data-thumb-index={i}
                className={`${styles.lightboxThumb} ${
                  i === index ? styles.lightboxThumbActive : ''
                }`}
                onClick={() => onChangeIndex(i)}
                aria-label={`Изображение ${i + 1}: ${img.name}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <img src={img.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <a
          href={current.src}
          download={current.name}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.lightboxDownload}
        >
          Скачать
        </a>
      </div>
    </div>
  );
}

function MessageAttachments({ attachments, onOpenImage, onOpenPreview, className }) {
  const batch = useMediaBatchMap();
  if (!attachments?.length) return null;
  const imageSlides = buildImageSlides(attachments).map((slide) => ({
    ...slide,
    src: lookupMediaUrl(batch?.urls, `att:${slide.id}`, `attachment://${slide.id}`) || slide.src,
  }));

  return (
    <div className={className}>
      {attachments.map((att) => {
        const kind = getAttachmentPreviewKind(att);

        if (kind === 'image') {
          const imageIndex = imageSlides.findIndex((img) => img.id === att.id);
          return (
            <button
              key={att.id}
              type="button"
              className={styles.attachmentImageBtn}
              onClick={(e) => {
                e.stopPropagation();
                onOpenImage({ images: imageSlides, index: Math.max(imageIndex, 0) });
              }}
              title={`Открыть: ${att.original_filename}`}
            >
              <img
                src={imageSlides[imageIndex]?.src}
                alt={att.original_filename}
                className={styles.attachmentImage}
                loading="lazy"
              />
            </button>
          );
        }

        if (kind === 'pdf') {
          const src = attachmentSrc(att);
          return (
            <div key={att.id} className={styles.attachmentPdfWrap}>
              <button
                type="button"
                className={styles.attachmentPdfBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview(att);
                }}
                title={`Открыть PDF: ${att.original_filename}`}
              >
                <div className={styles.attachmentPdfClip}>
                  <iframe
                    src={src}
                    title={att.original_filename}
                    className={styles.attachmentPdfInline}
                    tabIndex={-1}
                  />
                </div>
                <span className={styles.attachmentPdfOverlay}>
                  <span className={styles.attachmentPreviewBadge}>PDF</span>
                  <span className={styles.attachmentPdfName}>{att.original_filename}</span>
                </span>
              </button>
            </div>
          );
        }

        if (kind === 'video') {
          const src = attachmentSrc(att);
          return (
            <div key={att.id} className={styles.attachmentVideoWrap}>
              <video
                src={src}
                className={styles.attachmentVideo}
                controls
                preload="metadata"
                playsInline
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className={styles.attachmentVideoExpand}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview(att);
                }}
                title={`Открыть видео: ${att.original_filename}`}
              >
                <PlayIcon />
                <span>Развернуть</span>
              </button>
            </div>
          );
        }

        if (['csv', 'excel', 'word', 'text'].includes(kind)) {
          return (
            <button
              key={att.id}
              type="button"
              className={styles.attachmentPreviewCard}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPreview(att);
              }}
              title={`Просмотр: ${att.original_filename}`}
            >
              <DocumentIcon />
              <span className={styles.attachmentFileName}>{att.original_filename}</span>
              <span className={styles.attachmentPreviewBadge}>
                {PREVIEW_KIND_LABELS[kind] || 'Файл'}
              </span>
            </button>
          );
        }

        return (
          <a
            key={att.id}
            href={attachmentSrc(att)}
            download={att.original_filename}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.attachmentFile}
            onClick={(e) => e.stopPropagation()}
          >
            <DocumentIcon />
            <span className={styles.attachmentFileName}>{att.original_filename}</span>
            <span className={styles.attachmentFileSize}>{formatFileSize(att.size_bytes)}</span>
          </a>
        );
      })}
    </div>
  );
}

export default function EmailTab({
  activeTab,
  user,
  pendingDmUserId = null,
  onPendingDmHandled,
  pendingOpenRoom = null,
  onPendingOpenRoomHandled,
}) {
  const [subTab, setSubTab] = useState('chats');
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [showJumpDown, setShowJumpDown] = useState(false);
  const {
    unreadByRoom,
    unreadChatCount,
    unreadMailCount,
    setViewing,
    subscribeWs,
    hydrateUnreadFromRooms,
    clearRoomUnread,
    requestBrowserPermission,
  } = useMessagingAlerts();
  const { joinCall, active: callActive } = useCallSession();
  const { dismissIncomingCall } = useMessagingAlerts();
  const [startingCall, setStartingCall] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [forwardMessages, setForwardMessages] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [pendingEntityRefs, setPendingEntityRefs] = useState([]);
  const [editAttachmentItems, setEditAttachmentItems] = useState([]);
  const [editEntityRefs, setEditEntityRefs] = useState([]);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [roomMembers, setRoomMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSearch, setMembersSearch] = useState('');
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardEmployees, setForwardEmployees] = useState([]);
  const [forwardEmployeesLoading, setForwardEmployeesLoading] = useState(false);
  const [peerAvatars, setPeerAvatars] = useState({});
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [roomLayout, setRoomLayout] = useState({ pinned: [], activity: {} });
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showRenameRoom, setShowRenameRoom] = useState(false);
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState(false);
  const [roomManaging, setRoomManaging] = useState(false);
  const [draggingRoomId, setDraggingRoomId] = useState(null);
  const [dragOverRoomId, setDragOverRoomId] = useState(null);
  const [composerDropActive, setComposerDropActive] = useState(false);
  const [roomLastMessageById, setRoomLastMessageById] = useState({});
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [aiAgentInfo, setAiAgentInfo] = useState(null);
  const [selectedAiAgent, setSelectedAiAgent] = useState(false);
  const [checkedRoomIds, setCheckedRoomIds] = useState(() => new Set());
  const [deletingRooms, setDeletingRooms] = useState(false);
  const membersPanelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesBoxRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerDragDepthRef = useRef(0);
  const contextMenuRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const roomsRef = useRef(rooms);
  const userIdRef = useRef(user?.id);
  const subTabRef = useRef(subTab);
  const activeTabRef = useRef(activeTab);
  const messagesRef = useRef(messages);
  const hasOlderRef = useRef(hasOlder);
  const authorProfilesRef = useRef(authorProfiles);
  const readCursorsRef = useRef({});
  const lastMarkedReadRef = useRef({});

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    hasOlderRef.current = hasOlder;
  }, [hasOlder]);
  useEffect(() => {
    authorProfilesRef.current = authorProfiles;
  }, [authorProfiles]);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    subTabRef.current = subTab;
  }, [subTab]);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  }, []);

  useEffect(() => {
    clearPendingAttachments();
    setPendingEntityRefs([]);
    setEditAttachmentItems([]);
    setEditEntityRefs([]);
    composerDragDepthRef.current = 0;
    setComposerDropActive(false);
  }, [selectedRoomId, clearPendingAttachments]);

  const composerEntityRefKeys = useMemo(() => {
    const keys = new Set();
    editEntityRefs.forEach((ref) => keys.add(entityRefKey(ref)));
    pendingEntityRefs.forEach((ref) => keys.add(entityRefKey(ref)));
    return [...keys];
  }, [editEntityRefs, pendingEntityRefs]);

  const mergedEditEntityRefs = useMemo(() => {
    const map = new Map();
    editEntityRefs.forEach((ref) => map.set(entityRefKey(ref), ref));
    pendingEntityRefs.forEach((ref) => map.set(entityRefKey(ref), ref));
    return [...map.values()];
  }, [editEntityRefs, pendingEntityRefs]);

  const readyAttachmentIds = useMemo(
    () => pendingAttachments.filter((p) => p.uploadedId && !p.error).map((p) => p.uploadedId),
    [pendingAttachments]
  );

  const editAttachmentIds = useMemo(
    () => [...editAttachmentItems.map((att) => att.id), ...readyAttachmentIds],
    [editAttachmentItems, readyAttachmentIds]
  );

  const pendingEntityRefKeys = useMemo(
    () => pendingEntityRefs.map((ref) => entityRefKey(ref)),
    [pendingEntityRefs]
  );
  const hasPendingUpload = pendingAttachments.some((p) => p.uploading);
  const canSendMessage = editingMessage
    ? Boolean(
        messageText.trim() ||
          editAttachmentItems.length ||
          readyAttachmentIds.length ||
          editEntityRefs.length ||
          pendingEntityRefs.length
      ) && !hasPendingUpload
    : Boolean(messageText.trim() || readyAttachmentIds.length || pendingEntityRefs.length) &&
      !hasPendingUpload;

  const resizeComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const paddingY =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0);
    const borderY =
      (Number.parseFloat(style.borderTopWidth) || 0) +
      (Number.parseFloat(style.borderBottomWidth) || 0);
    const maxHeight = lineHeight * COMPOSER_MAX_LINES + paddingY + borderY;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(next, lineHeight + paddingY + borderY)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight + 1 ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [messageText, editingMessage, replyTo, resizeComposer]);

  const notify = useCallback((message, type = 'info', { browser = false, browserTitle } = {}) => {
    setNotification({ type, message });
    if (browser) {
      showBrowserNotification(browserTitle || 'Сообщения', message);
    }
  }, []);

  const fetchEmployeeProfiles = useCallback((userIds) => {
    const missing = [...new Set(userIds.filter(Boolean))]
      .filter((id) => Number(id) !== AI_ASSISTANT_USER_ID)
      .filter((id) => authorProfilesRef.current[id] === undefined);
    if (!missing.length) return undefined;

    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        employeeService
          .getChatEmployee(id)
          .then((employee) => ({ id, employee }))
          .catch(() => ({ id, employee: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      setAuthorProfiles((prev) => {
        const next = { ...prev };
        results.forEach(({ id, employee }) => {
          next[id] = employee
            ? {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                team_role: employee.team_role,
                avatar: employee.avatar || null,
              }
            : { id, name: null, email: null, team_role: null, avatar: null };
        });
        return next;
      });
      setPeerAvatars((prev) => {
        const next = { ...prev };
        results.forEach(({ id, employee }) => {
          if (next[id] === undefined) {
            next[id] = employee?.avatar || null;
          }
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const box = messagesBoxRef.current;
    if (!box) {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    stickToBottomRef.current = true;
    setShowJumpDown(false);
  }, []);

  const markRoomReadUpTo = useCallback(async (roomId, messageId) => {
    if (!roomId || !messageId) return;
    const prev = lastMarkedReadRef.current[roomId] || 0;
    if (messageId <= prev) return;
    lastMarkedReadRef.current[roomId] = messageId;
    try {
      await messagingService.markRoomRead(roomId, messageId);
    } catch (err) {
      console.error(err);
      lastMarkedReadRef.current[roomId] = prev;
    }
  }, []);

  const ensureMessageLoaded = useCallback(async (messageId) => {
    if (!selectedRoomId || !messageId) return false;
    if (messagesRef.current.some((m) => m.id === messageId)) return true;

    let attempts = 0;
    while (attempts < 25 && hasOlderRef.current) {
      const oldestId = messagesRef.current[0]?.id;
      if (!oldestId) break;

      try {
        const { messages: older } = await messagingService.getMessages(selectedRoomId, {
          cursor: oldestId,
          limit: 50,
        });
        if (older.length === 0) {
          setHasOlder(false);
          break;
        }
        setHasOlder(older.length >= 50);
        let found = false;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const merged = [...older.filter((m) => !ids.has(m.id)), ...prev];
          messagesRef.current = merged;
          found = merged.some((m) => m.id === messageId);
          return merged;
        });
        if (found) return true;
      } catch (err) {
        console.error(err);
        break;
      }
      attempts += 1;
    }
    return messagesRef.current.some((m) => m.id === messageId);
  }, [selectedRoomId]);

  const scrollToMessage = useCallback(async (messageId) => {
    if (!messageId) return;

    const reveal = () => {
      const el = messagesBoxRef.current?.querySelector(`[data-msg-id="${messageId}"]`);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      window.setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 2200);
      return true;
    };

    if (!messagesRef.current.some((m) => m.id === messageId)) {
      const loaded = await ensureMessageLoaded(messageId);
      if (!loaded) {
        notify('Исходное сообщение не найдено или удалено', 'warning');
        return;
      }
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    }

    if (!reveal()) {
      notify('Не удалось показать сообщение', 'warning');
    }
  }, [ensureMessageLoaded, notify]);

  const loadRooms = useCallback(async () => {
    const data = await messagingService.getRooms();
    setRooms(data);
    hydrateUnreadFromRooms(data);
    setSelectedRoomId((prev) => prev ?? (data[0]?.id ?? null));
    return data;
  }, [hydrateUnreadFromRooms]);

  const updateRoomLayout = useCallback((updater) => {
    if (!user?.id) return;
    setRoomLayout((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveRoomLayout(user.id, next);
      return next;
    });
  }, [user?.id]);

  const bumpRoomActivity = useCallback((roomId, timestamp = Date.now()) => {
    if (!roomId) return;
    updateRoomLayout((prev) => bumpRoomActivityInLayout(prev, roomId, timestamp));
  }, [updateRoomLayout]);

  const bumpRoomActivityRef = useRef(bumpRoomActivity);
  useEffect(() => {
    bumpRoomActivityRef.current = bumpRoomActivity;
  }, [bumpRoomActivity]);

  const rememberRoomLastMessage = useCallback((roomId, message) => {
    if (!roomId || !message) return;
    setRoomLastMessageById((prev) => {
      const current = prev[roomId];
      if (!shouldReplaceRoomLastMessage(message, current)) return prev;
      return { ...prev, [roomId]: message };
    });
  }, []);

  const rememberRoomLastMessageRef = useRef(rememberRoomLastMessage);
  useEffect(() => {
    rememberRoomLastMessageRef.current = rememberRoomLastMessage;
  }, [rememberRoomLastMessage]);

  const fetchRoomLastMessage = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const { messages: data } = await messagingService.getMessages(roomId, { limit: 1 });
      const latest = data[data.length - 1];
      if (latest) rememberRoomLastMessage(roomId, latest);
    } catch {
      // ignore preview fetch errors
    }
  }, [rememberRoomLastMessage]);

  const fetchRoomLastMessageRef = useRef(fetchRoomLastMessage);
  useEffect(() => {
    fetchRoomLastMessageRef.current = fetchRoomLastMessage;
  }, [fetchRoomLastMessage]);

  const orderedRooms = useMemo(() => {
    const laid = applyRoomLayout(rooms, roomLayout, (room) => getRoomDisplayName(room, user));
    const notes = laid.filter((room) => room.room_type === 'notification');
    const rest = laid.filter((room) => room.room_type !== 'notification');
    return [...notes, ...rest];
  }, [rooms, roomLayout, user]);

  const handleToggleRoomPin = useCallback((roomId) => {
    updateRoomLayout((prev) => toggleRoomPin(prev, roomId));
  }, [updateRoomLayout]);

  const handleRoomDrop = useCallback((targetRoomId) => {
    if (!draggingRoomId || draggingRoomId === targetRoomId) return;
    if (!roomLayout.pinned.includes(draggingRoomId)) return;
    if (!roomLayout.pinned.includes(targetRoomId)) return;
    updateRoomLayout((prev) => ({
      ...prev,
      pinned: reorderPinnedRooms(prev.pinned, draggingRoomId, targetRoomId),
    }));
    setDraggingRoomId(null);
    setDragOverRoomId(null);
  }, [draggingRoomId, roomLayout.pinned, updateRoomLayout]);

  const handleRoomCreated = useCallback(async (room) => {
    await loadRooms();
    if (room?.id) {
      setSelectedRoomId(room.id);
      bumpRoomActivity(room.id);
    }
    notify('Комната создана', 'success');
  }, [loadRooms, notify, bumpRoomActivity]);

  const openDirectRoomWithUser = useCallback(async (userId) => {
    const peerId = Number(userId);
    if (!peerId || peerId === user?.id) return;
    try {
      setSubTab('chats');
      setShowMembersPanel(false);
      const room = await messagingService.createDirectRoom(peerId);
      const data = await loadRooms();
      const resolved = data.find((r) => r.id === room.id) || room;
      setSelectedRoomId(resolved.id);
    } catch (err) {
      console.error(err);
      notify('Не удалось открыть личный чат', 'error');
    }
  }, [user?.id, loadRooms, notify]);

  const loadMessages = useCallback(async (roomId) => {
    if (!roomId) return;
    const { messages: data, readCursors } = await messagingService.getMessages(roomId, { limit: 50 });
    storeReadCursors(readCursorsRef, roomId, readCursors);
    setMessages(data);
    setHasOlder(data.length >= 50);
    stickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom(false));
    if (data.length > 0) {
      const latest = data[data.length - 1];
      rememberRoomLastMessageRef.current?.(roomId, latest);
      const ts = latest?.created_at ? new Date(latest.created_at).getTime() : Date.now();
      bumpRoomActivityRef.current?.(roomId, ts);
      markRoomReadUpTo(roomId, latest.id);
    }
  }, [scrollToBottom, markRoomReadUpTo]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedRoomId || loadingOlder || !hasOlder || messages.length === 0) return;
    const box = messagesBoxRef.current;
    const prevHeight = box?.scrollHeight || 0;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    setLoadingOlder(true);
    try {
      const { messages: older } = await messagingService.getMessages(selectedRoomId, {
        cursor: oldestId,
        limit: 50,
      });
      if (older.length === 0) {
        setHasOlder(false);
        return;
      }
      setHasOlder(older.length >= 50);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const merged = [...older.filter((m) => !ids.has(m.id)), ...prev];
        return merged;
      });
      requestAnimationFrame(() => {
        if (box) {
          box.scrollTop = box.scrollHeight - prevHeight;
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedRoomId, loadingOlder, hasOlder, messages]);

  const handleWsPayload = useCallback((payload) => {
    if (!payload?.type) return;
    const roomId = payload.room_id;
    const currentRoom = selectedRoomIdRef.current;

    if (payload.type === 'message.new' && payload.message) {
      const msg = payload.message;
      const mine = msg.author_id === userIdRef.current;
      const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : Date.now();
      bumpRoomActivityRef.current?.(roomId, msgTime);
      rememberRoomLastMessageRef.current?.(roomId, msg);
      if (roomId === currentRoom) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        const looking =
          activeTabRef.current === 'email' &&
          typeof document !== 'undefined' &&
          !document.hidden &&
          subTabRef.current === 'chats';
        if (!mine && looking) {
          markRoomReadUpTo(roomId, msg.id);
          clearRoomUnread(roomId);
        }
        if (stickToBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        } else if (!mine) {
          setShowJumpDown(true);
        }
      }
      return;
    }

    if (payload.type === 'message.updated' && payload.message) {
      const msg = payload.message;
      rememberRoomLastMessageRef.current?.(roomId, msg);
      if (roomId === currentRoom) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? msg : m))
        );
      }
      return;
    }

    if (payload.type === 'message.deleted') {
      const id = payload.message_id ?? payload.message?.id;
      if (roomId === currentRoom) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
      fetchRoomLastMessageRef.current?.(roomId);
      return;
    }

    if (payload.type === 'room.updated' && payload.room) {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === roomId ? { ...room, name: payload.room.name } : room
        )
      );
      return;
    }

    if (payload.type === 'room.deleted') {
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      if (roomId === currentRoom) {
        setSelectedRoomId(null);
        setMessages([]);
        setShowMembersPanel(false);
      }
      return;
    }

    if (payload.type === 'room.members_updated' && payload.members) {
      if (roomId === currentRoom) {
        setRoomMembers(payload.members);
      }
      return;
    }

    if (payload.type === 'room.read_updated') {
      const readerId = payload.user_id;
      const lastRead = payload.last_read_message_id;
      if (!roomId || !readerId || !lastRead) return;
      if (!readCursorsRef.current[roomId]) readCursorsRef.current[roomId] = {};
      readCursorsRef.current[roomId][readerId] = Math.max(
        readCursorsRef.current[roomId][readerId] || 0,
        lastRead
      );
      if (roomId === currentRoom) {
        setMessages((prev) => recomputeOwnMessagesRead(
          prev,
          readCursorsRef,
          roomId,
          userIdRef.current
        ));
      }
    }
  }, [notify, scrollToBottom, markRoomReadUpTo, clearRoomUnread]);

  useEffect(() => {
    if (activeTab !== 'email') return undefined;
    requestBrowserPermission();
    setLoading(true);
    setError('');
    loadRooms()
      .catch((err) => {
        console.error(err);
        const status = err?.response?.status;
        setError(
          status === 401
            ? 'Нет доступа к чатам. Обновите страницу или войдите снова.'
            : 'Не удалось подключиться к сервису сообщений'
        );
      })
      .finally(() => setLoading(false));
    aiAgentService.getAgentInfo()
      .then((info) => {
        if (info?.enabled && info?.allowed !== false) {
          setAiAgentInfo(info);
        } else {
          setAiAgentInfo(null);
          setSelectedAiAgent(false);
        }
      })
      .catch(() => {
        setAiAgentInfo(null);
        setSelectedAiAgent(false);
      });
  }, [activeTab, loadRooms, requestBrowserPermission]);

  useEffect(() => subscribeWs(handleWsPayload), [subscribeWs, handleWsPayload]);

  useEffect(() => {
    if (activeTab !== 'email' || !rooms.length) return undefined;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        rooms.map(async (room) => {
          try {
            const { messages: data } = await messagingService.getMessages(room.id, { limit: 1 });
            return { roomId: room.id, message: data[data.length - 1] };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setRoomLastMessageById((prev) => {
        const next = { ...prev };
        results.forEach((row) => {
          if (!row?.message) return;
          const current = next[row.roomId];
          if (shouldReplaceRoomLastMessage(row.message, current)) {
            next[row.roomId] = row.message;
          }
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rooms, activeTab]);

  useEffect(() => {
    if (activeTab !== 'email' || !selectedRoomId) return;
    setReplyTo(null);
    setEditingMessage(null);
    setEditAttachmentItems([]);
    setEditEntityRefs([]);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setContextMenu(null);
    setHighlightedMessageId(null);
    lastMarkedReadRef.current[selectedRoomId] = 0;
    clearRoomUnread(selectedRoomId);
    loadMessages(selectedRoomId).catch((err) => {
      console.error(err);
      setError('Ошибка загрузки сообщений');
    });
  }, [activeTab, selectedRoomId, loadMessages, clearRoomUnread]);

  useEffect(() => {
    if (activeTab !== 'email') {
      setViewing('none');
      return undefined;
    }
    setViewing(subTab, subTab === 'chats' ? selectedRoomId : null);
    return undefined;
  }, [activeTab, subTab, selectedRoomId, setViewing]);

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (activeTab !== 'email' || subTab !== 'chats' || !selectedRoomId) return;
      clearRoomUnread(selectedRoomId);
      const latest = messagesRef.current[messagesRef.current.length - 1];
      if (latest?.id) markRoomReadUpTo(selectedRoomId, latest.id);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeTab, subTab, selectedRoomId, clearRoomUnread, markRoomReadUpTo]);

  useEffect(() => {
    const onOpenRoom = (event) => {
      const roomId = Number(event.detail?.roomId);
      const messageId = event.detail?.messageId != null ? Number(event.detail.messageId) : null;
      if (!roomId) return;
      setSubTab('chats');
      setSelectedRoomId(roomId);
      if (messageId) {
        window.setTimeout(() => {
          scrollToMessage(messageId).catch(() => {});
        }, 350);
      }
    };
    const onOpenMail = () => setSubTab('mail');
    window.addEventListener(MMM_OPEN_ROOM_EVENT, onOpenRoom);
    window.addEventListener(MMM_OPEN_MAIL_EVENT, onOpenMail);
    return () => {
      window.removeEventListener(MMM_OPEN_ROOM_EVENT, onOpenRoom);
      window.removeEventListener(MMM_OPEN_MAIL_EVENT, onOpenMail);
    };
  }, [scrollToMessage]);

  useEffect(() => {
    if (activeTab !== 'email' || !messages.length) return undefined;
    const authorIds = messages
      .map((m) => m.author_id)
      .filter((id) => id && id !== user?.id);
    return fetchEmployeeProfiles(authorIds);
  }, [activeTab, messages, user?.id, fetchEmployeeProfiles]);

  useEffect(() => {
    if (!roomMembers.length) return undefined;
    setAuthorProfiles((prev) => {
      let changed = false;
      const next = { ...prev };
      roomMembers.forEach((member) => {
        if (next[member.id]) return;
        changed = true;
        next[member.id] = {
          id: member.id,
          name: member.name,
          email: member.email,
          team_role: member.team_role,
          avatar: null,
        };
      });
      return changed ? next : prev;
    });
    return fetchEmployeeProfiles(roomMembers.map((member) => member.id));
  }, [roomMembers, fetchEmployeeProfiles]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeMenu = () => setContextMenu(null);
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selectionMode) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setSelectedIds(new Set());
      setSelectionMode(false);
      setContextMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionMode]);

  const setLightboxIndex = useCallback((nextIndex) => {
    setLightbox((prev) => {
      if (!prev?.images?.length) return prev;
      const index = typeof nextIndex === 'function' ? nextIndex(prev.index) : nextIndex;
      const clamped = Math.min(Math.max(index, 0), prev.images.length - 1);
      return { ...prev, index: clamped };
    });
  }, []);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let x = contextMenu.x;
    let y = contextMenu.y;
    if (x + rect.width > window.innerWidth - pad) {
      x = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (y + rect.height > window.innerHeight - pad) {
      y = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu((prev) => (prev ? { ...prev, x, y } : prev));
    }
  }, [contextMenu]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  const handleJoinCall = useCallback(
    async (partyRoomId) => {
      if (!partyRoomId) return;
      dismissIncomingCall();
      try {
        let members = roomMembers;
        if ((!members || members.length === 0) && selectedRoomId) {
          members = await messagingService.getRoomMembers(selectedRoomId);
        }
        await joinCall({
          partyRoomId,
          displayName: encodeCallDisplayName(user),
          chatRoomId: selectedRoomId,
          selfUserId: user?.id,
          expectedMembers: (members || []).map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
          })),
        });
      } catch (err) {
        notify(err?.message || 'Не удалось присоединиться к звонку', 'error');
      }
    },
    [dismissIncomingCall, joinCall, notify, roomMembers, selectedRoomId, user]
  );

  const startVideoCall = useCallback(async () => {
    if (!selectedRoomId || !selectedRoom || startingCall || callActive) return;
    if (selectedRoom.room_type === 'notification') {
      notify('В комнате уведомлений звонки недоступны', 'warning');
      return;
    }
    setStartingCall(true);
    try {
      const roomTitle = getRoomDisplayName(selectedRoom, user);
      const { room_id: partyRoomId } = await partyhomeService.createRoom(roomTitle);
      if (!partyRoomId) throw new Error('PartyHome не вернул room_id');
      let members = roomMembers;
      if ((!members || members.length === 0) && selectedRoom.room_type === 'direct' && selectedRoom.peer) {
        members = [
          { id: user.id, name: user.name, email: user.email },
          {
            id: selectedRoom.peer.id,
            name: selectedRoom.peer.name,
            email: selectedRoom.peer.email,
          },
        ];
      } else if ((!members || members.length === 0)) {
        members = await messagingService.getRoomMembers(selectedRoomId);
      }
      await joinCall({
        partyRoomId,
        displayName: encodeCallDisplayName(user),
        chatRoomId: selectedRoomId,
        selfUserId: user?.id,
        expectedMembers: (members || []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
        })),
      });
      const callRef = buildCallEntityRef(selectedRoomId, partyRoomId, 'Видеозвонок');
      const data = await messagingService.sendMessage(
        selectedRoomId,
        'Начал(а) видеозвонок',
        null,
        [],
        [callRef]
      );
      const msg = data?.message || data;
      if (msg?.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        bumpRoomActivity(selectedRoomId);
      }
    } catch (err) {
      notify(err?.response?.data?.detail || err?.message || 'Не удалось начать звонок', 'error');
    } finally {
      setStartingCall(false);
    }
  }, [
    bumpRoomActivity,
    callActive,
    joinCall,
    notify,
    roomMembers,
    selectedRoom,
    selectedRoomId,
    startingCall,
    user,
  ]);

  const myRoomRole = useMemo(
    () => getMyRoomRole(selectedRoom, roomMembers, user?.id),
    [selectedRoom, roomMembers, user?.id]
  );

  useEffect(() => {
    if (!selectedRoomId || !user?.id || !roomMembers.length) return;
    const me = roomMembers.find((member) => member.id === user.id);
    if (!me?.role) return;
    setRooms((prev) =>
      prev.map((room) =>
        room.id === selectedRoomId && room.my_role !== me.role
          ? { ...room, my_role: me.role }
          : room
      )
    );
  }, [roomMembers, selectedRoomId, user?.id]);

  const sortedRoomMembers = useMemo(() => {
    const list = [...roomMembers];
    list.sort((a, b) => {
      const aSelf = a.id === user?.id;
      const bSelf = b.id === user?.id;
      if (aSelf !== bSelf) return aSelf ? -1 : 1;
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    return list;
  }, [roomMembers, user?.id]);

  const filteredRoomMembers = useMemo(() => {
    const query = membersSearch.trim().toLowerCase();
    if (!query) return sortedRoomMembers;
    return sortedRoomMembers.filter((member) => {
      const haystack = [member.name, member.email, member.team_role, member.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedRoomMembers, membersSearch]);

  const forwardTargetRooms = useMemo(() => {
    const list = orderedRooms.filter((room) => room.id !== selectedRoomId);
    const query = forwardSearch.trim().toLowerCase();
    if (!query) return list;
    return list.filter((room) => {
      const name = getRoomDisplayName(room, user).toLowerCase();
      const type = String(ROOM_TYPE_LABELS[room.room_type] || room.room_type || '').toLowerCase();
      return name.includes(query) || type.includes(query);
    });
  }, [orderedRooms, selectedRoomId, forwardSearch, user]);

  const forwardTargetEmployees = useMemo(() => {
    const query = forwardSearch.trim().toLowerCase();
    if (!query) return [];
    return forwardEmployees
      .filter((employee) => {
        if (employee.id === user?.id) return false;
        const haystack = [employee.name, employee.email, employee.team_role]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 24);
  }, [forwardEmployees, forwardSearch, user?.id]);

  const messagesById = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const messageTimeline = useMemo(() => {
    const items = [];
    let lastDay = null;
    for (const msg of messages) {
      const key = dayKey(msg.created_at);
      if (key !== lastDay) {
        items.push({ kind: 'day', id: `day-${key}`, label: formatDayLabel(msg.created_at) });
        lastDay = key;
      }
      items.push({ kind: 'message', id: msg.id, message: msg });
    }
    return items;
  }, [messages]);

  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.has(m.id)),
    [messages, selectedIds]
  );

  const mediaBatchItems = useMemo(() => {
    const items = [];
    Object.entries(peerAvatars || {}).forEach(([id, path]) => {
      if (path) {
        items.push({ key: `avatar:${id}`, ref: path, preset: 'avatar_md' });
      }
    });
    const seen = new Set();
    (messages || []).forEach((msg) => {
      (msg.attachments || []).forEach((att) => {
        if (getAttachmentPreviewKind(att) !== 'image' || seen.has(att.id)) return;
        seen.add(att.id);
        items.push({
          key: `att:${att.id}`,
          ref: `attachment://${att.id}`,
          preset: 'chat_inline',
        });
      });
    });
    return items;
  }, [peerAvatars, messages]);

  const canDeleteSelected =
    selectedMessages.length > 0 &&
    selectedMessages.every((m) => m.author_id === user?.id);

  const cancelComposerContext = useCallback(() => {
    setReplyTo(null);
    setEditingMessage(null);
    setMessageText('');
    setEditAttachmentItems([]);
    setEditEntityRefs([]);
    clearPendingAttachments();
    setPendingEntityRefs([]);
  }, [clearPendingAttachments]);

  useEffect(() => {
    if (!user?.id) return;
    setRoomLayout(loadRoomLayout(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || rooms.length === 0) return;
    setRoomLayout((prev) => {
      const synced = syncLayoutWithRooms(prev, rooms);
      const pinnedSame =
        synced.pinned.length === prev.pinned.length &&
        synced.pinned.every((id, index) => id === prev.pinned[index]);
      const activitySame = JSON.stringify(synced.activity) === JSON.stringify(prev.activity);
      if (pinnedSame && activitySame) return prev;
      saveRoomLayout(user.id, synced);
      return synced;
    });
  }, [rooms, user?.id]);

  useEffect(() => {
    if (activeTab !== 'email') return undefined;
    const peerIds = rooms
      .filter((room) => room.room_type === 'direct')
      .map((room) => getDirectPeerId(room, user?.id))
      .filter(Boolean);
    const memberIds = (roomMembers || []).map((member) => member.id).filter(Boolean);
    const authorIds = (messages || []).map((msg) => msg.author_id).filter(Boolean);
    const missing = [...new Set([...peerIds, ...memberIds, ...authorIds])].filter(
      (id) => peerAvatars[id] === undefined && Number(id) !== Number(user?.id)
    );
    if (!missing.length) return undefined;

    let cancelled = false;
    employeeService
      .getChatAvatars(missing)
      .then((data) => {
        if (cancelled) return;
        const avatars = data?.avatars || {};
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            const key = String(id);
            next[id] = avatars[key] ?? avatars[id] ?? null;
          });
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            if (next[id] === undefined) next[id] = null;
          });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [rooms, roomMembers, messages, activeTab, user?.id, peerAvatars]);

  useEffect(() => {
    if (!pendingDmUserId) return;
    openDirectRoomWithUser(pendingDmUserId).finally(() => {
      onPendingDmHandled?.();
    });
  }, [pendingDmUserId, openDirectRoomWithUser, onPendingDmHandled]);

  useEffect(() => {
    if (!pendingOpenRoom?.roomId) return;
    const roomId = Number(pendingOpenRoom.roomId);
    const messageId =
      pendingOpenRoom.messageId != null ? Number(pendingOpenRoom.messageId) : null;
    setSubTab('chats');
    setSelectedRoomId(roomId);
    onPendingOpenRoomHandled?.();
    if (messageId) {
      window.setTimeout(() => {
        scrollToMessage(messageId).catch(() => {});
      }, 400);
    }
  }, [pendingOpenRoom, onPendingOpenRoomHandled, scrollToMessage]);

  useEffect(() => {
    if (!forwardMessages?.length) {
      setForwardSearch('');
      setForwardEmployees([]);
      return undefined;
    }

    let cancelled = false;
    setForwardEmployeesLoading(true);
    employeeService
      .getChatDirectory()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.items || [];
        setForwardEmployees(list);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setForwardEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setForwardEmployeesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [forwardMessages]);

  useEffect(() => {
    if (!forwardMessages?.length || !forwardSearch.trim() || !forwardTargetEmployees.length) {
      return undefined;
    }

    const missing = forwardTargetEmployees
      .map((employee) => employee.id)
      .filter((id) => peerAvatars[id] === undefined);
    if (!missing.length) return undefined;

    let cancelled = false;
    employeeService
      .getChatAvatars(missing)
      .then((data) => {
        if (cancelled) return;
        const avatars = data?.avatars || {};
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            const key = String(id);
            next[id] = avatars[key] ?? avatars[id] ?? null;
          });
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            if (next[id] === undefined) next[id] = null;
          });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [forwardMessages, forwardSearch, forwardTargetEmployees, peerAvatars]);

  useEffect(() => {
    setShowMembersPanel(false);
    setRoomMembers([]);
    setMembersSearch('');
  }, [selectedRoomId]);

  useEffect(() => {
    if (!showMembersPanel) {
      setMembersSearch('');
      return undefined;
    }
    if (!roomMembers.length) return undefined;

    const missing = roomMembers
      .map((member) => member.id)
      .filter((id) => peerAvatars[id] === undefined);
    if (!missing.length) return undefined;

    let cancelled = false;
    employeeService
      .getChatAvatars(missing)
      .then((data) => {
        if (cancelled) return;
        const avatars = data?.avatars || {};
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            const key = String(id);
            next[id] = avatars[key] ?? avatars[id] ?? null;
          });
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPeerAvatars((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            if (next[id] === undefined) next[id] = null;
          });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [showMembersPanel, roomMembers, peerAvatars]);

  useEffect(() => {
    if (!showMembersPanel || !selectedRoomId) return undefined;
    let cancelled = false;
    setMembersLoading(true);
    messagingService
      .getRoomMembers(selectedRoomId)
      .then((members) => {
        if (!cancelled) setRoomMembers(members);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setRoomMembers([]);
          notify('Не удалось загрузить участников', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showMembersPanel, selectedRoomId, notify]);

  useEffect(() => {
    if (!showMembersPanel) return undefined;
    const onDocClick = (event) => {
      if (membersPanelRef.current?.contains(event.target)) return;
      setShowMembersPanel(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMembersPanel]);

  const deliverForwardToRoom = useCallback(async (roomId) => {
    if (!forwardMessages?.length) return;
    const sourceRoom = rooms.find((r) => r.id === forwardMessages[0].room_id);
    const prefix = `↪ Переслано${sourceRoom ? ` из «${getRoomDisplayName(sourceRoom, user)}»` : ''}`;
    const ordered = [...forwardMessages].sort((a, b) => a.id - b.id);

    for (const msg of ordered) {
      const lines = [`${prefix}:`];
      if (msg.content?.trim()) lines.push(msg.content.trim());
      await messagingService.forwardMessage(roomId, {
        content: lines.join('\n'),
        attachments: msg.attachments || [],
        entityRefs: msg.entity_refs || [],
      });
    }

    setForwardMessages(null);
    setForwardSearch('');
    setSelectedIds(new Set());
    setSelectionMode(false);
    notify(
      ordered.length === 1 ? 'Сообщение переслано' : `Переслано: ${ordered.length}`,
      'success',
      { browser: true, browserTitle: 'Чат' }
    );

    if (roomId === selectedRoomId) {
      await loadMessages(roomId);
    } else {
      await fetchRoomLastMessage(roomId);
    }
    bumpRoomActivity(roomId);
  }, [forwardMessages, rooms, user, selectedRoomId, loadMessages, fetchRoomLastMessage, notify, bumpRoomActivity]);

  const handleRenameRoomSubmit = useCallback(
    async (nextName) => {
      if (!selectedRoomId || !selectedRoom) return;
      if (!isRoomAdminOrOwner(selectedRoom, roomMembers, user?.id)) {
        throw new Error('Недостаточно прав');
      }
      setRoomManaging(true);
      try {
        const updated = await messagingService.updateRoom(selectedRoomId, { name: nextName });
        setRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoomId ? { ...room, name: updated.name } : room
          )
        );
        setShowRenameRoom(false);
        notify('Название комнаты изменено', 'success');
      } finally {
        setRoomManaging(false);
      }
    },
    [selectedRoomId, selectedRoom, roomMembers, user?.id, notify]
  );

  const handleDeleteRoomConfirm = useCallback(async () => {
    if (!selectedRoomId || !selectedRoom) return;
    if (!isRoomOwner(selectedRoom, roomMembers, user?.id)) return;
    setRoomManaging(true);
    try {
      await messagingService.deleteRoom(selectedRoomId);
      setRooms((prev) => prev.filter((room) => room.id !== selectedRoomId));
      setSelectedRoomId(null);
      setMessages([]);
      setShowMembersPanel(false);
      setShowDeleteRoomConfirm(false);
      notify('Комната удалена', 'success');
    } catch (err) {
      console.error(err);
      notify(err.response?.data?.detail || 'Не удалось удалить комнату', 'error');
    } finally {
      setRoomManaging(false);
    }
  }, [selectedRoomId, selectedRoom, roomMembers, user?.id, notify]);

  const PROTECTED_ROOM_TYPES = new Set(['notification', 'cross_department', 'executive', 'management']);

  const isRoomDeletable = useCallback((room) => {
    if (!room) return false;
    if (PROTECTED_ROOM_TYPES.has(room.room_type)) return false;
    return true;
  }, []);

  const handleBulkDeleteRooms = useCallback(async () => {
    if (checkedRoomIds.size === 0) return;
    if (!window.confirm(`Удалить ${checkedRoomIds.size} чат(ов)?`)) return;
    setDeletingRooms(true);
    const ids = Array.from(checkedRoomIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await messagingService.deleteRoom(id);
        deleted++;
      } catch (err) {
        console.error('Failed to delete room', id, err);
      }
    }
    setRooms((prev) => prev.filter((r) => !checkedRoomIds.has(r.id)));
    if (checkedRoomIds.has(selectedRoomId)) {
      setSelectedRoomId(null);
      setMessages([]);
    }
    setCheckedRoomIds(new Set());
    setDeletingRooms(false);
    notify(`Удалено чатов: ${deleted}`, 'success');
  }, [checkedRoomIds, selectedRoomId, notify]);

  const toggleRoomCheck = useCallback((roomId) => {
    setCheckedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

  const handleRemoveRoomMember = useCallback(
    async (member) => {
      if (!selectedRoomId || !selectedRoom || !member?.id) return;
      const actorRole = getMyRoomRole(selectedRoom, roomMembers, user?.id);
      const isSelf = member.id === user?.id;
      if (!canRemoveRoomMember(selectedRoom, actorRole, member, user?.id)) return;

      const label = isSelf
        ? 'Покинуть эту комнату?'
        : `Удалить ${member.name} из комнаты?`;
      if (!window.confirm(label)) return;

      setRoomManaging(true);
      try {
        const members = await messagingService.removeRoomMember(selectedRoomId, member.id);
        setRoomMembers(members);
        if (isSelf) {
          setShowMembersPanel(false);
          setSelectedRoomId(null);
          setMessages([]);
          await loadRooms();
        } else {
          notify('Участник удалён', 'success');
        }
        if (isSelf) {
          notify('Вы покинули комнату', 'success');
        }
      } catch (err) {
        console.error(err);
        notify(err.response?.data?.detail || 'Не удалось удалить участника', 'error');
      } finally {
        setRoomManaging(false);
      }
    },
    [selectedRoomId, selectedRoom, user?.id, notify, loadRooms]
  );

  const handleToggleMemberAdmin = useCallback(
    async (member) => {
      if (!selectedRoomId || !selectedRoom) return;
      if (!canChangeRoomMemberRole(selectedRoom, roomMembers, user?.id, member)) return;
      const nextRole = member.role === 'admin' ? 'member' : 'admin';
      const action =
        nextRole === 'admin' ? 'назначить администратором' : 'снять права администратора';
      if (!window.confirm(`${member.name}: ${action}?`)) return;

      setRoomManaging(true);
      try {
        const members = await messagingService.updateRoomMemberRole(
          selectedRoomId,
          member.id,
          nextRole
        );
        setRoomMembers(members);
        notify(
          nextRole === 'admin' ? 'Администратор назначен' : 'Права администратора сняты',
          'success'
        );
      } catch (err) {
        console.error(err);
        notify(err.response?.data?.detail || 'Не удалось изменить роль', 'error');
      } finally {
        setRoomManaging(false);
      }
    },
    [selectedRoomId, selectedRoom, roomMembers, user?.id, notify]
  );

  const handleMembersAdded = useCallback((members) => {
    setRoomMembers(members);
    notify('Участники добавлены', 'success');
  }, [notify]);

  const handleMessagesScroll = () => {
    const box = messagesBoxRef.current;
    if (!box) return;
    const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
    const nearBottom = distance < NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowJumpDown(!nearBottom);
    if (box.scrollTop < 48) {
      loadOlderMessages();
    }
  };

  if (activeTab !== 'email') return null;

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const toggleSelectMessage = (messageId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      setSelectionMode(next.size > 0);
      return next;
    });
    setContextMenu(null);
  };

  const closeContextMenu = () => setContextMenu(null);

  const openContextMenu = (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectionMode) {
      toggleSelectMessage(message.id);
      return;
    }

    const pad = 8;
    const menuW = 220;
    const menuH = 240;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Place at cursor; flip left/up when near viewport edges.
    let x = event.clientX;
    let y = event.clientY;
    if (x + menuW + pad > vw) x = event.clientX - menuW;
    if (y + menuH + pad > vh) y = event.clientY - menuH;
    x = Math.min(Math.max(pad, x), vw - menuW - pad);
    y = Math.min(Math.max(pad, y), vh - menuH - pad);

    setContextMenu({ x, y, messageId: message.id, message });
  };

  const startReply = (message) => {
    cancelComposerContext();
    setReplyTo(message);
    setMessageText('');
    closeContextMenu();
  };

  const startEdit = (message) => {
    setReplyTo(null);
    setEditingMessage(message);
    setMessageText(message.content || '');
    setEditAttachmentItems([...(message.attachments || [])]);
    setEditEntityRefs([...(message.entity_refs || [])]);
    clearPendingAttachments();
    setPendingEntityRefs([]);
    closeContextMenu();
  };

  const startForward = (messagesToForward) => {
    const list = Array.isArray(messagesToForward) ? messagesToForward : [messagesToForward];
    if (list.length === 0) return;
    setForwardMessages(list);
    closeContextMenu();
  };

  const handleDelete = async (messagesToDelete) => {
    closeContextMenu();
    if (!selectedRoomId) return;
    const list = Array.isArray(messagesToDelete) ? messagesToDelete : [messagesToDelete];
    if (list.length === 0) return;
    if (!list.every((m) => m.author_id === user?.id)) {
      notify('Можно удалять только свои сообщения', 'error');
      return;
    }
    const label =
      list.length === 1
        ? 'Удалить сообщение у всех?'
        : `Удалить ${list.length} сообщений у всех?`;
    if (!window.confirm(label)) return;
    try {
      await Promise.all(
        list.map((m) => messagingService.deleteMessage(selectedRoomId, m.id))
      );
      const ids = new Set(list.map((m) => m.id));
      setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
      clearSelection();
      await fetchRoomLastMessage(selectedRoomId);
      notify(list.length === 1 ? 'Сообщение удалено' : 'Сообщения удалены', 'success');
    } catch (err) {
      console.error(err);
      notify('Не удалось удалить сообщения', 'error');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    if (selectedRoom?.room_type === 'notification') return;
    if (editingMessage && !messageText.trim() && editAttachmentIds.length === 0 && mergedEditEntityRefs.length === 0) return;
    if (!editingMessage && !messageText.trim() && readyAttachmentIds.length === 0 && pendingEntityRefs.length === 0) return;
    if (hasPendingUpload) {
      notify('Дождитесь загрузки файлов', 'warning');
      return;
    }
    setSending(true);
    try {
      if (editingMessage) {
        const updated = await messagingService.editMessage(selectedRoomId, editingMessage.id, {
          content: messageText.trim(),
          attachmentIds: editAttachmentIds,
          entityRefs: mergedEditEntityRefs,
        });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        rememberRoomLastMessage(selectedRoomId, updated);
        cancelComposerContext();
        bumpRoomActivity(selectedRoomId);
        notify('Сообщение изменено', 'success');
      } else {
        const msg = await messagingService.sendMessage(
          selectedRoomId,
          messageText.trim(),
          replyTo?.id ?? null,
          readyAttachmentIds,
          pendingEntityRefs
        );
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        rememberRoomLastMessage(selectedRoomId, msg);
        const msgTime = msg?.created_at ? new Date(msg.created_at).getTime() : Date.now();
        bumpRoomActivity(selectedRoomId, msgTime);
        const sentContent = messageText.trim();
        setMessageText('');
        setReplyTo(null);
        clearPendingAttachments();
        setPendingEntityRefs([]);
        stickToBottomRef.current = true;
        requestAnimationFrame(() => scrollToBottom(true));
        if (messageMentionsAi(sentContent)) {
          void messagingAiService
            .mention({
              roomId: selectedRoomId,
              content: sentContent,
              parentMessageId: msg.id,
            })
            .then((data) => {
              const bot = data?.message;
              if (!bot?.id) return;
              setMessages((prev) => (prev.some((m) => m.id === bot.id) ? prev : [...prev, bot]));
              rememberRoomLastMessage(selectedRoomId, bot);
              stickToBottomRef.current = true;
              requestAnimationFrame(() => scrollToBottom(true));
            })
            .catch((err) => {
              console.error(err);
              const detail = err?.response?.data?.detail;
              notify(
                typeof detail === 'string' ? detail : 'Не удалось получить ответ @ai',
                'error',
              );
            });
        }
      }
    } catch (err) {
      console.error(err);
      notify(
        editingMessage ? 'Не удалось изменить сообщение' : 'Не удалось отправить сообщение',
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await uploadComposerFiles(files);
  };

  const uploadComposerFiles = async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!selectedRoomId || !list.length || sending) return;

    for (const file of list) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setPendingAttachments((prev) => [
        ...prev,
        {
          localId,
          name: file.name,
          mime: file.type,
          size: file.size,
          previewUrl,
          uploading: true,
          uploadedId: null,
          error: null,
        },
      ]);

      try {
        const uploaded = await messagingService.uploadAttachment(selectedRoomId, file);
        setPendingAttachments((prev) =>
          prev.map((p) =>
            p.localId === localId
              ? { ...p, uploading: false, uploadedId: uploaded.id }
              : p
          )
        );
      } catch (err) {
        console.error(err);
        setPendingAttachments((prev) =>
          prev.map((p) =>
            p.localId === localId ? { ...p, uploading: false, error: 'Ошибка загрузки' } : p
          )
        );
        notify(`Не удалось загрузить «${file.name}»`, 'error');
      }
    }
  };

  const dragEventHasFiles = (event) =>
    Array.from(event.dataTransfer?.types || []).includes('Files');

  const handleComposerDragEnter = (event) => {
    if (!dragEventHasFiles(event) || sending) return;
    event.preventDefault();
    event.stopPropagation();
    composerDragDepthRef.current += 1;
    setComposerDropActive(true);
  };

  const handleComposerDragLeave = (event) => {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
    if (composerDragDepthRef.current === 0) setComposerDropActive(false);
  };

  const handleComposerDragOver = (event) => {
    if (!dragEventHasFiles(event) || sending) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleComposerDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    composerDragDepthRef.current = 0;
    setComposerDropActive(false);
    if (sending) return;
    const files = Array.from(event.dataTransfer?.files || []);
    await uploadComposerFiles(files);
  };

  const removePendingAttachment = (localId) => {
    setPendingAttachments((prev) => {
      const item = prev.find((p) => p.localId === localId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  const togglePendingEntityRef = (ref) => {
    const key = entityRefKey(ref);
    setPendingEntityRefs((prev) => {
      if (prev.some((item) => entityRefKey(item) === key)) {
        return prev.filter((item) => entityRefKey(item) !== key);
      }
      return [...prev, ref];
    });
  };

  const removePendingEntityRef = (ref) => {
    const key = entityRefKey(ref);
    setPendingEntityRefs((prev) => prev.filter((item) => entityRefKey(item) !== key));
  };

  const removeEditAttachment = (attachmentId) => {
    setEditAttachmentItems((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const removeEditEntityRef = (ref) => {
    const key = entityRefKey(ref);
    setEditEntityRefs((prev) => prev.filter((item) => entityRefKey(item) !== key));
  };

  const toggleComposerEntityRef = (ref) => {
    const key = entityRefKey(ref);
    if (editEntityRefs.some((item) => entityRefKey(item) === key)) {
      removeEditEntityRef(ref);
      return;
    }
    if (pendingEntityRefs.some((item) => entityRefKey(item) === key)) {
      removePendingEntityRef(ref);
      return;
    }
    setPendingEntityRefs((prev) => [...prev, ref]);
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleForwardToRoom = async (roomId) => {
    if (!forwardMessages?.length || sending) return;
    setSending(true);
    try {
      await deliverForwardToRoom(roomId);
    } catch (err) {
      console.error(err);
      notify('Не удалось переслать сообщения', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleForwardToEmployee = async (employee) => {
    if (!forwardMessages?.length || sending || !employee?.id) return;
    setSending(true);
    try {
      const existingRoom = orderedRooms.find(
        (room) =>
          room.room_type === 'direct' && getDirectPeerId(room, user?.id) === employee.id
      );
      const room = existingRoom || (await messagingService.createDirectRoom(employee.id));
      if (!existingRoom) {
        await loadRooms();
      }
      await deliverForwardToRoom(room.id);
    } catch (err) {
      console.error(err);
      notify('Не удалось переслать сообщение сотруднику', 'error');
    } finally {
      setSending(false);
    }
  };

  const ctxMessage = contextMenu?.message;
  const ctxMine = ctxMessage && ctxMessage.author_id === user?.id;

  return (
    <MediaBatchProvider items={mediaBatchItems}>
    <div className={styles.root}>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h1>Сообщения</h1>
          <p>Внутренние чаты команд и корпоративная почта</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Разделы сообщений">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'chats'}
            onClick={() => setSubTab('chats')}
            className={`${styles.tab} ${subTab === 'chats' ? styles.tabActive : ''}`}
          >
            <ChatBubbleLeftRightIcon className={styles.tabIcon} />
            Чаты
            {unreadChatCount > 0 && (
              <span className={styles.tabBadge}>{formatUnreadCount(unreadChatCount)}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'mail'}
            onClick={() => setSubTab('mail')}
            className={`${styles.tab} ${subTab === 'mail' ? styles.tabActive : ''}`}
          >
            <EnvelopeIcon className={styles.tabIcon} />
            Почта
            {unreadMailCount > 0 && (
              <span className={styles.tabBadge}>{formatUnreadCount(unreadMailCount)}</span>
            )}
          </button>
        </div>
      </div>

      {loading && subTab === 'chats' && (
        <div className={`${styles.statusBanner} ${styles.statusBannerLoading}`}>
          Загрузка сервиса сообщений…
        </div>
      )}
      {error && subTab === 'chats' && (
        <div className={`${styles.statusBanner} ${styles.statusBannerError}`}>
          <ExclamationTriangleIcon className={styles.tabIcon} />
          {error}
        </div>
      )}

      {subTab === 'chats' && (
        <div className={styles.shell}>
          <aside className={styles.roomsPane}>
            <div className={styles.roomsHead}>
              <span className={styles.roomsHeadTitle}>Комнаты</span>
              <div className={styles.roomsHeadActions}>
                {checkedRoomIds.size > 0 && (
                  <button
                    type="button"
                    className={styles.bulkDeleteBtn}
                    onClick={handleBulkDeleteRooms}
                    disabled={deletingRooms}
                    aria-label={`Удалить выбранные чаты (${checkedRoomIds.size})`}
                    title={`Удалить выбранные (${checkedRoomIds.size})`}
                  >
                    {deletingRooms ? (
                      <span className={styles.bulkDeleteSpinner} />
                    ) : (
                      <TrashIcon className={styles.bulkDeleteIcon} />
                    )}
                    <span>{checkedRoomIds.size}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.createRoomBtn}
                  onClick={() => setShowCreateRoom(true)}
                  aria-label="Создать комнату"
                  title="Создать комнату"
                >
                  <PlusIcon />
                </button>
                <span className={styles.roomsCount}>{rooms.length}</span>
              </div>
            </div>
            <ul className={styles.roomsList}>
              {aiAgentInfo && (
                <li
                  key="ai-agent"
                  className={styles.roomItem}
                  style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}
                >
                  <span className={styles.roomDragSpacer} aria-hidden="true" />
                  <button
                    type="button"
                    className={`${styles.roomBtn} ${selectedAiAgent ? styles.roomBtnActive : ''}`}
                    onClick={() => {
                      setSelectedAiAgent(true);
                      setSelectedRoomId(null);
                    }}
                  >
                    <span
                      className={styles.roomAvatar}
                      style={{
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.3))',
                        border: '1px solid rgba(139,92,246,0.3)',
                        overflow: 'hidden',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {aiAgentInfo.avatar_path ? (
                        <Avatar
                          src={aiAgentInfo.avatar_path}
                          name={aiAgentInfo.name}
                          preset="avatar_md"
                          className={styles.roomAvatar}
                          imgClassName={styles.roomAvatarImage}
                          rounded="lg"
                        />
                      ) : (
                        <svg style={{ width: 14, height: 14, color: '#c4b5fd' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                      )}
                    </span>
                    <span className={styles.roomInfo}>
                      <span className={styles.roomName}>{aiAgentInfo.name || 'AI Ассистент'}</span>
                    </span>
                  </button>
                </li>
              )}
              {orderedRooms.map((room) => {
                const active = selectedRoomId === room.id;
                const tone = ROOM_TONE[room.room_type] || styles.toneCustom;
                const unread = unreadByRoom[room.id] || 0;
                const displayName = getRoomDisplayName(room, user);
                const isPinned = roomLayout.pinned.includes(room.id);
                const isDragging = draggingRoomId === room.id;
                const isDragOver = dragOverRoomId === room.id && draggingRoomId !== room.id;
                return (
                  <li
                    key={room.id}
                    className={`${styles.roomItem} ${isPinned ? styles.roomItemPinned : ''} ${
                      unread > 0 ? styles.roomItemUnread : ''
                    } ${isDragging ? styles.roomItemDragging : ''} ${
                      isDragOver ? styles.roomItemDragOver : ''
                    }`}
                    draggable={isPinned}
                    onDragStart={
                      isPinned
                        ? (event) => {
                            setDraggingRoomId(room.id);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', String(room.id));
                          }
                        : undefined
                    }
                    onDragEnd={
                      isPinned
                        ? () => {
                            setDraggingRoomId(null);
                            setDragOverRoomId(null);
                          }
                        : undefined
                    }
                    onDragOver={
                      isPinned && roomLayout.pinned.includes(draggingRoomId)
                        ? (event) => {
                            event.preventDefault();
                            if (draggingRoomId !== room.id) setDragOverRoomId(room.id);
                          }
                        : undefined
                    }
                    onDragLeave={
                      isPinned
                        ? () => {
                            if (dragOverRoomId === room.id) setDragOverRoomId(null);
                          }
                        : undefined
                    }
                    onDrop={
                      isPinned
                        ? (event) => {
                            event.preventDefault();
                            handleRoomDrop(room.id);
                          }
                        : undefined
                    }
                  >
                    {isRoomDeletable(room) ? (
                      <button
                        type="button"
                        className={`${styles.roomCheckBtn} ${checkedRoomIds.has(room.id) ? styles.roomCheckBtnChecked : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleRoomCheck(room.id); }}
                        aria-label={checkedRoomIds.has(room.id) ? 'Снять выбор' : 'Выбрать для удаления'}
                        title={checkedRoomIds.has(room.id) ? 'Снять выбор' : 'Выбрать'}
                      >
                        {checkedRoomIds.has(room.id) && (
                          <svg viewBox="0 0 10 8" fill="none" className={styles.roomCheckMark}>
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ) : isPinned ? (
                      <button
                        type="button"
                        className={styles.roomDragHandle}
                        aria-label="Перетащить"
                        title="Перетащить"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <Bars3Icon />
                      </button>
                    ) : (
                      <span className={styles.roomDragSpacer} aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedRoomId(room.id); setSelectedAiAgent(false); }}
                      className={`${styles.roomBtn} ${active ? styles.roomBtnActive : ''} ${
                        unread > 0 && !active ? styles.roomBtnUnread : ''
                      }`}
                    >
                      <RoomAvatar
                        room={room}
                        tone={tone}
                        peerAvatars={peerAvatars}
                        currentUser={user}
                      />
                      <span className={styles.roomMeta}>
                        <span className={styles.roomNameRow}>
                          <span className={styles.roomName}>{displayName}</span>
                          {unread > 0 && (
                            <span className={styles.unreadBadge}>{formatUnreadCount(unread)}</span>
                          )}
                        </span>
                        <span className={styles.roomPreview}>
                          {buildMessagePreview(roomLastMessageById[room.id])}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.roomPinBtn} ${isPinned ? styles.roomPinBtnActive : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleRoomPin(room.id);
                      }}
                      aria-label={isPinned ? 'Открепить' : 'Закрепить'}
                      title={isPinned ? 'Открепить' : 'Закрепить'}
                    >
                      {isPinned ? <BookmarkSolidIcon /> : <BookmarkIcon />}
                    </button>
                  </li>
                );
              })}
              {rooms.length === 0 && !loading && (
                <li className={styles.empty}>
                  <div className={styles.emptyIcon}>
                    <ChatBubbleLeftRightIcon />
                  </div>
                  <strong>Пока нет чатов</strong>
                  <p>Комнаты появятся после синхронизации сотрудников и отделов</p>
                </li>
              )}
            </ul>
          </aside>

          <section className={styles.chatPane}>
            {selectedAiAgent ? (
              <AiAgentChat user={user} />
            ) : (
            <><div className={styles.chatHead}>
              {selectedRoom ? (
                <>
                  <RoomAvatar
                    room={selectedRoom}
                    tone={ROOM_TONE[selectedRoom.room_type] || styles.toneCustom}
                    peerAvatars={peerAvatars}
                    currentUser={user}
                  />
                  <div className={styles.chatHeadCopy}>
                    <h2>{getRoomDisplayName(selectedRoom, user)}</h2>
                    <p>{ROOM_TYPE_LABELS[selectedRoom.room_type] || selectedRoom.room_type}</p>
                  </div>
                  <div className={styles.chatHeadActions} ref={membersPanelRef}>
                    {selectedRoom.room_type !== 'notification' && (
                      <button
                        type="button"
                        className={styles.membersBtn}
                        onClick={() => void startVideoCall()}
                        disabled={startingCall || callActive}
                        aria-label="Видеозвонок"
                        title={callActive ? 'Звонок уже идёт' : 'Начать видеозвонок'}
                      >
                        <PhoneIcon />
                        <span>{startingCall ? 'Запуск…' : 'Звонок'}</span>
                      </button>
                    )}
                    {selectedRoom.room_type !== 'direct' && (
                    <>
                    <button
                      type="button"
                      className={`${styles.membersBtn} ${showMembersPanel ? styles.membersBtnActive : ''}`}
                      onClick={() => setShowMembersPanel((prev) => !prev)}
                      aria-expanded={showMembersPanel}
                      aria-label="Участники чата"
                      title="Участники"
                    >
                      <UsersIcon />
                      <span>Участники</span>
                    </button>
                    {showMembersPanel && (
                      <div className={styles.membersPanel} role="dialog" aria-label="Участники чата">
                        <div className={styles.membersPanelHead}>
                          <div className={styles.membersPanelTitle}>
                            <strong>Участники</strong>
                            {!membersLoading && (
                              <span className={styles.membersCount}>{roomMembers.length}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowMembersPanel(false)}
                            aria-label="Закрыть"
                          >
                            <XMarkIcon />
                          </button>
                        </div>

                        {!membersLoading && roomMembers.length > 5 && (
                          <div className={styles.membersSearchWrap}>
                            <MagnifyingGlassIcon />
                            <input
                              type="search"
                              value={membersSearch}
                              onChange={(event) => setMembersSearch(event.target.value)}
                              placeholder="Поиск по имени или email"
                            />
                          </div>
                        )}

                        {isManageableCustomRoom(selectedRoom) &&
                          isRoomAdminOrOwner(selectedRoom, roomMembers, user?.id) && (
                          <div className={styles.membersPanelTools}>
                            <button
                              type="button"
                              className={styles.membersToolBtn}
                              onClick={() => setShowAddMembers(true)}
                              disabled={roomManaging}
                            >
                              <UserPlusIcon />
                              <span>Добавить</span>
                            </button>
                            <button
                              type="button"
                              className={styles.membersToolBtn}
                              onClick={() => setShowRenameRoom(true)}
                              disabled={roomManaging}
                            >
                              <PencilSquareIcon />
                              <span>Переименовать</span>
                            </button>
                            {isRoomOwner(selectedRoom, roomMembers, user?.id) && (
                              <button
                                type="button"
                                className={`${styles.membersToolBtn} ${styles.membersToolBtnDanger}`}
                                onClick={() => setShowDeleteRoomConfirm(true)}
                                disabled={roomManaging}
                              >
                                <TrashIcon />
                                <span>Удалить</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={styles.membersPanelBody}>
                          {membersLoading && (
                            <p className={styles.membersHint}>Загрузка участников…</p>
                          )}
                          {!membersLoading && roomMembers.length === 0 && (
                            <p className={styles.membersHint}>Нет участников</p>
                          )}
                          {!membersLoading && roomMembers.length > 0 && filteredRoomMembers.length === 0 && (
                            <p className={styles.membersHint}>Никого не найдено</p>
                          )}
                          {!membersLoading && filteredRoomMembers.length > 0 && (
                            <ul className={styles.membersList}>
                              {filteredRoomMembers.map((member) => {
                                const employee = {
                                  id: member.id,
                                  name: member.name,
                                  email: member.email,
                                  team_role: member.team_role,
                                };
                                const isSelf = member.id === user?.id;
                                const canRemove = canRemoveRoomMember(
                                  selectedRoom,
                                  myRoomRole,
                                  member,
                                  user?.id
                                );
                                const canPromote = canChangeRoomMemberRole(
                                  selectedRoom,
                                  roomMembers,
                                  user?.id,
                                  member
                                );
                                return (
                                  <li key={member.id} className={styles.memberCard}>
                                    <MemberAvatar
                                      member={member}
                                      avatarPath={peerAvatars[member.id]}
                                    />
                                    <div className={styles.memberCardMain}>
                                      <div className={styles.memberCardTop}>
                                        <EmployeeHoverTrigger
                                          employee={employee}
                                          className={styles.memberNameWrap}
                                          profileSource="chat"
                                        >
                                          <span className={styles.memberName}>{member.name}</span>
                                        </EmployeeHoverTrigger>
                                        {isSelf ? (
                                          <span className={styles.memberSelfBadge}>Вы</span>
                                        ) : (
                                          <button
                                            type="button"
                                            className={styles.memberDmBtn}
                                            onClick={() => openDirectRoomWithUser(member.id)}
                                            title={`Написать ${member.name}`}
                                          >
                                            <ChatBubbleLeftRightIcon />
                                            <span>Написать</span>
                                          </button>
                                        )}
                                      </div>
                                      <div className={styles.memberCardMeta}>
                                        <span
                                          className={`${styles.memberRoleBadge} ${
                                            member.role === 'owner'
                                              ? styles.memberRoleOwner
                                              : member.role === 'admin'
                                                ? styles.memberRoleAdmin
                                                : ''
                                          }`}
                                        >
                                          {memberRoleLabel(member)}
                                        </span>
                                        {member.email && (
                                          <span className={styles.memberEmail}>{member.email}</span>
                                        )}
                                      </div>
                                      {(canRemove || canPromote) && (
                                        <div className={styles.memberCardActions}>
                                          {canPromote && (
                                            <button
                                              type="button"
                                              className={styles.memberActionBtn}
                                              disabled={roomManaging}
                                              onClick={() => handleToggleMemberAdmin(member)}
                                            >
                                              {member.role === 'admin'
                                                ? 'Снять админа'
                                                : 'Сделать админом'}
                                            </button>
                                          )}
                                          {canRemove && (
                                            <button
                                              type="button"
                                              className={`${styles.memberActionBtn} ${styles.memberActionBtnDanger}`}
                                              disabled={roomManaging}
                                              onClick={() => handleRemoveRoomMember(member)}
                                            >
                                              {isSelf ? 'Выйти' : 'Удалить'}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.chatHeadCopy}>
                  <h2>Выберите чат</h2>
                  <p>Сообщения появятся в ленте справа</p>
                </div>
              )}
            </div>

            <div className={styles.messagesWrap}>
              <div
                ref={messagesBoxRef}
                className={styles.messages}
                onScroll={handleMessagesScroll}
              >
                {loadingOlder && (
                  <div className={styles.loadingOlder}>Загрузка истории…</div>
                )}
                {!selectedRoomId && (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>
                      <ChatBubbleLeftRightIcon />
                    </div>
                    <strong>Начните переписку</strong>
                    <p>Выберите комнату слева, чтобы открыть историю сообщений</p>
                  </div>
                )}
                {selectedRoomId && messages.length === 0 && !loading && (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>
                      <InboxIcon />
                    </div>
                    <strong>Пока тихо</strong>
                    <p>Напишите первое сообщение в этот чат</p>
                  </div>
                )}
                {messageTimeline.map((item) => {
                  if (item.kind === 'day') {
                    return (
                      <div key={item.id} className={styles.dayDivider}>
                        {item.label}
                      </div>
                    );
                  }
                  const msg = item.message;
                  const mine = msg.author_id === user?.id;
                  const parent = msg.parent_id ? messagesById.get(msg.parent_id) : null;
                  const isSelected = selectedIds.has(msg.id);
                  return (
                    <div
                      key={item.id}
                      data-msg-id={msg.id}
                      className={`${styles.bubbleRow} ${mine ? styles.bubbleRowMine : ''} ${
                        isSelected ? styles.bubbleRowSelected : ''
                      } ${selectionMode ? styles.bubbleRowSelectable : ''} ${
                        highlightedMessageId === msg.id ? styles.bubbleRowHighlighted : ''
                      }`}
                      onContextMenu={(e) => openContextMenu(e, msg)}
                      onClick={(e) => {
                        if (!selectionMode) return;
                        e.stopPropagation();
                        toggleSelectMessage(msg.id);
                      }}
                    >
                      <button
                        type="button"
                        className={`${styles.selectToggle} ${
                          isSelected ? styles.selectToggleOn : ''
                        } ${selectionMode || isSelected ? styles.selectToggleVisible : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectMessage(msg.id);
                        }}
                        aria-label={isSelected ? 'Снять выбор' : 'Выбрать сообщение'}
                        title={isSelected ? 'Снять выбор' : 'Выбрать'}
                      >
                        {isSelected ? <CheckCircleSolidIcon /> : <span className={styles.selectDot} />}
                      </button>
                      {!mine && (
                        <MessageAuthorAvatar
                          authorId={msg.author_id}
                          authorProfiles={authorProfiles}
                          peerAvatars={peerAvatars}
                        />
                      )}
                      <div
                        data-msg-bubble
                        className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs} ${
                          isSelected ? styles.bubbleSelected : ''
                        }`}
                      >
                        {msg.parent_id && (
                          <button
                            type="button"
                            className={styles.replyQuote}
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToMessage(msg.parent_id);
                            }}
                            title="Перейти к исходному сообщению"
                          >
                            <span>Ответ</span>
                            <p>
                              {parent
                                ? buildMessagePreview(parent, 100)
                                : 'Нажмите, чтобы перейти к сообщению'}
                            </p>
                          </button>
                        )}
                        {msg.content?.trim() && (
                          <MessageContentWithMentions
                            content={msg.content}
                            asMarkdown={Number(msg.author_id) === AI_ASSISTANT_USER_ID}
                          />
                        )}
                        <MessageEntityRefs
                          entityRefs={msg.entity_refs}
                          className={styles.messageEntityRefs}
                          onJoinCall={handleJoinCall}
                        />
                        <MessageAttachments
                          attachments={msg.attachments}
                          onOpenImage={setLightbox}
                          onOpenPreview={setPreviewAttachment}
                          className={styles.messageAttachments}
                        />
                        <div className={styles.bubbleMeta}>
                          {msg.edited_at && <span className={styles.editedTag}>изм.</span>}
                          <span className={styles.bubbleTime}>
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {mine && !msg.deleted_at && (
                            <MessageReadStatus readByOthers={msg.read_by_others} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {showJumpDown && (
                <button
                  type="button"
                  className={styles.jumpDownBtn}
                  onClick={() => scrollToBottom(true)}
                  title="К новым сообщениям"
                >
                  <ArrowDownIcon />
                  К новым
                </button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className={styles.selectionBar} role="toolbar" aria-label="Действия с выбранными">
                <div className={styles.selectionInfo}>
                  <span className={styles.selectionBadge}>{selectedIds.size}</span>
                  <span className={styles.selectionCount}>выбрано</span>
                </div>
                <div className={styles.selectionActions}>
                  <button
                    type="button"
                    className={styles.selectionBtn}
                    onClick={() => startForward(selectedMessages)}
                    disabled={sending || selectedMessages.length === 0}
                  >
                    <ArrowPathRoundedSquareIcon />
                    <span>Переслать</span>
                  </button>
                  {canDeleteSelected && (
                    <button
                      type="button"
                      className={`${styles.selectionBtn} ${styles.selectionDanger}`}
                      onClick={() => handleDelete(selectedMessages)}
                      disabled={sending}
                    >
                      <TrashIcon />
                      <span>Удалить</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.selectionBtn} ${styles.selectionGhost}`}
                    onClick={clearSelection}
                    title="Сбросить выбор"
                  >
                    <XMarkIcon />
                    <span>Отмена</span>
                  </button>
                </div>
              </div>
            )}

            {selectedRoomId && selectedRoom?.room_type === 'notification' && (
              <div className={styles.composerBlock}>
                <p className={styles.notificationHint}>
                  Сюда приходит changelog: задачи, команды, проекты, роль и отдел. Ответить из этого чата нельзя.
                </p>
              </div>
            )}

            {selectedRoomId && selectedRoom?.room_type !== 'notification' && (
              <form
                onSubmit={handleSendMessage}
                className={`${styles.composerBlock} ${
                  composerDropActive ? styles.composerDropActive : ''
                }`}
                onDragEnter={handleComposerDragEnter}
                onDragLeave={handleComposerDragLeave}
                onDragOver={handleComposerDragOver}
                onDrop={handleComposerDrop}
              >
                {composerDropActive && (
                  <div className={styles.composerDropOverlay} aria-hidden="true">
                    <PaperClipIcon />
                    <span>Отпустите файл или изображение, чтобы прикрепить</span>
                  </div>
                )}
                {(replyTo || editingMessage) && (
                  <div className={styles.composerContext}>
                    <div>
                      <strong>{editingMessage ? 'Редактирование' : 'Ответ'}</strong>
                      <p>{previewText((editingMessage || replyTo)?.content, 120)}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.composerContextClose}
                      onClick={cancelComposerContext}
                      aria-label="Отменить"
                    >
                      ×
                    </button>
                  </div>
                )}
                {(editingMessage
                  ? editAttachmentItems.length > 0 ||
                    editEntityRefs.length > 0 ||
                    pendingAttachments.length > 0 ||
                    pendingEntityRefs.length > 0
                  : pendingAttachments.length > 0 || pendingEntityRefs.length > 0) && (
                  <div className={styles.pendingAttachments}>
                    {editEntityRefs.map((ref) => {
                      const Icon = ENTITY_REF_ICONS[ref.type] || LinkIcon;
                      return (
                        <div key={`edit-ref-${entityRefKey(ref)}`} className={styles.pendingAttachment}>
                          <Icon className={styles.pendingDocIcon} />
                          <span className={styles.pendingName} title={ref.title}>
                            {getEntityRefLabel(ref)}: {ref.title}
                          </span>
                          <button
                            type="button"
                            className={styles.pendingRemove}
                            onClick={() => removeEditEntityRef(ref)}
                            aria-label="Убрать ссылку"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {pendingEntityRefs.map((ref) => {
                      const Icon = ENTITY_REF_ICONS[ref.type] || LinkIcon;
                      return (
                        <div key={entityRefKey(ref)} className={styles.pendingAttachment}>
                          <Icon className={styles.pendingDocIcon} />
                          <span className={styles.pendingName} title={ref.title}>
                            {getEntityRefLabel(ref)}: {ref.title}
                          </span>
                          <button
                            type="button"
                            className={styles.pendingRemove}
                            onClick={() => removePendingEntityRef(ref)}
                            aria-label="Убрать ссылку"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {editAttachmentItems.map((att) => (
                      <div key={`edit-att-${att.id}`} className={styles.pendingAttachment}>
                        <DocumentIcon className={styles.pendingDocIcon} />
                        <span className={styles.pendingName} title={att.original_filename}>
                          {att.original_filename}
                        </span>
                        <button
                          type="button"
                          className={styles.pendingRemove}
                          onClick={() => removeEditAttachment(att.id)}
                          aria-label="Убрать файл"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {pendingAttachments.map((p) => (
                      <div
                        key={p.localId}
                        className={`${styles.pendingAttachment} ${
                          p.error ? styles.pendingAttachmentError : ''
                        }`}
                      >
                        {p.previewUrl ? (
                          <img src={p.previewUrl} alt="" className={styles.pendingThumb} />
                        ) : (
                          <DocumentIcon className={styles.pendingDocIcon} />
                        )}
                        <span className={styles.pendingName} title={p.name}>
                          {p.name}
                        </span>
                        {p.uploading && <span className={styles.pendingStatus}>…</span>}
                        {p.error && <span className={styles.pendingError}>!</span>}
                        <button
                          type="button"
                          className={styles.pendingRemove}
                          onClick={() => removePendingAttachment(p.localId)}
                          aria-label="Убрать файл"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`${styles.composer} ${
                    composerDropActive ? styles.composerDropHighlight : ''
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className={styles.fileInputHidden}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    className={styles.attachBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    aria-label="Прикрепить файл"
                    title="Прикрепить файл или перетащите сюда"
                  >
                    <PaperClipIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.attachBtn}
                    onClick={() => setShowEntityPicker(true)}
                    disabled={sending}
                    aria-label="Прикрепить из проекта"
                    title="Документ, задача или дашборд"
                  >
                    <LinkIcon />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    onInput={resizeComposer}
                    placeholder={
                      editingMessage
                        ? 'Измените сообщение…'
                        : 'Напишите сообщение… @ai — вопрос ассистенту. Enter — отправить, Shift+Enter — новая строка'
                    }
                    className={styles.composerField}
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={sending || !canSendMessage}
                    className={styles.sendBtn}
                    aria-label={editingMessage ? 'Сохранить' : 'Отправить сообщение'}
                    title={editingMessage ? 'Сохранить' : 'Отправить'}
                  >
                    <PaperAirplaneIcon />
                  </button>
                </div>
              </form>
            )}
            </>
            )}
          </section>
        </div>
      )}

      {subTab === 'mail' && (
        <MailPane user={user} notify={notify} />
      )}

      {contextMenu &&
        ctxMessage &&
        createPortal(
          <div
            ref={contextMenuRef}
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button type="button" onClick={() => toggleSelectMessage(ctxMessage.id)}>
              <CheckIcon />
              Выбрать
            </button>
            <button type="button" onClick={() => startReply(ctxMessage)}>
              <ArrowUturnLeftIcon />
              Ответить
            </button>
            <button type="button" onClick={() => startForward(ctxMessage)}>
              <ArrowPathRoundedSquareIcon />
              Переслать
            </button>
            {ctxMine && (
              <>
                <button type="button" onClick={() => startEdit(ctxMessage)}>
                  <PencilSquareIcon />
                  Изменить
                </button>
                <button
                  type="button"
                  className={styles.contextDanger}
                  onClick={() => handleDelete(ctxMessage)}
                >
                  <TrashIcon />
                  Удалить у всех
                </button>
              </>
            )}
          </div>,
          document.body
        )}

      {forwardMessages?.length > 0 && (
        <div className={styles.modalBackdrop} onClick={() => setForwardMessages(null)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Переслать сообщения"
          >
            <div className={styles.modalHead}>
              <h3>
                {forwardMessages.length === 1
                  ? 'Переслать в чат'
                  : `Переслать ${forwardMessages.length} сообщ.`}
              </h3>
              <button type="button" onClick={() => setForwardMessages(null)} aria-label="Закрыть">
                <XMarkIcon />
              </button>
            </div>
            <p className={styles.modalPreview}>
              {forwardMessages.length === 1
                ? previewText(forwardMessages[0].content, 160)
                : forwardMessages
                    .slice(0, 3)
                    .map((m) => previewText(m.content, 60))
                    .join(' · ')}
              {forwardMessages.length > 3 ? '…' : ''}
            </p>

            <div className={styles.forwardSearchWrap}>
              <MagnifyingGlassIcon />
              <input
                type="search"
                value={forwardSearch}
                onChange={(event) => setForwardSearch(event.target.value)}
                placeholder="Поиск чата или сотрудника"
                autoFocus
              />
            </div>

            <div className={styles.modalRoomBody}>
              {forwardSearch.trim() && forwardEmployeesLoading && (
                <p className={styles.forwardHint}>Поиск…</p>
              )}

              {forwardTargetRooms.length > 0 && (
                <section className={styles.forwardSection}>
                  {forwardSearch.trim() && (
                    <h4 className={styles.forwardSectionTitle}>Чаты</h4>
                  )}
                  <ul className={styles.modalRoomList}>
                    {forwardTargetRooms.map((room) => (
                      <li key={room.id} className={styles.modalRoomItem}>
                        <button
                          type="button"
                          className={styles.modalRoomBtn}
                          disabled={sending}
                          onClick={() => handleForwardToRoom(room.id)}
                        >
                          <RoomAvatar
                            room={room}
                            tone={ROOM_TONE[room.room_type] || styles.toneCustom}
                            peerAvatars={peerAvatars}
                            currentUser={user}
                          />
                          <span className={styles.modalRoomMeta}>
                            <strong>{getRoomDisplayName(room, user)}</strong>
                            <small>{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {forwardSearch.trim() && forwardTargetEmployees.length > 0 && (
                <section className={styles.forwardSection}>
                  <h4 className={styles.forwardSectionTitle}>Сотрудники</h4>
                  <ul className={styles.modalRoomList}>
                    {forwardTargetEmployees.map((employee) => (
                      <li key={`employee-${employee.id}`} className={styles.modalRoomItem}>
                        <button
                          type="button"
                          className={styles.modalRoomBtn}
                          disabled={sending}
                          onClick={() => handleForwardToEmployee(employee)}
                        >
                          <MemberAvatar
                            member={employee}
                            avatarPath={peerAvatars[employee.id]}
                          />
                          <span className={styles.modalRoomMeta}>
                            <strong>{employee.name}</strong>
                            <small>
                              {[employee.team_role, employee.email].filter(Boolean).join(' · ') ||
                                'Личное сообщение'}
                            </small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!forwardEmployeesLoading &&
                forwardTargetRooms.length === 0 &&
                forwardTargetEmployees.length === 0 && (
                  <p className={styles.forwardHint}>
                    {forwardSearch.trim()
                      ? 'Ничего не найдено'
                      : 'Нет других чатов для пересылки'}
                  </p>
                )}
            </div>
          </div>
        </div>
      )}

      {showCreateRoom && (
        <CreateRoomModal
          open={showCreateRoom}
          onClose={() => setShowCreateRoom(false)}
          onCreated={handleRoomCreated}
          currentUserId={user?.id}
        />
      )}

      {showAddMembers && selectedRoomId && (
        <AddRoomMembersModal
          open={showAddMembers}
          onClose={() => setShowAddMembers(false)}
          roomId={selectedRoomId}
          existingMemberIds={roomMembers.map((member) => member.id)}
          onAdded={handleMembersAdded}
        />
      )}

      <RenameRoomModal
        open={showRenameRoom}
        roomName={selectedRoom?.name || ''}
        onClose={() => setShowRenameRoom(false)}
        onSubmit={handleRenameRoomSubmit}
        submitting={roomManaging}
      />

      <DeleteRoomConfirmModal
        open={showDeleteRoomConfirm}
        roomName={selectedRoom?.name || ''}
        onClose={() => setShowDeleteRoomConfirm(false)}
        onConfirm={handleDeleteRoomConfirm}
        submitting={roomManaging}
      />

      {showEntityPicker && (
        <EntityAttachPicker
          open={showEntityPicker}
          onClose={() => setShowEntityPicker(false)}
          onSelect={editingMessage ? toggleComposerEntityRef : togglePendingEntityRef}
          selectedKeys={editingMessage ? composerEntityRefKeys : pendingEntityRefKeys}
        />
      )}

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {lightbox?.images?.length > 0 &&
        createPortal(
          <ImageLightbox
            gallery={lightbox}
            onClose={() => setLightbox(null)}
            onChangeIndex={setLightboxIndex}
          />,
          document.body
        )}
    </div>
    </MediaBatchProvider>
  );
}
