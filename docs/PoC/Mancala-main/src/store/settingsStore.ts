import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../utils/i18n';

type Language = 'fr' | 'en' | 'es' | 'de' | 'zh' | 'ko' | 'ja';

interface SettingsState {
  language: Language;
  highContrast: boolean;
  soundEnabled: boolean;
  setLanguage: (lang: Language) => void;
  setHighContrast: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'fr',
      highContrast: false,
      soundEnabled: true,
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setHighContrast: (highContrast) => {
        set({ highContrast });
        if (highContrast) {
          document.documentElement.classList.add('high-contrast');
        } else {
          document.documentElement.classList.remove('high-contrast');
        }
      },
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: 'songo-settings',
    }
  )
);
