import React from 'react';
import { Info, X } from 'lucide-react';
import { useTranslation } from '../../utils/i18n';
import { useSettingsStore } from '../../store/settingsStore';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-900/20 rounded-[2.5rem] p-8 md:p-10 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative custom-scrollbar ring-1 ring-white/5">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors bg-stone-950/50 p-2 rounded-xl border border-white/5"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20 shadow-lg">
            <Info size={32} className="text-teal-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-stone-50 tracking-tight">{t('about_title')}</h2>
            <p className="text-xs text-teal-200/40 tracking-widest uppercase">{t('about_subtitle')}</p>
          </div>
        </div>

        <div className="space-y-6 text-stone-400 text-sm leading-relaxed">
          <p>
            <strong className="text-stone-50 font-black">Mancala - {t('menu_title')}</strong> {t('about_desc1')}
          </p>
          <p>
            {t('about_desc2')}
          </p>
          <div className="bg-stone-950/60 p-6 rounded-3xl border border-white/5 mt-6 shadow-inner">
            <h3 className="text-amber-400 font-black uppercase tracking-widest text-xs mb-3">{t('about_elo_title')}</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              {t('about_elo_desc')}
            </p>
          </div>
          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-stone-600 uppercase tracking-[0.3em] font-black mb-4">{t('about_dev_by')}</p>
            <div className="flex items-center justify-center gap-4">
              <img 
                src="/-1821220248.png.jpg" 
                alt="MoneFan9" 
                className="w-16 h-16 rounded-full border-2 border-teal-500/30 shadow-lg bg-stone-900 object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-500 drop-shadow-sm">
                MoneFan9
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full mt-10 bg-stone-950 hover:bg-stone-900 text-stone-500 hover:text-stone-300 font-black py-4 rounded-2xl transition-all border border-white/5 uppercase tracking-widest text-xs active:scale-95"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
};
