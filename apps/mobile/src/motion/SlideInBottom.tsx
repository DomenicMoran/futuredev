import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useMotionDuration } from './useMotionDuration.js';

interface SlideInBottomProps {
  children: ReactNode;
  visible?: boolean;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
}

/** Enter from below (mini player, modals). */
export function SlideInBottom({ children, visible = true, durationMs = 220, style }: SlideInBottomProps) {
  const duration = useMotionDuration(durationMs);
  const translateY = useRef(new Animated.Value(duration === 0 || visible ? 0 : 20)).current;
  const opacity = useRef(new Animated.Value(duration === 0 || visible ? 1 : 0)).current;

  useEffect(() => {
    if (!visible) {
      if (duration === 0) {
        translateY.setValue(20);
        opacity.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 20, duration, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }),
        ]).start();
      }
      return;
    }
    if (duration === 0) {
      translateY.setValue(0);
      opacity.setValue(1);
      return;
    }
    translateY.setValue(20);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [duration, opacity, translateY, visible]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}
