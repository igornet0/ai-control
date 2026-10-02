import { useEffect, useMemo, useState } from 'react';
import { documentService } from '../../services/documentService';
import { buildPlaceholderVars, globalDefaultsToMap } from './documentPlaceholders';

/** Загружает глобальные параметры и собирает vars для resolveDocumentPlaceholders. */
export function useDocumentPlaceholderVars({
  номер,
  number,
  вид,
  kindName,
} = {}) {
  const [globalDefaults, setGlobalDefaults] = useState({});

  useEffect(() => {
    let cancelled = false;
    documentService.getGlobalDefaults()
      .then((data) => {
        if (!cancelled) setGlobalDefaults(globalDefaultsToMap(data));
      })
      .catch(() => {
        if (!cancelled) setGlobalDefaults({});
      });
    return () => { cancelled = true; };
  }, []);

  return useMemo(
    () => buildPlaceholderVars({ номер, number, вид, kindName, globalDefaults }),
    [номер, number, вид, kindName, globalDefaults],
  );
}
