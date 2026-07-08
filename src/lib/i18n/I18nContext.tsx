import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Lang } from '@/types/i18n';
import { translate, type TKey } from './translations';

const STORAGE_KEY = 'logvibe.lang';

export type TFunc = (key: TKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Remembered choice, else the browser's preference, else English. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'de') return saved;
  } catch {
    // storage unavailable — fall through to navigator
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('de')
    ? 'de'
    : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — keep the in-memory preference
    }
    setLangState(next);
  }, []);

  const t = useCallback<TFunc>((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the current language + translator. Must be under `I18nProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
