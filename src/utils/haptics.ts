export type HapticPatternName =
  | 'tick'
  | 'selection'
  | 'light'
  | 'medium'
  | 'success'
  | 'warning'
  | 'error';

const STORAGE_KEY = 'kadenz_haptics_enabled';

/**
 * Apple Taptic-Engine inspired millisecond vibration envelopes
 * for Android Chrome / PWA / supported mobile browsers.
 */
export const HAPTIC_PATTERNS: Record<HapticPatternName, number | number[]> = {
  tick: 6,
  selection: 9,
  light: 12,
  medium: 18,
  success: [10, 34, 16],
  warning: [20, 40, 20],
  error: [26, 42, 26, 42, 30],
};

let cachedEnabled: boolean | null = null;

export function isHapticsEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      cachedEnabled = stored === null ? true : stored === 'true';
      return cachedEnabled;
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
  cachedEnabled = true;
  return true;
}

export function setHapticsEnabled(enabled: boolean): void {
  cachedEnabled = enabled;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // ignore storage errors
  }
}

export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

/**
 * Triggers subtle, intentional tactile haptic feedback when supported and enabled.
 * Respects user setting and prefers-reduced-motion automatically.
 */
export function triggerHaptic(pattern: HapticPatternName = 'selection'): boolean {
  if (!isHapticsEnabled()) return false;
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return false;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return Boolean(navigator.vibrate(HAPTIC_PATTERNS[pattern]));
    }
  } catch {
    // Graceful no-op on browsers that disallow vibrate before gesture
  }
  return false;
}

export const haptics = {
  tick: () => triggerHaptic('tick'),
  selection: () => triggerHaptic('selection'),
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
} as const;

