import { supabase } from './supabaseClient';
import { Notification, NotificationType } from '../types';
import { createServiceError } from '../utils/errorHandler';

const getNotificationTitle = (type: NotificationType): string => {
  const titles: Record<NotificationType, string> = {
    [NotificationType.EXPENSE_ADDED]: 'مصروف جديد',
    [NotificationType.PAYMENT_RECEIVED]: 'استلمت مبلغ',
    [NotificationType.PAYMENT_CONFIRMED]: 'تأكيد الدفع',
    [NotificationType.DEBT_REMINDER]: 'تذكير بالدين',
    [NotificationType.BILL_DUE]: 'فاتورة قادمة',
    [NotificationType.NEW_MEMBER]: 'عضو جديد',
    [NotificationType.CHAT_MESSAGE]: 'رسالة جديدة'
  };
  return titles[type] || 'إشعار';
};

const buildNotification = (
  userId: string,
  message: string,
  type: NotificationType
): Notification => ({
  id: 'n' + Date.now() + Math.random().toString(36).slice(2, 9),
  userId,
  type,
  title: getNotificationTitle(type),
  message,
  read: false,
  date: Date.now()
});

export const getNotifications = async (userId?: string): Promise<Notification[]> => {
  try {
    let query = supabase.from('notifications').select('*').order('date', { ascending: false });
    if (userId) {
      query = query.eq('userId', userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Notification[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل الإشعارات');
  }
};

export const addNotificationToUser = async (
  userId: string,
  message: string,
  type: NotificationType
): Promise<void> => {
  try {
    const notification = buildNotification(userId, message, type);
    const { error } = await supabase.from('notifications').insert(notification);
    if (error) throw error;
  } catch (error) {
    throw createServiceError(error, 'تعذر إرسال الإشعار');
  }
};

export const addNotification = async (
  groupIdOrUserId: string,
  message: string,
  type: NotificationType = NotificationType.EXPENSE_ADDED
): Promise<void> => {
  try {
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, members')
      .eq('id', groupIdOrUserId)
      .maybeSingle();

    if (error) throw error;

    if (group?.members?.length) {
      const notifications = group.members.map((memberId: string) => buildNotification(memberId, message, type));
      const { error: insertError } = await supabase.from('notifications').insert(notifications);
      if (insertError) throw insertError;
      return;
    }

    await addNotificationToUser(groupIdOrUserId, message, type);
  } catch (error) {
    throw createServiceError(error, 'تعذر إرسال الإشعار');
  }
};

export const markNotificationAsRead = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث الإشعار');
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('userId', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث الإشعارات');
  }
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('read', false);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    throw createServiceError(error, 'تعذر حساب الإشعارات غير المقروءة');
  }
};
