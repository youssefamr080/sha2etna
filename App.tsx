import React, { useState, useEffect, useCallback, createContext, useContext, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Home, Wallet, Calculator, MessageCircle, ShoppingBag, Bell, Moon, Sun } from 'lucide-react';
import * as AuthService from './services/authService';
import * as UserService from './services/UserService';
import * as GroupService from './services/GroupService';
import * as NotificationService from './services/NotificationService';
import * as ThemeService from './services/themeService';
import { initializeApp } from './services/systemService';
import * as OfflineService from './services/offlineService';
import { ToastProvider } from './contexts/ToastContext';
import { supabase } from './services/supabaseClient';
import { User, Group } from './types';

// PWA Components
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineBanner } from './components/OfflineBanner';
import { useIOSInstallPrompt } from './components/ui/IOSInstallGuide';

// =============================================================================
// LAZY LOADING WITH RETRY - Handles network failures gracefully
// =============================================================================
const lazyWithRetry = (importFn: () => Promise<{ default: React.ComponentType<unknown> }>) => {
  return lazy(() => 
    importFn().catch(() => {
      // On failure, wait a bit and retry once
      return new Promise<{ default: React.ComponentType<unknown> }>((resolve) => {
        setTimeout(() => {
          importFn()
            .then(resolve)
            .catch(() => {
              // If still failing, return an error component
              resolve({
                default: () => (
                  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir="rtl">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">تعذر تحميل الصفحة</h2>
                      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                        تأكد من اتصالك بالإنترنت
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  </div>
                )
              });
            });
        }, 1000);
      });
    })
  );
};

