import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', rounded = true }) => {
  const baseClass = 'relative overflow-hidden bg-gray-200 dark:bg-gray-700 animate-pulse';
  const shapeClass = rounded ? 'rounded-xl' : '';

  return (
    <div className={`${baseClass} ${shapeClass} ${className}`.trim()}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
      <style>
        {`@keyframes shimmer { 100% { transform: translateX(100%); } }`}
      </style>
    </div>
  );
};

export default Skeleton;
