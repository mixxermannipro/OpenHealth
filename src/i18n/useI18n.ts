import { useHealthStore } from '../store/useHealthStore';
import {
  getExplanation,
  SUPPORTED_LOCALES,
  UI_TRANSLATIONS,
  UITranslations,
} from './translations';
import { ExplanationTopic } from './de';
import { AppLocale } from '../types/health';

export function useI18n(): {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: UITranslations;
  locales: typeof SUPPORTED_LOCALES;
  explain: (topic: ExplanationTopic) => ReturnType<typeof getExplanation>;
} {
  const locale = useHealthStore((s) => s.locale);
  const setLocale = useHealthStore((s) => s.setLocale);
  const t = UI_TRANSLATIONS[locale] ?? UI_TRANSLATIONS.de;

  return {
    locale,
    setLocale,
    t,
    locales: SUPPORTED_LOCALES,
    explain: (topic: ExplanationTopic) => getExplanation(topic, locale),
  };
}
