import React, { useEffect, useMemo, useState } from 'react';
import MobileSidebarChrome from '../../components/layout/MobileSidebarChrome.jsx';
import { useAuth } from '../../context/AuthContext';
import { useCollapsibleSidebar } from '../../hooks/useCollapsibleSidebar.js';
import { supportService } from '../../services/supportService';
import { isPlatformAdmin } from '../../utils/isPlatformAdmin';
import AskQuestionPanel from './components/AskQuestionPanel';
import HelpArticleView from './components/HelpArticleView';
import { SUPPORT_CATEGORIES, getArticle, getCategoryById } from './content';
import styles from './Support.module.css';

const SIDEBAR_COLLAPSED_KEY = 'support-sidebar-collapsed';

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a9 9 0 1 0 9 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 8v4.5M12 16.5h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const {
    collapsed: sidebarCollapsed,
    toggle: toggleSidebar,
    mobileOpen,
    closeMobile,
    openMobile,
  } = useCollapsibleSidebar(SIDEBAR_COLLAPSED_KEY);

  const [categoryId, setCategoryId] = useState(SUPPORT_CATEGORIES[0].id);
  const [articleId, setArticleId] = useState(SUPPORT_CATEGORIES[0].articles[0]?.id);
  const [expandedIds, setExpandedIds] = useState(() => new Set([SUPPORT_CATEGORIES[0].id]));
  const [askOpen, setAskOpen] = useState(false);
  const [canEditImages, setCanEditImages] = useState(false);
  const [imageRevision, setImageRevision] = useState(0);

  const category = useMemo(() => getCategoryById(categoryId), [categoryId]);
  const article = useMemo(
    () => getArticle(categoryId, articleId),
    [categoryId, articleId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cap = await supportService.getHelpEditCapability();
        if (!cancelled) {
          setCanEditImages(Boolean(cap?.can_edit || isPlatformAdmin(user)));
        }
      } catch {
        if (!cancelled) setCanEditImages(isPlatformAdmin(user));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const first = category?.articles?.[0]?.id;
    if (first && !category.articles.some((a) => a.id === articleId)) {
      setArticleId(first);
    }
  }, [category, articleId]);

  const selectCategoryHeader = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    const next = getCategoryById(id);
    setCategoryId(id);
    if (!expandedIds.has(id)) {
      setArticleId(next?.articles?.[0]?.id);
    }
  };

  const selectArticle = (catId, artId) => {
    setCategoryId(catId);
    setArticleId(artId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(catId);
      return next;
    });
    closeMobile();
  };

  return (
    <>
      <MobileSidebarChrome
        open={mobileOpen}
        onOpen={openMobile}
        onClose={closeMobile}
        label="Открыть меню поддержки"
      />

      <div className={styles.container}>
        <aside
          className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
          data-app-sidebar
          data-open={mobileOpen ? 'true' : 'false'}
        >
          <div className={styles.sidebarBrand}>
            <span className={styles.sidebarBrandIcon} aria-hidden>
              <SupportIcon />
            </span>
            <div className={styles.sidebarBrandText}>
              <h2 className={styles.sidebarTitle}>Поддержка</h2>
              <span className={styles.sidebarSubtitle}>Справка 2А</span>
            </div>
            <button
              type="button"
              className={styles.sidebarToggle}
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              {sidebarCollapsed ? '»' : '«'}
            </button>
          </div>

          <nav className={styles.sidebarNav} aria-label="Разделы помощи">
            <span className={styles.navSectionLabel}>Документация</span>
            <ul className={styles.categoryList}>
              {SUPPORT_CATEGORIES.map((cat) => {
                const expanded = expandedIds.has(cat.id);
                const catActive = categoryId === cat.id;
                return (
                  <li key={cat.id} className={styles.categoryItem}>
                    <button
                      type="button"
                      className={`${styles.categoryBtn} ${
                        catActive ? styles.categoryBtnActive : ''
                      }`}
                      onClick={() => selectCategoryHeader(cat.id)}
                      aria-expanded={expanded}
                      title={sidebarCollapsed ? cat.label : undefined}
                    >
                      <span className={styles.categoryBtnLabel}>{cat.label}</span>
                      {!sidebarCollapsed && (
                        <span className={styles.categoryChevron} aria-hidden>
                          {expanded ? '▾' : '▸'}
                        </span>
                      )}
                    </button>

                    {expanded && !sidebarCollapsed ? (
                      <ul className={styles.topicList}>
                        {cat.articles.map((art) => {
                          const active = categoryId === cat.id && articleId === art.id;
                          return (
                            <li key={art.id}>
                              <button
                                type="button"
                                className={`${styles.topicBtn} ${
                                  active ? styles.topicBtnActive : ''
                                }`}
                                onClick={() => selectArticle(cat.id, art.id)}
                                aria-current={active ? 'page' : undefined}
                              >
                                {art.title}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.topToolbar}>
            <div className={styles.toolbarLeft}>
              <p className={styles.breadcrumb}>
                <span>Поддержка</span>
                <span className={styles.breadcrumbSep}>/</span>
                <span className={styles.breadcrumbCurrent}>{category?.label}</span>
              </p>
              <h1 className={styles.pageTitle}>{article?.title || category?.label}</h1>
            </div>
            <div className={styles.toolbarRight}>
              {canEditImages ? (
                <span className={styles.editorBadge}>Редактор изображений</span>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setAskOpen((v) => !v)}
                aria-expanded={askOpen}
              >
                {askOpen ? 'Скрыть форму' : 'Задать вопрос'}
              </button>
            </div>
          </div>

          <div className={styles.mainBody}>
            {category?.description ? (
              <p className={styles.pageSubtitle}>{category.description}</p>
            ) : null}

            {askOpen ? (
              <AskQuestionPanel
                defaultCategory={categoryId}
                key={categoryId}
                onClose={() => setAskOpen(false)}
              />
            ) : null}

            <div className={styles.articlePane}>
              <HelpArticleView
                article={article}
                categoryId={categoryId}
                canEdit={canEditImages}
                imageRevision={imageRevision}
                onImageChanged={() => setImageRevision((n) => n + 1)}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
