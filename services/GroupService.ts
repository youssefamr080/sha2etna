import { Group, GroupMember, NotificationType } from '../types';
import { supabase } from './supabaseClient';
import { createServiceError } from '../utils/errorHandler';
import * as NotificationService from './NotificationService';
import * as UserService from './UserService';
import * as SettlementService from './SettlementService';

const generateGroupId = () => `g${Date.now()}`;
const generateMemberId = () => `gm${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const generateGroupCode = () => `SHA2-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

const fetchGroup = async (groupId: string): Promise<Group | null> => {
  const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (error) {
    throw error;
  }
  return data as Group;
};

export const getGroups = async (): Promise<Group[]> => {
  try {
    const { data, error } = await supabase.from('groups').select('*');
    if (error) throw error;
    return (data || []) as Group[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل المجموعات');
  }
};

export const getGroup = async (id?: string): Promise<Group> => {
  try {
    if (id) {
      const { data, error } = await supabase.from('groups').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Group;
    }

    const { data, error } = await supabase.from('groups').select('*').limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      throw createServiceError(new Error('لم يتم العثور على أي مجموعة'), 'فشل تحميل بيانات المجموعة');
    }
    return data as Group;
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل بيانات المجموعة');
  }
};

export const getGroupByCode = async (code: string): Promise<Group | null> => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data as Group;
  } catch (error) {
    throw createServiceError(error, 'لم يتم العثور على مجموعة بهذا الرمز');
  }
};

export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  try {
    const { data, error } = await supabase.from('group_members').select('*').eq('group_id', groupId);
    if (error) throw error;
    return (data || []) as GroupMember[];
  } catch (error) {
    throw createServiceError(error, 'فشل تحميل أعضاء المجموعة');
  }
};

export const getUserGroups = async (userId: string): Promise<Group[]> => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .contains('members', [userId]);

    if (error) throw error;
    return (data || []) as Group[];
  } catch (error) {
    throw createServiceError(error, 'فشل الحصول على مجموعات المستخدم');
  }
};

export const createGroup = async (
  name: string,
  createdBy: string,
  password?: string
): Promise<Group> => {
  try {
    const groupId = generateGroupId();
    const code = generateGroupCode();

    const newGroup = {
      id: groupId,
      name,
      code,
      password,
      members: [createdBy],
      created_by: createdBy,
      created_at: new Date().toISOString()
    } satisfies Partial<Group> & Record<string, unknown>;

    const { data, error } = await supabase.from('groups').insert(newGroup).select('*').single();
    if (error) throw error;

    await supabase.from('group_members').insert({
      id: generateMemberId(),
      group_id: groupId,
      user_id: createdBy,
      role: 'admin'
    });

    return data as Group;
  } catch (error) {
    throw createServiceError(error, 'تعذر إنشاء المجموعة');
  }
};

export const joinGroup = async (
  code: string,
  userId: string,
  password?: string
): Promise<{ success: boolean; message: string; group?: Group }> => {
  try {
    const { data, error } = await supabase.rpc('join_group_with_code', {
      p_code: code.trim().toUpperCase(),
      p_user_id: userId,
      p_password: password || null
    });

    if (error) {
      const message = error.message || '';

      if (message.includes('GROUP_NOT_FOUND')) {
        return { success: false, message: 'رمز المجموعة غير صحيح' };
      }

      if (message.includes('INVALID_PASSWORD')) {
        return { success: false, message: 'كلمة المرور غير صحيحة' };
      }

      if (message.includes('ALREADY_MEMBER')) {
        return { success: false, message: 'أنت عضو بالفعل في هذه المجموعة' };
      }

      throw error;
    }

    if (!data) {
      return { success: false, message: 'فشل الانضمام إلى المجموعة' };
    }

    const group = data as Group;

    try {
      const newMember = await UserService.getUserById(userId);
      await NotificationService.addNotification(
        group.id,
        `انضم ${newMember?.name || 'عضو جديد'} إلى المجموعة`,
        NotificationType.NEW_MEMBER
      );
    } catch {
      // Notification failure is non-critical, continue silently
    }

    return { success: true, message: 'تم الانضمام بنجاح', group };
  } catch (error) {
    throw createServiceError(error, 'فشل الانضمام إلى المجموعة');
  }
};

export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
  try {
    const group = await fetchGroup(groupId);
    if (!group) {
      return false;
    }

    const balances = await SettlementService.calculateGroupBalances(groupId);
    const memberBalance = balances.find(balance => balance.userId === userId);
    if (memberBalance && Math.abs(memberBalance.balance) > 0.01) {
      throw createServiceError(
        new Error('لا يمكن مغادرة المجموعة قبل تسوية الديون'),
        'تعذر مغادرة المجموعة'
      );
    }

    const updatedMembers = group.members.filter(memberId => memberId !== userId);
    const { error } = await supabase
      .from('groups')
      .update({ members: updatedMembers })
      .eq('id', groupId);

    if (error) throw error;

    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر مغادرة المجموعة');
  }
};

// ============================================================
// NEW: Transfer Group Ownership
// ============================================================
export const transferOwnership = async (
  groupId: string, 
  currentOwnerId: string, 
  newOwnerId: string
): Promise<boolean> => {
  try {
    const group = await fetchGroup(groupId);
    if (!group) {
      throw createServiceError(new Error('المجموعة غير موجودة'), 'نقل الملكية');
    }

    if (group.created_by !== currentOwnerId) {
      throw createServiceError(new Error('أنت لست مالك المجموعة'), 'نقل الملكية');
    }

    if (!group.members.includes(newOwnerId)) {
      throw createServiceError(new Error('المستخدم ليس عضواً في المجموعة'), 'نقل الملكية');
    }

    // Update group owner
    const { error: groupError } = await supabase
      .from('groups')
      .update({ created_by: newOwnerId })
      .eq('id', groupId);

    if (groupError) throw groupError;

    // Update roles in group_members
    await supabase
      .from('group_members')
      .update({ role: 'member' })
      .eq('group_id', groupId)
      .eq('user_id', currentOwnerId);

    await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', groupId)
      .eq('user_id', newOwnerId);

    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر نقل الملكية');
  }
};

