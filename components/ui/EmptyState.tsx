import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action, className = '' }) => {
  return (
    <div className={`w-full rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300 ${className}`.trim()}>
      {icon && <div className="text-3xl mb-1">{icon}</div>}
      <p className="text-lg font-semibold text-gray-800 dark:text-white">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
