import { useEffect } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../src/theme/useTheme.js';
import { useOnboardingStore } from '../src/state/onboarding.js';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Kein Fehlerfall, der die App blockieren darf: Splash-Screen bleibt notfalls stehen.
});

// Root-Layout: Onboarding-Weiterleitung (Technikvorgabe 9), Statusleiste je
// Farbschema. Die Reiterleiste selbst lebt in app/(tabs)/_layout.tsx.
export default function RootLayout() {
  const theme = useTheme();
  const completed = useOnboardingStore((s) => s.completed);
  const pathname = usePathname();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Siehe oben: kein Blockierfall.
    });
  }, []);

  if (!completed && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
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
      </Stack>
    </>
  );
}
