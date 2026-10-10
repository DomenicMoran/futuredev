import { listLessonStatuses, type LessonStatus } from '../data/lessonStatus.js';
import { subscribeProgressChanged } from '../data/progressEvents.js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ContentState } from './types.js';
import { refreshContent } from './sync.js';
import { buildModuleList, type ModuleListEntry } from './listLessons.js';
import { getContentFs } from './contentFs.js';
import { bundledContent as BUNDLED } from './bundledData.js';

interface ContentContextValue {
  state: ContentState;
  moduleList: ModuleListEntry[];
  refresh: () => Promise<void>;
  statuses: Record<string, LessonStatus>;
  refreshStatuses: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

/**
 * Stellt Manifest, Modulkarte, Ladezustand und `refresh()` bereit
 * (Technikvorgabe 4). Bindet sich in `app/_layout.tsx` ein (minimale,
 * additive Aenderung). Laedt beim ersten Mount: Erststart-Kopie, Manifest
 * abgleichen, Modulliste mit Fortschritt bauen.
 */
export function ContentProvider({ children, navigationKey = '' }: { children: ReactNode; navigationKey?: string }) {
  const [state, setState] = useState<ContentState>(() => ({
    status: 'ok',
    manifest: BUNDLED.manifest,
    modules: BUNDLED.modules,
    lastUpdatedAt: null,
    hasNewLessons: false,
  }));
  const [statuses, setStatuses] = useState<Record<string, LessonStatus>>({});
  const statusRequest = useRef(0);
  const refreshStatuses = useCallback(async () => {
    const token = ++statusRequest.current;
    const value = await listLessonStatuses();
    if (token === statusRequest.current) setStatuses(value);
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => { void refreshStatuses().catch(() => undefined); };
    load();
    const unsubscribe = subscribeProgressChanged(() => { if (timer) clearTimeout(timer); timer = setTimeout(load, 100); });
    return () => { statusRequest.current += 1; unsubscribe(); if (timer) clearTimeout(timer); };
  }, [navigationKey, refreshStatuses]);
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

  const value = useMemo(() => ({ state, moduleList, refresh, statuses, refreshStatuses }), [state, moduleList, refresh, statuses, refreshStatuses]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error('useContent muss innerhalb von <ContentProvider> aufgerufen werden');
  }
  return ctx;
}
