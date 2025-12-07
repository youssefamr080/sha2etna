import { supabase } from './supabaseClient';
import { Expense, ExpenseCategory, ExpenseCursor, ExpenseSplit, ExpenseWithSplits, PaginatedResult } from '../types';
import { createServiceError } from '../utils/errorHandler';

export interface CreateExpenseInput {
  groupId: string;
  payerId: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  participants: string[];
  date?: string;
  notes?: string;
  receiptUrl?: string;
  id?: string;
}

export interface GetExpensesParams {
  groupId?: string;
  limit?: number;
  cursor?: ExpenseCursor | null;
}

export interface UpdateExpenseInput {
  id: string;
  amount: number;
  participants: string[];
  description?: string;
  category?: ExpenseCategory;
  date?: string;
  notes?: string;
  receiptUrl?: string;
}

export type ExpensePaginationResult = PaginatedResult<ExpenseWithSplits, ExpenseCursor | null>;

interface ExpenseSplitRow {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number | string;
  paid: boolean;
  paid_at?: string | null;
}

interface ExpenseRow {
  id: string;
  groupId: string;
  payerId: string;
  amount: number | string;
  description: string;
  category: ExpenseCategory;
  date: string;
  receiptUrl?: string | null;
  splitBetween?: string[] | null;
  splitAmounts?: Record<string, number> | null;
  notes?: string | null;
  created_at?: string | null;
  expense_splits?: ExpenseSplitRow[];
}

interface ExpenseSplitInsert {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  paid: boolean;
  paid_at?: string | null;
}

const EXPENSE_SELECT = `
  id,
  "groupId",
  "payerId",
  amount,
  description,
  category,
  date,
  "receiptUrl",
  "splitBetween",
  "splitAmounts",
  notes,
  created_at,
  expense_splits:expense_splits (
    id,
    expense_id,
    user_id,
    amount,
    paid,
    paid_at
  )
`;

const POSITIVE_AMOUNT_ERROR = 'قيمة المصروف يجب أن تكون أكبر من صفر';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return 0;
};

const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

const ensureParticipants = (participants: string[], payerId: string): string[] => {
  const unique = new Set(participants.filter(Boolean));
  unique.add(payerId);
  return Array.from(unique);
};

const distributeShares = (total: number, participantIds: string[]): Record<string, number> => {
  if (participantIds.length === 0) {
    throw createServiceError(new Error('لا يوجد مشاركين للمصروف'), 'حساب توزيع المصروف');
  }

  const centsTotal = Math.round(total * 100);
  const baseShare = Math.floor(centsTotal / participantIds.length);
  let remainder = centsTotal - baseShare * participantIds.length;

  const shares: Record<string, number> = {};
  participantIds.forEach((userId, index) => {
    let shareInCents = baseShare;
    if (remainder > 0) {
      shareInCents += 1;
      remainder -= 1;
    }
    shares[userId] = shareInCents / 100;
  });

  return shares;
};

const assertValidAmount = (value: number, context: string): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw createServiceError(new Error(POSITIVE_AMOUNT_ERROR), context);
  }
  return numeric;
};

const mapSplitRow = (row: ExpenseSplitRow): ExpenseSplit => ({
  id: row.id,
  expenseId: row.expense_id,
  userId: row.user_id,
  amount: Number(toNumber(row.amount).toFixed(2)),
  paid: row.paid,
  paidAt: row.paid_at ?? null
});

const mapExpenseRow = (row: ExpenseRow): ExpenseWithSplits => {
  const splits = (row.expense_splits || []).map(mapSplitRow);
  const normalizedSplitBetween = splits.length
    ? splits.map(split => split.userId)
    : row.splitBetween || [];
  const normalizedSplitAmounts = splits.length
    ? splits.reduce<Record<string, number>>((acc, split) => {
        acc[split.userId] = split.amount;
        return acc;
      }, {})
    : (row.splitAmounts || undefined);

  return {
    id: row.id,
    groupId: row.groupId,
    payerId: row.payerId,
    amount: Number(toNumber(row.amount).toFixed(2)),
    description: row.description,
    category: row.category,
    date: row.date,
    receiptUrl: row.receiptUrl || undefined,
    splitBetween: normalizedSplitBetween,
    splitAmounts: normalizedSplitAmounts,
    notes: row.notes || undefined,
    created_at: row.created_at || undefined,
    splits
  };
};

const buildSplitRows = (
  expenseId: string,
  participants: string[],
  shares: Record<string, number>,
  payerId: string
): ExpenseSplitInsert[] => {
  return participants.map((userId, index) => ({
    id: createId(`split${index}`),
    expense_id: expenseId,
    user_id: userId,
    amount: shares[userId],
    paid: userId === payerId,
    paid_at: userId === payerId ? new Date().toISOString() : null
  }));
};