// Lazy-loaded Pages with retry support
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const ExpensesPage = lazyWithRetry(() => import('./pages/ExpensesPage'));
const SettlementsPage = lazyWithRetry(() => import('./pages/SettlementsPage'));
const ChatPage = lazyWithRetry(() => import('./pages/ChatPage'));
const ShoppingPage = lazyWithRetry(() => import('./pages/ShoppingPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const AuthPage = lazyWithRetry(() => import('./pages/AuthPage'));
const GroupSetupPage = lazyWithRetry(() => import('./pages/GroupSetupPage'));
const BillsPage = lazyWithRetry(() => import('./pages/BillsPage'));
const StatsPage = lazyWithRetry(() => import('./pages/StatsPage'));

// Page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">جاري التحميل...</p>
    </div>
  </div>
);

// Global Context
interface AppContextType {
  currentUser: User | null;
  currentGroup: Group | null;
  login: (user: User) => void;
  logout: () => void;
  users: User[];
  group: Group;
  setGroup: (group: Group) => void;
  refreshData: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  unreadNotifications: number;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

const EMPTY_GROUP: Group = { id: '', name: '', code: '', members: [] };

// Navbar Component
const Navbar = () => {
  const location = useLocation();
  const { unreadNotifications } = useApp();
  
  const navItems = [
    { path: '/', icon: <Home size={22} />, label: 'الرئيسية' },
    { path: '/expenses', icon: <Wallet size={22} />, label: 'المصاريف' },
    { path: '/settlements', icon: <Calculator size={22} />, label: 'الديون' },
    { path: '/chat', icon: <MessageCircle size={22} />, label: 'المحادثة' },
    { path: '/shopping', icon: <ShoppingBag size={22} />, label: 'التسوق' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 fixed-bottom-safe">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.path === '/' && unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// Header Component
const Header = () => {
  const { currentUser, theme, toggleTheme, unreadNotifications } = useApp();
  
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-3">
          <img 
            src={currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name}`} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full border-2 border-primary/20"
          />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">أهلاً</p>
            <p className="font-bold text-gray-900 dark:text-white">{currentUser?.name}</p>
          </div>
        </Link>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <Link to="/profile" className="relative p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children, showHeader = true }: { children?: React.ReactNode; showHeader?: boolean }) => {
  const { currentUser, group } = useApp();
  
  if (!currentUser) return <Navigate to="/auth" replace />;
  if (!group.id) return <Navigate to="/group-setup" replace />;
  
  return (
    <div className="min-h-screen min-h-[100svh] bg-gray-50 dark:bg-gray-900 font-sans transition-colors" dir="rtl">
      {showHeader && <Header />}
      <div className="pb-navbar">
        {children}
      </div>
      <Navbar />
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [group, setGroup] = useState<Group>(EMPTY_GROUP);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // iOS PWA Install Guide
  const { GuideComponent: IOSGuide } = useIOSInstallPrompt();
  
  const loadUserContext = useCallback(async (user: User) => {
    try {
      const [fetchedUsers, userGroups, unread] = await Promise.all([
        UserService.getUsers(),
        GroupService.getUserGroups(user.id),
        NotificationService.getUnreadNotificationCount(user.id)
      ]);

      setUsers(fetchedUsers);
      const currentGroupData = userGroups.length > 0 ? userGroups[0] : EMPTY_GROUP;
      setGroup(currentGroupData);
      setUnreadNotifications(unread);
      
      // Cache data for offline use
      if (OfflineService.isOnline()) {
        await Promise.all([
          OfflineService.cacheUsers(fetchedUsers),
          currentGroupData.id ? OfflineService.cacheGroup(currentGroupData) : Promise.resolve()
        ]);
      }
    } catch (error) {
      // If offline, try to load from cache
      if (!OfflineService.isOnline()) {
        console.log('Offline: loading from cache');
        const [cachedUsers, cachedGroup] = await Promise.all([
          OfflineService.getCachedUsers(),
          OfflineService.getCachedGroup()
        ]);
        
        if (cachedUsers.length > 0) {
          setUsers(cachedUsers as User[]);
        }
        if (cachedGroup) {
          setGroup(cachedGroup as Group);
        }
      } else {
        throw error;
      }
    }
  }, []);

  const handleAuthenticatedUser = useCallback(async (profile: User) => {
    setCurrentUser(profile);
    AuthService.setCachedProfile(profile);
    await loadUserContext(profile);
    setIsLoading(false);
  }, [loadUserContext]);

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    await loadUserContext(currentUser);
  }, [currentUser, loadUserContext]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initApp = async () => {
      await initializeApp();

      const savedTheme = ThemeService.getTheme();
      setThemeState(savedTheme);

      const session = await AuthService.getSession();
      if (session?.user) {
        const profile = await AuthService.refreshCurrentProfile();
        if (profile) {
          await handleAuthenticatedUser(profile);
        }
      } else {
        setIsLoading(false);
      }

      unsubscribe = AuthService.initializeAuthListener(async ({ session, profile }) => {
        if (session?.user && profile) {
          await handleAuthenticatedUser(profile);
        } else {
          setCurrentUser(null);
          AuthService.setCachedProfile(null);
          setGroup(EMPTY_GROUP);
          setUnreadNotifications(0);
          setIsLoading(false);
        }
      });
    };

    initApp();

    return () => {
      unsubscribe?.();
    };
  }, [handleAuthenticatedUser]);

  useEffect(() => {
    if (!currentUser || !group.id) return;

    // Debounce realtime updates to prevent excessive API calls
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const channel = supabase
      .channel(`group-members-${group.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${group.id}`
      }, () => {
        // Debounce to prevent multiple rapid refreshes
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void refreshData();
        }, 1000);
      });

    void channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [currentUser?.id, group.id, refreshData]);

  // Only refresh on visibility change if tab was hidden for a while
  useEffect(() => {
    if (!currentUser) return;

    let lastHiddenTime = 0;
    
    const handleVisibility = () => {
      if (document.hidden) {
        lastHiddenTime = Date.now();
      } else {
        // Only refresh if tab was hidden for more than 30 seconds
        if (lastHiddenTime && Date.now() - lastHiddenTime > 30000) {
          void refreshData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.id, refreshData]);

  // Refresh notifications periodically (every 60 seconds instead of 30)
  useEffect(() => {
    if (!currentUser) return;
    
    const interval = setInterval(async () => {
      try {
        const unread = await NotificationService.getUnreadNotificationCount(currentUser.id);
        setUnreadNotifications(unread);
      } catch {
        // Silently fail - don't spam errors
      }
    }, 60000); // Every 60 seconds
    
    return () => clearInterval(interval);
  }, [currentUser]);

  // Process sync queue when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      try {
        console.log('Back online - processing sync queue');
        const result = await OfflineService.processSyncQueue(async (item) => {
          // Here we would sync each queued item based on its type
          // For now, just log and mark as processed
          console.log('Syncing:', item);
          // TODO: Implement actual sync logic per table
          return true;
        });
        
        if (result.success > 0) {
          console.log(`Synced ${result.success} items`);
        }
      } catch (error) {
        console.error('Sync failed:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const login = (user: User) => {
    void handleAuthenticatedUser(user);
  };

  const logout = () => {
    setCurrentUser(null);
    setGroup(EMPTY_GROUP);
    AuthService.setCachedProfile(null);
    AuthService.signOut().catch(() => {});
  };

  const toggleTheme = () => {
    const newTheme = ThemeService.toggleTheme();
    setThemeState(newTheme);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-slate-900 to-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-4xl">🏠</span>
          </div>
          <div className="text-primary text-3xl font-bold">شقتنا</div>
          <div className="text-gray-400 mt-2">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppContext.Provider value={{ 
      currentUser,
      currentGroup: group,
      login, 
      logout, 
      users, 
      group, 
      setGroup,
      refreshData,
      theme,
      toggleTheme,
      unreadNotifications
    }}>
        {/* PWA: Offline status banner */}
        <OfflineBanner />
        
        <Router>
          <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Auth Routes */}
          <Route path="/auth" element={
            currentUser ? <Navigate to={group.id ? "/" : "/group-setup"} replace /> : <AuthPage onLogin={login} />
          } />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          
          {/* Group Setup */}
          <Route path="/group-setup" element={
            !currentUser ? <Navigate to="/auth" replace /> : <GroupSetupPage />
          } />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/settlements" element={<ProtectedRoute><SettlementsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute showHeader={false}><ChatPage /></ProtectedRoute>} />
          <Route path="/shopping" element={<ProtectedRoute><ShoppingPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute showHeader={false}><ProfilePage /></ProtectedRoute>} />
          <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
        
        {/* PWA: Install prompt banner (shows when installable) */}
        <InstallPrompt variant="banner" />
        
        {/* iOS PWA Install Guide */}
        <IOSGuide />
      </AppContext.Provider>
    </ToastProvider>
  );
};

export default App;
