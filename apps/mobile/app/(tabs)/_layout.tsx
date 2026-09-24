import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BookOpen, Headphones, Dumbbell, CircleUser } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { de } from '../../src/i18n/de';
import { tabBarHeight } from '../../src/navigation/tabBarMetrics';

const TAB_ICON_SIZE = 22;
const TAB_STROKE = 1.75;

function TabIcon({ Icon, color, focused }: { Icon: typeof Home; color: string; focused: boolean }) {
  return (
    <Icon
      color={color}
      size={TAB_ICON_SIZE}
      strokeWidth={TAB_STROKE}
      fill={focused ? color : 'transparent'}
    />
  );
}

// Fünf Reiter, Lucide-Symbole, Labels aus src/i18n/de.ts, aktive Farbe Akzent,
// Mindesthöhe nach design-system.md (Komponente "Reiterleiste").
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
          height: tabBarHeight(theme, insets.bottom),
          paddingBottom: insets.bottom + theme.spacing.xs,
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
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Home} color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="lernen"
        options={{
          title: de.tabs.lernen,
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={BookOpen} color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="hoeren"
        options={{
          title: de.tabs.hoeren,
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Headphones} color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ueben"
        options={{
          title: de.tabs.ueben,
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Dumbbell} color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ich"
        options={{
          title: de.tabs.ich,
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={CircleUser} color={String(color)} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
