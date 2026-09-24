import { useEffect } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrackPlayer from 'react-native-track-player';
import { useTheme } from '../src/theme/useTheme.js';
import { useOnboardingStore } from '../src/state/onboarding.js';
import { useSettingsStore } from '../src/state/settings.js';
import { ContentProvider } from '../src/content/ContentProvider.js';
import { MiniPlayer } from '../src/player/MiniPlayer.js';
import { PlaybackService } from '../src/player/service.js';
import { loadPlayerPreferences } from '../src/player/playerPreferences.js';
import { usePlayerStore } from '../src/player/store.js';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Kein Fehlerfall, der die App blockieren darf: Splash-Screen bleibt notfalls stehen.
});

// Auf Modulebene registriert, wie von react-native-track-player verlangt
// (muss vor dem ersten TrackPlayer-Aufruf laufen; expo-router hat kein
// eigenes index.js mehr, das man dafür anfassen könnte, siehe README
// "Bauen auf Windows"). Ein erneuter Aufruf bei Fast Refresh ist unschädlich,
// TrackPlayer ersetzt den vorherigen Dienst.
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Root-Layout: Onboarding-Weiterleitung (Technikvorgabe 9), Statusleiste je
// Farbschema. Die Reiterleiste selbst lebt in app/(tabs)/_layout.tsx.
// SafeAreaProvider umschliesst alles: react-native-safe-area-context
// (statt des veralteten SafeAreaView aus react-native, Pruefbericht Phase 3
// B-05) braucht diesen Provider, sonst liefert jede SafeAreaView weiter
// unten Insets von 0 und die Statusleiste ueberlappt Inhalte.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootLayoutInner />
    </SafeAreaProvider>
  );
}

function RootLayoutInner() {
  const theme = useTheme();
  const completed = useOnboardingStore((s) => s.completed);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const pathname = usePathname();

  // Onboarding-Persistenz (AP-3.5, Punkt 6): vor der ersten Weiterleitungs-
  // Entscheidung erst `settings.onboarding_done`/`settings.goal` aus SQLite
  // lesen, sonst würde ein wiederkehrender Start immer kurz zurück ins
  // Onboarding springen (Store startet mit completed=false).
  useEffect(() => {
    loadPlayerPreferences()
      .then((prefs) => {
        usePlayerStore.getState().setAutoplayNext(prefs.autoplayNext);
        usePlayerStore.getState().setRepeatMode(prefs.repeatMode);
        usePlayerStore.getState().setPlayerPreferencesHydrated(true);
      })
      .catch(() => {
        usePlayerStore.getState().setPlayerPreferencesHydrated(true);
      });
    useSettingsStore
      .getState()
      .hydrate()
      .then((loaded) => {
        useOnboardingStore.getState().applyHydrated(loaded.onboardingDone, loaded.goal);
      })
      .catch(() => {
        // Kein Blockierfall: ohne lesbare Einstellungen bleibt es beim
        // Vorgabewert (Onboarding erneut anzeigen).
      })
      .finally(() => {
        SplashScreen.hideAsync().catch(() => {
          // Siehe unten: kein Blockierfall.
        });
      });
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!completed && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />;
  }

  // Mini-Player nur über der Reiterleiste, nicht auf Onboarding oder dem
  // Vollbild-Player selbst (der zeigt die Steuerung bereits vollständig).
  const showMiniPlayer = pathname !== '/onboarding' && pathname !== '/player';

  return (
    <ContentProvider>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="lesson/[id]" />
        <Stack.Screen name="module/[id]" />
        <Stack.Screen name="player" options={{ presentation: 'modal' }} />
        <Stack.Screen name="flashcards/index" />
      </Stack>
      {showMiniPlayer ? <MiniPlayer /> : null}
    </ContentProvider>
  );
}
