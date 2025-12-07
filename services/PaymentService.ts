import { supabase } from './supabaseClient';
import { Payment, TransactionStatus, NotificationType } from '../types';
import { createServiceError } from '../utils/errorHandler';
import * as NotificationService from './NotificationService';
import * as UserService from './UserService';

interface PaymentFilter {
  groupId?: string;
}

const withId = (payment: Payment): Payment => ({
  id: payment.id || Date.now().toString(),
  ...payment
});

const fetchUserName = async (userId: string): Promise<string> => {
  try {
    const profile = await UserService.getUserById(userId);
    return profile?.name || 'عضو';
  } catch {
    return 'عضو';
  }
};

export const getPayments = async (filter?: PaymentFilter): Promise<Payment[]> => {
  try {
    let query = supabase.from('payments').select('*').order('date', { ascending: false });
    if (filter?.groupId) {
      query = query.eq('groupId', filter.groupId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Payment[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل المدفوعات');
  }
};

export const addPayment = async (payment: Payment): Promise<Payment> => {
  try {
    const payload = withId(payment);
    const { data, error } = await supabase.from('payments').insert(payload).select().single();
    if (error) throw error;

    const fromName = await fetchUserName(payment.from);
    await NotificationService.addNotificationToUser(
      payment.to,
      `${fromName} أرسل لك ${payment.amount} ج.م - في انتظار تأكيدك`,
      NotificationType.PAYMENT_RECEIVED
    );

    return data as Payment;
  } catch (error) {
    throw createServiceError(error, 'تعذر إضافة المدفوعات');
  }
};

export const updatePayment = async (payment: Payment): Promise<boolean> => {
  try {
    const { error } = await supabase.from('payments').update(payment).eq('id', payment.id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث عملية الدفع');
  }
};

export const confirmPayment = async (paymentId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (error) throw error;

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: TransactionStatus.CONFIRMED,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    if (data) {
      const receiverName = await fetchUserName(data.to);
      await NotificationService.addNotificationToUser(
        data.from,
        `${receiverName} أكد استلام ${data.amount} ج.م`,
        NotificationType.PAYMENT_CONFIRMED
      );
    }

    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تأكيد عملية الدفع');
  }
};

export const rejectPayment = async (paymentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('payments')
      .update({ status: TransactionStatus.REJECTED })
      .eq('id', paymentId);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر رفض عملية الدفع');
  }
};
