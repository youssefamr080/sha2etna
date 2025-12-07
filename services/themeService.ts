const THEME_KEY = 'sha2etna_theme';

type ThemeMode = 'light' | 'dark';

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
};

export const getTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const setTheme = (mode: ThemeMode) => {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage not available (private mode, quota exceeded)
  }
  applyThemeToDocument(mode);
};

export const toggleTheme = (): ThemeMode => {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
};

export const applySavedTheme = () => {
  applyThemeToDocument(getTheme());
};
