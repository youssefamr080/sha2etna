// ============================================================
// iOS PWA Install Guide Component
// Shows step-by-step instructions for installing the app on iOS
// ============================================================

import React, { useState, useEffect } from 'react';
import { X, Share, Plus, Monitor, Check } from 'lucide-react';

interface IOSInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const IOSInstallGuide: React.FC<IOSInstallGuideProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Share className="text-blue-500" size={32} />,
      title: 'اضغط على زر المشاركة',
      description: 'في الشريط السفلي للمتصفح، اضغط على أيقونة المشاركة',
      image: '📤',
    },
    {
      icon: <Plus className="text-gray-700" size={32} />,
      title: 'أضف إلى الشاشة الرئيسية',
      description: 'مرر للأسفل واختر "Add to Home Screen" أو "إضافة إلى الشاشة الرئيسية"',
      image: '➕',
    },
    {
      icon: <Monitor className="text-green-500" size={32} />,
      title: 'اختر اسم التطبيق',
      description: 'اضغط "Add" أو "إضافة" في الزاوية العلوية',
      image: '✅',
    },
    {
      icon: <Check className="text-emerald-500" size={32} />,
      title: 'تم!',
      description: 'افتح التطبيق من الشاشة الرئيسية للحصول على تجربة كاملة',
      image: '🎉',
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 modal-backdrop">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">تثبيت التطبيق</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step Indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-6 bg-primary'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Current Step */}
          <div className="text-center">
            <div className="text-6xl mb-4">{steps[currentStep].image}</div>
            <div className="mb-3">{steps[currentStep].icon}</div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {steps[currentStep].title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
              >
                السابق
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium"
              >
                التالي
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium"
              >
                فهمت!
              </button>
            )}
          </div>
        </div>

        {/* Footer tip */}
        <div className="px-6 pb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center">
            <span className="text-xs text-blue-600 dark:text-blue-400">
              💡 تأكد من استخدام متصفح Safari للحصول على أفضل تجربة
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallGuide;

// ============================================================
// useIOSInstallPrompt Hook
// Detects if user should be prompted to install PWA on iOS
// ============================================================
export const useIOSInstallPrompt = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Detect if running as standalone (installed PWA)
    const isInStandaloneMode = ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Show prompt if iOS, not standalone, and hasn't been dismissed recently
    if (isIOSDevice && !isInStandaloneMode) {
      const dismissed = localStorage.getItem('ios_install_dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show again after 7 days
      if (daysSinceDismissed > 7) {
        // Delay showing the prompt
        const timer = setTimeout(() => setShowGuide(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const dismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem('ios_install_dismissed', Date.now().toString());
  };

  const openGuide = () => {
    setShowGuide(true);
  };

  return {
    showGuide,
    isIOS,
    isStandalone,
    dismissGuide,
    openGuide,
    GuideComponent: () => <IOSInstallGuide isOpen={showGuide} onClose={dismissGuide} />,
  };
};
