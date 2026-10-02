import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  TableCellsIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { documentService } from '../../../services/documentService';
import { exportDocumentForMail } from '../../../services/mailDocumentExport';
import { messagingService } from '../../../services/messagingService';
import { projectService } from '../../../services/projectService';
import {
  formatRelativeTime,
  getDocumentDisplayTitle,
} from '../../documents/documentsPageUtils';
import { isSpreadsheetDocument } from '../../documents/templateTypeUtils';
import styles from './ComposeMailModal.module.css';

const initialForm = { to: '', subject: '', body: '' };

const TYPE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'table', label: 'Таблицы' },
  { id: 'document', label: 'Документы' },
];

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function documentNumberLabel(doc) {
  if (doc?.number == null || doc.number === '') return null;
  return `№ ${doc.number}`;
}

function documentWhen(doc) {
  return formatRelativeTime(doc?.updated || doc?.updated_at || doc?.created || doc?.created_at);
}

export default function ComposeMailModal({
  open,
  onClose,
  onSent,
  userEmail,
}) {
  const [form, setForm] = useState(initialForm);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setAttachments([]);
      setError('');
      setSubmitting(false);
      setUploading(false);
      setShowDocPicker(false);
      setDocSearch('');
      setTypeFilter('all');
      setTeamFilter('all');
    }
  }, [open]);

  const loadPickerMeta = useCallback(async () => {
    try {
      const [tplData, projectData] = await Promise.all([
        documentService.getTemplates(),
        projectService.getProjects(),
      ]);
      setTemplates(normalizeList(tplData));
      setProjects(normalizeList(projectData));
    } catch (err) {
      console.error(err);
      setTemplates([]);
      setProjects([]);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await documentService.getDocuments(null, null, {
        limit: 200,
        search: docSearch.trim() || undefined,
      });
      setDocuments(normalizeList(data));
    } catch (err) {
      console.error(err);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, [docSearch]);

  useEffect(() => {
    if (!open || !showDocPicker) return undefined;
    loadPickerMeta();
    return undefined;
  }, [open, showDocPicker, loadPickerMeta]);

  useEffect(() => {
    if (!open || !showDocPicker) return undefined;
    const timer = setTimeout(loadDocuments, docSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, showDocPicker, loadDocuments, docSearch]);

  const projectById = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      if (p?.id != null) map.set(Number(p.id), p);
    });
    return map;
  }, [projects]);

  const getDocTeamLinks = useCallback(
    (doc) => {
      if (doc?.project_id == null) return [];
      const project = projectById.get(Number(doc.project_id));
      if (!project) return [];

      if (Array.isArray(project.teams) && project.teams.length > 0) {
        return project.teams
          .map((link) => {
            const id = Number(link?.team_id ?? link?.id);
            if (Number.isNaN(id)) return null;
            const name = String(link?.team_name || link?.name || `Команда ${id}`).trim();
            return { id, name };
          })
          .filter(Boolean);
      }

      const ids = Array.isArray(project.team_ids) ? project.team_ids : [];
      return ids
        .map((raw) => {
          const id = Number(raw);
          if (Number.isNaN(id)) return null;
          return { id, name: `Команда ${id}` };
        })
        .filter(Boolean);
    },
    [projectById],
  );

  const getDocTeamIds = useCallback(
    (doc) => getDocTeamLinks(doc).map((link) => link.id),
    [getDocTeamLinks],
  );

  const getDocTeamLabels = useCallback(
    (doc) => getDocTeamLinks(doc).map((link) => link.name).filter(Boolean),
    [getDocTeamLinks],
  );

  const teamFilterOptions = useMemo(() => {
    const byId = new Map();
    documents.forEach((doc) => {
      getDocTeamLinks(doc).forEach((link) => {
        if (!byId.has(link.id)) byId.set(link.id, link.name);
      });
    });
    const options = Array.from(byId.entries())
      .map(([id, label]) => ({ id: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    const hasUnassigned = documents.some((doc) => getDocTeamIds(doc).length === 0);
    return { options, hasUnassigned };
  }, [documents, getDocTeamLinks, getDocTeamIds]);

  const teamFilteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const teamIds = getDocTeamIds(doc);
      if (teamFilter === 'unassigned') return teamIds.length === 0;
      if (teamFilter !== 'all') {
        const wanted = Number(teamFilter);
        if (Number.isNaN(wanted) || !teamIds.includes(wanted)) return false;
      }
      return true;
    });
  }, [documents, teamFilter, getDocTeamIds]);

  const filteredDocuments = useMemo(() => {
    return teamFilteredDocuments.filter((doc) => {
      const isTable = isSpreadsheetDocument(doc, templates);
      if (typeFilter === 'table' && !isTable) return false;
      if (typeFilter === 'document' && isTable) return false;
      return true;
    });
  }, [teamFilteredDocuments, templates, typeFilter]);

  const tableDocs = useMemo(
    () => filteredDocuments.filter((doc) => isSpreadsheetDocument(doc, templates)),
    [filteredDocuments, templates],
  );
  const textDocs = useMemo(
    () => filteredDocuments.filter((doc) => !isSpreadsheetDocument(doc, templates)),
    [filteredDocuments, templates],
  );

  const tableCount = useMemo(
    () => teamFilteredDocuments.filter((doc) => isSpreadsheetDocument(doc, templates)).length,
    [teamFilteredDocuments, templates],
  );
  const textCount = useMemo(
    () => teamFilteredDocuments.filter((doc) => !isSpreadsheetDocument(doc, templates)).length,
    [teamFilteredDocuments, templates],
  );

  const addUploadedAttachment = (att, label) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: att.id,
        name: label || att.original_filename,
        size: att.size_bytes,
        mime: att.mime_type,
      },
    ]);
  };

  const handleFilePick = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        const att = await messagingService.uploadMailAttachment(file);
        addUploadedAttachment(att, file.name);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentPick = async (doc) => {
    setShowDocPicker(false);
    setUploading(true);
    setError('');
    try {
      const exported = await exportDocumentForMail(doc);
      const files = Array.isArray(exported) ? exported : [exported];
      for (const file of files) {
        const att = await messagingService.uploadMailAttachment(file);
        addUploadedAttachment(att, file.name);
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось подготовить документ для отправки');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.to.trim() || !form.subject.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await messagingService.sendMail({
        to: form.to.trim(),
        subject: form.subject.trim(),
        body: form.body,
        attachmentIds: attachments.map((a) => a.id),
      });
      onSent?.(form.subject.trim());
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Ошибка отправки письма');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDocItem = (doc) => {
    const isTable = isSpreadsheetDocument(doc, templates);
    const title = getDocumentDisplayTitle(doc);
    const numberLabel = documentNumberLabel(doc);
    const project = doc?.project_name?.trim() || null;
    const teamLabels = getDocTeamLabels(doc);
    const when = documentWhen(doc);
    const Icon = isTable ? TableCellsIcon : DocumentTextIcon;

    return (
      <li key={doc.id}>
        <button
          type="button"
          className={styles.pickerItem}
          onClick={() => handleDocumentPick(doc)}
        >
          <span
            className={`${styles.pickerItemIcon} ${isTable ? styles.pickerItemIconTable : ''}`}
            aria-hidden
          >
            <Icon />
          </span>
          <span className={styles.pickerItemBody}>
            <span className={styles.pickerItemTitle}>{title}</span>
            <span className={styles.pickerItemMeta}>
              <span className={`${styles.pickerBadge} ${isTable ? styles.pickerBadgeTable : ''}`}>
                {isTable ? 'Таблица → CSV' : 'Документ → PDF'}
              </span>
              {numberLabel && <span className={styles.pickerBadge}>{numberLabel}</span>}
              {project && <span className={styles.pickerMetaText}>{project}</span>}
              {teamLabels.length > 0 && (
                <span className={styles.pickerMetaText}>
                  {teamLabels.length === 1 ? teamLabels[0] : `${teamLabels[0]} +${teamLabels.length - 1}`}
                </span>
              )}
              {when && <span className={styles.pickerMetaText}>{when}</span>}
            </span>
          </span>
          <span className={styles.pickerItemAction}>
            <ArrowUpTrayIcon />
            <span>Вложить</span>
          </span>
        </button>
      </li>
    );
  };

  const renderSections = () => {
    if (docsLoading) {
      return <li className={styles.pickerEmpty}>Загрузка документов…</li>;
    }
    if (filteredDocuments.length === 0) {
      return (
        <li className={styles.pickerEmpty}>
          {docSearch.trim() || typeFilter !== 'all' || teamFilter !== 'all'
            ? 'Ничего не найдено по фильтрам'
            : 'Документы не найдены'}
        </li>
      );
    }

    if (typeFilter === 'table') {
      return tableDocs.map(renderDocItem);
    }
    if (typeFilter === 'document') {
      return textDocs.map(renderDocItem);
    }

    return (
      <>
        {tableDocs.length > 0 && (
          <li className={styles.pickerSection} aria-hidden={false}>
            <div className={styles.pickerSectionHead}>
              <TableCellsIcon />
              <span>Таблицы</span>
              <span className={styles.pickerSectionCount}>{tableDocs.length}</span>
            </div>
            <ul className={styles.pickerSectionList}>{tableDocs.map(renderDocItem)}</ul>
          </li>
        )}
        {textDocs.length > 0 && (
          <li className={styles.pickerSection}>
            <div className={styles.pickerSectionHead}>
              <DocumentTextIcon />
              <span>Текстовые документы</span>
              <span className={styles.pickerSectionCount}>{textDocs.length}</span>
            </div>
            <ul className={styles.pickerSectionList}>{textDocs.map(renderDocItem)}</ul>
          </li>
        )}
      </>
    );
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation">
        <form
          className={styles.panel}
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.head}>
            <div>
              <h3>Новое письмо</h3>
              <p>Отправка через Exmail от имени {userEmail || 'вашего профиля'}</p>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
              <XMarkIcon />
            </button>
          </div>

          <div className={styles.body}>
            <label>
              <span className={styles.fieldLabel}>Кому</span>
              <input
                type="email"
                required
                className={styles.input}
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                placeholder="colleague@company.ru"
              />
            </label>
            <label>
              <span className={styles.fieldLabel}>Тема</span>
              <input
                type="text"
                required
                className={styles.input}
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="О чём письмо"
              />
            </label>
            <label>
              <span className={styles.fieldLabel}>Текст</span>
              <textarea
                className={styles.textarea}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Текст письма (HTML поддерживается)"
              />
            </label>

            <div className={styles.attachBar}>
              <button
                type="button"
                className={styles.attachBtn}
                disabled={uploading || submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                <PaperClipIcon />
                Файл с компьютера
              </button>
              <button
                type="button"
                className={styles.attachBtn}
                disabled={uploading || submitting}
                onClick={() => setShowDocPicker(true)}
              >
                <DocumentTextIcon />
                Документ проекта
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={styles.fileInput}
                onChange={handleFilePick}
              />
            </div>

            {attachments.length > 0 && (
              <ul className={styles.attachList}>
                {attachments.map((att) => (
                  <li key={att.id} className={styles.attachItem}>
                    <span>{att.name} · {formatFileSize(att.size)}</span>
                    <button type="button" onClick={() => removeAttachment(att.id)} aria-label="Удалить">
                      <XMarkIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.foot}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting || uploading}>
              <PaperAirplaneIcon />
              {submitting ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>

      {showDocPicker && (
        <div className={styles.pickerBackdrop} onClick={() => setShowDocPicker(false)} role="presentation">
          <div
            className={styles.pickerPanel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Документы проекта"
          >
            <div className={styles.pickerHead}>
              <div className={styles.pickerHeadText}>
                <h4>Документы проекта</h4>
                <p>Таблицы → CSV, текстовые документы → PDF</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowDocPicker(false)}
                aria-label="Закрыть"
              >
                <XMarkIcon />
              </button>
            </div>

            <div className={styles.pickerFilters}>
              <div className={styles.pickerTypeTabs} role="tablist" aria-label="Тип документа">
                {TYPE_FILTERS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={typeFilter === tab.id}
                    className={`${styles.pickerTypeTab} ${typeFilter === tab.id ? styles.pickerTypeTabActive : ''}`}
                    onClick={() => setTypeFilter(tab.id)}
                  >
                    {tab.label}
                    {tab.id === 'table' && (
                      <span className={styles.pickerTypeCount}>{tableCount}</span>
                    )}
                    {tab.id === 'document' && (
                      <span className={styles.pickerTypeCount}>{textCount}</span>
                    )}
                    {tab.id === 'all' && (
                      <span className={styles.pickerTypeCount}>{teamFilteredDocuments.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <label className={styles.pickerTeamFilter}>
                <UserGroupIcon aria-hidden />
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  aria-label="Фильтр по команде"
                >
                  <option value="all">Все команды</option>
                  {teamFilterOptions.hasUnassigned && (
                    <option value="unassigned">Без команды</option>
                  )}
                  {teamFilterOptions.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.pickerSearch}>
              <MagnifyingGlassIcon className={styles.pickerSearchIcon} aria-hidden />
              <input
                type="search"
                placeholder="Название или номер…"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                autoFocus
              />
            </div>

            <ul className={styles.pickerList}>{renderSections()}</ul>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
