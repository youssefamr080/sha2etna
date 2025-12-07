import { supabase } from './supabaseClient';
import { GroupStats, UserStats, Expense, TransactionStatus } from '../types';
import { createServiceError } from '../utils/errorHandler';
import * as GroupService from './GroupService';
import * as UserService from './UserService';
import * as PaymentService from './PaymentService';

const fetchGroupExpenses = async (groupId: string): Promise<Expense[]> => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('groupId', groupId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []) as Expense[];
};

export const getUserStats = async (userId: string, groupId: string): Promise<UserStats> => {
  try {
    const [group, expenses, payments] = await Promise.all([
      GroupService.getGroup(groupId),
      fetchGroupExpenses(groupId),
      PaymentService.getPayments({ groupId })
    ]);

    if (!group) {
      throw new Error('لم يتم العثور على المجموعة');
    }

    const totalPaid = expenses
      .filter(expense => expense.payerId === userId)
      .reduce((sum, expense) => sum + expense.amount, 0);

    let totalOwed = 0;
    let totalOwing = 0;

    expenses.forEach(expense => {
      const splitMembers = expense.splitBetween?.length ? expense.splitBetween : group.members;
      const perPersonShare = expense.amount / splitMembers.length;

      if (expense.payerId === userId) {
        splitMembers.forEach(memberId => {
          if (memberId !== userId) {
            totalOwed += perPersonShare;
          }
        });
      } else if (splitMembers.includes(userId)) {
        totalOwing += perPersonShare;
      }
    });

    payments
      .filter(payment => payment.status === TransactionStatus.CONFIRMED)
      .forEach(payment => {
        if (payment.from === userId) {
          totalOwing = Math.max(0, totalOwing - payment.amount);
        } else if (payment.to === userId) {
          totalOwed = Math.max(0, totalOwed - payment.amount);
        }
      });

    const monthlyExpenses: { month: string; amount: number }[] = [];
    const lastSixMonths = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date();
      date.setMonth(date.getMonth() - idx);
      return date.toISOString().slice(0, 7);
    }).reverse();

    lastSixMonths.forEach(month => {
      const monthTotal = expenses
        .filter(exp => exp.date.startsWith(month))
        .reduce((sum, exp) => {
          const splitMembers = exp.splitBetween?.length ? exp.splitBetween : group.members;
          if (!splitMembers.includes(userId)) {
            return sum;
          }
          return sum + exp.amount / splitMembers.length;
        }, 0);

      monthlyExpenses.push({
        month: new Date(`${month}-01`).toLocaleDateString('ar-SA', { month: 'short' }),
        amount: Math.round(monthTotal)
      });
    });

    const categoryTotals: Record<string, number> = {};
    expenses.forEach(expense => {
      const splitMembers = expense.splitBetween?.length ? expense.splitBetween : group.members;
      if (splitMembers.includes(userId)) {
        const share = expense.amount / splitMembers.length;
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + share;
      }
    });

    const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount: Math.round(amount)
    }));

    return {
      totalPaid: Math.round(totalPaid),
      totalOwed: Math.round(Math.max(0, totalOwed)),
      totalOwing: Math.round(Math.max(0, totalOwing)),
      balance: Math.round(totalOwed - totalOwing),
      monthlyExpenses,
      categoryBreakdown
    };
  } catch (error) {
    throw createServiceError(error, 'تعذر تحميل إحصاءات المستخدم');
  }
};

export const getGroupStats = async (groupId: string): Promise<GroupStats> => {
  try {
    const [group, expenses, users] = await Promise.all([
      GroupService.getGroup(groupId),
      fetchGroupExpenses(groupId),
      UserService.getUsers()
    ]);

    if (!group) {
      throw new Error('لم يتم العثور على المجموعة');
    }

    const groupUsers = users.filter(user => group.members.includes(user.id));
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTotal = expenses
      .filter(expense => expense.date.startsWith(currentMonth))
      .reduce((sum, expense) => sum + expense.amount, 0);

    const spenderTotals: Record<string, number> = {};
    expenses.forEach(expense => {
      spenderTotals[expense.payerId] = (spenderTotals[expense.payerId] || 0) + expense.amount;
    });

    const [highestSpenderUserId, highestSpenderAmount] = Object.entries(spenderTotals)
      .sort(([, a], [, b]) => b - a)[0] || ['', 0];

    const categoryTotals: Record<string, number> = {};
    expenses.forEach(expense => {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    const categoryDistribution = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
    }));

    const lastSixMonths = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date();
      date.setMonth(date.getMonth() - idx);
      return date.toISOString().slice(0, 7);
    }).reverse();

    const monthlyTrend = lastSixMonths.map(month => {
      const monthTotal = expenses
        .filter(expense => expense.date.startsWith(month))
        .reduce((sum, expense) => sum + expense.amount, 0);

      return {
        month: new Date(`${month}-01`).toLocaleDateString('ar-SA', { month: 'short' }),
        amount: Math.round(monthTotal)
      };
    });

    const memberContributions = groupUsers.map(user => {
      const amount = spenderTotals[user.id] || 0;
      return {
        userId: user.id,
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
      };
    });

    return {
      totalExpenses: Math.round(totalExpenses),
      monthlyTotal: Math.round(monthlyTotal),
      highestSpender: { userId: highestSpenderUserId, amount: highestSpenderAmount },
      categoryDistribution,
      monthlyTrend,
      memberContributions
    };
  } catch (error) {
    throw createServiceError(error, 'تعذر تحميل إحصاءات المجموعة');
  }
};
