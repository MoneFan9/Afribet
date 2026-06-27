import React, { useEffect, useState } from 'react';
import { Trophy, X, Medal, User } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { UserStats } from '../../types';

interface LeaderboardEntry {
  uid?: string;
  displayName?: string;
  elo: number;
  wins: number;
  photoURL?: string;
}

interface LeaderboardModalProps {
  onClose: () => void;
  getLeaderboard: () => Promise<UserStats[]>;
  currentUserUid?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, getLeaderboard, currentUserUid }) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const data = await getLeaderboard();
      setEntries(data as LeaderboardEntry[]);
      setLoading(false);
    };
    fetchLeaderboard();
  }, [getLeaderboard]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-900/20 rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative flex flex-col max-h-[85vh] ring-1 ring-white/5">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors bg-stone-950/50 p-2 rounded-xl border border-white/5"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 shadow-lg">
            <Trophy size={32} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-stone-50 tracking-tight">{t('leaderboard_title')}</h2>
            <p className="text-xs text-amber-200/40 tracking-widest uppercase">{t('leaderboard_subtitle')}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="w-12 h-12 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin shadow-[0_0_20px_rgba(245,158,11,0.2)]"></div>
              <p className="text-stone-500 text-lg animate-pulse">{t('leaderboard_loading')}</p>
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map((entry, index) => {
                const isCurrentUser = entry.uid === currentUserUid;
                const rank = index + 1;
                
                return (
                  <div 
                    key={entry.uid}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      isCurrentUser 
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-xl ring-1 ring-amber-500/20' 
                        : 'bg-stone-950/40 border-white/5 hover:border-white/10 hover:bg-stone-950/60 shadow-inner'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-8 text-center font-black text-lg shrink-0">
                        {rank === 1 ? <Medal className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] mx-auto" size={24} /> :
                         rank === 2 ? <Medal className="text-stone-300 drop-shadow-[0_0_8px_rgba(214,211,209,0.5)] mx-auto" size={24} /> :
                         rank === 3 ? <Medal className="text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.5)] mx-auto" size={24} /> :
                         <span className="text-stone-600 text-sm font-mono">#{rank}</span>}
                      </div>
                      
                      <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 shadow-lg ${isCurrentUser ? 'border-amber-500/50' : 'border-white/5'}`}>
                        {entry.photoURL ? (
                          <img 
                            src={entry.photoURL} 
                            alt={entry.displayName} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-600">
                            <User size={20} />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className={`font-bold truncate ${isCurrentUser ? 'text-amber-200' : 'text-stone-50'}`}>
                          {entry.displayName}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-stone-500 uppercase font-black tracking-widest shrink-0">{entry.wins} {t('leaderboard_wins')}</span>
                          {isCurrentUser && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-lg uppercase font-black shrink-0 border border-amber-500/20">{t('leaderboard_you')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right bg-stone-950/60 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                      <div className="text-amber-400 font-black text-xl leading-none">{entry.elo}</div>
                      <div className="text-[8px] text-stone-500 uppercase font-black tracking-tighter mt-1">{t('leaderboard_points')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-stone-950/20 rounded-[2rem] border border-dashed border-white/5">
              <User size={64} className="mx-auto text-stone-800 mb-6 opacity-20" />
              <p className="text-stone-500 text-lg">{t('leaderboard_empty')}</p>
              <p className="text-xs text-stone-600 uppercase tracking-widest mt-2">{t('leaderboard_empty_sub')}</p>
            </div>
          )}
        </div>
        
        <button 
          onClick={onClose}
          className="w-full mt-8 bg-stone-950 hover:bg-stone-900 text-stone-400 hover:text-stone-200 font-black py-4 rounded-2xl transition-all border border-white/5 uppercase tracking-widest text-xs shadow-xl active:scale-95"
        >
          {t('online_back_village')}
        </button>
      </div>
    </div>
  );
};
