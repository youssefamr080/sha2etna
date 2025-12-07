import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../App';
import * as ChatService from '../services/ChatService';
import * as GeminiService from '../services/geminiService';
import * as HapticService from '../services/hapticService';
import { ChatMessage } from '../types';
import { Send, Mic, Square, Loader2, MessageCircle } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';
import { useToast } from '../contexts/ToastContext';

const ChatPage: React.FC = () => {
  const { currentUser, group, users } = useApp();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  
  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const loadMessages = useCallback(
    async (reset = false) => {
      if (!group?.id || loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const { items, hasMore: more, nextCursor } = await ChatService.getMessages({
          groupId: group.id,
          limit: 30,
          cursor: reset ? undefined : cursorRef.current ?? undefined
        });

        setMessages(prev => {
          const merged = reset ? items : [...items, ...prev];
          const map = new Map<string, ChatMessage>();
          merged.forEach(msg => map.set(msg.id, msg));
          return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
        setHasMore(more);
        setCursor(nextCursor ?? null);
        cursorRef.current = nextCursor ?? null;
        autoScrollRef.current = reset;
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [group?.id]
  );

  useEffect(() => {
    if (!group?.id) return;
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    loadMessages(true);
  }, [group?.id, loadMessages]);

  useEffect(() => {
    if (!group?.id) return;
    const subscription = ChatService.subscribeToMessages(group.id, message => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        autoScrollRef.current = true;
        return [...prev, message].sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [group?.id]);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      autoScrollRef.current = false;
    }
  }, [messages]);

  const [isSending, setIsSending] = useState(false);
  
  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !group.id || isSending) return;

    const messageText = inputText.trim();
    setInputText(''); // Clear immediately for better UX
    setIsSending(true);
    HapticService.lightTap();
    
    try {
      const created = await ChatService.sendMessage({
        groupId: group.id,
        userId: currentUser.id,
        text: messageText
      });

      setMessages(prev => {
        if (prev.some(msg => msg.id === created.id)) {
          return prev;
        }
        autoScrollRef.current = true;
        return [...prev, created].sort((a, b) => a.timestamp - b.timestamp);
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setInputText(messageText); // Restore text on error
      HapticService.errorFeedback();
    } finally {
      setIsSending(false);
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
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            setIsProcessing(true);
            const text = await GeminiService.transcribeAudio(base64Data);
            setInputText(prev => (prev ? prev + ' ' + text : text));
            setIsProcessing(false);
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

  return (
    <div className="flex flex-col min-h-[100svh] bg-gray-50 dark:bg-gray-900" dir="rtl">
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800 dark:text-white">محادثة {group.name}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">{group.members.length} أعضاء</p>
      </div>

      {errorMessage && (
        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={() => loadMessages(false)}
              disabled={isLoading}
              className="text-xs text-primary font-semibold py-1 px-3 border border-primary/40 rounded-full"
            >
              {isLoading ? 'جاري التحميل...' : 'تحميل رسائل أقدم'}
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 && (
          <div className="space-y-3" aria-live="polite">
            {[1, 2, 3].map(idx => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-11/12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <MessageCircle size={24} />
            </div>
            <p className="font-semibold">ابدأ المحادثة الآن</p>
            <p className="text-sm mt-1">أرسل أول رسالة لأعضاء الشقة</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.userId === currentUser?.id;
          const sender = users.find(u => u.id === msg.userId);

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <img
                  src={sender?.avatar}
                  alt={sender?.name}
                  className="w-8 h-8 rounded-full self-end object-cover"
                />
              )}
              <div
                className={`max-w-[75%] p-3 rounded-2xl ${
                  isMe
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                }`}
              >
                {!isMe && (
                  <p className="text-[10px] font-bold text-gray-400 mb-1">{sender?.name || 'عضو'}</p>
                )}
                <p className="text-sm break-words">{msg.text}</p>
                <p className={`text-[9px] mt-1 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div
        className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2 items-center"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSending}
            className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isRecording 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            } disabled:opacity-50`}
        >
             {isProcessing ? <Loader2 className="animate-spin" size={20} /> : (isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />)}
        </button>
        <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
            placeholder="اكتب رسالة..."
            disabled={isSending}
            className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <button 
            onClick={handleSend}
            disabled={isProcessing || isSending || !inputText.trim()}
            className="bg-primary text-white p-3 rounded-full hover:bg-emerald-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} 
        </button>
      </div>
    </div>
  );
};

export default ChatPage;