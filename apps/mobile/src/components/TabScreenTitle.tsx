import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme.js';

/** Calm H1 under the safe area on main tab screens (large-title replacement). */
export function TabScreenTitle({ title, includeSafeAreaTop = true }: { title: string; includeSafeAreaTop?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.title,
        {
          color: theme.colors.text,
          paddingHorizontal: theme.spacing.base,
          paddingTop: (includeSafeAreaTop ? insets.top : 0) + theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
      ]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
});
