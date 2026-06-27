import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { translations as frTranslations } from '../locales/fr';
import { translations as enTranslations } from '../locales/en';
import { translations as esTranslations } from '../locales/es';
import { translations as deTranslations } from '../locales/de';
import { translations as zhTranslations } from '../locales/zh';
import { translations as koTranslations } from '../locales/ko';
import { translations as jaTranslations } from '../locales/ja';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: frTranslations },
      en: { translation: enTranslations },
      es: { translation: esTranslations },
      de: { translation: deTranslations },
      zh: { translation: zhTranslations },
      ko: { translation: koTranslations },
      ja: { translation: jaTranslations },
    },
    lng: "fr",
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false 
    }
  });

import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { useEffect } from 'react';

export const useTranslation = (lang: string) => {
  const { t, i18n } = useI18nextTranslation();
  
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  return (key: string, defaultText: string = '') => {
    const res = t(key);
    // If react-i18next returns the key itself, it means it's missing. Use default text if provided.
    if (res === key && defaultText) {
      return defaultText;
    }
    return res;
  };
};

export default i18n;

