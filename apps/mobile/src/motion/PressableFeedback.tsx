import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMotionDuration } from './useMotionDuration.js';

type PressableFeedbackProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Press animation length (default 150 ms). */
  pressDurationMs?: number;
};

export function PressableFeedback({
  children,
  onPressIn,
  onPressOut,
  style,
  pressDurationMs = 150,
  disabled,
  ...rest
}: PressableFeedbackProps) {
  const duration = useMotionDuration(pressDurationMs);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateTo(pressed: boolean) {
    if (disabled) return;
    if (duration === 0) {
      scale.setValue(pressed ? 0.98 : 1);
      opacity.setValue(pressed ? 0.92 : 1);
      return;
    }
    Animated.parallel([
      Animated.timing(scale, {
        toValue: pressed ? 0.98 : 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: pressed ? 0.92 : 1,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        animateTo(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(false);
        onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>{children}</Animated.View>
    </Pressable>
  );
}
