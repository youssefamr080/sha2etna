import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import * as BillService from '../services/BillService';
import { Bill, ExpenseCategory } from '../types';
import { Plus, Calendar, Bell, Check, Clock, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';

const BillsPage: React.FC = () => {
  const { group, currentUser } = useApp();
  const { showToast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingBillId, setProcessingBillId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.UTILITIES);
  const [dueDate, setDueDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [reminder, setReminder] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);

  const loadBills = React.useCallback(async () => {
    if (!group.id) return;
    setIsLoading(true);
    try {
      const data = await BillService.getBills(group.id);
      setBills(data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [group.id, showToast]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group.id || isSaving) return;

    setIsSaving(true);
    const newBill: Omit<Bill, 'id'> = {
      groupId: group.id,
      name,
      amount: parseFloat(amount),
      category,
      dueDate: new Date(dueDate).toISOString(),
      recurring,
      recurringPeriod: recurring ? recurringPeriod : undefined,
      reminder,
      reminderDays: reminder ? reminderDays : undefined,
      status: 'pending'
    };

    try {
      await BillService.addBill(newBill);
      await loadBills();
      resetForm();
      setIsModalOpen(false);
      showToast('تمت إضافة الفاتورة', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async (billId: string) => {
    if (processingBillId) return;
    setProcessingBillId(billId);
    try {
      await BillService.markBillAsPaid(billId);
      await loadBills();
      showToast('تم تسجيل الدفع', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessingBillId(null);
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategory(ExpenseCategory.UTILITIES);
    setDueDate('');
    setRecurring(false);
    setReminder(true);
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    const due = new Date(dueDate);
    const today = new Date();
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (daysUntil <= 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  };

  const getStatusIcon = (status: string, dueDate: string) => {
    if (status === 'paid') return <Check size={16} />;
    const due = new Date(dueDate);
    const today = new Date();
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return <AlertTriangle size={16} />;
    return <Clock size={16} />;
  };

  const translateCategory = (cat: string) => {
    const map: Record<string, string> = {
      'Rent': 'إيجار', 'Utilities': 'فواتير', 'Groceries': 'مقاضي',
      'Internet': 'إنترنت', 'Electricity': 'كهرباء', 'Water': 'مياه',
      'Gas': 'غاز', 'Entertainment': 'ترفيه', 'Food': 'طعام',
      'Transportation': 'مواصلات', 'Maintenance': 'صيانة', 'Other': 'أخرى'
    };
    return map[cat] || cat;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="p-5 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الفواتير المتكررة</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">تتبع مواعيد الدفع</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-emerald-600 text-white rounded-full p-3 shadow-lg transition-transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Upcoming Bills Alert */}
      {bills.filter(b => {
        const daysUntil = Math.ceil((new Date(b.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return b.status !== 'paid' && daysUntil <= 7 && daysUntil >= 0;
      }).length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Bell size={20} />
            <span className="font-medium">لديك فواتير قادمة خلال الأسبوع!</span>
          </div>
        </div>
      )}

      {/* Bills List */}
      <div className="space-y-4">
        {bills.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">لا توجد فواتير مسجلة</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-primary font-medium"
            >
              أضف فاتورة جديدة
            </button>
          </div>
        ) : (
          bills.map(bill => {
            const daysUntil = Math.ceil((new Date(bill.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={bill.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">{bill.name}</h3>
                      {bill.recurring && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                          متكرر
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{translateCategory(bill.category)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getStatusColor(bill.status, bill.dueDate)}`}>
                        {getStatusIcon(bill.status, bill.dueDate)}
                        {bill.status === 'paid' ? 'مدفوعة' : 
                          daysUntil < 0 ? `متأخر ${Math.abs(daysUntil)} يوم` :
                          daysUntil === 0 ? 'اليوم!' :
                          `خلال ${daysUntil} يوم`}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-xl text-gray-900 dark:text-white">{bill.amount}</p>
                    <p className="text-xs text-gray-400">ج.م</p>
                    {bill.status !== 'paid' && (
                      <button
                        onClick={() => handleMarkPaid(bill.id)}
                        className="mt-2 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors"
                      >
                        تم الدفع
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl modal-content flex flex-col" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}>
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">إضافة فاتورة</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
            <form onSubmit={handleAddBill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الفاتورة</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: فاتورة الكهرباء"
                  required
                  className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">التصنيف</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{translateCategory(cat)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  required
                  className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={recurring}
                  onChange={e => setRecurring(e.target.checked)}
                  className="w-5 h-5 text-primary rounded"
                />
                <label htmlFor="recurring" className="text-gray-700 dark:text-gray-300">فاتورة متكررة</label>
              </div>

              {recurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تكرار كل</label>
                  <select
                    value={recurringPeriod}
                    onChange={e => setRecurringPeriod(e.target.value as any)}
                    className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="monthly">شهر</option>
                    <option value="quarterly">3 أشهر</option>
                    <option value="yearly">سنة</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="reminder"
                  checked={reminder}
                  onChange={e => setReminder(e.target.checked)}
                  className="w-5 h-5 text-primary rounded"
                />
                <label htmlFor="reminder" className="text-gray-700 dark:text-gray-300">تذكير قبل الموعد</label>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-md hover:bg-emerald-600 transition-colors"
              >
                حفظ الفاتورة
              </button>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsPage;
