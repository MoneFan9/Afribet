import React from 'react';
import { BookOpen, X, Target, Hand, Zap, Shield, Swords, HeartHandshake, AlertTriangle, Crown, Lightbulb, Flame } from 'lucide-react';
import { useTranslation } from '../../utils/i18n';
import { useSettingsStore } from '../../store/settingsStore';

interface HelpModalProps {
  setShowHelp: (v: boolean) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ setShowHelp }) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-xl" onClick={() => setShowHelp(false)}>
      <div className="bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border border-amber-900/30 rounded-[2rem] sm:rounded-[2.5rem] max-w-4xl w-full flex flex-col shadow-[0_0_50px_rgba(217,119,6,0.15)] relative overflow-hidden max-h-[95vh] ring-1 ring-white/10" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-stone-950/80 p-6 md:p-8 border-b border-white/5 flex justify-between items-center shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 p-3 sm:p-4 rounded-2xl border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <BookOpen size={32} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 tracking-tight drop-shadow-sm">{t('help_grimoire')}</h2>
              <p className="text-[10px] sm:text-xs text-amber-200/60 tracking-[0.2em] uppercase font-bold mt-1">{t('help_secrets')}</p>
            </div>
          </div>
          <button onClick={() => setShowHelp(false)} className="text-stone-400 hover:text-white transition-all bg-stone-900/50 hover:bg-stone-800 rounded-xl p-2.5 border border-white/5 hover:border-white/10 hover:scale-105 relative z-10" aria-label={t('close')}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-10 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8 text-stone-300 text-sm md:text-base">
          
          {/* Intro */}
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-xl font-black text-stone-100 mb-3 tracking-wide">{t('help_intro_title')}</h3>
            <p className="text-stone-400 leading-relaxed italic">"{t('help_intro_desc')}"</p>
          </div>

          {/* 1. Le But du Jeu */}
          <div className="bg-stone-950/40 p-6 md:p-8 rounded-3xl border border-white/5 shadow-inner relative overflow-hidden group hover:border-amber-500/20 transition-colors">
            <div className="absolute -right-6 -top-6 text-amber-500/5 group-hover:text-amber-500/10 transition-colors"><Crown size={120} /></div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-3 mb-4 relative z-10">
              <Target size={24} /> {t('help_goal_title')}
            </h3>
            <p className="text-stone-300 leading-relaxed relative z-10 text-base">
              {t('help_goal_desc')}
            </p>
          </div>

          {/* 2. Le Semis */}
          <div className="bg-stone-950/40 p-6 md:p-8 rounded-3xl border border-white/5 shadow-inner relative overflow-hidden group hover:border-blue-500/20 transition-colors">
            <div className="absolute -right-6 -top-6 text-blue-500/5 group-hover:text-blue-500/10 transition-colors"><Hand size={120} /></div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-blue-400 flex items-center gap-3 mb-4 relative z-10">
              <Hand size={24} /> {t('help_sowing_title')}
            </h3>
            <p className="mb-5 text-stone-300 text-base relative z-10">{t('help_sowing_desc')}</p>
            <ul className="space-y-4 text-blue-100/70 relative z-10">
              <li className="flex gap-3 items-start">
                <span className="text-blue-500 font-black mt-1">•</span>
                <span className="text-base">{t('help_sowing_rule1')}</span>
              </li>
              <li className="flex gap-4 bg-gradient-to-r from-blue-900/30 to-transparent p-4 rounded-2xl border-l-4 border-blue-500/50">
                <span className="text-blue-400 font-black text-2xl leading-none mt-1">🌪️</span>
                <span><strong className="text-blue-300 not-italic block mb-1 text-sm uppercase tracking-wider">{t('help_sowing_rule14_title')}</strong> <span className="text-base">{t('help_sowing_rule14_desc')}</span></span>
              </li>
            </ul>
          </div>

          {/* 3. La Capture */}
          <div className="bg-stone-950/40 p-6 md:p-8 rounded-3xl border border-white/5 shadow-inner relative overflow-hidden group hover:border-orange-500/20 transition-colors">
            <div className="absolute -right-6 -top-6 text-orange-500/5 group-hover:text-orange-500/10 transition-colors"><Zap size={120} /></div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-orange-500 flex items-center gap-3 mb-4 relative z-10">
              <Zap size={24} /> {t('help_capture_title')}
            </h3>
            <p className="mb-5 text-stone-300 text-base relative z-10">{t('help_capture_desc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
              <div className="bg-orange-500/5 p-5 rounded-2xl border border-orange-500/10 flex items-start gap-4">
                <div className="bg-orange-500/20 text-orange-400 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">1</div>
                <p className="text-orange-200/80 text-sm mt-1">{t('help_capture_cond1')}</p>
              </div>
              <div className="bg-orange-500/5 p-5 rounded-2xl border border-orange-500/10 flex items-start gap-4">
                <div className="bg-orange-500/20 text-orange-400 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">2</div>
                <p className="text-orange-200/80 text-sm mt-1">{t('help_capture_cond2')}</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-orange-900/30 to-transparent p-5 rounded-2xl border-l-4 border-orange-500/50 relative z-10">
              <strong className="text-orange-400 not-italic uppercase tracking-widest text-sm block mb-2 flex items-center gap-2"><Flame size={18} /> {t('help_capture_cascade_title')}</strong> 
              <p className="text-orange-200/80 text-base">{t('help_capture_cascade_desc')}</p>
            </div>
          </div>

          {/* 4. Règles Sacrées */}
          <div className="bg-red-950/10 p-6 md:p-8 rounded-3xl border border-red-900/20 shadow-inner relative overflow-hidden group hover:border-red-500/30 transition-colors">
            <div className="absolute -right-6 -top-6 text-red-500/5 group-hover:text-red-500/10 transition-colors"><Shield size={120} /></div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-red-400 flex items-center gap-3 mb-6 relative z-10">
              <Shield size={24} /> {t('help_laws_title')}
            </h3>
            <ul className="space-y-6 text-red-100/70 relative z-10">
              <li className="flex gap-4 items-start">
                <span className="bg-red-900/40 p-3 rounded-xl text-red-400 shrink-0"><HeartHandshake size={24} /></span>
                <div>
                  <strong className="text-red-400 not-italic uppercase tracking-widest text-sm block mb-2">{t('help_solidarity_title')}</strong>
                  <p className="mb-3 text-base">{t('help_solidarity_desc')}</p>
                  <div className="bg-red-900/20 p-4 rounded-xl border border-red-500/20 text-sm text-red-200/80 border-l-2 border-l-red-500">
                    <strong className="text-red-300 block mb-1">{t('help_solidarity_exception_title')}</strong> {t('help_solidarity_exception_desc')}
                  </div>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="bg-red-900/40 p-3 rounded-xl text-red-400 shrink-0"><AlertTriangle size={24} /></span>
                <div>
                  <strong className="text-red-400 not-italic uppercase tracking-widest text-sm block mb-2">{t('help_trap_title')}</strong>
                  <p className="text-base">{t('help_trap_desc')}</p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="bg-red-900/40 p-3 rounded-xl text-red-400 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">⏳</span>
                <div>
                  <strong className="text-red-400 not-italic uppercase tracking-widest text-sm block mb-2">{t('help_rarity_title')}</strong>
                  <p className="text-base">{t('help_rarity_desc')}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* 5. Conseils de Maître */}
          <div className="bg-emerald-950/10 p-6 md:p-8 rounded-3xl border border-emerald-900/30 shadow-inner relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute -right-6 -top-6 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors"><Lightbulb size={120} /></div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-emerald-400 flex items-center gap-3 mb-6 relative z-10">
              <Lightbulb size={24} /> {t('help_tips_title')}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {[1, 2, 3, 4].map((num) => (
                <li key={num} className="bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/10 flex items-start gap-3">
                  <span className="text-emerald-500 font-black mt-0.5">•</span>
                  <span className="text-emerald-100/80 text-sm">{t(`help_tips_${num}` as Parameters<typeof t>[0])}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 6. Modes de jeu */}
          <div className="bg-stone-950/40 p-6 md:p-8 rounded-3xl border border-white/5 shadow-inner">
            <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-stone-300 flex items-center gap-3 mb-6">
              <Swords size={24} /> {t('help_ways_title')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: t('pvp_face_to_face'), desc: t('menu_pvp_desc') },
                { name: t('mode_pve'), desc: "Affrontez 5 niveaux d'IA" },
                { name: t('mode_dojo'), desc: t('menu_dojo_desc') },
                { name: t('online_arena'), desc: t('menu_online_desc') },
                { name: t('mode_tournament'), desc: t('menu_tournament_desc') }
              ].map((m, i) => (
                <div key={i} className="bg-stone-900/50 p-4 rounded-2xl border border-white/5 flex flex-col justify-center hover:bg-stone-800/50 transition-colors">
                  <strong className="text-stone-200 not-italic text-sm block mb-1">{m.name}</strong>
                  <span className="text-xs text-stone-500 uppercase tracking-wider leading-relaxed">{m.desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-stone-950/80 p-4 sm:p-6 md:p-8 border-t border-white/5 shrink-0 backdrop-blur-md">
          <button onClick={() => setShowHelp(false)} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black py-4 sm:py-5 rounded-2xl transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 uppercase tracking-[0.2em] text-sm md:text-base">
            {t('help_understood')}
          </button>
        </div>
      </div>
    </div>
  );
};

