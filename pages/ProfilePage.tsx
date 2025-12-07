import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../App';
import * as NotificationService from '../services/NotificationService';
import * as GroupService from '../services/GroupService';
import * as UserService from '../services/UserService';
import { Notification, Group, User } from '../types';
import { 
  LogOut, Bell, Settings, Users, Crown, Trash2, UserMinus, 
  RefreshCw, Edit3, Copy, Check, ChevronDown, ChevronUp,
  Link as LinkIcon, CreditCard, Share2
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';

const ProfilePage: React.FC = () => {
  const { currentUser, currentGroup, logout, refreshData } = useApp();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Group management state
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // InstaPay state
  const [instaPayLink, setInstaPayLink] = useState('');
  const [isEditingInstaPay, setIsEditingInstaPay] = useState(false);
  const [tempInstaPayLink, setTempInstaPayLink] = useState('');

  // Load InstaPay from localStorage (with try-catch for private browsing)
  useEffect(() => {
    if (currentUser) {
      try {
        const savedLink = localStorage.getItem(`instapay_${currentUser.id}`);
        if (savedLink) setInstaPayLink(savedLink);
      } catch {
        // localStorage not available in private browsing
      }
    }
  }, [currentUser]);

  const loadGroupData = useCallback(async () => {
    if (!currentGroup || !currentUser) return;
    
    try {
      const [groupData, memberIds] = await Promise.all([
        GroupService.getGroup(currentGroup.id),
        GroupService.getGroupMembers(currentGroup.id)
      ]);
      
      setGroup(groupData);
      setIsAdmin(groupData.created_by === currentUser.id);
      setNewGroupName(groupData.name);
      
      // Load member details
      const memberUsers = await Promise.all(
        memberIds.map(m => UserService.getUserById(m.user_id))
      );
      setMembers(memberUsers.filter(Boolean) as User[]);
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  }, [currentGroup, currentUser]);

  useEffect(() => {
    const loadNotifications = async () => {
      if(currentUser) {
          setIsLoading(true);
          try {
            const all = await NotificationService.getNotifications(currentUser.id);
            setNotifications(all);

            // Mark all as read after viewing
            const unreadIds = all.filter(n => !n.read).map(n => n.id);
            if (unreadIds.length > 0) {
              await NotificationService.markAllNotificationsAsRead(currentUser.id);
              // Update local state to reflect read status
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }
          } catch (error) {
            showToast(getErrorMessage(error), 'error');
          } finally {
            setIsLoading(false);
          }
      }
    };
    loadNotifications();
    loadGroupData();
  }, [currentUser, showToast, loadGroupData]);

  // Group Management Actions
  const handleUpdateGroupName = async () => {
    if (!group || !newGroupName.trim() || processing) return;
    
    setProcessing('name');
    try {
      await GroupService.updateGroupName(group.id, newGroupName.trim());
      showToast('تم تحديث اسم المجموعة', 'success');
      setIsEditingName(false);
      await loadGroupData();
      refreshData?.();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleRegenerateCode = async () => {
    if (!group || !currentUser || processing) return;
    
    setProcessing('code');
    try {
      const newCode = await GroupService.regenerateInviteCode(group.id, currentUser.id);
      showToast(`كود الدعوة الجديد: ${newCode}`, 'success');
      await loadGroupData();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleCopyCode = async () => {
    if (!group?.code) return;
    
    try {
      await navigator.clipboard.writeText(group.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showToast('فشل نسخ الكود', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!group || !currentUser || processing) return;
    
    if (!confirm(`هل تريد إزالة ${memberName} من المجموعة؟`)) return;
    
    setProcessing(memberId);
    try {
      await GroupService.removeMember(group.id, currentUser.id, memberId);
      showToast(`تمت إزالة ${memberName}`, 'success');
      await loadGroupData();
      refreshData?.();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleTransferOwnership = async (memberId: string, memberName: string) => {
    if (!group || !currentUser || processing) return;
    
    if (!confirm(`هل تريد نقل ملكية المجموعة إلى ${memberName}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    
    setProcessing(memberId);
    try {
      await GroupService.transferOwnership(group.id, currentUser.id, memberId);
      showToast(`تم نقل الملكية إلى ${memberName}`, 'success');
      await loadGroupData();
      refreshData?.();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || !currentUser || processing) return;
    
    const confirmText = prompt('اكتب اسم المجموعة للتأكيد على الحذف:');
    if (confirmText !== group.name) {
      showToast('اسم المجموعة غير مطابق', 'error');
      return;
    }
    
    setProcessing('delete');
    try {
      await GroupService.deleteGroup(group.id, currentUser.id);
      showToast('تم حذف المجموعة', 'success');
      // Redirect or refresh
      window.location.reload();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group || !currentUser || processing) return;
    
    if (!confirm('هل تريد مغادرة المجموعة؟')) return;
    
    setProcessing('leave');
    try {
      await GroupService.leaveGroup(group.id, currentUser.id);
      showToast('تم مغادرة المجموعة', 'success');
      window.location.reload();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setProcessing(null);
    }
  };

  // InstaPay Actions
  const handleSaveInstaPay = () => {
    if (!currentUser) return;
    
    try {
      localStorage.setItem(`instapay_${currentUser.id}`, tempInstaPayLink);
      setInstaPayLink(tempInstaPayLink);
      setIsEditingInstaPay(false);
      showToast('تم حفظ رابط InstaPay', 'success');
    } catch {
      showToast('فشل حفظ الرابط', 'error');
    }
  };

  const handleShareInstaPay = async () => {
    if (!instaPayLink) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'رابط InstaPay',
          text: 'حوّلي على InstaPay',
          url: instaPayLink
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(instaPayLink);
      showToast('تم نسخ الرابط', 'success');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="p-5 min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">الملف الشخصي</h1>

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center mb-6">
            <img src={currentUser.avatar} alt="Me" className="w-24 h-24 rounded-full mb-4 border-4 border-gray-50 dark:border-gray-700" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentUser.name}</h2>
            <p className="text-gray-500 dark:text-gray-400">{currentUser.email}</p>
            
            <button 
                onClick={logout}
                className="mt-6 flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-full text-sm font-medium"
            >
                <LogOut size={16} /> تسجيل خروج
            </button>
        </div>

        {/* InstaPay Section */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <CreditCard size={20} className="text-green-500" /> InstaPay
            </h3>
            {!isEditingInstaPay && (
              <button
                onClick={() => {
                  setTempInstaPayLink(instaPayLink);
                  setIsEditingInstaPay(true);
                }}
                className="text-primary text-sm"
              >
                {instaPayLink ? 'تعديل' : 'إضافة'}
              </button>
            )}
          </div>

          {isEditingInstaPay ? (
            <div className="space-y-3">
              <input
                type="url"
                value={tempInstaPayLink}
                onChange={(e) => setTempInstaPayLink(e.target.value)}
                placeholder="https://ipn.eg/S/username/instapay/..."
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm"
                dir="ltr"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveInstaPay}
                  className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-medium"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setIsEditingInstaPay(false)}
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-xl text-sm font-medium"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : instaPayLink ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-700 p-3 rounded-xl text-xs text-gray-600 dark:text-gray-400 truncate" dir="ltr">
                {instaPayLink}
              </div>
              <button
                onClick={handleShareInstaPay}
                className="p-2 bg-green-500 text-white rounded-xl"
              >
                <Share2 size={18} />
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">أضف رابط InstaPay لتسهيل استلام المدفوعات</p>
          )}
        </div>

        {/* Group Management Section */}
        {group && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 overflow-hidden">
            <button
              onClick={() => setShowGroupSettings(!showGroupSettings)}
              className="w-full p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                <span className="font-bold text-slate-800 dark:text-white">إدارة المجموعة</span>
              </div>
              {showGroupSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showGroupSettings && (
              <div className="p-4 pt-0 space-y-4">
                {/* Group Name */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">اسم المجموعة</label>
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="flex-1 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm"
                      />
                      <button
                        onClick={handleUpdateGroupName}
                        disabled={!!processing}
                        className="px-3 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {processing === 'name' ? '...' : 'حفظ'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setNewGroupName(group.name);
                        }}
                        className="px-3 bg-gray-200 dark:bg-gray-600 rounded-lg text-sm"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <span className="text-slate-800 dark:text-white">{group.name}</span>
                      {isAdmin && (
                        <button onClick={() => setIsEditingName(true)} className="text-primary">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Invite Code */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">كود الدعوة</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg font-mono text-center text-lg tracking-widest text-primary">
                      {group.code}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className={`p-3 rounded-lg ${codeCopied ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
                    >
                      {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleRegenerateCode}
                        disabled={!!processing}
                        className="p-3 bg-orange-500 text-white rounded-lg disabled:opacity-50"
                      >
                        {processing === 'code' ? '...' : <RefreshCw size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div>
                  <label className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <Users size={14} /> الأعضاء ({members.length})
                  </label>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium text-slate-800 dark:text-white">
                                {member.name}
                              </span>
                              {group.created_by === member.id && (
                                <Crown size={14} className="text-yellow-500" />
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{member.email}</span>
                          </div>
                        </div>

                        {isAdmin && member.id !== currentUser.id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleTransferOwnership(member.id, member.name)}
                              disabled={!!processing}
                              className="p-2 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg disabled:opacity-50"
                              title="نقل الملكية"
                            >
                              {processing === member.id ? '...' : <Crown size={16} />}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              disabled={!!processing}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                              title="إزالة"
                            >
                              <UserMinus size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2">
                  {!isAdmin && (
                    <button
                      onClick={handleLeaveGroup}
                      disabled={!!processing}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl font-medium disabled:opacity-50"
                    >
                      <LogOut size={18} />
                      {processing === 'leave' ? 'جاري المغادرة...' : 'مغادرة المجموعة'}
                    </button>
                  )}
                  
                  {isAdmin && (
                    <button
                      onClick={handleDeleteGroup}
                      disabled={!!processing}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl font-medium disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                      {processing === 'delete' ? 'جاري الحذف...' : 'حذف المجموعة'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Bell size={20} className="text-primary" /> التنبيهات
            </h3>
            <div className="space-y-3">
                {isLoading && (
                  <>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-20" />
                    ))}
                  </>
                )}
                {!isLoading && notifications.map(n => (
                    <div key={n.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                        {!n.read && <div className="absolute top-0 right-0 w-1 h-full bg-primary"></div>}
                        <h4 className="font-bold text-sm text-gray-800 dark:text-white">{n.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                        <span className="text-[10px] text-gray-400 mt-2 block">{new Date(n.date).toLocaleDateString('ar-EG')}</span>
                    </div>
                ))}
                {!isLoading && notifications.length === 0 && <p className="text-gray-400 text-sm">لا توجد تنبيهات جديدة.</p>}
            </div>
        </div>
    </div>
  );
};

export default ProfilePage;