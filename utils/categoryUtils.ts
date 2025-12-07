export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Rent': 'إيجار',
  'Utilities': 'فواتير',
  'Groceries': 'مقاضي',
  'Internet': 'إنترنت',
  'Electricity': 'كهرباء',
  'Water': 'مياه',
  'Gas': 'غاز',
  'Entertainment': 'ترفيه',
  'Food': 'طعام',
  'Transportation': 'مواصلات',
  'Maintenance': 'صيانة',
  'Other': 'أخرى'
};

export const CATEGORY_TRANSLATIONS_FULL: Record<string, string> = {
  'Rent': 'الإيجار',
  'Utilities': 'الفواتير',
  'Groceries': 'المقاضي',
  'Internet': 'الإنترنت',
  'Entertainment': 'الترفيه',
  'Other': 'أخرى'
};

export const translateCategory = (cat: string): string => {
  return CATEGORY_TRANSLATIONS[cat] || cat;
};

export const translateCategoryFull = (cat: string): string => {
  return CATEGORY_TRANSLATIONS_FULL[cat] || cat;
};
