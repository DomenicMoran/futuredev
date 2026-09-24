import { useCallback, useEffect, useState } from 'react';
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

interface LessonTitleLookup {
  (lessonId: string): string;
}

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
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByPlaylist, setItemsByPlaylist] = useState<Record<string, PlaylistItemRow[]>>({});
  const [nameModal, setNameModal] = useState<NameModalMode | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [pickPlaylistForLesson, setPickPlaylistForLesson] = useState<string | null>(null);
  const [pendingLessonAfterCreate, setPendingLessonAfterCreate] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPlaylists(await listPlaylists());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        if (next) void loadItems(next);
        return next;
      });
    },
    [loadItems],
  );

  const submitNameModal = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !nameModal) return;
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
  }, [nameDraft, nameModal, reload]);

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
      await addLessonToPlaylist(playlistId, lessonId);
      setPickPlaylistForLesson(null);
      if (expandedId === playlistId) await loadItems(playlistId);
      await reload();
    },
    [expandedId, loadItems, reload],
  );

  if (loading) {
    return <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: theme.spacing.sm }} />;
  }

  return (
    <View style={styles.block}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{de.hoeren.playlistsTitle}</Text>
        <Pressable
          onPress={() => {
            setNameModal({ kind: 'create' });
            setNameDraft('');
          }}
          accessibilityRole="button"
          accessibilityLabel={de.hoeren.playlistCreate}
          hitSlop={8}
          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center', alignItems: 'center' }}
        >
          <Plus color={theme.colors.accent} size={22} />
        </Pressable>
      </View>

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
                    await deletePlaylist(playlist.id);
                    if (expandedId === playlist.id) setExpandedId(null);
                    await reload();
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
                            await removePlaylistItem(playlist.id, item.lessonId);
                            await loadItems(playlist.id);
                            await reload();
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
        onChange={setNameDraft}
        onCancel={() => {
          setNameModal(null);
          setNameDraft('');
        }}
        onSubmit={() => void submitNameModal()}
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
          setNameModal({ kind: 'create' });
          setNameDraft('');
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
  onChange,
  onCancel,
  onSubmit,
  theme,
}: {
  visible: boolean;
  title: string;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.playlistName, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            autoFocus
            placeholder={title}
            placeholderTextColor={theme.colors.textWeak}
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                color: theme.colors.text,
                borderRadius: theme.radius.md,
              },
            ]}
            onSubmitEditing={onSubmit}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}>
              <Text style={{ color: theme.colors.textWeak }}>{de.common.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              accessibilityRole="button"
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  modalCard: { padding: 16, gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
