import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import * as ExpenseService from '../services/ExpenseService';
import * as HapticService from '../services/hapticService';
import { ExpenseCategory, ExpenseCursor, ExpenseWithSplits } from '../types';
import { Plus, Camera, Loader2, X, Mic, Square, Edit3, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';
import { useToast } from '../contexts/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { translateCategory } from '../utils/categoryUtils';
import { useSuccessCheckmark } from '../components/ui/SuccessCheckmark';

// Lazy load GeminiService to reduce initial bundle size (saves ~220KB)
const loadGeminiService = () => import('../services/geminiService');

const PAGE_SIZE = 20;

const ExpensesPage: React.FC = () => {
  const { currentUser, group, users } = useApp();
  const { showToast } = useToast();
  const { showSuccess, SuccessCheckmarkComponent } = useSuccessCheckmark();
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<ExpenseCursor | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<ExpenseCursor | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const loadExpenses = useCallback(
    async (reset = false) => {
      if (!group?.id || loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const { items, hasMore: more, nextCursor } = await ExpenseService.getExpenses({
          groupId: group.id,
          limit: PAGE_SIZE,
          cursor: reset ? undefined : cursorRef.current ?? undefined
        });

        setExpenses(prev => (reset ? items : [...prev, ...items]));
        setHasMore(more);
        setCursor(nextCursor ?? null);
        cursorRef.current = nextCursor ?? null;
      } catch (error) {
        const message = getErrorMessage(error);
        setErrorMessage(message);
        showToast(message, 'error');
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [group?.id, showToast]
  );

  useEffect(() => {
    if (!group?.id) return;
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    loadExpenses(true);
  }, [group?.id, loadExpenses]);

  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.GROCERIES);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingExpense, setEditingExpense] = useState<ExpenseWithSplits | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (group?.members?.length) {
      setSelectedParticipants(group.members);
    }
  }, [group?.members]);

  const resetModal = () => {
    setAmount('');
    setDescription('');
    setCategory(ExpenseCategory.GROCERIES);
    setSelectedParticipants(group?.members || []);
    setEditingExpense(null);
    setModalMode('create');
    setIsProcessing(false);
    setIsSaving(false);
  };

  const openCreateModal = () => {
    resetModal();
    setIsModalOpen(true);
  };

  const openEditModal = (expense: ExpenseWithSplits) => {
    setModalMode('edit');
    setEditingExpense(expense);
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setCategory(expense.category);
    setSelectedParticipants(
      expense.splitBetween?.length ? expense.splitBetween : group?.members || []
    );
    setIsModalOpen(true);
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !amount || !group?.id) return;

    const participants = (selectedParticipants.length ? selectedParticipants : group.members) || [];
    if (participants.length === 0) {
      const message = 'اختر مشاركاً واحداً على الأقل';
      setErrorMessage(message);
      showToast(message, 'error');
      return;
    }

    const payload = {
      amount: parseFloat(amount),
      description: description || 'بدون وصف',
      category,
      participants: Array.from(new Set([...participants, currentUser.id]))
    };

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await ExpenseService.addExpense({
          id: Date.now().toString(),
          groupId: group.id,
          payerId: currentUser.id,
          date: new Date().toISOString(),
          ...payload
        });
        HapticService.successFeedback();
        showSuccess('تمت إضافة المصروف');
        showToast('تمت إضافة المصروف بنجاح', 'success');
      } else if (editingExpense) {
        await ExpenseService.updateExpense({
          id: editingExpense.id,
          ...payload,
          participants: Array.from(new Set(participants))
        });
        HapticService.mediumTap();
        showToast('تم تحديث المصروف', 'success');
      }

      await loadExpenses(true);
      setIsModalOpen(false);
      resetModal();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteExpense = async (expense: ExpenseWithSplits) => {
    try {
      await ExpenseService.deleteExpense(expense.id);
      setExpenses(prev => prev.filter(e => e.id !== expense.id));
      showToast('تم حذف المصروف', 'success');
      setDeleteConfirmId(null);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      showToast(message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          // Dynamic import - only loads when needed
          const GeminiService = await loadGeminiService();
          const data = await GeminiService.scanReceipt(base64Data);
          if (data) {
            setAmount(data.amount.toString());
            setDescription(`${data.vendor} - ${data.category}`);
            if(Object.values(ExpenseCategory).includes(data.category as ExpenseCategory)) {
               setCategory(data.category as ExpenseCategory);
            } else {
               setCategory(ExpenseCategory.OTHER);
            }
          } else {
              showToast('تعذر استخراج البيانات. الرجاء الإدخال يدوياً.', 'error');
          }
        } catch {
          showToast('حدث خطأ أثناء تحليل الفاتورة', 'error');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        showToast('تعذر قراءة الملف', 'error');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('المتصفح لا يدعم تسجيل الصوت.', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
              const base64String = reader.result as string;
              const base64Data = base64String.split(',')[1];
              setIsProcessing(true);
              // Dynamic import - only loads when needed
              const GeminiService = await loadGeminiService();
              const text = await GeminiService.transcribeAudio(base64Data);
              if (text) {
                setDescription(prev => (prev ? prev + ' ' + text : text));
              }
            } catch {
              showToast('حدث خطأ أثناء تحويل الصوت', 'error');
            } finally {
              setIsProcessing(false);
            }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'NotFoundError' || error.message?.includes('device not found')) {
        showToast('لم يتم العثور على ميكروفون. الرجاء التأكد من توصيل الميكروفون.', 'error');
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showToast('الرجاء السماح بصلاحيات الميكروفون في إعدادات المتصفح.', 'error');
      } else {
        showToast('حدث خطأ أثناء الوصول للميكروفون.', 'error');
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const getPayerName = (id: string) => users.find(u => u.id === id)?.name || 'غير معروف';

  const sortedExpenses = expenses
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isInitialLoading = isLoading && expenses.length === 0;

  return (
    <div className="p-5 min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <SuccessCheckmarkComponent />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">المصاريف المشتركة</h1>
        <button 
          onClick={openCreateModal}
          className="bg-primary hover:bg-emerald-700 text-white rounded-full p-3 shadow-lg transition-transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        {isInitialLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28" />
            ))}
          </div>
        )}

        {!isInitialLoading && sortedExpenses.map(exp => (
          <div key={exp.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">{exp.description}</h3>
                    <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full mt-1">
                        {translateCategory(exp.category)}
                    </span>
                </div>
                <div className="text-left">
                    <span className="block font-bold text-lg text-primary">{exp.amount}</span>
                    <span className="text-[10px] text-gray-400">ج.م</span>
                </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => openEditModal(exp)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200"
              >
                <Edit3 size={14} /> تعديل
              </button>
              {deleteConfirmId === exp.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDeleteExpense(exp)}
                    className="text-xs px-2 py-1 rounded-full bg-red-500 text-white"
                  >
                    تأكيد
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(exp.id)}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                >
                  <Trash2 size={14} /> حذف
                </button>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-50 dark:border-gray-700 mt-2">
                <div className="flex items-center gap-1">
                    <span>دفع بواسطة</span>
                    <strong className="text-slate-700 dark:text-gray-200">{getPayerName(exp.payerId)}</strong>
                </div>
                <div>
                    {new Date(exp.date).toLocaleDateString('ar-EG')}
                </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && expenses.length === 0 && (
        <EmptyState
          className="mt-8"
          icon="🧾"
          title="لا توجد مصروفات بعد"
          subtitle="استخدم زر + لإضافة المصروفات ومشاركة التفاصيل مع مجموعتك."
        />
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => loadExpenses(false)}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-full hover:bg-primary/10 disabled:opacity-60"
          >
            {isLoading ? 'جاري التحميل...' : 'تحميل المزيد'}
          </button>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm modal-backdrop" onClick={(e) => e.target === e.currentTarget && (setIsModalOpen(false), resetModal())}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom-10 modal-content flex flex-col" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}>
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-bold dark:text-white">{modalMode === 'create' ? 'إضافة مصروف' : 'تعديل المصروف'}</h2>
              <button onClick={() => { setIsModalOpen(false); resetModal(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={24} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
            {/* AI Action */}
            <div className="mb-6">
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full py-3 border-2 border-dashed border-primary/30 bg-primary/5 dark:bg-primary/10 rounded-xl text-primary font-medium flex items-center justify-center gap-2 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Camera size={20} />}
                    {isProcessing ? "جاري التحليل..." : "مسح الفاتورة بالذكاء الاصطناعي"}
                </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ</label>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)}
                        className="w-full border dark:border-gray-600 rounded-lg p-3 text-lg font-bold focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
                        placeholder="0.00"
                        required 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوصف</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)}
                            className="w-full border dark:border-gray-600 rounded-lg p-3 pl-12 focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
                            placeholder="عبارة عن إيش؟"
                            required
                        />
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isRecording ? 'bg-red-100 text-red-500 animate-pulse' : 'text-gray-400 hover:text-primary'}`}
                        >
                            {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">التصنيف</label>
                    <select 
                        value={category}
                        onChange={e => setCategory(e.target.value as ExpenseCategory)}
                        className="w-full border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        {Object.values(ExpenseCategory).map(cat => (
                            <option key={cat} value={cat}>{translateCategory(cat)}</option>
                        ))}
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المشاركون</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 dark:border-gray-600">
                    {(group?.members || []).map(memberId => {
                      const member = users.find(u => u.id === memberId);
                      return (
                        <label key={memberId} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(memberId)}
                            onChange={() => toggleParticipant(memberId)}
                            className="rounded text-primary"
                          />
                          <span>{member?.name || 'عضو'}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isProcessing || isSaving}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-md hover:bg-emerald-700 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {modalMode === 'create' ? 'حفظ المصروف' : 'تحديث المصروف'}
                </button>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;