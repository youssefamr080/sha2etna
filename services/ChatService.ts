import { supabase } from './supabaseClient';
import { ChatMessage, PaginatedResult } from '../types';
import { createServiceError } from '../utils/errorHandler';

export interface GetChatMessagesParams {
  groupId: string;
  limit?: number;
  cursor?: number;
}

export type ChatMessagesPage = PaginatedResult<ChatMessage, number | null>;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export const getMessages = async ({
  groupId,
  limit = DEFAULT_LIMIT,
  cursor
}: GetChatMessagesParams): Promise<ChatMessagesPage> => {
  if (!groupId) {
    throw createServiceError(new Error('groupId is required'), 'تحميل رسائل المحادثة');
  }

  try {
    const normalizedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('groupId', groupId)
      .order('timestamp', { ascending: false })
      .limit(normalizedLimit + 1);

    if (cursor) {
      query = query.lt('timestamp', cursor);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > normalizedLimit;
    const trimmedDesc = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const nextCursor = hasMore ? trimmedDesc[trimmedDesc.length - 1]?.timestamp ?? null : null;
    const sorted = [...trimmedDesc].sort((a, b) => a.timestamp - b.timestamp);

    return {
      items: sorted as ChatMessage[],
      hasMore,
      nextCursor
    };
  } catch (error) {
    throw createServiceError(error, 'تحميل رسائل المحادثة');
  }
};

export interface SendMessageInput {
  groupId: string;
  userId: string;
  text: string;
  type?: ChatMessage['type'];
  id?: string;
  timestamp?: number;
}

export const sendMessage = async (input: SendMessageInput): Promise<ChatMessage> => {
  try {
    const payload: ChatMessage = {
      id: input.id ?? `chat_${Date.now()}`,
      groupId: input.groupId,
      userId: input.userId,
      text: input.text,
      type: input.type ?? 'text',
      timestamp: input.timestamp ?? Date.now()
    };

    const { data, error } = await supabase.from('chat_messages').insert(payload).select('*').single();
    if (error) throw error;
    return data as ChatMessage;
  } catch (error) {
    throw createServiceError(error, 'إرسال الرسالة');
  }
};

export const subscribeToMessages = (groupId: string, callback: (message: ChatMessage) => void) => {
  return supabase
    .channel(`chat:${groupId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `groupId=eq.${groupId}`
    }, payload => {
      callback(payload.new as ChatMessage);
    })
    .subscribe();
};
