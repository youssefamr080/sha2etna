import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import * as StatsService from '../services/StatsService';
import { GroupStats, UserStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Wallet, PieChart as PieIcon, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';

const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const StatsPage: React.FC = () => {
  const { currentUser, group, users } = useApp();
  const { showToast } = useToast();
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'group' | 'personal'>('group');

  const loadStats = React.useCallback(async () => {
    if (!currentUser || !group.id) return;
    setIsLoading(true);
    
    try {
      const [gStats, uStats] = await Promise.all([
        StatsService.getGroupStats(group.id),
        StatsService.getUserStats(currentUser.id, group.id)
      ]);
      
      setGroupStats(gStats);
      setUserStats(uStats);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, group.id, showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const translateCategory = (cat: string) => {
    const map: Record<string, string> = {
      'Rent': 'إيجار', 'Utilities': 'فواتير', 'Groceries': 'مقاضي',
      'Internet': 'إنترنت', 'Electricity': 'كهرباء', 'Water': 'مياه',
      'Gas': 'غاز', 'Entertainment': 'ترفيه', 'Food': 'طعام',
      'Transportation': 'مواصلات', 'Maintenance': 'صيانة', 'Other': 'أخرى'
    };
    return map[cat] || cat;
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'غير معروف';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="p-5 min-h-screen pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الإحصائيات</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{group.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'group' 
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          إحصائيات الشقة
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'personal' 
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          إحصائياتي
        </button>
      </div>

      {activeTab === 'group' && groupStats && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-xl p-4 text-white">
              <Wallet size={24} className="opacity-80 mb-2" />
              <p className="text-emerald-100 text-xs">إجمالي المصروفات</p>
              <p className="text-2xl font-bold">{groupStats.totalExpenses.toLocaleString()}</p>
              <p className="text-xs text-emerald-100">ج.م</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <TrendingUp size={24} className="opacity-80 mb-2" />
              <p className="text-blue-100 text-xs">هذا الشهر</p>
              <p className="text-2xl font-bold">{groupStats.monthlyTotal.toLocaleString()}</p>
              <p className="text-xs text-blue-100">ج.م</p>
            </div>
          </div>

          {/* Highest Spender */}
          {groupStats.highestSpender.userId && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👑</span>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">أكثر المنفقين</p>
                  <p className="font-bold text-gray-900 dark:text-white">{getUserName(groupStats.highestSpender.userId)}</p>
                  <p className="text-primary font-medium">{groupStats.highestSpender.amount.toLocaleString()} ج.م</p>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Trend Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">الاتجاه الشهري</h3>
            <div style={{ width: '100%', height: 200 }} dir="ltr">
              <ResponsiveContainer>
                <LineChart data={groupStats.monthlyTrend}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} ج.م`, 'المصروفات']}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">توزيع المصروفات</h3>
            <div style={{ width: '100%', height: 200 }} dir="ltr">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={groupStats.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {groupStats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [`${value} ج.م`, translateCategory(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {groupStats.categoryDistribution.map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 dark:text-gray-400">{translateCategory(cat.category)}</span>
                  <span className="text-gray-400 dark:text-gray-500">({cat.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Member Contributions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">مساهمات الأعضاء</h3>
            <div className="space-y-3">
              {groupStats.memberContributions.map((member, i) => (
                <div key={member.userId} className="flex items-center gap-3">
                  <img 
                    src={users.find(u => u.id === member.userId)?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userId}`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{getUserName(member.userId)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{member.amount.toLocaleString()} ج.م</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all" 
                        style={{ width: `${member.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'personal' && userStats && (
        <div className="space-y-6">
          {/* Personal Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">دفعت</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.totalPaid.toLocaleString()}</p>
              <p className="text-xs text-gray-400">ج.م</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">لك عند الآخرين</p>
              <p className="text-2xl font-bold text-green-600">{userStats.totalOwed.toLocaleString()}</p>
              <p className="text-xs text-gray-400">ج.م</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">عليك للآخرين</p>
              <p className="text-2xl font-bold text-red-500">{userStats.totalOwing.toLocaleString()}</p>
              <p className="text-xs text-gray-400">ج.م</p>
            </div>
            <div className={`rounded-xl p-4 border ${userStats.balance >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">الرصيد</p>
              <p className={`text-2xl font-bold ${userStats.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {userStats.balance >= 0 ? '+' : ''}{userStats.balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">ج.م</p>
            </div>
          </div>

          {/* Personal Monthly Expenses */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">مصروفاتي الشهرية</h3>
            <div style={{ width: '100%', height: 200 }} dir="ltr">
              <ResponsiveContainer>
                <BarChart data={userStats.monthlyExpenses}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} ج.م`, 'المصروفات']}
                  />
                  <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Personal Category Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">توزيع مصروفاتي</h3>
            {userStats.categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {userStats.categoryBreakdown.sort((a, b) => b.amount - a.amount).map((cat, i) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700 dark:text-gray-300">{translateCategory(cat.category)}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{cat.amount.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">لا توجد بيانات</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
