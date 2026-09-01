export const supportedLocales = ['ja', 'en', 'zh-CN'] as const;
export type SupportedLocale = typeof supportedLocales[number];
export const localeStorageKey = 'twst-language';

export function normalizeLocale(value: unknown): SupportedLocale | undefined {
  const locale = String(value ?? '').toLowerCase().replace(/_/g, '-');
  if (locale === 'ja' || locale.startsWith('ja-')) return 'ja';
  if (locale === 'en' || locale.startsWith('en-')) return 'en';
  // Traditional Chinese is not yet translated; do not label it as Simplified Chinese.
  if (['zh', 'zh-cn', 'zh-sg'].includes(locale) || locale === 'zh-hans' || locale.startsWith('zh-hans-')) return 'zh-CN';
  return undefined;
}

export function getSavedLocale(): SupportedLocale {
  try {
    return normalizeLocale(localStorage.getItem(localeStorageKey)) ?? 'ja';
  } catch {
    return 'ja';
  }
}

export function saveLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(localeStorageKey, locale);
  } catch {
    // Language switching still works when browser storage is unavailable.
  }
}
