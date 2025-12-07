// ============================================================
// Haptic Feedback Service
// Provides tactile feedback for user interactions on supported devices
// ============================================================

// Check if the Vibration API is available
const supportsVibration = (): boolean => {
  return 'vibrate' in navigator;
};

// Haptic patterns (in milliseconds)
const PATTERNS = {
  // Light tap for UI interactions (buttons, toggles)
  light: [10],
  
  // Medium feedback for confirmations
  medium: [20],
  
  // Strong feedback for important actions
  heavy: [30],
  
  // Success pattern (ascending pulses)
  success: [10, 50, 15, 50, 20],
  
  // Error pattern (two quick vibrations)
  error: [50, 50, 50],
  
  // Warning pattern (single longer vibration)
  warning: [100],
  
  // Double tap pattern
  double: [20, 50, 20],
  
  // Selection changed
  selection: [5],
  
  // Payment confirmed (celebratory)
  payment: [20, 30, 40, 30, 20, 30, 60],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

/**
 * Trigger haptic feedback
 * @param pattern - The vibration pattern to use
 * @returns boolean indicating if vibration was triggered
 */
export const vibrate = (pattern: HapticPattern = 'light'): boolean => {
  if (!supportsVibration()) {
    return false;
  }

  try {
    navigator.vibrate(PATTERNS[pattern]);
    return true;
  } catch {
    return false;
  }
};

/**
 * Stop any ongoing vibration
 */
export const cancelVibration = (): void => {
  if (supportsVibration()) {
    navigator.vibrate(0);
  }
};

/**
 * Light haptic for UI taps (buttons, links)
 */
export const lightTap = (): boolean => vibrate('light');

/**
 * Medium haptic for confirmations
 */
export const mediumTap = (): boolean => vibrate('medium');

/**
 * Heavy haptic for important actions
 */
export const heavyTap = (): boolean => vibrate('heavy');

/**
 * Success haptic (e.g., after saving, completing task)
 */
export const successFeedback = (): boolean => vibrate('success');

/**
 * Error haptic (e.g., validation error)
 */
export const errorFeedback = (): boolean => vibrate('error');

/**
 * Warning haptic (e.g., before destructive action)
 */
export const warningFeedback = (): boolean => vibrate('warning');

/**
 * Double tap haptic
 */
export const doubleTap = (): boolean => vibrate('double');

/**
 * Selection changed haptic (e.g., picker, toggle)
 */
export const selectionChanged = (): boolean => vibrate('selection');

/**
 * Payment confirmed haptic (celebratory)
 */
export const paymentConfirmed = (): boolean => vibrate('payment');

/**
 * Check if device supports haptic feedback
 */
export const isHapticSupported = supportsVibration;
