import React from 'react';
import { User } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';

interface PvPSetupModalProps {
  tempName1: string;
  setTempName1: (v: string) => void;
  tempName2: string;
  setTempName2: (v: string) => void;
  setShowPvPSetup: (v: boolean) => void;
  startGame: (mode: string, diff: string, firstPlayer?: number, isNextRound?: boolean, roundNum?: number, customNames?: string[]) => void;
}

export const PvPSetupModal: React.FC<PvPSetupModalProps> = ({
  tempName1, setTempName1, tempName2, setTempName2, setShowPvPSetup, startGame
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="bg-stone-900/90 p-6 md:p-10 rounded-[2.5rem] border border-amber-700/30 text-left shadow-2xl backdrop-blur-2xl ring-1 ring-amber-500/20">
      <h3 className="text-2xl md:text-3xl font-black text-amber-500 mb-8 flex items-center gap-3"><User size={32} /> {t('pvp_face_to_face')}</h3>
      <div className="mb-10 space-y-6">
        <div className="bg-stone-950/40 p-6 rounded-3xl border border-green-900/20">
          <label className="block text-green-400 mb-3 font-black uppercase tracking-widest text-xs">{t('pvp_sud_warrior')}</label>
          <input type="text" value={tempName1} onChange={(e) => setTempName1(e.target.value)} maxLength={15} className="w-full bg-stone-900/80 border-2 border-green-900/30 text-stone-50 px-5 py-4 rounded-2xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-bold text-lg" placeholder="Ex: Ali" />
        </div>
        <div className="bg-stone-950/40 p-6 rounded-3xl border border-red-900/20">
          <label className="block text-red-400 mb-3 font-black uppercase tracking-widest text-xs">{t('pvp_nord_warrior')}</label>
          <input type="text" value={tempName2} onChange={(e) => setTempName2(e.target.value)} maxLength={15} className="w-full bg-stone-900/80 border-2 border-red-900/30 text-stone-50 px-5 py-4 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-lg" placeholder="Ex: Jean" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={() => setShowPvPSetup(false)} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-400 py-5 rounded-2xl font-black transition-all uppercase tracking-widest text-sm">{t('pvp_cancel')}</button>
        <button onClick={() => { setShowPvPSetup(false); startGame('PvP', '', 0, false, 1, [tempName1 || 'Joueur 1', tempName2 || 'Joueur 2']); }} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-5 rounded-2xl font-black transition-all shadow-xl shadow-amber-900/30 border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 text-lg">{t('pvp_start_duel')}</button>
      </div>
    </div>
  );
};
