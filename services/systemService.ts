import { supabase } from './supabaseClient';
import { applySavedTheme } from './themeService';

export const initializeApp = async () => {
  applySavedTheme();

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
  } catch {
    // Initial data check failed - non-critical, continue app initialization
  }
};
