// ============================================================
// Pull to Refresh Component
// Native-feeling pull-to-refresh for mobile PWA
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import * as HapticService from '../../services/hapticService';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  threshold?: number;
  resistance?: number;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  threshold = 80,
  resistance = 2.5,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [state, setState] = useState<RefreshState>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);

  const canPull = useCallback(() => {
    if (disabled || state === 'refreshing') return false;
    
    // Only allow pull when at the top of the scrollable area
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    return scrollTop <= 0;
  }, [disabled, state]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!canPull()) return;
    
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [canPull]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || !canPull()) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      
      // Apply resistance to make it feel more natural
      const distance = Math.min(diff / resistance, threshold * 1.5);
      setPullDistance(distance);
      
      if (distance >= threshold && state !== 'ready') {
        setState('ready');
        HapticService.mediumTap();
      } else if (distance < threshold && state === 'ready') {
        setState('pulling');
      } else if (state === 'idle' && distance > 10) {
        setState('pulling');
      }
    }
  }, [canPull, resistance, threshold, state]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    
    isPullingRef.current = false;

    if (state === 'ready') {
      setState('refreshing');
      setPullDistance(threshold * 0.6);
      
      try {
        await onRefresh();
      } finally {
        setState('idle');
        setPullDistance(0);
      }
    } else {
      setState('idle');
      setPullDistance(0);
    }
  }, [state, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-auto relative"
      style={{ touchAction: state === 'idle' ? 'auto' : 'none' }}
    >
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex justify-center items-center pointer-events-none z-10 transition-opacity"
        style={{
          top: pullDistance - 50,
          opacity: state !== 'idle' ? 1 : 0,
        }}
      >
        <div 
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            state === 'refreshing' 
              ? 'bg-primary text-white' 
              : state === 'ready'
              ? 'bg-primary text-white'
              : 'bg-white dark:bg-gray-800 text-gray-500'
          }`}
        >
          {state === 'refreshing' ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <RefreshCw 
              size={20} 
              style={{ 
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 100ms ease-out'
              }} 
            />
          )}
        </div>
      </div>

      {/* Content with translation */}
      <div 
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: state === 'idle' || state === 'refreshing' ? 'transform 200ms ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
