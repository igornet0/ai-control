import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './DeveloperApiDocsPage.module.css';

/**
 * Developer API documentation page.
 * Loads static HTML from public/developer-api-docs/ via iframe.
 * Passes apiBase from query string (?apiBase=...) to the iframe.
 */
const DeveloperApiDocsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iframeRef = useRef(null);
  const iframeOrigin = window.location.origin;

  const apiBase = searchParams.get('apiBase') || '';

  const iframeSrc = apiBase
    ? `/developer-api-docs/index.html?apiBase=${encodeURIComponent(apiBase)}`
    : '/developer-api-docs/index.html';

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== iframeOrigin) return;
      if (event.data && typeof event.data === 'object' && event.data.type === 'DOCS_CLOSED') {
        navigate(-1);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, iframeOrigin]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !apiBase) return undefined;

    const sendBase = () => {
      iframe.contentWindow?.postMessage(
        { type: 'SET_API_BASE', apiBase },
        iframeOrigin,
      );
    };

    iframe.addEventListener('load', sendBase);
    return () => iframe.removeEventListener('load', sendBase);
  }, [apiBase, iframeOrigin]);

  return (
    <div className={styles.docsPage}>
      <div className={styles.docsHeader}>
        <div>
          <h1 className={styles.docsTitle}>Developer API</h1>
          <p className={styles.docsSubtitle}>Документация 2A Developer API v1.0</p>
        </div>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(-1)}
        >
          ← Назад
        </button>
      </div>
      <div className={styles.docsContainer}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className={styles.docsIframe}
          title="Developer API Documentation"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
};

export default DeveloperApiDocsPage;
