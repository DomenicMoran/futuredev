// Duenner Adapter um AccessibilityInfo.isReduceMotionEnabled (Technikvorgabe
// 10), unbedingt zusaetzlich zu einer moeglichen CSS-Medienabfrage im Web,
// weil jede JS/Reanimated-getriebene Bewegung sonst daran vorbeilaeuft
// (siehe 20_Gedaechtnis/feedback_reduced_motion_css_reicht_nicht). Nicht
// eigens getestet (wie useTheme.ts/useColorScheme): reiner RN-Wrapper, die
// pruefbare Logik steckt in motion.ts (resolveAnimationDuration).
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Ohne Auskunft bleibt es bei "keine Reduzierung" (Vorgabewert).
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(value);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
