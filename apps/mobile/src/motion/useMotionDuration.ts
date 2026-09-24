import { motionDurationMs } from '../accessibility/motion.js';
import { useReducedMotion } from '../accessibility/useReducedMotion.js';

export function useMotionDuration(normalDurationMs: number): number {
  const reducedMotion = useReducedMotion();
  return motionDurationMs(reducedMotion, normalDurationMs);
}
