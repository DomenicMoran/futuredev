import { useCallback, useEffect, useMemo, useState } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import {

  ChevronDown,

  ChevronLeft,

  ChevronRight,

  Moon,

  Pause,

  Play,

  Rewind,

  FastForward,

  BookOpen,

  X,

  Repeat1,

  Repeat,

} from 'lucide-react-native';

import { useTheme } from '../src/theme/useTheme.js';

import { de } from '../src/i18n/de.js';

import { useContent } from '../src/content/ContentProvider.js';

import { ModuleCover } from '../src/components/ModuleCover.js';

import { usePlayerStore } from '../src/player/store.js';

import { currentItem } from '../src/player/queue.js';

import {

  JUMP_BACKWARD_SECONDS,

  JUMP_FORWARD_SECONDS,

  SLEEP_TIMER_PRESET_MINUTES,

} from '../src/player/types.js';

import { RATE_OPTIONS } from '../src/player/rate.js';

import {

  ensureSpeechTextsForLesson,

  jumpBackward,

  jumpForward,

  removeFromQueue,

  seekToBlock,

  seekToSeconds,

  setRate,

  setSleepTimer,

  skipToNext,

  skipToPrevious,

  applyRepeatMode,

} from '../src/player/index.js';

import { nextRepeatMode } from '../src/player/playbackEnd.js';

import { formatPlaybackTime } from '../src/player/formatTime.js';

import { buildChapterJumps, findActiveChapterJumpIndex } from '../src/player/chapterJumps.js';

import { PlaybackScrubber } from '../src/player/PlaybackScrubber.js';



async function togglePlayback(isPlaying: boolean): Promise<void> {

  const trackPlayer = (await import('react-native-track-player')).default;

  if (isPlaying) {

    await trackPlayer.pause();

    usePlayerStore.getState().setPlaying(false);

  } else {

    await trackPlayer.play();

    usePlayerStore.getState().setPlaying(true);

  }

}



function moduleIdFromLessonId(lessonId: string): string {

  const dash = lessonId.indexOf('-');

  return dash > 0 ? lessonId.slice(0, dash) : lessonId;

}



