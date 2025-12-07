// =============================================================================
// 🔌 OfflineBanner Component
// =============================================================================
// A subtle, non-intrusive banner that appears when the user goes offline.
// Uses the useNetworkStatus hook to detect connectivity changes.
// =============================================================================

import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface OfflineBannerProps {
  /** Custom class name */
  className?: string;
}

/**
 * Offline Banner Component
 * 
 * Shows a subtle banner when the user loses internet connection.
 * Automatically hides when connection is restored.
 * 
 * @example
 * ```tsx
 * // In your App.tsx
 * <OfflineBanner />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({ className = '' }) => {
  const { isOffline, isOnline, timeSinceChange } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = React.useState(false);
  const [wasOffline, setWasOffline] = React.useState(false);

  // Track if we were offline to show "reconnected" message
  React.useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, wasOffline]);

  // Format time since offline
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ساعة`;
  };

  // Show reconnected banner
  if (showReconnected) {
    return (
      <div 
        className={`fixed top-0 left-0 right-0 z-50 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="bg-emerald-600 text-white px-4 py-2 shadow-lg animate-slide-down">
          <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-2">
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">تم استعادة الاتصال بالإنترنت</span>
          </div>
        </div>
      </div>
    );
  }

  // Don't show if online
  if (!isOffline) {
    return null;
  }

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-amber-500 text-white px-4 py-2 shadow-lg animate-slide-down">
        <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">
            أنت غير متصل بالإنترنت
            {timeSinceChange && timeSinceChange > 5 && (
              <span className="text-amber-100 mr-2">
                ({formatTime(timeSinceChange)})
              </span>
            )}
          </span>
        </div>
      </div>
      
      {/* Inline styles for animation */}
      <style>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default OfflineBanner;
