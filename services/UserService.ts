import { supabase } from './supabaseClient';
import { User } from '../types';
import { createServiceError } from '../utils/errorHandler';

export const getUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || []) as User[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل المستخدمين');
  }
};

export const getUserById = async (id: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data as User;
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل بيانات المستخدم');
  }
};

export const updateUser = async (id: string, updates: Partial<User>): Promise<boolean> => {
  try {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث ملف المستخدم');
  }
};
