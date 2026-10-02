import { useCallback, useEffect, useRef, useState } from 'react';
import { qaPlaylistAutofillName } from '../qa/buildGate.js';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, ListMusic, Pencil, Play, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { normalizedPlaylistDraft } from './playlistDraft.js';
import { PressableFeedback } from '../motion/PressableFeedback.js';
import { useFocusEffect } from 'expo-router';
import { de } from '../i18n/de.js';
import {
  addLessonToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylistItems,
  listPlaylists,
  removePlaylistItem,
  renamePlaylist,
} from '../data/playlists.js';
import type { PlaylistItemRow, PlaylistRow } from '../data/types.js';
import { playPlaylist } from '../player/index.js';

type LessonTitleLookup = (lessonId: string) => string;

interface PlaylistsSectionProps {
  lessonTitleFor: LessonTitleLookup;
  onPlaybackError: (emptyPlaylist: boolean) => void;
  /** Öffnet die Playlist-Auswahl für diese Lektion (z. B. von einer Lektionszeile). */
  requestAddLessonId?: string | null;
  onRequestAddHandled?: () => void;
}

type NameModalMode = { kind: 'create' } | { kind: 'rename'; playlistId: string; initial: string };

export function PlaylistsSection({
  lessonTitleFor,
  onPlaybackError,
  requestAddLessonId,
  onRequestAddHandled,
}: PlaylistsSectionProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByPlaylist, setItemsByPlaylist] = useState<Record<string, PlaylistItemRow[]>>({});
  const [nameModal, setNameModal] = useState<NameModalMode | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [pickPlaylistForLesson, setPickPlaylistForLesson] = useState<string | null>(null);
  const [pendingLessonAfterCreate, setPendingLessonAfterCreate] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const reloadGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    setLoading(true);
    try {
      const rows = await listPlaylists();
      const itemLists = await Promise.all(rows.map(async (row) => [row.id, await listPlaylistItems(row.id)] as const));
      if (generation !== reloadGeneration.current) return;
      setPlaylists(rows);
      setItemsByPlaylist(Object.fromEntries(itemLists));
      setReloadError(null);
    } catch (error) {
      if (generation === reloadGeneration.current) setReloadError(error instanceof Error ? error.message : 'Playlists konnten nicht geladen werden.');
      throw error;
    } finally {
      if (generation === reloadGeneration.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reload().catch(() => undefined);
    return () => { reloadGeneration.current += 1; };
  }, [reload]));

  useEffect(() => {
    if (requestAddLessonId) {
      setPickPlaylistForLesson(requestAddLessonId);
      onRequestAddHandled?.();
    }
  }, [requestAddLessonId, onRequestAddHandled]);

  const loadItems = useCallback(async (playlistId: string) => {
    const items = await listPlaylistItems(playlistId);
    setItemsByPlaylist((prev) => ({ ...prev, [playlistId]: items }));
  }, []);

  const toggleExpanded = useCallback(
    (playlistId: string) => {
      setExpandedId((current) => {
        const next = current === playlistId ? null : playlistId;
        if (next) void loadItems(next).catch((error: unknown) => setReloadError(error instanceof Error ? error.message : 'Playlist konnte nicht geladen werden.'));
        return next;
      });
    },
    [loadItems],
  );

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  const showFeedback = useCallback((message: string, isError = false) => {
    setFeedback({ text: message, isError });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  }, []);

  const submitNameModal = useCallback(async (nameOverride?: string) => {
    const trimmed = normalizedPlaylistDraft(nameOverride ?? nameDraft);
    if (!nameModal || saveInFlight.current) return;
    if (!trimmed) {
      setNameError(de.hoeren.playlistNameRequired);
      return;
    }
    setNameError(null);
    saveInFlight.current = true;
    try {
      if (nameModal.kind === 'create') {
        const created = await createPlaylist(trimmed);
        setExpandedId(created.id);
        setItemsByPlaylist((prev) => ({ ...prev, [created.id]: [] }));
        if (pendingLessonAfterCreate) {
          await addLessonToPlaylist(created.id, pendingLessonAfterCreate);
          setPendingLessonAfterCreate(null);
          await loadItems(created.id);
        }
      } else {
        await renamePlaylist(nameModal.playlistId, trimmed);
      }
      setNameModal(null);
      setNameDraft('');
      await reload();
      showFeedback(de.hoeren.playlistSaved);
    } catch (err) {
      const devDetail = __DEV__ && err instanceof Error ? ` (${err.message})` : '';
      setNameError(`${de.hoeren.playlistSaveError}${devDetail}`);
    } finally {
      saveInFlight.current = false;
    }
  }, [nameDraft, nameModal, reload, pendingLessonAfterCreate, loadItems, showFeedback]);

  const onPlay = useCallback(
    async (playlistId: string) => {
      try {
        await playPlaylist(playlistId);
      } catch (err) {
        onPlaybackError(err instanceof Error && err.message === 'playlist_empty');
      }
    },
    [onPlaybackError],
  );

  const onAddLessonToPlaylist = useCallback(
    async (playlistId: string, lessonId: string) => {
      try {
        await addLessonToPlaylist(playlistId, lessonId);
        setPickPlaylistForLesson(null);
        if (expandedId === playlistId) await loadItems(playlistId);
        await reload();
        showFeedback(de.hoeren.playlistSaved);
      } catch {
        showFeedback(de.hoeren.playlistAddError, true);
      }
    },
    [expandedId, loadItems, reload, showFeedback],
  );

  if (loading) {
    return <View accessibilityLiveRegion="polite" style={{ minHeight: theme.minTapTarget, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}><ActivityIndicator color={theme.colors.accent} /><Text style={{ color: theme.colors.textWeak }}>{de.hoeren.playlistLoading}</Text></View>;
  }

  return (
    <View style={styles.block}>
      <View style={styles.headerRow}>
        <Text testID="playlists-heading" style={[styles.sectionTitle, { color: theme.colors.text, flex: 1, minWidth: 0, flexShrink: 1 }]}>{de.hoeren.playlistsTitle}</Text>
        <Pressable
          testID="playlist-create-button"
          onPress={() => {
            setNameError(null);
            setNameModal({ kind: 'create' });
            setNameDraft(qaPlaylistAutofillName());
          }}
          accessibilityRole="button"
          accessibilityLabel={`${de.hoeren.playlistCreate} anlegen`}
          hitSlop={8}
          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center', alignItems: 'center' }}
        >
          <Plus color={theme.colors.accent} size={22} />
        </Pressable>
      </View>

      {reloadError ? (
        <PressableFeedback onPress={() => void reload().catch(() => undefined)} accessibilityRole="button" accessibilityLabel="Playlists erneut laden" style={{ paddingVertical: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.error, fontSize: 13 }}>Playlists konnten nicht aktualisiert werden. Erneut versuchen.</Text>
        </PressableFeedback>
      ) : null}

      {feedback ? (
        <Text
          style={{
            color: feedback.isError ? theme.colors.error : theme.colors.success,
            fontSize: 14,
            fontWeight: '600',
          }}
          accessibilityLiveRegion="polite"
        >
          {feedback.text}
        </Text>
      ) : null}

      {playlists.length === 0 ? (
        <Text style={{ color: theme.colors.textWeak }}>{de.hoeren.playlistEmpty}</Text>
      ) : null}

      {playlists.map((playlist) => {
        const expanded = expandedId === playlist.id;
        const items = itemsByPlaylist[playlist.id];
        return (
          <View
            key={playlist.id}
            style={[
              styles.playlistCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Pressable
              testID={`playlist-row-${playlist.name}`}
              onPress={() => toggleExpanded(playlist.id)}
              accessibilityRole="button"
              accessibilityLabel={playlist.name}
              style={styles.playlistTitleRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.playlistName, { color: theme.colors.text }]}>{playlist.name}</Text>
                <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>
                  {de.hoeren.playlistLessonCount(items?.length ?? 0)}
                </Text>
              </View>
              {expanded ? (
                <ChevronUp color={theme.colors.textWeak} size={20} />
              ) : (
                <ChevronDown color={theme.colors.textWeak} size={20} />
              )}
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => void onPlay(playlist.id)}
                accessibilityRole="button"
                accessibilityLabel={`${de.hoeren.playlistPlay}: ${playlist.name}`}
                style={styles.iconBtn}
              >
                <Play color={theme.colors.accent} size={20} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setNameError(null);
                  setNameModal({ kind: 'rename', playlistId: playlist.id, initial: playlist.name });
                  setNameDraft(playlist.name);
                }}
                accessibilityRole="button"
                accessibilityLabel={de.hoeren.playlistRename}
                style={styles.iconBtn}
              >
                <Pencil color={theme.colors.textWeak} size={18} />
              </Pressable>
              <Pressable
                onPress={() => {
                    void (async () => {
                      try {
                        await deletePlaylist(playlist.id);
                        if (expandedId === playlist.id) setExpandedId(null);
                        await reload();
                      } catch {
                        showFeedback(de.hoeren.playlistSaveError, true);
                      }
                    })();
                }}
                accessibilityRole="button"
                accessibilityLabel={de.hoeren.playlistDelete}
                style={styles.iconBtn}
              >
                <Trash2 color={theme.colors.error} size={18} />
              </Pressable>
            </View>

            {expanded && items ? (
              <View style={{ gap: 6, marginTop: theme.spacing.sm }}>
                {items.length === 0 ? (
                  <Text style={{ color: theme.colors.textWeak, fontSize: 14 }}>{de.hoeren.playlistEmptyPlayError}</Text>
                ) : (
                  items.map((item) => (
                    <View key={item.lessonId} style={styles.itemRow}>
                      <ListMusic color={theme.colors.textWeak} size={16} />
                      <Text numberOfLines={1} style={{ flex: 1, color: theme.colors.text }}>
                        {lessonTitleFor(item.lessonId)}
                      </Text>
                      <Pressable
                        onPress={() => {
                          void (async () => {
                            try {
                              await removePlaylistItem(playlist.id, item.lessonId);
                              await loadItems(playlist.id);
                              await reload();
                            } catch {
                              showFeedback(de.hoeren.playlistAddError, true);
                            }
                          })();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={de.hoeren.playlistRemoveLesson}
                        hitSlop={8}
                        style={styles.iconBtn}
                      >
                        <Trash2 color={theme.colors.textWeak} size={16} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      <NameModal
        visible={nameModal !== null}
        title={
          nameModal?.kind === 'rename' ? de.hoeren.playlistRenamePrompt : de.hoeren.playlistCreatePrompt
        }
        value={nameDraft}
        error={nameError}
        onChange={(v) => {
          setNameDraft(v);
          if (nameError) setNameError(null);
        }}
        onCancel={() => {
          setNameModal(null);
          setNameDraft('');
          setNameError(null);
          setPendingLessonAfterCreate(null);
        }}
        onSubmit={(nameOverride) => void submitNameModal(nameOverride)}
        theme={theme}
      />

      <PickPlaylistModal
        visible={pickPlaylistForLesson !== null}
        playlists={playlists}
        onCancel={() => setPickPlaylistForLesson(null)}
        onPick={(playlistId) => {
          if (pickPlaylistForLesson) void onAddLessonToPlaylist(playlistId, pickPlaylistForLesson);
        }}
        onCreate={() => {
          setPendingLessonAfterCreate(pickPlaylistForLesson);
          setPickPlaylistForLesson(null);
          setNameError(null);
          setNameModal({ kind: 'create' });
          setNameDraft(qaPlaylistAutofillName());
        }}
        theme={theme}
      />
    </View>
  );
}

function NameModal({
  visible,
  title,
  value,
  error,
  onChange,
  onCancel,
  onSubmit,
  theme,
}: {
  visible: boolean;
  title: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: (nameOverride?: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const inputRef = useRef<TextInput>(null);
  const nativeTextRef = useRef('');

  useEffect(() => {
    if (!visible) return;
    nativeTextRef.current = value;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.playlistName, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>{title}</Text>
          <TextInput
            ref={inputRef}
            key={visible ? 'playlist-name-open' : 'playlist-name-closed'}
            value={value}
            onChangeText={(t) => {
              nativeTextRef.current = t;
              onChange(t);
            }}
            autoFocus={false}
            testID="playlist-name-input"
            accessibilityLabel={title}
            placeholder={title}
            placeholderTextColor={theme.colors.textWeak}
            style={[
              styles.input,
              {
                borderColor: error ? theme.colors.error : theme.colors.border,
                color: theme.colors.text,
                borderRadius: theme.radius.md,
              },
            ]}
            onSubmitEditing={(e) => onSubmit(e.nativeEvent.text)}
          />
          {error ? (
            <Text style={{ color: theme.colors.error, fontSize: 14 }} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}>
              <Text style={{ color: theme.colors.textWeak }}>{de.common.cancel}</Text>
            </Pressable>
            <Pressable
              testID="playlist-save-button"
              onPress={() => {
                const finalDraft = nativeTextRef.current;
                inputRef.current?.blur();
                onSubmit(normalizedPlaylistDraft(finalDraft));
              }}
              accessibilityRole="button"
              accessibilityLabel={de.common.save}
              style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>{de.common.save}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickPlaylistModal({
  visible,
  playlists,
  onCancel,
  onPick,
  onCreate,
  theme,
}: {
  visible: boolean;
  playlists: PlaylistRow[];
  onCancel: () => void;
  onPick: (playlistId: string) => void;
  onCreate: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, maxHeight: '70%' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.playlistName, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {de.hoeren.playlistPickTitle}
          </Text>
          {playlists.map((pl) => (
            <Pressable
              key={pl.id}
              onPress={() => onPick(pl.id)}
              accessibilityRole="button"
              style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.colors.text, fontSize: 16 }}>{pl.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onCreate} accessibilityRole="button" style={{ minHeight: theme.minTapTarget, justifyContent: 'center', marginTop: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>{de.hoeren.playlistCreate}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  playlistCard: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  playlistTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playlistName: { fontSize: 16, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 4 },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { padding: 16, gap: 8, width: '100%', maxWidth: 400, alignSelf: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
