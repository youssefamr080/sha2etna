import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

const typeStyles: Record<ToastProps['type'], string> = {
  success: 'bg-emerald-500 text-white shadow-emerald-500/40',
  error: 'bg-rose-500 text-white shadow-rose-500/40',
  info: 'bg-sky-500 text-white shadow-sky-500/40'
};

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div
      className={`pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ring-white/20 transition transform ${typeStyles[type]}`}
    >
      {message}
    </div>
  );
};

export default Toast;
