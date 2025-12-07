
import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import * as PaymentService from '../services/PaymentService';
import * as SettlementService from '../services/SettlementService';
import * as HapticService from '../services/hapticService';
import { Payment, TransactionStatus, UserBalance } from '../types';
import { ArrowLeft, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, CreditCard } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { getErrorMessage } from '../utils/errorHandler';
import { useConfetti } from '../components/ui/Confetti';

interface DebtLine {
  from: string;
  to: string;
  amount: number;
}

const buildDebtLines = (balances: UserBalance[]): DebtLine[] => {
  const debtors = balances
    .filter(balance => balance.balance < -0.01)
    .map(balance => ({ id: balance.userId, amount: Math.abs(balance.balance) }));
  const creditors = balances
    .filter(balance => balance.balance > 0.01)
    .map(balance => ({ id: balance.userId, amount: balance.balance }));

  const result: DebtLine[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      result.push({ from: debtor.id, to: creditor.id, amount: Number(amount.toFixed(2)) });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.01) {
      debtorIndex++;
    }
    if (creditor.amount <= 0.01) {
      creditorIndex++;
    }
  }

  return result;
};

const SettlementsPage: React.FC = () => {
  const { currentUser, group, users } = useApp();
  const { showToast: pushToast } = useToast();
  const { triggerConfetti, ConfettiComponent } = useConfetti();
  const [debts, setDebts] = useState<DebtLine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPaymentTo, setProcessingPaymentTo] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!group.id) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [balances, paymentRows] = await Promise.all([
          SettlementService.calculateGroupBalances(group.id),
          PaymentService.getPayments({ groupId: group.id })
        ]);
        setDebts(buildDebtLines(balances));
        setPayments(paymentRows);
      } catch (error) {
        pushToast(getErrorMessage(error), 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [group.id, pushToast]);

  const refreshSettlements = async () => {
    if (!group.id) return;
    const [balances, paymentRows] = await Promise.all([
      SettlementService.calculateGroupBalances(group.id),
      PaymentService.getPayments({ groupId: group.id })
    ]);
    setDebts(buildDebtLines(balances));
    setPayments(paymentRows);
  };

  const handlePay = async (toUserId: string, amount: number) => {
    if (!currentUser || !group.id || processingPaymentTo) return;
    
    setProcessingPaymentTo(toUserId);
    const payment: Payment = {
      id: Date.now().toString(),
      from: currentUser.id,
      to: toUserId,
      amount,
      date: new Date().toISOString(),
      status: TransactionStatus.PENDING,
      groupId: group.id
    };

    try {
      await PaymentService.addPayment(payment);
      await refreshSettlements();
      pushToast('تم بدء الدفع', 'success');
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setProcessingPaymentTo(null);
    }
  };

  const confirmPayment = async (payment: Payment) => {
    if (confirmingPaymentId) return;
    
    setConfirmingPaymentId(payment.id);
    try {
      await PaymentService.confirmPayment(payment.id);
      await refreshSettlements();
      
      // Haptic and confetti feedback
      HapticService.paymentConfirmed();
      
      // Check if all debts are settled
      const balances = await SettlementService.calculateGroupBalances(group!.id);
      const hasRemainingDebts = balances.some(b => Math.abs(b.balance) > 0.01);
      
      if (!hasRemainingDebts) {
        // All debts settled - celebration!
        triggerConfetti();
        pushToast('🎉 تم تسوية جميع الديون!', 'success');
      } else {
        pushToast('تم تأكيد الدفع', 'success');
      }
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name;
  const getUserAvatar = (id: string) => users.find(u => u.id === id)?.avatar;

  const toggleExpand = (id: string) => {
    setExpandedPaymentId(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="p-5 pb-24 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3 mb-8">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 pb-24 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <ConfettiComponent />
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">التسويات والديون</h1>

      {/* Suggested Settlements */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">مقترحات السداد</h2>
        <div className="space-y-3">
          {debts.length === 0 ? (
            <EmptyState
              variant="celebration"
              title="كل الحسابات مسوّاة!"
              subtitle="لا توجد ديون متبقية على المجموعة حالياً. أحسنتم! 👏"
            />
          ) : (
            debts.map((debt, idx) => {
              // Get InstaPay link for the recipient (with try-catch for private browsing)
              let recipientInstaPayLink: string | null = null;
              try {
                recipientInstaPayLink = localStorage.getItem(`instapay_${debt.to}`);
              } catch {
                // localStorage not available in private browsing
              }
              
              const fromUser = users.find(u=>u.id === debt.from);
              const toUser = users.find(u=>u.id === debt.to);
              const fromAvatar = fromUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${debt.from}`;
              const toAvatar = toUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${debt.to}`;
              
              return (
              <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={fromAvatar} alt="" className="w-8 h-8 rounded-full opacity-70" />
                    <ArrowLeft size={16} className="text-gray-400" />
                    <img src={toAvatar} alt="" className="w-8 h-8 rounded-full" />
                </div>
                <div className="text-left">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {debt.from === currentUser?.id ? 'عليك' : `على ${getUserName(debt.from)}`}
                    </p>
                    <p className="font-bold text-lg dark:text-white">{debt.amount} ج.م</p>
                    
                    {debt.from === currentUser?.id && (
                        <div className="flex gap-2 mt-2">
                          {recipientInstaPayLink && (
                            <a
                              href={recipientInstaPayLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-green-500 text-white text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1"
                              onClick={() => HapticService.lightTap()}
                            >
                              <CreditCard size={14} />
                              InstaPay
                            </a>
                          )}
                          <button 
                              onClick={() => {
                                if (processingPaymentTo) return;
                                handlePay(debt.to, debt.amount);
                              }}
                              disabled={processingPaymentTo !== null}
                              className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 active:scale-95 flex items-center gap-1.5 min-w-[80px] justify-center"
                          >
                              {processingPaymentTo === debt.to ? (
                                <><Loader2 size={14} className="animate-spin" /></>
                              ) : processingPaymentTo !== null ? (
                                <span className="opacity-50">سدد الآن</span>
                              ) : (
                                'سدد الآن'
                              )}
                          </button>
                        </div>
                    )}
                </div>
              </div>
            );})
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">سجل المدفوعات</h2>
        <div className="space-y-3">
          {payments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pay => {
            const isIncoming = pay.to === currentUser?.id;
            const otherUser = isIncoming ? getUserName(pay.from) : getUserName(pay.to);
            const isExpanded = expandedPaymentId === pay.id;
            
            return (
                <div key={pay.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all duration-300">
                    <div 
                        onClick={() => toggleExpand(pay.id)}
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isIncoming ? 'bg-green-100 dark:bg-green-900/50 text-green-600' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600'}`}>
                                {isIncoming ? <ArrowLeft className="rotate-180" size={16} /> : <ArrowLeft size={16} />}
                            </div>
                            <div>
                                <p className="font-medium text-sm dark:text-white">
                                    {isIncoming ? `استلمت من ${otherUser}` : `حولت إلى ${otherUser}`}
                                </p>
                                <p className="text-[10px] text-gray-400">{new Date(pay.date).toLocaleDateString('ar-EG')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-gray-800 dark:text-white">{pay.amount}</span>
                            {pay.status === TransactionStatus.PENDING ? (
                                isIncoming ? (
                                    <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (confirmingPaymentId) return;
                                          confirmPayment(pay); 
                                        }}
                                        disabled={confirmingPaymentId !== null}
                                        className="flex items-center gap-1 text-[10px] bg-green-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-green-700 z-10 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[60px] justify-center"
                                    >
                                        {confirmingPaymentId === pay.id ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <>تأكيد <CheckCircle size={12} /></>
                                        )}
                                    </button>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                                        معلق <Clock size={10} />
                                    </span>
                                )
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-green-600 font-medium">مكتمل</span>
                                    {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Expanded Content */}
                    <div 
                        className={`bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                        <div className="p-4">
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 relative overflow-hidden">
                                {/* Decorative bar */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20"></div>

                                <div className="flex items-center justify-between relative z-10 pt-2" dir="rtl">
                                    {/* Sender */}
                                    <div className="flex flex-col items-center w-1/3 animate-in fade-in zoom-in duration-300">
                                        <img src={getUserAvatar(pay.from)} className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-md mb-2 object-cover" alt="Sender" />
                                        <span className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-full">{getUserName(pay.from)}</span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">المرسل</span>
                                    </div>

                                    {/* Arrow / Amount */}
                                    <div className="flex flex-col items-center w-1/3 text-center px-2">
                                        <div className="w-full h-px bg-gray-200 dark:bg-gray-600 mb-2 relative">
                                             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-50 dark:bg-gray-800 p-1 rounded-full border border-gray-100 dark:border-gray-700">
                                                <ArrowLeft size={12} className="text-gray-400" />
                                             </div>
                                        </div>
                                        <span className="text-xs font-bold text-primary dir-ltr">{pay.amount} ج.م</span>
                                    </div>

                                    {/* Receiver */}
                                     <div className="flex flex-col items-center w-1/3 animate-in fade-in zoom-in duration-300 delay-75">
                                        <img src={getUserAvatar(pay.to)} className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-md mb-2 object-cover" alt="Receiver" />
                                        <span className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-full">{getUserName(pay.to)}</span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">المستلم</span>
                                    </div>
                                </div>

                                {/* Date Footer */}
                                <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 text-center">
                                     <div className="flex items-center justify-center gap-1.5 text-gray-400 text-[10px]">
                                        <Clock size={12} />
                                        <span>
                                            {new Date(pay.date).toLocaleDateString('ar-EG', { 
                                                weekday: 'long', 
                                                day: 'numeric',
                                                month: 'long', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SettlementsPage;
