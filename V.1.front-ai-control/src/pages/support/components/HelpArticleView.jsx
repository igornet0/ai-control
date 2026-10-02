import React from 'react';
import { Link } from 'react-router-dom';
import HelpImageFrame from './HelpImageFrame';
import styles from '../Support.module.css';

function renderBody(body) {
  if (!body) return null;
  return String(body)
    .split('\n')
    .map((line, idx) => (
      <p key={idx} className={styles.sectionBody}>
        {line}
      </p>
    ));
}

export default function HelpArticleView({
  article,
  categoryId,
  canEdit = false,
  imageRevision = 0,
  onImageChanged,
}) {
  if (!article) {
    return <p className={styles.emptyHint}>Выберите тему в меню слева.</p>;
  }

  const actions = Array.isArray(article.actions) ? article.actions : [];

  return (
    <article className={styles.articleView}>
      {article.summary ? <p className={styles.articleViewSummary}>{article.summary}</p> : null}

      {actions.length > 0 ? (
        <div className={styles.articleActions}>
          {actions.map((action) => {
            const useFullLoad = Boolean(action.fullLoad || action.href?.includes('datacode-docs'));
            const openInNewTab = Boolean(action.newTab);
            if (useFullLoad) {
              return (
                <a
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={styles.articleActionBtn}
                  {...(openInNewTab
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {action.label}
                </a>
              );
            }
            return (
              <Link
                key={`${action.href}-${action.label}`}
                to={action.href}
                className={styles.articleActionBtn}
                {...(openInNewTab
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <HelpImageFrame
        categoryId={categoryId}
        articleId={article.id}
        slot="cover"
        label="Обложка темы"
        canEdit={canEdit}
        revision={imageRevision}
        onChanged={onImageChanged}
      />

      <div className={styles.sections}>
        {(article.sections || []).map((section, idx) => (
          <section key={`${section.heading}-${idx}`} className={styles.section}>
            <h3 className={styles.sectionHeading}>{section.heading}</h3>
            {renderBody(section.body)}
            <HelpImageFrame
              categoryId={categoryId}
              articleId={article.id}
              slot={`s${idx}`}
              label={`Иллюстрация: ${section.heading}`}
              canEdit={canEdit}
              revision={imageRevision}
              onChanged={onImageChanged}
            />
          </section>
        ))}
      </div>
    </article>
  );
}
