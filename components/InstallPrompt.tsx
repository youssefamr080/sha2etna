// =============================================================================
// 📲 InstallPrompt Component
// =============================================================================
// Native-like install prompt that intercepts the browser's default prompt
// and shows a custom, beautiful UI for installing the PWA.
// 
// Features:
// - Intercepts `beforeinstallprompt` event
// - Shows custom Arabic UI button
// - Tracks installation state
// - Auto-hides after installation
// - Remembers user dismissal (localStorage)
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

// Extend Window interface to include the PWA install prompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

// Storage key for dismissal tracking
const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISSED_EXPIRY_DAYS = 7; // Show again after 7 days

interface InstallPromptProps {
  /** Custom class name for the container */
  className?: string;
  /** Variant: 'banner' shows at top/bottom, 'button' shows inline */
  variant?: 'banner' | 'button' | 'modal';
}

/**
 * PWA Install Prompt Component
 * 
 * Intercepts the browser's install prompt and shows a custom UI.
 * 
 * @example
 * ```tsx
 * // In your App.tsx or layout
 * <InstallPrompt variant="banner" />
 * ```
 */
export const InstallPrompt: React.FC<InstallPromptProps> = ({ 
  className = '',
  variant = 'banner'
}) => {
  // Store the deferred prompt event
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  // UI states
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if already installed or running as PWA
  const checkIfInstalled = useCallback(() => {
    // Check if running in standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // iOS Safari standalone check
    if ((navigator as unknown as { standalone?: boolean }).standalone === true) {
      return true;
    }
    return false;
  }, []);

  // Check if user dismissed recently
  const wasDismissedRecently = useCallback(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) return false;
      
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysDiff < DISMISSED_EXPIRY_DAYS;
    } catch {
      return false;
    }
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    // Already installed, don't show
    if (checkIfInstalled()) {
      setIsInstalled(true);
      return;
    }

    // User dismissed recently, don't show
    if (wasDismissedRecently()) {
      return;
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the default browser prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      // Show our custom prompt
      setIsVisible(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkIfInstalled, wasDismissedRecently]);

  // Handle install button click
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);

    try {
      // Show the browser's install prompt
      await deferredPrompt.prompt();
      
      // Wait for user's choice
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch (error) {
      // Silent fail - installation failed
    } finally {
      setIsInstalling(false);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // localStorage not available
    }
  };

  // Don't render if not visible or already installed
  if (!isVisible || isInstalled || !deferredPrompt) {
    return null;
  }

  // ==========================================================================
  // RENDER VARIANTS
  // ==========================================================================

  // Banner variant - fixed at bottom
  if (variant === 'banner') {
    return (
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 safe-area-bottom ${className}`}
        role="dialog"
        aria-label="تثبيت التطبيق"
      >
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-3 shadow-lg">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
            {/* Icon & Text */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">ثبّت تطبيق شقتنا</p>
                <p className="text-xs text-emerald-100 truncate">
                  للوصول السريع وتجربة أفضل
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex items-center gap-2 bg-white text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                {isInstalling ? (
                  <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>تثبيت</span>
              </button>
              
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Button variant - inline button
  if (variant === 'button') {
    return (
      <button
        onClick={handleInstall}
        disabled={isInstalling}
        className={`flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 ${className}`}
      >
        {isInstalling ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  // Modal variant - centered modal
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm modal-backdrop">
        <div 
          className={`bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-2xl modal-content ${className}`}
          role="dialog"
          aria-label="تثبيت التطبيق"
        >
          {/* App Icon */}
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
            ثبّت تطبيق شقتنا
          </h2>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-300 text-center text-sm mb-6">
            أضف التطبيق إلى شاشتك الرئيسية للوصول السريع وتجربة استخدام أفضل بدون متصفح
          </p>

          {/* Features */}
          <ul className="space-y-2 mb-6">
            {[
              'تشغيل سريع من الشاشة الرئيسية',
              'يعمل بدون إنترنت',
              'إشعارات فورية'
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {feature}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isInstalling ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span>تثبيت التطبيق</span>
            </button>
            
            <button
              onClick={handleDismiss}
              className="w-full text-slate-500 dark:text-slate-400 py-2 text-sm hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              ليس الآن
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// =============================================================================
// 🎣 useInstallPrompt Hook
// =============================================================================
// Standalone hook if you want to build your own UI
// =============================================================================

interface UseInstallPromptReturn {
  /** Whether the install prompt is available */
  isInstallable: boolean;
  /** Whether the app is already installed */
  isInstalled: boolean;
  /** Trigger the install prompt */
  promptInstall: () => Promise<boolean>;
  /** Dismiss and remember */
  dismiss: () => void;
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      setDeferredPrompt(null);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Silent fail
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    promptInstall,
    dismiss
  };
}

export default InstallPrompt;
