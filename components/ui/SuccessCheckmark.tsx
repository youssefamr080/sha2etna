// ============================================================
// Success Checkmark Animation Component
// Animated checkmark with circle for success feedback
// ============================================================

import React, { useEffect, useState } from 'react';

interface SuccessCheckmarkProps {
  isVisible: boolean;
  size?: number;
  duration?: number;
  message?: string;
  onComplete?: () => void;
}

const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = ({
  isVisible,
  size = 80,
  duration = 2000,
  message,
  onComplete,
}) => {
  const [showComponent, setShowComponent] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'circle' | 'check' | 'complete' | 'hidden'>('hidden');

  useEffect(() => {
    if (isVisible) {
      setShowComponent(true);
      setAnimationPhase('circle');

      // Circle animation complete → show checkmark
      const checkTimer = setTimeout(() => {
        setAnimationPhase('check');
      }, 300);

      // Checkmark animation complete
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 600);

      // Hide component
      const hideTimer = setTimeout(() => {
        setAnimationPhase('hidden');
        setShowComponent(false);
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(checkTimer);
        clearTimeout(completeTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setAnimationPhase('hidden');
      setShowComponent(false);
    }
  }, [isVisible, duration, onComplete]);

  if (!showComponent) return null;

  const circleRadius = size * 0.4;
  const strokeWidth = size * 0.08;
  const circumference = 2 * Math.PI * circleRadius;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9998] bg-black/30 backdrop-blur-sm"
      style={{
        opacity: animationPhase === 'hidden' ? 0 : 1,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <div 
        className="flex flex-col items-center gap-4"
        style={{
          transform: animationPhase === 'complete' ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 200ms ease-out',
        }}
      >
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={circleRadius}
            fill="none"
            stroke="#22c55e"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: animationPhase === 'hidden' ? circumference : 0,
              transition: 'stroke-dashoffset 300ms ease-out',
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }}
          />
          
          {/* Fill circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={circleRadius - strokeWidth / 2}
            fill="#22c55e"
            style={{
              opacity: animationPhase === 'check' || animationPhase === 'complete' ? 0.15 : 0,
              transition: 'opacity 200ms ease-out',
            }}
          />
          
          {/* Checkmark */}
          <path
            d={`M ${size * 0.28} ${size * 0.52} L ${size * 0.45} ${size * 0.68} L ${size * 0.72} ${size * 0.35}`}
            fill="none"
            stroke="#22c55e"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: size,
              strokeDashoffset: animationPhase === 'check' || animationPhase === 'complete' ? 0 : size,
              transition: 'stroke-dashoffset 300ms ease-out 200ms',
            }}
          />
        </svg>
        
        {message && (
          <span 
            className="text-white font-medium text-lg"
            style={{
              opacity: animationPhase === 'complete' ? 1 : 0,
              transform: animationPhase === 'complete' ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 200ms ease-out',
            }}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
};

export default SuccessCheckmark;

// ============================================================
// useSuccessCheckmark Hook
// ============================================================
export const useSuccessCheckmark = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const showSuccess = (msg?: string) => {
    setMessage(msg);
    setIsVisible(true);
  };

  const hideSuccess = () => {
    setIsVisible(false);
  };

  return {
    isVisible,
    showSuccess,
    hideSuccess,
    SuccessCheckmarkComponent: () => (
      <SuccessCheckmark 
        isVisible={isVisible} 
        message={message}
        onComplete={hideSuccess}
      />
    ),
  };
};
