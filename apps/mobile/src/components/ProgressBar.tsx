import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme.js';

interface ProgressBarProps {
  readonly progress: number;
  readonly height?: number;
}

function ProgressBarInner({ progress, height = 4 }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[styles.track, { backgroundColor: theme.colors.border, height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.accent,
            width: `${clamped * 100}%`,
            height,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

export const ProgressBar = memo(ProgressBarInner);

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill: {},
});
