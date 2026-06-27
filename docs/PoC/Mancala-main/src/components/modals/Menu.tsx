import React from 'react';
import { FolderOpen, Globe, User, Swords, Cpu, BookOpen, Info, Trophy, Smartphone } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { ProfileModal } from './ProfileModal';
import { PvPSetupModal } from './PvPSetupModal';
import { TournamentSetupModal } from './TournamentSetupModal';
import { OnlineSetupModal } from './OnlineSetupModal';

import { UserType, UserStats, TournamentState } from '../../types';

interface MenuProps {
  hasSave: boolean;
  loadGame: () => void;
  deleteSave?: () => void;
  showOnlineModal: boolean;
  setShowOnlineModal: (v: boolean) => void;
  isWaitingForOpponent: boolean;
  onlineRoomId: string | null;
  leaveOnlineRoom: () => void;
  rejectStake: () => void;
  tempName1: string;
  setTempName1: (v: string) => void;
  tempName2: string;
  setTempName2: (v: string) => void;
  inputRoomId: string;
  setInputRoomId: (v: string) => void;
  pendingStakeAmount: number | null;
  setPendingStakeAmount: (v: number | null) => void;
  createOnlineRoom: (rounds: number, stake: number) => void;
  joinOnlineRoom: (id: string) => void;
  confirmPaymentOnline: () => void;
  showPvPSetup: boolean;
  setShowPvPSetup: (v: boolean) => void;
  startGame: (mode: string, diff: string, firstPlayer?: number, isNextRound?: boolean, roundNum?: number, customNames?: string[]) => void;
  showTournamentSetup: boolean;
  setShowTournamentSetup: (v: boolean) => void;
  tournoi: TournamentState;
  setTournoi: React.Dispatch<React.SetStateAction<TournamentState>> | ((v: TournamentState | ((prev: TournamentState) => TournamentState)) => void);
  difficulty: string;
  setDifficulty: (v: string) => void;
  startTournament: (manches: number, diff: string) => void;
  addLog: (msg: string, type: string) => void;
  user?: UserType;
  userStats?: UserStats | null;
  login?: () => Promise<void>;
  setShowHelp: (v: boolean) => void;
  setShowAbout: (v: boolean) => void;
  setShowLeaderboard: (v: boolean) => void;
  userRank: number | null;
  logout?: () => Promise<void>;
  resetElo?: () => Promise<void>;
}

