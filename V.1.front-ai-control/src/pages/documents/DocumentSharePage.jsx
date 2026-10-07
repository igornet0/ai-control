import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Notification from '../../components/Notification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { documentLinkService } from '../../services/documentLinkService';
import { documentService } from '../../services/documentService';
import DocumentSheetPreview from './DocumentSheetPreview';
import ShareFieldEditModal from './ShareFieldEditModal';
import { resolveTitleTemplate } from './documentPlaceholders';
import { useDocumentPlaceholderVars } from './useDocumentPlaceholderVars';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import styles from './DocumentsApp.module.css';

function snapshotPayload(title, fieldData) {
  return JSON.stringify({ title: title ?? '', fieldData: fieldData ?? {} });
}

export default function DocumentSharePage() {
  const { token } = useParams();
  const [bootstrap, setBootstrap] = useState(null);
  const [content, setContent] = useState(null);
  const [sheetBlocks, setSheetBlocks] = useState(null);
  const [titleStyle, setTitleStyle] = useState(null);
  const [pageNumberStyle, setPageNumberStyle] = useState(null);
  const [pageLayoutStyle, setPageLayoutStyle] = useState(null);
  const [structure, setStructure] = useState(null);
  const [titleTemplate, setTitleTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [title, setTitle] = useState('');
  const [fieldData, setFieldData] = useState({});
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [proposalComment, setProposalComment] = useState('');

  const isEdit = bootstrap?.permission === 'edit';

  const isTableDocument = useMemo(
    () => isSpreadsheetTemplate({ sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [] }),
    [sheetBlocks],
  );

  const hasChanges = useMemo(
    () => baselineSnapshot !== '' && snapshotPayload(title, fieldData) !== baselineSnapshot,
    [baselineSnapshot, title, fieldData],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const boot = await documentLinkService.bootstrapShare(token);
      const body = await documentLinkService.getShareContent(token);
      const loadedTitle = body.title || '';
      const loadedFieldData = body.field_data || {};
      setBootstrap(boot);
      setContent(body);
      setTitle(loadedTitle);
      setFieldData(loadedFieldData);
      setBaselineSnapshot(snapshotPayload(loadedTitle, loadedFieldData));

      if (boot.document_kind_id) {
        try {
          const s = await documentService.getStructureByKindId(boot.document_kind_id);
          setStructure(s);
        } catch {
          setStructure(null);
        }
      }

      if (boot.template_id) {
        try {
          const template = boot.template_version
            ? await documentService.getTemplateVersion(boot.template_id, boot.template_version)
            : await documentService.getTemplate(boot.template_id);
          if (Array.isArray(template.sheet_content) && template.sheet_content.length > 0) {
            setSheetBlocks(template.sheet_content);
          } else {
            setSheetBlocks(null);
          }
          setTitleTemplate(template.title_template != null && template.title_template !== '' ? template.title_template : null);
          setTemplateName(template.name || '');
          setTitleStyle(template.title_style && typeof template.title_style === 'object' ? template.title_style : null);
          setPageNumberStyle(template.page_number_style && typeof template.page_number_style === 'object' ? template.page_number_style : null);
          setPageLayoutStyle(template.page_layout_style && typeof template.page_layout_style === 'object' ? template.page_layout_style : null);
        } catch {
          setSheetBlocks(null);
          setTitleTemplate(null);
          setTemplateName('');
          setTitleStyle(null);
          setPageNumberStyle(null);
          setPageLayoutStyle(null);
        }
      } else {
        setSheetBlocks(null);
        setTitleTemplate(null);
        setTemplateName('');
        setTitleStyle(null);
        setPageNumberStyle(null);
        setPageLayoutStyle(null);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось открыть ссылку');
      setBootstrap(null);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFieldChange = (fieldName, value) => {
    setFieldData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleFieldClick = useCallback(({ fieldName, block, meta }) => {
    if (!isEdit || isTableDocument || !fieldName) return;
    setEditTarget({ kind: 'field', fieldName, block, meta });
  }, [isEdit, isTableDocument]);

  const handleTitleClick = useCallback(() => {
    if (!isEdit || isTableDocument) return;
    setEditTarget({ kind: 'title' });
  }, [isEdit, isTableDocument]);

  const handleSaveProposal = async () => {
    if (!token || !isEdit || !hasChanges) return;
    setSaving(true);
    setError(null);
    setNotification(null);
    try {
      await documentLinkService.saveShareProposal(token, {
        field_data: fieldData,
        title,
        comment: proposalComment,
      });
      setBaselineSnapshot(snapshotPayload(title, fieldData));
      setProposalComment('');
      setNotification({
        message: 'Предложение отправлено владельцу документа.',
        type: 'success',
      });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось сохранить предложение');
    } finally {
      setSaving(false);
    }
  };

  const kindLabel = templateName || 'Документ';
  const placeholderVars = useDocumentPlaceholderVars({
    номер: content?.number ?? '—',
    вид: kindLabel,
  });
  const sheetTitle = useMemo(
    () => resolveTitleTemplate(
      titleTemplate || `${kindLabel} — № {номер}`,
      placeholderVars,
    ) || `${kindLabel} — № ${content?.number ?? content?.document_id ?? ''}`,
    [titleTemplate, kindLabel, placeholderVars, content?.number, content?.document_id],
  );
  const pageTitle = useMemo(() => {
    const trimmed = title != null ? String(title).trim() : '';
    return trimmed || sheetTitle;
  }, [title, sheetTitle]);
  useDocumentTitle(content ? [pageTitle, 'Документ по ссылке'] : null);

  if (loading) {
    return (
      <div className={styles.sharePage}>
        <p className={styles.sharePageMeta}>Загрузка документа…</p>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className={styles.sharePage}>
        <p className={styles.error}>{error}</p>
        <Link to="/documents">К документам</Link>
      </div>
    );
  }

  return (
    <div className={`${styles.sharePage} ${isTableDocument ? styles.sharePageTable : ''}`.trim()}>
      <header className={styles.sharePageHeader}>
        <div>
          <h1 className={styles.sharePageTitle}>{pageTitle}</h1>
          <div className={styles.sharePageMetaRow}>
            {content?.number && <span>№ {content.number}</span>}
            {bootstrap?.author_name && <span>Автор: {bootstrap.author_name}</span>}
            {isEdit ? <span className={styles.shareModeBadge}>Предложение изменений</span> : <span className={styles.shareModeBadge}>Просмотр</span>}
          </div>
        </div>
        <Link to="/documents" className={styles.secondaryButton}>К документам</Link>
      </header>

      {isEdit && (
        <div className={styles.shareProposalBanner} role="status">
          {isTableDocument
            ? 'Измените ячейки в таблице. После правок появится кнопка отправки предложения.'
            : 'Нажмите на поле или заголовок документа, чтобы изменить значение. После правок появится кнопка отправки.'}
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <DocumentSheetPreview
        sheetBlocks={sheetBlocks}
        fieldData={fieldData}
        title={sheetTitle}
        titleStyle={titleStyle}
        pageNumberStyle={pageNumberStyle}
        pageLayout={pageLayoutStyle}
        structure={structure}
        docNumber={content?.number}
        kindName={kindLabel}
        readOnly={isTableDocument ? !isEdit : true}
        interactive={isEdit && !isTableDocument}
        onFieldChange={handleFieldChange}
        onFieldClick={handleFieldClick}
        onTitleClick={handleTitleClick}
      />

      <ShareFieldEditModal
        open={!!editTarget}
        target={editTarget}
        fieldData={fieldData}
        title={title}
        onSaveField={handleFieldChange}
        onSaveTitle={setTitle}
        onClose={() => setEditTarget(null)}
      />

      {isEdit && hasChanges && (
        <div className={styles.shareSubmitBar} role="region" aria-label="Отправка изменений">
          <div className={styles.shareSubmitBarMain}>
            <span className={styles.shareSubmitBarHint}>Есть несохранённые изменения</span>
            <label className={styles.shareSubmitComment}>
              <span className={styles.shareSubmitCommentLabel}>Комментарий к изменениям</span>
              <textarea
                className={styles.shareSubmitCommentInput}
                value={proposalComment}
                onChange={(e) => setProposalComment(e.target.value)}
                placeholder="Необязательно — пояснение для владельца документа"
                rows={2}
                maxLength={2000}
                disabled={saving}
              />
            </label>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSaveProposal}
            disabled={saving}
          >
            {saving ? 'Отправка…' : 'Отправить изменения'}
          </button>
        </div>
      )}
    </div>
  );
}
