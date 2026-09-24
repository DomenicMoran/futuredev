import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, BookOpen, Headphones, Dumbbell, CircleUser } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { de } from '../../src/i18n/de';
import { tabBarHeight } from '../../src/navigation/tabBarMetrics';

// Fünf Reiter, Lucide-Symbole, Labels aus src/i18n/de.ts, aktive Farbe Akzent,
// Mindesthöhe nach design-system.md (Komponente "Reiterleiste").
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textWeak,
        tabBarItemStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight(theme),
          paddingBottom: theme.spacing.xs,
          paddingTop: theme.spacing.sm,
        },
        tabBarLabelStyle: {
          fontSize: theme.type.size.xs.size,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: de.tabs.start,
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} size={focused ? 23 : 22} strokeWidth={focused ? 2 : 1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="lernen"
        options={{
          title: de.tabs.lernen,
          tabBarIcon: ({ color, focused }) => (
            <BookOpen color={color} size={focused ? 23 : 22} strokeWidth={focused ? 2 : 1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="hoeren"
        options={{
          title: de.tabs.hoeren,
          tabBarIcon: ({ color, focused }) => (
            <Headphones color={color} size={focused ? 23 : 22} strokeWidth={focused ? 2 : 1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="ueben"
        options={{
          title: de.tabs.ueben,
          tabBarIcon: ({ color, focused }) => (
            <Dumbbell color={color} size={focused ? 23 : 22} strokeWidth={focused ? 2 : 1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="ich"
        options={{
          title: de.tabs.ich,
          tabBarIcon: ({ color, focused }) => (
            <CircleUser color={color} size={focused ? 23 : 22} strokeWidth={focused ? 2 : 1.75} />
          ),
        }}
      />
    </Tabs>
  );
}
