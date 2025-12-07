import { supabase } from './supabaseClient';
import { TransactionStatus, UserBalance } from '../types';
import { createServiceError } from '../utils/errorHandler';

interface ExpenseSummaryRow {
  id: string;
  payerId: string;
  amount: number | string;
}

interface SplitSummaryRow {
  user_id: string;
  amount: number | string;
}

interface PaymentRow {
  from: string;
  to: string;
  amount: number | string;
  status: TransactionStatus | string;
}

const PAYMENT_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.COMPLETED,
  TransactionStatus.CONFIRMED
]);

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return 0;
};

const accumulate = (map: Map<string, number>, key: string, delta: number) => {
  map.set(key, Number(((map.get(key) || 0) + delta).toFixed(2)));
};

const roundCurrency = (value: number) => Number(value.toFixed(2));

export const calculateGroupBalances = async (groupId: string): Promise<UserBalance[]> => {
  if (!groupId) {
    throw createServiceError(new Error('groupId is required to calculate balances'), 'حساب الأرصدة');
  }

  try {
    // IMPORTANT: Balance calculation uses ONLY expense_splits rows.
    // This ensures new members joining the group are NOT retroactively
    // charged for old expenses they weren't part of.
    // Only users with an explicit split row in an expense are included in its calculation.

    const [expensesRes, splitsRes, paymentsRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, "payerId", amount')
      .eq('groupId', groupId),
    supabase
      .from('expense_splits')
      .select('user_id, amount, expenses!inner(id, "groupId")')
      .eq('expenses.groupId', groupId),
    supabase
      .from('payments')
      .select('"from", "to", amount, status')
      .eq('groupId', groupId)
  ]);

  if (expensesRes.error) throw expensesRes.error;
  if (splitsRes.error) throw splitsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const paidTotals = new Map<string, number>();
  (expensesRes.data as ExpenseSummaryRow[]).forEach(expense => {
    accumulate(paidTotals, expense.payerId, toNumber(expense.amount));
  });

  const shareTotals = new Map<string, number>();
  (splitsRes.data as SplitSummaryRow[]).forEach(split => {
    accumulate(shareTotals, split.user_id, toNumber(split.amount));
  });

  const sentTotals = new Map<string, number>();
  const receivedTotals = new Map<string, number>();
  (paymentsRes.data as PaymentRow[]).forEach(payment => {
    if (!PAYMENT_STATUSES.has(payment.status as TransactionStatus)) {
      return;
    }
    accumulate(sentTotals, payment.from, toNumber(payment.amount));
    accumulate(receivedTotals, payment.to, toNumber(payment.amount));
  });

  const userIds = new Set<string>([
    ...paidTotals.keys(),
    ...shareTotals.keys(),
    ...sentTotals.keys(),
    ...receivedTotals.keys()
  ]);

  const balances: UserBalance[] = Array.from(userIds).map(userId => {
    const totalPaid = paidTotals.get(userId) || 0;
    const totalShare = shareTotals.get(userId) || 0;
    const totalSent = sentTotals.get(userId) || 0;
    const totalReceived = receivedTotals.get(userId) || 0;

    // Correct balance formula:
    // - (totalPaid - totalShare): net credit/debt from expenses alone
    // - +totalSent: sending money to others INCREASES my credit (they owe me less, or I prepaid)
    // - -totalReceived: receiving money DECREASES my credit (debt settled)
    // Final: Net = (totalPaid - totalShare) + totalSent - totalReceived
    const balance = (totalPaid - totalShare) + totalSent - totalReceived;

    return {
      userId,
      totalPaid: roundCurrency(totalPaid),
      totalShare: roundCurrency(totalShare),
      totalSent: roundCurrency(totalSent),
      totalReceived: roundCurrency(totalReceived),
      balance: roundCurrency(balance)
    };
  });

    return balances.sort((a, b) => b.balance - a.balance);
  } catch (error) {
    throw createServiceError(error, 'حساب الأرصدة');
  }
};

export const getBalances = calculateGroupBalances;
