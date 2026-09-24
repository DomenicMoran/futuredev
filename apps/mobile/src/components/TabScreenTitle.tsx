import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/useTheme.js';

/** Calm H1 under the safe area on main tab screens (large-title replacement). */
export function TabScreenTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.title,
        {
          color: theme.colors.text,
          paddingHorizontal: theme.spacing.base,
          paddingTop: theme.spacing.sm,
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
