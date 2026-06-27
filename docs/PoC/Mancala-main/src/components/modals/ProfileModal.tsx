import React from 'react';
import { User, Trophy } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { UserType, UserStats } from '../../types';

interface ProfileModalProps {
  user: UserType;
  userStats: UserStats | null;
  userRank: number | null;
  setShowUserInfo: (v: boolean) => void;
  setShowLeaderboard: (v: boolean) => void;
  setShowResetConfirm: (v: boolean) => void;
  logout?: () => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user, userStats, userRank, setShowUserInfo, setShowLeaderboard, setShowResetConfirm, logout
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
      <div className="bg-stone-900 border-2 border-white/10 p-6 md:p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-900/40 to-stone-900" />
        <button onClick={() => setShowUserInfo(false)} className="absolute top-4 right-4 bg-stone-800 text-stone-400 hover:text-white p-2 rounded-full transition-colors z-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        
        <div className="relative z-10 flex flex-col items-center mt-4 mb-8">
          <div className="w-24 h-24 rounded-3xl overflow-hidden bg-blue-900/20 border-4 border-stone-900 shadow-xl ring-4 ring-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'Joueur'} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User size={48} />
            )}
          </div>
          <h3 className="text-2xl font-black text-stone-50 truncate max-w-full px-4 text-center">
            {user.displayName || 'Joueur'}
          </h3>
          <div className="text-stone-400 text-sm mt-1">{user.email}</div>
          <div className="flex gap-2 mt-4">
            <div className="bg-stone-950 px-4 py-1.5 rounded-full border border-white/5 text-sm font-mono flex items-center gap-2">
              <span className="text-stone-500 uppercase tracking-widest text-[10px]">Elo</span>
              <span className="text-amber-400 font-black">{userStats.elo}</span>
            </div>
            {userRank && (
              <div className="bg-amber-500/20 text-amber-400 px-4 py-1.5 rounded-full font-black border border-amber-500/20 text-sm flex items-center gap-2">
                <Trophy size={14} /> #{userRank}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-stone-950/60 p-4 rounded-2xl border border-white/5 text-center">
            <div className="text-2xl text-green-400 font-black mb-1">{userStats.wins}</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold tracking-widest leading-none">{t('stats_wins')}</div>
          </div>
          <div className="bg-stone-950/60 p-4 rounded-2xl border border-white/5 text-center">
            <div className="text-2xl text-stone-400 font-black mb-1">{userStats.draws}</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold tracking-widest leading-none">{t('stats_draws')}</div>
          </div>
          <div className="bg-stone-950/60 p-4 rounded-2xl border border-white/5 text-center">
            <div className="text-2xl text-red-400 font-black mb-1">{userStats.losses}</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold tracking-widest leading-none">{t('stats_losses')}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => { setShowUserInfo(false); setShowLeaderboard(true); }}
            className="w-full py-4 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-500 rounded-xl font-bold transition-all border border-amber-900/50 flex items-center justify-center gap-2 shadow-lg"
          >
            <Trophy size={20} />
            {t('leaderboard_global')}
          </button>
          <div className="flex gap-3">
            {logout && (
              <button 
                onClick={logout}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold transition-colors shadow-lg"
              >
                {t('logout', 'Déconnexion')}
              </button>
            )}
            <button 
              onClick={() => { setShowUserInfo(false); setShowResetConfirm(true); }}
              className="flex-1 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-xl font-bold transition-colors shadow-lg"
            >
              Reset Elo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
