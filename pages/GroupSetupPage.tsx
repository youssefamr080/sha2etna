import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Key, Lock, ArrowRight, Loader2, Copy, Check } from 'lucide-react';
import * as GroupService from '../services/GroupService';
import { useApp } from '../App';
import { useToast } from '../contexts/ToastContext';
import type { Group } from '../types';

const GroupSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setGroup: updateGroup, refreshData } = useApp();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  // Create group fields
  const [groupName, setGroupName] = useState('');
  const [groupPassword, setGroupPassword] = useState('');
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  // Join group fields
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const screenBaseClass = 'min-h-[100svh] bg-gradient-to-br from-secondary via-slate-900 to-secondary flex flex-col items-center px-6 py-10 overflow-y-auto lg:justify-center';
  const safeAreaStyle: React.CSSProperties = { paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const group = await GroupService.createGroup(groupName, currentUser.id, groupPassword || undefined);
      if (group) {
        setCreatedGroup(group);
        setSuccess('تم إنشاء المجموعة بنجاح!');
        showToast('تم إنشاء المجموعة بنجاح!', 'success');
      } else {
        const message = 'حدث خطأ أثناء إنشاء المجموعة';
        setError(message);
        showToast(message, 'error');
      }
    } catch (err) {
      const message = 'حدث خطأ. حاول مرة أخرى';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await GroupService.joinGroup(joinCode.toUpperCase(), currentUser.id, joinPassword || undefined);
      if (result.success && result.group) {
        updateGroup(result.group);
        await refreshData();
        setSuccess('تم الانضمام بنجاح!');
        showToast('تم الانضمام بنجاح!', 'success');
        setTimeout(() => navigate('/'), 1500);
      } else {
        const failureMessage = result.message || 'تعذر الانضمام للمجموعة. تحقق من البيانات وحاول مجدداً.';
        setError(failureMessage);
        showToast(failureMessage, 'error');
      }
    } catch (err) {
      const message = 'حدث خطأ. حاول مرة أخرى';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (createdGroup?.code) {
      try {
        await navigator.clipboard.writeText(createdGroup.code);
        setCopied(true);
        showToast('تم نسخ رمز الدعوة', 'success');
        setTimeout(() => setCopied(false), 2000);
      } catch (copyError) {
        showToast('تعذر نسخ الكود، انسخه يدوياً', 'error');
      }
    }
  };

  const goToHome = async () => {
    if (createdGroup) {
      updateGroup(createdGroup);
      await refreshData();
    }
    navigate('/');
  };

  if (mode === 'choice') {
    return (
      <div className={screenBaseClass} style={safeAreaStyle} dir="rtl">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="text-primary" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">مرحباً {currentUser?.name}!</h1>
          <p className="text-gray-400">ابدأ بإنشاء مجموعة جديدة أو انضم لمجموعة موجودة</p>
        </div>

        <div className="w-full max-w-md space-y-4 mt-10">
          <button
            onClick={() => setMode('create')}
            className="w-full bg-primary hover:bg-emerald-600 text-white rounded-2xl p-6 flex items-center gap-4 transition-all shadow-lg"
          >
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Plus size={28} />
            </div>
            <div className="text-right flex-1">
              <h3 className="font-bold text-lg">إنشاء شقة جديدة</h3>
              <p className="text-emerald-100 text-sm">أنشئ مجموعة وادعُ زملاءك</p>
            </div>
            <ArrowRight />
          </button>

          <button
            onClick={() => setMode('join')}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl p-6 flex items-center gap-4 transition-all"
          >
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
              <Key size={28} />
            </div>
            <div className="text-right flex-1">
              <h3 className="font-bold text-lg">انضم لشقة موجودة</h3>
              <p className="text-gray-400 text-sm">لديك رمز دعوة؟ انضم الآن</p>
            </div>
            <ArrowRight />
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className={screenBaseClass} style={safeAreaStyle} dir="rtl">
        <div className="w-full max-w-md">
          <button
            onClick={() => { setMode('choice'); setCreatedGroup(null); setSuccess(''); }}
            className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
          >
            <ArrowRight className="rotate-180" size={20} />
            رجوع
          </button>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="text-primary" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">إنشاء شقة جديدة</h2>
            </div>

            {!createdGroup ? (
              <form onSubmit={handleCreateGroup} className="space-y-5">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">اسم الشقة / المجموعة</label>
                  <input
                    type="text"
                    placeholder="مثال: شقة وسط البلد"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-2">كلمة مرور (اختياري)</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      placeholder="للحماية الإضافية"
                      value={groupPassword}
                      onChange={(e) => setGroupPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-2">اترك فارغاً للسماح بالانضمام بالرمز فقط</p>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : 'إنشاء المجموعة'}
                </button>
              </form>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="text-green-500" size={40} />
                </div>
                <p className="text-green-400 text-lg mb-6">{success}</p>
                
                <div className="bg-white/5 rounded-xl p-6 mb-6">
                  <p className="text-gray-400 text-sm mb-2">رمز الدعوة</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-bold text-primary tracking-wider">{createdGroup.code}</span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} className="text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-3">شارك هذا الرمز مع زملائك للانضمام</p>
                </div>

                <button
                  onClick={() => { void goToHome(); }}
                  className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
                >
                  الذهاب للرئيسية
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Join mode
  return (
    <div className={screenBaseClass} style={safeAreaStyle} dir="rtl">
      <div className="w-full max-w-md">
        <button
          onClick={() => { setMode('choice'); setError(''); setSuccess(''); }}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          <ArrowRight className="rotate-180" size={20} />
          رجوع
        </button>

        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="text-blue-400" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">انضم لشقة موجودة</h2>
          </div>

          <form onSubmit={handleJoinGroup} className="space-y-5">
            <div>
              <label className="block text-gray-300 text-sm mb-2">رمز الدعوة</label>
              <input
                type="text"
                placeholder="مثال: SHA2-XXXX"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary text-center text-xl tracking-widest font-mono"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">كلمة المرور (إن وجدت)</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  placeholder="اتركها فارغة إن لم تكن مطلوبة"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 text-green-300 text-sm text-center">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'انضمام'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GroupSetupPage;
