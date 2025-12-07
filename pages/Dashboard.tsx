
import React, { useEffect, useState } from 'react';
import { useApp } from '../App';
import * as ExpenseService from '../services/ExpenseService';
import * as PaymentService from '../services/PaymentService';
import { Expense, TransactionStatus } from '../types';
import { TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import { translateCategory } from '../utils/categoryUtils';

const DashboardSkeleton = () => (
  <div className="p-5 pb-24 space-y-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-10 rounded-full" rounded={true} />
    </div>

    <Skeleton className="h-36" />
    <Skeleton className="h-40" />
    <Skeleton className="h-32" />
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Skeleton key={idx} className="h-16" />
      ))}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { currentUser, group, users } = useApp();
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [myBalance, setMyBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!group.id) {
        setIsLoading(false);
        return;
      }

      try {
      const [{ items: allExpenses }, allPayments] = await Promise.all([
        ExpenseService.getExpenses({ groupId: group.id, limit: 250 }),
        PaymentService.getPayments({ groupId: group.id })
      ]);
      setExpenses(allExpenses);
      
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      // Calculate balance from expense_splits (not dynamic group.members.length)
      // This ensures new members don't get retroactively charged for old expenses
      let paidByMe = 0;
      let myShareTotal = 0;

      allExpenses.forEach(exp => {
        if (exp.payerId === currentUser.id) {
          paidByMe += exp.amount;
        }
        // Use splitAmounts if available (precise per-user share from expense_splits)
        if (exp.splitAmounts && exp.splitAmounts[currentUser.id] !== undefined) {
          myShareTotal += exp.splitAmounts[currentUser.id];
        } else if (exp.splitBetween.includes(currentUser.id)) {
          // Fallback: only if user is explicitly in splitBetween
          const splitCount = exp.splitBetween.length;
          myShareTotal += exp.amount / splitCount;
        }
        // Note: If user is NOT in splitBetween, they don't owe anything for this expense
      });

      let received = 0;
      let sent = 0;
      allPayments.forEach(pay => {
        if (pay.status === TransactionStatus.COMPLETED || pay.status === TransactionStatus.CONFIRMED) {
          if (pay.to === currentUser.id) received += pay.amount;
          if (pay.from === currentUser.id) sent += pay.amount;
        }
      });

      // Correct formula:
      // - paidByMe: total I paid for the group (creates credit for me)
      // - myShareTotal: my share of all expenses (creates debt for me)
      // - sent: money I transferred to others (INCREASES my credit - I paid out more)
      // - received: money I received from others (DECREASES my credit - debt settled)
      // Net = (paidByMe - myShareTotal) + sent - received
      const net = (paidByMe - myShareTotal) + sent - received;
      setMyBalance(net);
      } catch (error) {
        showToast('حدث خطأ أثناء تحميل البيانات', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [currentUser, group, showToast]);

  const memberDetails = (group.members || []).map(memberId => {
    const user = users.find(u => u.id === memberId);
    return {
      id: memberId,
      name: user?.name || 'عضو',
      avatar: user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberId}`,
      email: user?.email
    };
  });

  const copyInviteCode = async () => {
    if (!group.code) return;
    try {
      await navigator.clipboard.writeText(group.code);
      showToast('تم نسخ كود الدعوة', 'success');
    } catch (error) {
      showToast('تعذر نسخ الكود، انسخه يدوياً', 'error');
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-5 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">أهلاً، {currentUser?.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{group.name}</p>
        </div>
        <div className="relative">
            <Link to="/profile">
                <img src={currentUser?.avatar} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-sm" />
            </Link>
        </div>
      </div>

      {/* Group Info */}
      {group.id && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">معلومات الشقة</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">شارك الكود مع من تريد إضافته</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-xl text-sm font-mono text-gray-800 dark:text-gray-100">
                {group.code || '—'}
              </div>
              <button
                onClick={copyInviteCode}
                className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/10"
              >
                نسخ الكود
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              عدد الأفراد: {group.members?.length || 0}
            </p>
            <div className="flex flex-wrap gap-3">
              {memberDetails.length > 0 ? (
                memberDetails.map(member => (
                  <div key={member.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/60 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-600">
                    <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-white/40" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{member.name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">لا يوجد أعضاء حتى الآن.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-secondary to-slate-800 rounded-2xl p-6 text-white shadow-xl mb-6">
        <p className="text-slate-300 text-sm font-medium mb-1">رصيدك الحالي</p>
        <h2 className={`text-4xl font-bold mb-4 ${myBalance >= 0 ? 'text-primary' : 'text-red-400'}`} dir="ltr">
          {myBalance >= 0 ? '+' : ''}{myBalance.toFixed(2)} ج.م
        </h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg flex-1">
            <div className="bg-green-500/20 p-1.5 rounded-full text-green-400">
                <TrendingUp size={16} />
            </div>
            <div>
                <p className="text-[10px] text-gray-400">لك</p>
                <p className="font-semibold text-sm">{myBalance > 0 ? myBalance.toFixed(0) : 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg flex-1">
             <div className="bg-red-500/20 p-1.5 rounded-full text-red-400">
                <TrendingDown size={16} />
            </div>
            <div>
                <p className="text-[10px] text-gray-400">عليك</p>
                <p className="font-semibold text-sm">{myBalance < 0 ? Math.abs(myBalance).toFixed(0) : 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link 
          to="/bills" 
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <span className="text-xl">📋</span>
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white text-sm">الفواتير</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">تذكيرات الدفع</p>
          </div>
        </Link>
        <Link 
          to="/stats" 
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <PieChart size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white text-sm">التحليلات</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">إحصائيات مفصلة</p>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">آخر العمليات</h3>
        <div className="space-y-3">
          {expenses.slice().reverse().slice(0, 5).map(exp => (
            <div key={exp.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                        ${exp.category === 'Groceries' ? 'bg-orange-400' : 
                          exp.category === 'Utilities' ? 'bg-blue-400' : 'bg-gray-400'
                        }`}>
                        {exp.category[0]}
                    </div>
                    <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{exp.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{translateCategory(exp.category)} • {new Date(exp.date).toLocaleDateString('ar-EG')}</p>
                    </div>
                </div>
                <span className="font-bold text-gray-800 dark:text-gray-200" dir="ltr">-{exp.amount}</span>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-center text-gray-400 text-sm py-4">لا توجد مصاريف حتى الآن.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
