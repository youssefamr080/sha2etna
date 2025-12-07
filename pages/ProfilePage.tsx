import React, { useEffect, useState } from 'react';
import { useApp } from '../App';
import * as NotificationService from '../services/NotificationService';
import { Notification } from '../types';
import { LogOut, Bell } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';

const ProfilePage: React.FC = () => {
  const { currentUser, logout } = useApp();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      if(currentUser) {
          setIsLoading(true);
          try {
            const all = await NotificationService.getNotifications(currentUser.id);
            setNotifications(all);

            // Mark all as read after viewing
            const unreadIds = all.filter(n => !n.read).map(n => n.id);
            if (unreadIds.length > 0) {
              await NotificationService.markAllNotificationsAsRead(currentUser.id);
              // Update local state to reflect read status
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }
          } catch (error) {
            showToast(getErrorMessage(error), 'error');
          } finally {
            setIsLoading(false);
          }
      }
    };
    loadNotifications();
  }, [currentUser, showToast]);

  if (!currentUser) return null;

  return (
    <div className="p-5 min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">الملف الشخصي</h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center mb-6">
            <img src={currentUser.avatar} alt="Me" className="w-24 h-24 rounded-full mb-4 border-4 border-gray-50 dark:border-gray-700" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentUser.name}</h2>
            <p className="text-gray-500 dark:text-gray-400">{currentUser.email}</p>
            
            <button 
                onClick={logout}
                className="mt-6 flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-full text-sm font-medium"
            >
                <LogOut size={16} /> تسجيل خروج
            </button>
        </div>

        <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Bell size={20} className="text-primary" /> التنبيهات
            </h3>
            <div className="space-y-3">
                {isLoading && (
                  <>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-20" />
                    ))}
                  </>
                )}
                {!isLoading && notifications.map(n => (
                    <div key={n.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                        {!n.read && <div className="absolute top-0 right-0 w-1 h-full bg-primary"></div>}
                        <h4 className="font-bold text-sm text-gray-800 dark:text-white">{n.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                        <span className="text-[10px] text-gray-400 mt-2 block">{new Date(n.date).toLocaleDateString('ar-SA')}</span>
                    </div>
                ))}
                {!isLoading && notifications.length === 0 && <p className="text-gray-400 text-sm">لا توجد تنبيهات جديدة.</p>}
            </div>
        </div>
    </div>
  );
};

export default ProfilePage;