// ============================================================
// NEW: Update Group Name
// ============================================================
export const updateGroupName = async (groupId: string, newName: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('groups')
      .update({ name: newName.trim() })
      .eq('id', groupId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر تحديث اسم المجموعة');
  }
};

// ============================================================
// NEW: Regenerate Invite Code
// ============================================================
export const regenerateInviteCode = async (groupId: string, userId: string): Promise<string> => {
  try {
    const group = await fetchGroup(groupId);
    if (!group) {
      throw createServiceError(new Error('المجموعة غير موجودة'), 'تجديد الكود');
    }

    if (group.created_by !== userId) {
      throw createServiceError(new Error('فقط مالك المجموعة يمكنه تجديد الكود'), 'تجديد الكود');
    }

    const newCode = generateGroupCode();
    const { error } = await supabase
      .from('groups')
      .update({ code: newCode })
      .eq('id', groupId);

    if (error) throw error;
    return newCode;
  } catch (error) {
    throw createServiceError(error, 'تعذر تجديد كود الدعوة');
  }
};

// ============================================================
// NEW: Remove Member from Group (Admin only)
// ============================================================
export const removeMember = async (
  groupId: string, 
  adminId: string, 
  memberId: string
): Promise<boolean> => {
  try {
    const group = await fetchGroup(groupId);
    if (!group) {
      throw createServiceError(new Error('المجموعة غير موجودة'), 'إزالة العضو');
    }

    if (group.created_by !== adminId) {
      throw createServiceError(new Error('فقط مالك المجموعة يمكنه إزالة الأعضاء'), 'إزالة العضو');
    }

    if (memberId === adminId) {
      throw createServiceError(new Error('لا يمكنك إزالة نفسك'), 'إزالة العضو');
    }

    // Check if member has outstanding balance
    const balances = await SettlementService.calculateGroupBalances(groupId);
    const memberBalance = balances.find(b => b.userId === memberId);
    if (memberBalance && Math.abs(memberBalance.balance) > 0.01) {
      throw createServiceError(
        new Error('لا يمكن إزالة عضو لديه ديون غير مسوّاة'),
        'إزالة العضو'
      );
    }

    const updatedMembers = group.members.filter(m => m !== memberId);
    const { error } = await supabase
      .from('groups')
      .update({ members: updatedMembers })
      .eq('id', groupId);

    if (error) throw error;

    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', memberId);

    // Notify the removed member
    const admin = await UserService.getUserById(adminId);
    await NotificationService.addNotificationToUser(
      memberId,
      `تمت إزالتك من مجموعة "${group.name}" بواسطة ${admin?.name || 'المسؤول'}`,
      NotificationType.NEW_MEMBER
    );

    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر إزالة العضو');
  }
};

// ============================================================
// NEW: Delete Group (Admin only)
// ============================================================
export const deleteGroup = async (groupId: string, adminId: string): Promise<boolean> => {
  try {
    const group = await fetchGroup(groupId);
    if (!group) {
      throw createServiceError(new Error('المجموعة غير موجودة'), 'حذف المجموعة');
    }

    if (group.created_by !== adminId) {
      throw createServiceError(new Error('فقط مالك المجموعة يمكنه حذفها'), 'حذف المجموعة');
    }

    // Check if any member has outstanding balance
    const balances = await SettlementService.calculateGroupBalances(groupId);
    const hasOutstandingDebts = balances.some(b => Math.abs(b.balance) > 0.01);
    if (hasOutstandingDebts) {
      throw createServiceError(
        new Error('لا يمكن حذف المجموعة وهناك ديون غير مسوّاة'),
        'حذف المجموعة'
      );
    }

    // Delete all related data with error handling
    const deleteOperations = [
      { table: 'group_members', filter: { column: 'group_id', value: groupId } },
      { table: 'expense_splits', filter: { column: 'expense_id', subquery: { table: 'expenses', column: 'groupId', value: groupId } } },
      { table: 'expenses', filter: { column: 'groupId', value: groupId } },
      { table: 'payments', filter: { column: 'groupId', value: groupId } },
      { table: 'bills', filter: { column: 'groupId', value: groupId } },
      { table: 'shopping_items', filter: { column: 'groupId', value: groupId } },
      { table: 'chat_messages', filter: { column: 'groupId', value: groupId } },
    ];

    for (const op of deleteOperations) {
      const { error } = await supabase.from(op.table).delete().eq(op.filter.column, op.filter.value || groupId);
      if (error) {
        console.error(`Failed to delete from ${op.table}:`, error);
        // Continue with other deletions even if one fails
      }
    }

    // Finally delete the group
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    if (error) throw error;

    return true;
  } catch (error) {
    throw createServiceError(error, 'تعذر حذف المجموعة');
  }
};

// ============================================================
// NEW: Check if user is group admin
// ============================================================
export const isGroupAdmin = async (groupId: string, userId: string): Promise<boolean> => {
  try {
    const group = await fetchGroup(groupId);
    return group?.created_by === userId;
  } catch {
    return false;
  }
};
