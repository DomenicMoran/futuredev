import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';

interface EmptyStateProps {
  Icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Gestalteter Leerzustand: Symbol, Titel, ein Satz, optional eine Handlung.
// Kein Platzhalterbild, kein Lorem-Text (Technikvorgabe 10, Komponente
// "Leerzustand" aus design-system.md).
export function EmptyState({ Icon, title, body, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Icon size={40} color={theme.colors.textWeak} strokeWidth={1.75} />
      <Text style={[styles.title, { color: theme.colors.text, marginTop: theme.spacing.base }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[
            styles.action,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing.lg,
              minHeight: theme.minTapTarget,
            },
          ]}
        >
          <Text style={[styles.actionLabel, { color: theme.colors.accentText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
