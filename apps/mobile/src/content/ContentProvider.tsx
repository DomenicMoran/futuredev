import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Manifest, ModulesFile } from '@futuredev/content-schema';
import type { ContentState } from './types.js';
import { refreshContent } from './sync.js';
import type { BundledContent } from './bundledContent.js';
import { buildModuleList, type ModuleListEntry } from './listLessons.js';
import { getContentFs } from './contentFs.js';
import { bundledLessons, bundledManifest, bundledModules } from '../../assets/content/bundled.generated.js';

const BUNDLED: BundledContent = {
  manifest: bundledManifest as unknown as Manifest,
  modules: bundledModules as unknown as ModulesFile,
  lessons: bundledLessons,
};

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
      const fs = await getContentFs();
      const list = await buildModuleList(BUNDLED.modules, BUNDLED.manifest, fs);
      if (!cancelled) setModuleList(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const nextState = await refreshContent(BUNDLED);
    setState(nextState);
    if (nextState.modules) {
      const fs = await getContentFs();
      setModuleList(await buildModuleList(nextState.modules, nextState.manifest, fs));
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
