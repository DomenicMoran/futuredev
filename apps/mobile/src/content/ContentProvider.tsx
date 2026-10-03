import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContentState } from './types.js';
import { refreshContent } from './sync.js';
import { buildModuleList, type ModuleListEntry } from './listLessons.js';
import { getContentFs } from './contentFs.js';
import { bundledContent as BUNDLED } from './bundledData.js';

interface ContentContextValue {
  state: ContentState;
  moduleList: ModuleListEntry[];
  refresh: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

/**
 * Stellt Manifest, Modulkarte, Ladezustand und `refresh()` bereit
 * (Technikvorgabe 4). Bindet sich in `app/_layout.tsx` ein (minimale,
 * additive Aenderung). Laedt beim ersten Mount: Erststart-Kopie, Manifest
 * abgleichen, Modulliste mit Fortschritt bauen.
 */
export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentState>(() => ({
    status: 'ok',
    manifest: BUNDLED.manifest,
    modules: BUNDLED.modules,
    lastUpdatedAt: null,
    hasNewLessons: false,
  }));
  const [moduleList, setModuleList] = useState<ModuleListEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Metadata is already validated in memory; never block initial navigation on disk I/O.
      const list = await buildModuleList(BUNDLED.modules, BUNDLED.manifest);
      if (!cancelled) setModuleList(list);
    })().catch(() => {
      if (!cancelled) setState((previous) => ({ ...previous, status: 'error', message: 'Lernfortschritt konnte nicht geladen werden.' }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const nextState = await refreshContent(BUNDLED);
    setState(nextState);
    if (nextState.modules) {
      const fs = await getContentFs();
      try {
        setModuleList(await buildModuleList(nextState.modules, nextState.manifest, fs));
      } catch {
        setState((previous) => ({ ...previous, status: 'error', message: 'Lerninhalte konnten nicht geladen werden.' }));
      }
    }
  }, []);

  useEffect(() => {
    // Absichtlich nur beim Mount: ein manueller "Neu laden"-Weg kommt ueber
    // das Hinweisband (refresh()), kein Intervall-Polling im Hintergrund.
    // `refresh` ist ueber useCallback mit leerem Abhaengigkeits-Array stabil,
    // das Abhaengigkeits-Array hier ist deshalb bereits vollstaendig.
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ state, moduleList, refresh }), [state, moduleList, refresh]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error('useContent muss innerhalb von <ContentProvider> aufgerufen werden');
  }
  return ctx;
}
