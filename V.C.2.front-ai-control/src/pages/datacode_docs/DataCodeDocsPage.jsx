import React, { useEffect } from 'react';
import LoadingPage from '../../components/LoadingPage';
import { DATACODE_DOCS_EMBED_URL } from '../../constants/datacodeDocs.js';

/**
 * Client-side navigation to /datacode-docs must hard-load the static HTML.
 * Vite/nginx rewrite /datacode-docs → public/datacode-docs/index.html on full requests.
 * A React iframe shell is unreliable (blank nested app / routing clashes).
 */
const DataCodeDocsPage = () => {
  useEffect(() => {
    window.location.replace(DATACODE_DOCS_EMBED_URL);
  }, []);

  return <LoadingPage message="Открытие документации DataCode..." />;
};

export default DataCodeDocsPage;
