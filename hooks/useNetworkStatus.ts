// =============================================================================
// 🔌 useNetworkStatus Hook
// =============================================================================
// Custom hook to detect online/offline status with real-time updates.
// Uses the Navigator.onLine API with event listeners for changes.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  /** Whether the user is currently online */
  isOnline: boolean;
  /** Whether the user is currently offline */
  isOffline: boolean;
  /** Timestamp of the last status change */
  lastChanged: Date | null;
  /** Time since last status change in seconds */
  timeSinceChange: number | null;
}

/**
 * Hook to monitor network connectivity status.
 * 
 * @example
 * ```tsx
 * const { isOnline, isOffline } = useNetworkStatus();
 * 
 * if (isOffline) {
 *   showToast('أنت غير متصل بالإنترنت', 'warning');
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  // Initialize with current navigator.onLine status
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // SSR safety check
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  
  const [lastChanged, setLastChanged] = useState<Date | null>(null);
  const [timeSinceChange, setTimeSinceChange] = useState<number | null>(null);

  // Handler for when connection is restored
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastChanged(new Date());
  }, []);

  // Handler for when connection is lost
  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastChanged(new Date());
  }, []);

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;

    // Add event listeners for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Update time since last change every second (only when offline)
  useEffect(() => {
    if (!lastChanged || isOnline) {
      setTimeSinceChange(null);
      return;
    }

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - lastChanged.getTime()) / 1000);
      setTimeSinceChange(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastChanged, isOnline]);

  return {
    isOnline,
    isOffline: !isOnline,
    lastChanged,
    timeSinceChange
  };
}

export default useNetworkStatus;
