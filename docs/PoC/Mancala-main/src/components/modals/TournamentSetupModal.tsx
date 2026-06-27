import React from 'react';
import { Swords } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { TournamentState } from '../../types';

interface TournamentSetupModalProps {
  tournoi: TournamentState;
  setTournoi: React.Dispatch<React.SetStateAction<TournamentState>> | ((v: TournamentState | ((prev: TournamentState) => TournamentState)) => void);
  difficulty: string;
  setDifficulty: (v: string) => void;
  setShowTournamentSetup: (v: boolean) => void;
  startTournament: (manches: number, diff: string) => void;
}

export const TournamentSetupModal: React.FC<TournamentSetupModalProps> = ({
  tournoi, setTournoi, difficulty, setDifficulty, setShowTournamentSetup, startTournament
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="bg-stone-900/90 p-6 md:p-10 rounded-[2.5rem] border border-purple-700/30 text-left shadow-2xl backdrop-blur-2xl ring-1 ring-purple-500/20">
      <h3 className="text-2xl md:text-3xl font-black text-purple-400 mb-8 flex items-center gap-3"><Swords size={32} /> {t('tournament_config')}</h3>
      <div className="mb-8">
        <label className="block text-stone-400 mb-4 font-black uppercase tracking-widest text-xs">{t('tournament_rounds')}</label>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {[2, 4, 6].map(nb => (
            <button 
              key={nb} 
              onClick={() => setTournoi((prev) => ({ ...prev, totalManches: nb }))} 
              className={`py-6 rounded-2xl text-xl font-black transition-all border-b-4 active:border-b-0 active:translate-y-1 shadow-lg
                ${tournoi.totalManches === nb 
                  ? 'bg-purple-600 text-white border-purple-800 shadow-purple-900/40 scale-105' 
                  : 'bg-stone-950/50 text-stone-500 border-stone-900 hover:bg-stone-900'}`}
            >
              {nb}
              <span className="block text-[10px] opacity-60 uppercase tracking-tighter">{t('round')}s</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-10">
        <label className="block text-stone-400 mb-4 font-black uppercase tracking-widest text-xs">{t('tournament_difficulty')}</label>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {['Enfant', 'Initié', 'Vieux Sage', 'Grand Maître', 'AlphaSongo'].map(lvl => (
            <button key={lvl} onClick={() => setDifficulty(lvl)} className={`py-3 px-2 rounded-xl text-[10px] md:text-xs font-black transition-all border-b-2 active:border-b-0 active:translate-y-1 uppercase tracking-widest ${difficulty === lvl ? 'bg-red-600 text-white border-red-800 shadow-lg shadow-red-900/30' : 'bg-stone-950/50 text-stone-500 border-stone-900 hover:bg-stone-900'}`}>{t('diff_' + lvl.replace(' ', '_').replace('î', 'i').replace('â', 'a').toLowerCase(), lvl)}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={() => setShowTournamentSetup(false)} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-400 py-5 rounded-2xl font-black transition-all uppercase tracking-widest text-sm">{t('pvp_cancel')}</button>
        <button onClick={() => startTournament(tournoi.totalManches, difficulty)} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-5 rounded-2xl font-black transition-all shadow-xl shadow-purple-900/30 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 text-lg">{t('tournament_start')}</button>
      </div>
    </div>
  );
};
