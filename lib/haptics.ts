// Haptic feedback via the Vibration API. Supported on Android/Chrome; a
// no-op where unsupported (notably iOS Safari), so it's always safe to call.

export function haptic(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

export const buzz = {
  tick: () => haptic(8),
  reveal: () => haptic(12),
  lock: () => haptic([0, 25, 40, 25]),
  win: () => haptic([0, 30, 50, 30, 50, 60]),
  low: () => haptic(20),
};
