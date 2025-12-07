import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { User } from '../types';
import { createServiceError } from '../utils/errorHandler';

let cachedProfile: User | null = null;

const fetchProfileById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  cachedProfile = data;
  return cachedProfile;
};
const waitForProfile = async (id: string, attempts = 10, delayMs = 500): Promise<User | null> => {
  for (let i = 0; i < attempts; i += 1) {
    const profile = await fetchProfileById(id);
    if (profile) return profile;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
};

export const getCachedProfile = (): User | null => cachedProfile;
export const setCachedProfile = (profile: User | null) => {
  cachedProfile = profile;
};

export const refreshCurrentProfile = async (): Promise<User | null> => {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    cachedProfile = null;
    return null;
  }

  return fetchProfileById(user.id);
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw createServiceError(error, 'تسجيل الدخول');
  }

  const profile = await refreshCurrentProfile();
  if (!profile) {
    throw createServiceError(new Error('لم يتم العثور على الملف الشخصي'), 'تسجيل الدخول');
  }
  return profile;
};

export const signUpWithEmail = async (
  name: string,
  email: string,
  password: string,
  phone?: string
): Promise<User> => {
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        avatar
      }
    }
  });
  if (error) {
    throw createServiceError(error, 'إنشاء حساب');
  }

  const userId = data.user?.id;
  if (!userId) {
    throw createServiceError(new Error('فشل إنشاء الحساب'), 'إنشاء حساب');
  }

  // Profile row is inserted by the database trigger; wait for it
  let profile = await waitForProfile(userId);

  // Fallback: if trigger didn't fire (e.g., race condition), insert profile manually
  if (!profile) {
    const { data: upserted, error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: userId, name, email, phone, avatar })
      .select()
      .single();

    if (upsertError || !upserted) {
      throw createServiceError(upsertError || new Error('فشل إنشاء الملف الشخصي'), 'إنشاء الملف الشخصي');
    }
    profile = upserted as User;
  }

  cachedProfile = profile;
  return profile;
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
  cachedProfile = null;
};

export const getSession = async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
};

export const initializeAuthListener = (
  callback: (params: { event: AuthChangeEvent; session: Session | null; profile: User | null }) => void
) => {
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) {
      cachedProfile = null;
      callback({ event, session, profile: null });
      return;
    }

    const profile = await fetchProfileById(session.user.id);
    callback({ event, session, profile });
  });

  return () => data.subscription.unsubscribe();
};
