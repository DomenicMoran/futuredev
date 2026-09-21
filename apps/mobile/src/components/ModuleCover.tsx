import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useTheme } from '../theme/useTheme.js';
import { getModuleCover } from '../illustrations/moduleCovers.js';

interface ModuleCoverProps {
  moduleId: string;
  size?: number;
}

// Quadratisches Modul-Cover fuer Listenzeilen; faellt auf Akzentflaeche zurueck,
// falls fuer eine Modul-ID noch kein Asset existiert.
export function ModuleCover({ moduleId, size = 56 }: ModuleCoverProps) {
  const theme = useTheme();
  const source: ImageSourcePropType | null = getModuleCover(moduleId);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {source ? (
        <Image source={source} style={{ width: size, height: size, borderRadius: theme.radius.sm }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.fallback, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallback: {
    flex: 1,
    opacity: 0.35,
  },
});
