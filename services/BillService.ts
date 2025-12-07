import { supabase } from './supabaseClient';
import { Bill } from '../types';
import { createServiceError } from '../utils/errorHandler';

const withId = (bill: Omit<Bill, 'id'>): Bill => ({
  id: 'b' + Date.now(),
  ...bill
});

export const getBills = async (groupId: string): Promise<Bill[]> => {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('groupId', groupId)
      .order('dueDate', { ascending: true });
    if (error) throw error;
    return (data || []) as Bill[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل الفواتير');
  }
};

export const addBill = async (bill: Omit<Bill, 'id'>): Promise<Bill> => {
  try {
    const payload = withId(bill);
    const { data, error } = await supabase.from('bills').insert(payload).select().single();
    if (error) throw error;
    return data as Bill;
  } catch (error) {
    throw createServiceError(error, 'تعذر إضافة الفاتورة');
  }
};

export const updateBill = async (id: string, updates: Partial<Bill>): Promise<boolean> => {
  try {
    const { error } = await supabase.from('bills').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث الفاتورة');
  }
};

export const markBillAsPaid = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bills')
      .update({ status: 'paid', lastPaid: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث حالة الفاتورة');
  }
};

export const getUpcomingBills = async (groupId: string, days = 7): Promise<Bill[]> => {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('groupId', groupId)
      .eq('status', 'pending')
      .lte('dueDate', futureDate.toISOString())
      .order('dueDate', { ascending: true });

    if (error) throw error;
    return (data || []) as Bill[];
  } catch (error) {
    throw createServiceError(error, 'تعذر تحميل الفواتير القادمة');
  }
};
