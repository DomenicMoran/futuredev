import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMotionDuration } from './useMotionDuration.js';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateTo(pressed: boolean) {
    if (disabled) return;
    if (duration === 0) {
      scale.setValue(1);
      opacity.setValue(1);
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

  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const flattenedStyle = StyleSheet.flatten(resolvedStyle) ?? {};
  const { transform: callerTransform, opacity: callerOpacity = 1, ...layoutStyle } = flattenedStyle;
  const composedTransform = Array.isArray(callerTransform)
    ? [...callerTransform, { scale }]
    : callerTransform ?? [{ scale }];
  const animatedOpacity = typeof callerOpacity === 'number'
    ? opacity.interpolate({ inputRange: [0, 1], outputRange: [0, callerOpacity] })
    : callerOpacity;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[layoutStyle, { transform: composedTransform, opacity: animatedOpacity }]}
      onPressIn={(event) => {
        setPressed(true);
        animateTo(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animateTo(false);
        onPressOut?.(event);
      }}
    >{children}</AnimatedPressable>
  );
}