export const Menu: React.FC<MenuProps> = ({
  hasSave, loadGame, deleteSave, showOnlineModal, setShowOnlineModal, isWaitingForOpponent, onlineRoomId, leaveOnlineRoom, rejectStake,
  tempName1, setTempName1, tempName2, setTempName2, inputRoomId, setInputRoomId, pendingStakeAmount, setPendingStakeAmount, createOnlineRoom, joinOnlineRoom,
  confirmPaymentOnline, showPvPSetup, setShowPvPSetup, startGame, showTournamentSetup, setShowTournamentSetup, tournoi, setTournoi,
  difficulty, setDifficulty, startTournament, addLog, user, userStats, login, logout, resetElo, setShowHelp, setShowAbout,
  setShowLeaderboard, userRank
}) => {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [showUserInfo, setShowUserInfo] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<Event | null>(null);
  const { language, setLanguage } = useSettingsStore();
  const t = useTranslation(language);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-stone-950 text-stone-50 flex items-center justify-center font-sans p-2 md:p-6 relative overflow-hidden max-w-[100vw] selection:bg-amber-500/30">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex flex-wrap justify-center items-center gap-12" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => <div key={i} className="w-24 h-24 rounded-full border-8 border-amber-900/20"></div>)}
      </div>

      <div className="bg-gradient-to-b from-stone-900 to-stone-950 p-4 md:p-10 rounded-[2.5rem] shadow-2xl border border-amber-900/20 max-w-4xl w-full mx-auto text-center relative z-10 backdrop-blur-xl ring-1 ring-white/5">
        <div className="mb-10">
          <h1 className="text-5xl md:text-7xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-400 to-amber-500 tracking-tight drop-shadow-2xl leading-tight">{t('menu_title')}</h1>
          <p className="text-sm md:text-lg text-amber-200/40 tracking-widest mb-6">{t('menu_subtitle')}</p>
          
          <div className="flex justify-center items-center gap-3">
            <button 
              onClick={() => {
                const langs: ('fr' | 'en' | 'es' | 'de' | 'zh' | 'ko' | 'ja')[] = ['fr', 'en', 'es', 'de', 'zh', 'ko', 'ja'];
                const nextLang = langs[(langs.indexOf(language) + 1) % langs.length];
                setLanguage(nextLang);
              }}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-blue-400 hover:text-blue-300 bg-stone-950/80 hover:bg-stone-900 rounded-2xl transition-all border border-blue-900/30 shadow-lg font-black uppercase text-[10px] md:text-xs"
              title={t('language')}
            >
              {language}
            </button>
            <button 
              onClick={() => setShowAbout(true)}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-teal-400 hover:text-teal-300 bg-stone-950/80 hover:bg-stone-900 rounded-2xl transition-all border border-teal-900/30 shadow-lg"
              title={t('about')}
            >
              <Info size={22} className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button 
              onClick={() => setShowHelp(true)}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-amber-400 hover:text-amber-300 bg-stone-950/80 hover:bg-stone-900 rounded-2xl transition-all border border-amber-900/30 shadow-lg"
              title={t('help')}
            >
              <BookOpen size={22} className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            {user && userStats && (
              <button 
                onClick={() => setShowUserInfo(true)}
                className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-purple-400 hover:text-purple-300 bg-stone-950/80 hover:bg-stone-900 rounded-2xl transition-all border border-purple-900/30 shadow-lg overflow-hidden shrink-0"
                title="Profile"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'Profile'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={22} className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>
            )}
            {deferredPrompt && (
              <button 
                onClick={handleInstall}
                className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-green-400 hover:text-green-300 bg-stone-950/80 hover:bg-stone-900 rounded-2xl transition-all border border-green-900/30 shadow-lg animate-pulse"
                title={t('install_app')}
              >
                <Smartphone size={22} className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
          </div>
        </div>

        {hasSave && (
          <div className="flex gap-2 mb-6">
            <button onClick={loadGame} className="flex-1 bg-green-800/90 hover:bg-green-700 text-green-100 py-3 px-4 md:px-6 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 md:gap-3 border border-green-500/50 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] focus:ring-4 focus:ring-green-500/50 outline-none">
              <FolderOpen size={20} /> <span className="text-sm md:text-base">{t('menu_resume')}</span>
            </button>
            {deleteSave && (
              <button onClick={deleteSave} className="bg-red-900/80 hover:bg-red-800 text-red-100 py-3 px-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center border border-red-500/50 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] focus:ring-4 focus:ring-red-500/50 outline-none" title={t('menu_delete_save')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
            )}
          </div>
        )}

        {showOnlineModal ? (
          <OnlineSetupModal 
            user={user}
            login={login}
            isWaitingForOpponent={isWaitingForOpponent}
            onlineRoomId={onlineRoomId}
            leaveOnlineRoom={leaveOnlineRoom}
            rejectStake={rejectStake}
            inputRoomId={inputRoomId}
            setInputRoomId={setInputRoomId}
            pendingStakeAmount={pendingStakeAmount}
            setPendingStakeAmount={setPendingStakeAmount}
            createOnlineRoom={createOnlineRoom}
            joinOnlineRoom={joinOnlineRoom}
            confirmPaymentOnline={confirmPaymentOnline}
            setShowOnlineModal={setShowOnlineModal}
            addLog={addLog}
          />
        ) : showPvPSetup ? (
          <PvPSetupModal 
            tempName1={tempName1}
            setTempName1={setTempName1}
            tempName2={tempName2}
            setTempName2={setTempName2}
            setShowPvPSetup={setShowPvPSetup}
            startGame={startGame}
          />
        ) : !showTournamentSetup ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 text-left">
              {/* BENTO GRID LAYOUT */}
              <div className="md:col-span-4 bg-gradient-to-br from-stone-900/80 to-stone-950/80 p-6 md:p-8 rounded-[2.5rem] border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 shadow-2xl hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-1 ring-white/5 hover:ring-blue-500/20 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="absolute -right-4 -top-4 text-9xl blur-[2px] opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">🌍</div>
                <div className="relative z-10">
                  <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-500 flex items-center gap-3 drop-shadow-sm"><Globe size={28} className="text-blue-400 group-hover:rotate-12 transition-transform duration-500" /> {t('online_arena')}</h3>
                  <p className="text-sm md:text-base text-stone-400 mt-3 max-w-md font-medium leading-relaxed group-hover:text-stone-300 transition-colors">{t('menu_online_desc')}</p>
                </div>
                <button onClick={() => setShowOnlineModal(true)} className="w-full md:w-auto self-start mt-8 px-10 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-blue-900/40 border-b-4 border-blue-800 hover:border-blue-700 active:border-b-0 active:translate-y-1 text-lg tracking-wide">{t('mode_online')}</button>
              </div>

              <div className="md:col-span-2 bg-gradient-to-br from-stone-900/80 to-stone-950/80 p-6 md:p-8 rounded-[2.5rem] border border-amber-500/20 hover:border-amber-400/50 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-1 ring-white/5 hover:ring-amber-500/20 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="absolute -right-2 -bottom-2 text-8xl blur-[1px] opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">🤝</div>
                <div className="relative z-10">
                  <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 flex items-center gap-3 drop-shadow-sm"><User size={24} className="text-amber-400 group-hover:scale-110 transition-transform duration-500" /> {t('pvp_face_to_face')}</h3>
                  <p className="text-xs md:text-sm text-stone-400 mt-3 font-medium leading-relaxed group-hover:text-stone-300 transition-colors">{t('menu_pvp_desc')}</p>
                </div>
                <button onClick={() => setShowPvPSetup(true)} className="w-full mt-6 bg-stone-950/80 hover:bg-stone-900 text-amber-200 hover:text-amber-100 py-3 rounded-xl font-bold transition-all shadow-md border border-amber-900/30 hover:border-amber-500/50 text-sm uppercase tracking-widest">{t('mode_pvp')}</button>
              </div>

              <div className="md:col-span-2 bg-gradient-to-br from-stone-900/80 to-stone-950/80 p-6 md:p-8 rounded-[2.5rem] border border-indigo-500/20 hover:border-indigo-400/50 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-white/5 hover:ring-indigo-500/20 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="absolute -left-4 -bottom-4 text-8xl blur-[1px] opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:-rotate-12 pointer-events-none" aria-hidden="true">🐉</div>
                <div className="relative z-10">
                  <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-indigo-500 flex items-center gap-3 drop-shadow-sm"><BookOpen size={24} className="text-indigo-400 group-hover:scale-110 transition-transform duration-500" /> {t('menu_dojo_title')}</h3>
                  <p className="text-xs md:text-sm text-stone-400 mt-3 font-medium leading-relaxed group-hover:text-stone-300 transition-colors">{t('menu_dojo_desc')}</p>
                </div>
                <button onClick={() => startGame('Apprenti', 'Initié')} className="w-full mt-6 bg-stone-950/80 hover:bg-stone-900 text-indigo-200 hover:text-indigo-100 py-3 rounded-xl font-bold transition-all shadow-md border border-indigo-900/30 hover:border-indigo-500/50 text-sm uppercase tracking-widest">{t('mode_dojo')}</button>
              </div>

              <div className="md:col-span-4 bg-gradient-to-br from-stone-900/80 to-stone-950/80 p-6 md:p-8 rounded-[2.5rem] border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 shadow-xl hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] ring-1 ring-white/5 hover:ring-purple-500/20 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="absolute -right-4 -bottom-6 text-9xl blur-[2px] opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">⚔️</div>
                <div className="relative z-10">
                  <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-purple-500 flex items-center gap-3 drop-shadow-sm"><Swords size={28} className="text-purple-400 group-hover:-rotate-12 transition-transform duration-500" /> {t('mode_tournament')}</h3>
                  <p className="text-sm md:text-base text-stone-400 mt-3 max-w-md font-medium leading-relaxed group-hover:text-stone-300 transition-colors">{t('menu_tournament_desc')}</p>
                </div>
                <button onClick={() => setShowTournamentSetup(true)} className="w-full md:w-auto self-start mt-8 px-10 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-purple-900/40 border-b-4 border-purple-800 hover:border-purple-700 active:border-b-0 active:translate-y-1 text-lg tracking-wide">{t('menu_tournament_create')}</button>
              </div>

              <div className="md:col-span-6 bg-gradient-to-b from-stone-900/50 to-stone-950/80 p-6 md:p-8 rounded-[2.5rem] border border-stone-700/50 hover:border-red-500/30 transition-all duration-500 shadow-xl hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] ring-1 ring-white/5">
                <h3 className="text-xl md:text-2xl font-black text-red-400 mb-6 flex items-center gap-3 border-b border-white/5 pb-4"><Cpu size={24} className="text-red-500" /> {t('menu_pve_title')}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                  {['Enfant', 'Initié', 'Vieux Sage', 'Grand Maître', 'AlphaSongo'].map((lvl, i) => (
                    <button 
                      key={lvl} 
                      onClick={() => startGame('PvE', lvl)} 
                      className={`relative p-4 rounded-2xl text-xs md:text-sm font-black transition-all shadow-lg border-b-4 active:border-b-0 active:translate-y-1 uppercase tracking-widest overflow-hidden group
                        ${i === 0 ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-900 hover:text-white' : 
                          i === 1 ? 'bg-gradient-to-b from-amber-900/40 to-amber-950 hover:from-amber-800/60 hover:to-amber-900/80 text-amber-300 border-amber-950 hover:text-amber-100 hover:shadow-[0_0_15px_rgba(217,119,6,0.2)]' : 
                          i === 2 ? 'bg-gradient-to-b from-red-900/40 to-red-950 hover:from-red-800/60 hover:to-red-900/80 text-red-300 border-red-950 hover:text-red-100 hover:shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 
                          i === 3 ? 'bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-red-800 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 
                          'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-800 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]'}`}
                    >
                      <span className="relative z-10">{t('diff_' + lvl.replace(' ', '_').replace('î', 'i').replace('â', 'a').toLowerCase(), lvl)}</span>
                      {i >= 3 && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
        ) : (
          <TournamentSetupModal 
            tournoi={tournoi}
            setTournoi={setTournoi}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            setShowTournamentSetup={setShowTournamentSetup}
            startTournament={startTournament}
          />
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-stone-900 border-2 border-red-900/50 p-6 rounded-3xl max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold text-red-500 mb-4">{t('reset_confirm_title')}</h3>
              <p className="text-stone-400 text-sm mb-6">
                {t('reset_confirm_desc')}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 bg-stone-800 rounded-xl font-bold text-stone-300 hover:bg-stone-700 transition-colors"
                >
                  {t('pvp_cancel')}
                </button>
                <button 
                  onClick={() => {
                    resetElo?.();
                    setShowResetConfirm(false);
                    addLog(t('reset_success'), "info");
                  }}
                  className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                >
                  {t('reset_confirm_btn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showUserInfo && user && userStats && (
          <ProfileModal 
            user={user}
            userStats={userStats}
            userRank={userRank}
            setShowUserInfo={setShowUserInfo}
            setShowLeaderboard={setShowLeaderboard}
            setShowResetConfirm={setShowResetConfirm}
            logout={logout}
          />
        )}
      </div>
    </div>
  );
};
