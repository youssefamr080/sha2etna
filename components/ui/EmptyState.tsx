import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'celebration';
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  subtitle, 
  action, 
  className = '',
  variant = 'default'
}) => {
  if (variant === 'celebration') {
    return (
      <div className={`w-full rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800 p-8 text-center flex flex-col items-center gap-3 ${className}`.trim()}>
        <div className="text-5xl animate-bounce">🎉</div>
        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{title}</p>
        {subtitle && <p className="text-sm text-emerald-600/80 dark:text-emerald-400/70 max-w-sm">{subtitle}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`w-full py-8 text-center flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`.trim()}>
        {icon && <div className="text-2xl opacity-50">{icon}</div>}
        <p className="text-sm font-medium">{title}</p>
        {action && <div className="mt-1">{action}</div>}
      </div>
    );
  }

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
