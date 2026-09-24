import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useMotionDuration } from './useMotionDuration.js';

interface FadeInUpProps {
  children: ReactNode;
  /** Mount enter duration (default 200 ms). */
  durationMs?: number;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeInUp({ children, durationMs = 200, delayMs = 0, style }: FadeInUpProps) {
  const duration = useMotionDuration(durationMs);
  const opacity = useRef(new Animated.Value(duration === 0 ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(duration === 0 ? 0 : 8)).current;

  useEffect(() => {
    if (duration === 0) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: delayMs,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay: delayMs,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delayMs, duration, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}
