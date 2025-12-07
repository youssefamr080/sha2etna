import { ShoppingItem } from '../types';
import { supabase } from './supabaseClient';
import { createServiceError } from '../utils/errorHandler';

export const getShoppingList = async (groupId?: string): Promise<ShoppingItem[]> => {
  try {
    let query = supabase.from('shopping_items').select('*').order('created_at', { ascending: false });
    if (groupId) {
      query = query.eq('groupId', groupId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ShoppingItem[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل قائمة التسوق');
  }
};

export const addShoppingItem = async (item: ShoppingItem): Promise<ShoppingItem> => {
  try {
    const payload = { ...item, id: item.id || `item_${Date.now()}` };
    const { data, error } = await supabase.from('shopping_items').insert(payload).select('*').single();
    if (error) throw error;
    return data as ShoppingItem;
  } catch (error) {
    throw createServiceError(error, 'تعذر إضافة عنصر التسوق');
  }
};

export const updateShoppingItem = async (id: string, updates: Partial<ShoppingItem>): Promise<boolean> => {
  try {
    const { error } = await supabase.from('shopping_items').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث عنصر التسوق');
  }
};

export const toggleShoppingItem = async (
  id: string,
  completed: boolean,
  completedBy?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shopping_items')
      .update({ completed, completedBy })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث حالة عنصر التسوق');
  }
};

export const deleteShoppingItem = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر حذف عنصر التسوق');
  }
};

export const updateShoppingList = async (items: ShoppingItem[]): Promise<boolean> => {
  if (items.length === 0) {
    return true;
  }

  try {
    const groupId = items[0].groupId;
    if (!groupId) {
      throw createServiceError(new Error('groupId is required'), 'تحديث قائمة التسوق');
    }

    // Use upsert instead of delete+insert to prevent data loss
    const { error } = await supabase
      .from('shopping_items')
      .upsert(items, { onConflict: 'id' });
    
    if (error) throw error;

    return true;
  } catch (error) {
    throw createServiceError(error, 'تحديث قائمة التسوق');
  }
};
