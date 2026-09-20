import { Tabs } from 'expo-router';
import { Home, BookOpen, Headphones, Dumbbell, CircleUser } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { de } from '../../src/i18n/de';

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
          height: 56 + theme.spacing.xs,
          paddingBottom: theme.spacing.xs,
          paddingTop: theme.spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: theme.type.size.xs.size,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: de.tabs.start,
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="lernen"
        options={{
          title: de.tabs.lernen,
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="hoeren"
        options={{
          title: de.tabs.hoeren,
          tabBarIcon: ({ color, size }) => <Headphones color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="ueben"
        options={{
          title: de.tabs.ueben,
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="ich"
        options={{
          title: de.tabs.ich,
          tabBarIcon: ({ color, size }) => <CircleUser color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