export default function PlayerScreen() {

  const theme = useTheme();

  const { moduleList } = useContent();

  const queue = usePlayerStore((s) => s.queue);

  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const positionSeconds = usePlayerStore((s) => s.positionSeconds);

  const rate = usePlayerStore((s) => s.rate);

  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const cueSheetByLessonId = usePlayerStore((s) => s.cueSheetByLessonId);

  const speechTextsByLessonId = usePlayerStore((s) => s.speechTextsByLessonId);

  const speechBlockRolesByLessonId = usePlayerStore((s) => s.speechBlockRolesByLessonId);

  const item = currentItem(queue);

  const cueSheet = item ? cueSheetByLessonId[item.lessonId] : undefined;

  const speechTexts = item ? speechTextsByLessonId[item.lessonId] : undefined;

  const speechBlockRoles = item ? speechBlockRolesByLessonId[item.lessonId] : undefined;



  const moduleTitle = useMemo(() => {

    if (!item) return null;

    const moduleId = moduleIdFromLessonId(item.lessonId);

    return moduleList.find((m) => m.id === moduleId)?.title ?? null;

  }, [item, moduleList]);



  const chapterJumps = useMemo(

    () => (cueSheet ? buildChapterJumps(cueSheet, speechTexts, speechBlockRoles) : []),

    [cueSheet, speechTexts, speechBlockRoles],

  );



  const chapterMarks = useMemo(

    () => chapterJumps.map((jump) => ({ startSeconds: jump.block.startSeconds })),

    [chapterJumps],

  );



  const [ratePickerOpen, setRatePickerOpen] = useState(false);

  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);

  const [queueOpen, setQueueOpen] = useState(false);



  const onSeekCommit = useCallback((seconds: number) => {

    void seekToSeconds(seconds);

  }, []);



  useEffect(() => {

    if (!item) router.back();

  }, [item]);



  useEffect(() => {

    if (!item || speechTexts) return;

    void ensureSpeechTextsForLesson(item.lessonId);

  }, [item, speechTexts]);



  if (!item) return null;



  const currentBlockIndex = cueSheet

    ? [...cueSheet.blocks].reverse().find((b) => b.startSeconds <= positionSeconds)?.index

    : undefined;

  const activeChapterJumpIndex = findActiveChapterJumpIndex(chapterJumps, currentBlockIndex);

  const coverModuleId = moduleIdFromLessonId(item.lessonId);



  return (

    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>

      <View style={[styles.header, { paddingHorizontal: theme.spacing.base }]}>

        <Pressable

          onPress={() => router.back()}

          accessibilityRole="button"

          accessibilityLabel={de.player.close}

          hitSlop={12}

          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}

        >

          <ChevronDown color={theme.colors.text} size={26} />

        </Pressable>

      </View>



      <ScrollView

        contentContainerStyle={[

          styles.scrollContent,

          { paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing['2xl'] },

        ]}

      >

        <View style={[styles.artworkBlock, { marginTop: theme.spacing.md }]}>

          <ModuleCover moduleId={coverModuleId} size={240} />

        </View>



        <View style={[styles.titleBlock, { gap: theme.spacing.xs, marginTop: theme.spacing.xl }]}>

          <Text

            style={[

              styles.title,

              {

                color: theme.colors.text,

                fontSize: theme.type.size.xl.size,

                lineHeight: theme.type.size.xl.lineHeight,

              },

            ]}

          >

            {item.title}

          </Text>

          {moduleTitle ? (

            <Text

              style={[

                styles.subtitle,

                {

                  color: theme.colors.textWeak,

                  fontSize: theme.type.size.sm.size,

                  lineHeight: theme.type.size.sm.lineHeight,

                },

              ]}

            >

              {moduleTitle}

            </Text>

          ) : null}

          <Text

            style={[

              styles.aiHint,

              {

                color: theme.colors.textWeak,

                fontSize: theme.type.size.xs.size,

                lineHeight: theme.type.size.xs.lineHeight,

              },

            ]}

          >

            {de.player.aiVoiceLabel}

          </Text>

        </View>



        <View style={{ marginTop: theme.spacing.xl }}>

          <PlaybackScrubber

            durationSeconds={item.durationSeconds}

            positionSeconds={positionSeconds}

            chapterMarks={chapterMarks}

            onSeekCommit={onSeekCommit}

            variant="full"

          />

        </View>



        <View style={[styles.primaryControls, { gap: theme.spacing.lg, marginTop: theme.spacing.xl }]}>

          <Pressable

            onPress={() => void jumpBackward(JUMP_BACKWARD_SECONDS)}

            accessibilityRole="button"

            accessibilityLabel={de.player.jumpBackward}

            hitSlop={8}

            style={({ pressed }) => [

              styles.secondaryTap,

              { minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <Rewind color={theme.colors.text} size={28} />

            <Text style={[styles.jumpLabel, { color: theme.colors.textWeak }]}>15</Text>

          </Pressable>

          <Pressable

            onPress={() => void togglePlayback(isPlaying)}

            accessibilityRole="button"

            accessibilityLabel={isPlaying ? de.player.pause : de.player.play}

            style={({ pressed }) => [

              styles.playButton,

              {

                backgroundColor: theme.colors.accent,

                width: 72,

                height: 72,

                borderRadius: theme.radius.full,

                opacity: pressed ? 0.92 : 1,

              },

            ]}

          >

            {isPlaying ? (

              <Pause color={theme.colors.accentText} size={32} fill={theme.colors.accentText} />

            ) : (

              <Play color={theme.colors.accentText} size={32} fill={theme.colors.accentText} />

            )}

          </Pressable>

          <Pressable

            onPress={() => void jumpForward(JUMP_FORWARD_SECONDS)}

            accessibilityRole="button"

            accessibilityLabel={de.player.jumpForward}

            hitSlop={8}

            style={({ pressed }) => [

              styles.secondaryTap,

              { minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <FastForward color={theme.colors.text} size={28} />

            <Text style={[styles.jumpLabel, { color: theme.colors.textWeak }]}>30</Text>

          </Pressable>

        </View>



        <View style={[styles.settingsRow, { gap: theme.spacing.sm, marginTop: theme.spacing.xl }]}>

          <Pressable

            onPress={() => void skipToPrevious()}

            accessibilityRole="button"

            accessibilityLabel={de.player.previous}

            style={({ pressed }) => [

              styles.quietPill,

              { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <ChevronLeft color={theme.colors.textWeak} size={18} />

          </Pressable>

          <Pressable

            onPress={() => void skipToNext()}

            accessibilityRole="button"

            accessibilityLabel={de.player.next}

            style={({ pressed }) => [

              styles.quietPill,

              { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <ChevronRight color={theme.colors.textWeak} size={18} />

          </Pressable>

          <Pressable

            onPress={() => setRatePickerOpen((v) => !v)}

            accessibilityRole="button"

            accessibilityLabel={`${de.player.rate}: ${rate.toFixed(1)}×`}

            style={({ pressed }) => [

              styles.quietPill,

              { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <Text style={{ color: theme.colors.textWeak, fontSize: theme.type.size.sm.size }}>

              {rate.toFixed(1)}×

            </Text>

          </Pressable>

          <Pressable

            onPress={() => void applyRepeatMode(nextRepeatMode(repeatMode))}

            accessibilityRole="button"

            accessibilityLabel={
              repeatMode === 'one'
                ? de.player.repeatOne
                : repeatMode === 'all'
                  ? de.player.repeatAll
                  : de.player.repeatOff
            }

            style={({ pressed }) => [

              styles.quietPill,

              {
                borderColor: repeatMode === 'off' ? theme.colors.border : theme.colors.accent,
                minHeight: theme.minTapTarget,
                opacity: pressed ? 0.88 : 1,
              },

            ]}

          >

            {repeatMode === 'one' ? (
              <Repeat1 color={theme.colors.accent} size={16} />
            ) : (
              <Repeat color={repeatMode === 'all' ? theme.colors.accent : theme.colors.textWeak} size={16} />
            )}

          </Pressable>

          <Pressable

            onPress={() => setSleepPickerOpen((v) => !v)}

            accessibilityRole="button"

            accessibilityLabel={de.player.sleepTimer}

            style={({ pressed }) => [

              styles.quietPill,

              { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },

            ]}

          >

            <Moon color={theme.colors.textWeak} size={16} />

          </Pressable>

        </View>



        {ratePickerOpen ? (

          <View style={[styles.optionRow, { borderColor: theme.colors.border }]}>

            {RATE_OPTIONS.map((option) => (

              <Pressable

                key={option}

                onPress={() => {

                  void setRate(option);

                  setRatePickerOpen(false);

                }}

                accessibilityRole="button"

                accessibilityLabel={`Tempo ${option.toFixed(1)}`}

                style={[

                  styles.option,

                  { backgroundColor: option === rate ? theme.colors.accent : 'transparent', minHeight: theme.minTapTarget },

                ]}

              >

                <Text style={{ color: option === rate ? theme.colors.accentText : theme.colors.text }}>

                  {option.toFixed(1)}×

                </Text>

              </Pressable>

            ))}

          </View>

        ) : null}



        {sleepPickerOpen ? (

          <View style={[styles.optionRow, { borderColor: theme.colors.border }]}>

            <Pressable

              onPress={() => {

                setSleepTimer(null);

                setSleepPickerOpen(false);

              }}

              accessibilityRole="button"

              accessibilityLabel={de.player.sleepTimerOff}

              style={[styles.option, { minHeight: theme.minTapTarget }]}

            >

              <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerOff}</Text>

            </Pressable>

            {SLEEP_TIMER_PRESET_MINUTES.map((minutes) => (

              <Pressable

                key={minutes}

                onPress={() => {

                  setSleepTimer({ kind: 'minutes', minutes });

                  setSleepPickerOpen(false);

                }}

                accessibilityRole="button"

                accessibilityLabel={de.player.sleepTimerMinutes(minutes)}

                style={[styles.option, { minHeight: theme.minTapTarget }]}

              >

                <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerMinutes(minutes)}</Text>

              </Pressable>

            ))}

            <Pressable

              onPress={() => {

                setSleepTimer({ kind: 'endOfLesson' });

                setSleepPickerOpen(false);

              }}

              accessibilityRole="button"

              accessibilityLabel={de.player.sleepTimerEndOfLesson}

              style={[styles.option, { minHeight: theme.minTapTarget }]}

            >

              <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerEndOfLesson}</Text>

            </Pressable>

          </View>

        ) : null}



        <Pressable

          onPress={() =>

            router.push({ pathname: '/lesson/[id]', params: { id: item.lessonId, block: String(currentBlockIndex ?? 0) } })

          }

          accessibilityRole="button"

          accessibilityLabel={de.player.readInText}

          style={({ pressed }) => [

            styles.quietPill,

            {

              borderColor: theme.colors.border,

              alignSelf: 'flex-start',

              minHeight: theme.minTapTarget,

              marginTop: theme.spacing.lg,

              opacity: pressed ? 0.88 : 1,

            },

          ]}

        >

          <BookOpen color={theme.colors.textWeak} size={16} />

          <Text style={{ color: theme.colors.textWeak, fontSize: theme.type.size.sm.size }}> {de.player.readInText}</Text>

        </Pressable>



        {cueSheet ? (

          <View style={[styles.chapterList, { marginTop: theme.spacing.xl }]}>

            <Text style={[styles.sectionLabel, { color: theme.colors.textWeak }]}>{de.player.chapters}</Text>

            {chapterJumps.map((jump, jumpListIndex) => {

              const block = jump.block;

              const isActive = jumpListIndex === activeChapterJumpIndex;

              return (

                <View key={block.index}>

                  {jump.sectionHeading ? (

                    <Text

                      style={[

                        styles.chapterSectionLabel,

                        { color: theme.colors.textWeak, marginTop: jumpListIndex === 0 ? 0 : theme.spacing.sm },

                      ]}

                    >

                      {jump.sectionHeading}

                    </Text>

                  ) : null}

                  <Pressable

                    onPress={() => void seekToBlock(item.lessonId, block.index)}

                    accessibilityRole="button"

                    accessibilityLabel={`${jump.label}, ${formatPlaybackTime(block.startSeconds)}`}

                    style={({ pressed }) => [

                      styles.chapterItem,

                      {

                        minHeight: theme.minTapTarget,

                        borderLeftColor: block.isKeySentence

                          ? theme.colors.accent

                          : isActive

                            ? theme.colors.accent

                            : 'transparent',

                        backgroundColor: isActive ? theme.colors.surface : 'transparent',

                        borderRadius: theme.radius.sm,

                        paddingHorizontal: theme.spacing.sm,

                        opacity: pressed ? 0.92 : 1,

                      },

                    ]}

                  >

                    <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.chapterTitle, { color: theme.colors.text, flex: 1 }]}>

                      {jump.label}

                    </Text>

                    <Text style={[styles.chapterTime, { color: theme.colors.textWeak }]}>

                      {formatPlaybackTime(block.startSeconds)}

                    </Text>

                  </Pressable>

                </View>

              );

            })}

          </View>

        ) : null}



        <View style={[styles.chapterList, { marginTop: theme.spacing.xl }]}>

          <Pressable onPress={() => setQueueOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={de.player.queue}>

            <Text style={[styles.sectionLabel, { color: theme.colors.textWeak }]}>

              {de.player.queue} ({queue.items.length})

            </Text>

          </Pressable>

          {queueOpen

            ? queue.items.map((qItem, index) => (

                <View key={qItem.lessonId} style={[styles.chapterItem, { minHeight: theme.minTapTarget }]}>

                  <Text

                    style={{

                      color: index === queue.currentIndex ? theme.colors.accent : theme.colors.text,

                      flex: 1,

                    }}

                    numberOfLines={1}

                  >

                    {qItem.title}

                  </Text>

                  <Pressable

                    onPress={() => void removeFromQueue(index)}

                    accessibilityRole="button"

                    accessibilityLabel={`${de.player.remove}: ${qItem.title}`}

                    hitSlop={8}

                  >

                    <X color={theme.colors.textWeak} size={18} />

                  </Pressable>

                </View>

              ))

            : null}

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 8 },

  scrollContent: {},

  artworkBlock: { alignItems: 'center' },

  titleBlock: { alignItems: 'center' },

  title: { fontWeight: '700', textAlign: 'center' },

  subtitle: { textAlign: 'center' },

  aiHint: { textAlign: 'center', marginTop: 4 },

  primaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  secondaryTap: { alignItems: 'center', justifyContent: 'center' },

  jumpLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },

  playButton: { alignItems: 'center', justifyContent: 'center' },

  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },

  quietPill: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 12,

    borderRadius: 9999,

    borderWidth: StyleSheet.hairlineWidth,

  },

  optionRow: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 8,

    marginTop: 8,

    padding: 8,

    borderWidth: StyleSheet.hairlineWidth,

    borderRadius: 12,

  },

  option: { paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },

  chapterList: {},

  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  chapterSectionLabel: {

    fontSize: 11,

    fontWeight: '700',

    textTransform: 'uppercase',

    letterSpacing: 0.6,

    marginBottom: 4,

    paddingLeft: 8,

  },

  chapterItem: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,

    paddingHorizontal: 8,

    paddingVertical: 6,

    borderLeftWidth: 3,

  },

  chapterTitle: { fontSize: 14, lineHeight: 20 },

  chapterTime: { fontSize: 12, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },

});