export const getExpenses = async (params: GetExpensesParams = {}): Promise<ExpensePaginationResult> => {
  try {
    const limitParam = params.limit ?? DEFAULT_PAGE_SIZE;
    const limit = Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE);

    let query = supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (params.groupId) {
      query = query.eq('groupId', params.groupId);
    }

    if (params.cursor) {
      query = query.or(
        `date.lt.${params.cursor.date},and(date.eq.${params.cursor.date},id.lt.${params.cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = (data ?? []) as ExpenseRow[];

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = trimmed[trimmed.length - 1];

    return {
      items: trimmed.map(mapExpenseRow),
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? {
              date: lastItem.date,
              id: lastItem.id
            }
          : null
    };
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل المصاريف');
  }
};

export const addExpense = async (input: CreateExpenseInput): Promise<ExpenseWithSplits> => {
  const normalizedAmount = assertValidAmount(input.amount, 'إضافة مصروف جديد');

  try {
    const participants = ensureParticipants(input.participants, input.payerId);
    const shares = distributeShares(normalizedAmount, participants);
    const expenseId = input.id ?? createId('exp');
    const timestamp = input.date ?? new Date().toISOString();

    const expensePayload = {
      id: expenseId,
      groupId: input.groupId,
      payerId: input.payerId,
      amount: normalizedAmount,
      description: input.description,
      category: input.category,
      date: timestamp,
      receiptUrl: input.receiptUrl,
      notes: input.notes,
      splitBetween: participants,
      splitAmounts: shares
    } satisfies Partial<Expense> & Record<string, unknown>;

    const { data: expenseRow, error: expenseError } = await supabase
      .from('expenses')
      .insert(expensePayload)
      .select(EXPENSE_SELECT)
      .single();

    if (expenseError) {
      throw expenseError;
    }

    const splitRows = buildSplitRows(expenseId, participants, shares, input.payerId);
    const { data: createdSplits, error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitRows)
      .select('*');

    if (splitsError) {
      await supabase.from('expenses').delete().eq('id', expenseId);
      throw splitsError;
    }

    return mapExpenseRow({
      ...(expenseRow as ExpenseRow),
      expense_splits: createdSplits as ExpenseSplitRow[]
    });
  } catch (error) {
    throw createServiceError(error, 'إضافة مصروف جديد');
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  if (!expenseId) {
    throw createServiceError(new Error('معرف المصروف مطلوب للحذف'), 'حذف المصروف');
  }

  try {
    await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw error;
  } catch (error) {
    throw createServiceError(error, 'حذف المصروف');
  }
};

export const updateExpense = async (input: UpdateExpenseInput): Promise<ExpenseWithSplits> => {
  if (!input.id) {
    throw createServiceError(new Error('معرف المصروف مطلوب للتعديل'), 'تعديل المصروف');
  }

  const normalizedAmount = assertValidAmount(input.amount, 'تعديل المصروف');

  const { data: currentExpenseRow, error: fetchError } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', input.id)
    .single();

  if (fetchError || !currentExpenseRow) {
    throw createServiceError(fetchError || new Error('لم يتم العثور على المصروف'), 'تعديل المصروف');
  }

  const participants = ensureParticipants(input.participants, currentExpenseRow.payerId);
  const shares = distributeShares(normalizedAmount, participants);

  const updatedExpensePayload = {
    amount: normalizedAmount,
    description: input.description ?? currentExpenseRow.description,
    category: input.category ?? currentExpenseRow.category,
    date: input.date ?? currentExpenseRow.date,
    notes: input.notes ?? currentExpenseRow.notes,
    receiptUrl: input.receiptUrl ?? currentExpenseRow.receiptUrl,
    splitBetween: participants,
    splitAmounts: shares
  } satisfies Partial<Expense>;

  try {
    const splitRows = buildSplitRows(input.id, participants, shares, currentExpenseRow.payerId);

    const { error: rpcError } = await supabase.rpc('update_expense_with_splits', {
      expense_id: input.id,
      new_amount: updatedExpensePayload.amount,
      new_title: updatedExpensePayload.description,
      new_category: updatedExpensePayload.category,
      new_payer_id: currentExpenseRow.payerId,
      new_date: updatedExpensePayload.date,
      new_notes: updatedExpensePayload.notes ?? null,
      new_receipt_url: updatedExpensePayload.receiptUrl ?? null,
      new_split_between: participants,
      new_split_amounts: shares,
      new_splits: splitRows.map(split => ({
        id: split.id,
        expense_id: split.expense_id,
        user_id: split.user_id,
        amount: split.amount,
        paid: split.paid,
        paid_at: split.paid_at
      }))
    });

    if (rpcError) throw rpcError;

    const { data: refreshedRow, error: refreshError } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('id', input.id)
      .single();

    if (refreshError || !refreshedRow) {
      throw refreshError || new Error('فشل في جلب المصروف بعد التحديث');
    }

    return mapExpenseRow(refreshedRow as ExpenseRow);
  } catch (error) {
    throw createServiceError(error, 'تعديل المصروف');
  }
};
