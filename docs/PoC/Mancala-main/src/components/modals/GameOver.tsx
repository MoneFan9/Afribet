import React, { useState } from 'react';
import { Trophy, Swords, History, AlertTriangle, Medal, Share2, RotateCcw, Twitter, Facebook, MessageCircle, Link } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { TournamentState } from '../../types';

interface GameOverProps {
  tournoi: TournamentState;
  nomsJoueurs: string[];
  winner: number | null;
  forfeitLoser: number | null;
  greniers: number[];
  mode: string;
  statsApprenti: { joues: number; optimaux: number };
  setShowHistoryModal: (v: boolean) => void;
  nextTournamentRound: () => void;
  resetToMenu: () => void;
  restartGame?: () => void;
  onAskMaster?: () => void;
  masterFeedback?: string | null;
  isAskingMaster?: boolean;
  onlineRole?: number | null;
}

export const GameOver: React.FC<GameOverProps> = ({
  tournoi, nomsJoueurs, winner, forfeitLoser, greniers, mode, statsApprenti,
  setShowHistoryModal, nextTournamentRound, resetToMenu, restartGame, onAskMaster, masterFeedback, isAskingMaster, onlineRole
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);
  const isLocalWinner = mode === 'Online' && onlineRole !== null && winner === onlineRole;
  const isLocalLoser = mode === 'Online' && onlineRole !== null && winner !== null && winner !== 2 && winner !== onlineRole;
  const isDraw = winner === 2 || winner === null;

  const [showShareOptions, setShowShareOptions] = useState(false);

  const getShareText = () => {
    let text = t('game_over_share_text_base').replace('{0}', String(greniers[0])).replace('{1}', String(greniers[1]));
    if (isLocalWinner) {
      text = t('game_over_share_text_win').replace('{0}', String(greniers[onlineRole])).replace('{1}', String(greniers[1 - onlineRole]));
    } else if (winner === 0 || winner === 1) {
      text = t('game_over_share_text_winner').replace('{0}', nomsJoueurs[winner]).replace('{1}', String(greniers[winner]));
    }
    return text;
  };

  const handleShareClick = async () => {
    if (navigator.share && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // Use native share on mobile devices as it natively supports social apps
      try {
        await navigator.share({
          title: t('game_over_share_title'),
          text: getShareText(),
          url: window.location.href,
        });
      } catch (err) {
        console.error('Erreur lors du partage:', err);
      }
    } else {
      setShowShareOptions(!showShareOptions);
    }
  };

  const shareToWhatsApp = () => {
    const text = `${getShareText()} ${t('game_over_share_text_play_on')} ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToTwitter = () => {
    const text = `${getShareText()} ${t('game_over_share_text_play_on')}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const copyLink = () => {
    const text = `${getShareText()} ${t('game_over_share_text_play_on')} ${window.location.href}`;
    navigator.clipboard.writeText(text);
    alert(t('game_over_share_copied'));
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-900/20 p-6 md:p-10 rounded-[2.5rem] max-w-lg w-full text-center shadow-2xl max-h-[95dvh] overflow-y-auto ring-1 ring-white/5 relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex flex-wrap justify-center items-center gap-8 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => <div key={i} className="w-16 h-16 rounded-full border-4 border-amber-900/20"></div>)}
        </div>

        {tournoi.actif && tournoi.mancheActuelle >= tournoi.totalManches ? (
          <>
            <div className="bg-purple-500/10 w-20 h-20 rounded-3xl border border-purple-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Medal size={48} className="text-purple-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-stone-50 mb-2 tracking-tight">{t('tournament_result')}</h2>
            <p className="text-xs md:text-sm text-amber-200/40 tracking-widest uppercase mb-8">{t('tournament_global_scores').replace('{0}', String(tournoi.totalManches))}</p>
            
            <div className="flex justify-between bg-stone-950/60 p-6 rounded-3xl mb-8 border border-white/5 shadow-inner">
              <div className={`text-center w-1/2 border-r border-white/5 px-2 overflow-hidden ${mode === 'Online' && onlineRole === 0 ? 'bg-amber-500/5 rounded-l-2xl' : ''}`}>
                <div className="text-4xl md:text-5xl font-black text-green-400 mb-2 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">{tournoi.scores[0]}</div>
                <div className="text-[10px] text-stone-500 font-black tracking-widest uppercase truncate">{nomsJoueurs[0]} {mode === 'Online' && onlineRole === 0 && `(${t('you')})`}</div>
              </div>
              <div className={`text-center w-1/2 px-2 overflow-hidden ${mode === 'Online' && onlineRole === 1 ? 'bg-amber-500/5 rounded-r-2xl' : ''}`}>
                <div className="text-4xl md:text-5xl font-black text-red-400 mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">{tournoi.scores[1]}</div>
                <div className="text-[10px] text-stone-500 font-black tracking-widest uppercase truncate">{nomsJoueurs[1]} {mode === 'Online' && onlineRole === 1 && `(${t('you')})`}</div>
              </div>
            </div>
            
            <h3 className="text-2xl md:text-3xl font-black mb-10">
              {tournoi.scores[0] > tournoi.scores[1] ? (
                <span className={mode === 'Online' && onlineRole === 0 ? "text-green-400 animate-bounce block drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "text-green-400"}>
                  {mode === 'Online' && onlineRole === 0 ? t('you_won') : `${nomsJoueurs[0]} ${t('remporte')}`}
                </span>
              ) : tournoi.scores[1] > tournoi.scores[0] ? (
                <span className={mode === 'Online' && onlineRole === 1 ? "text-red-400 animate-bounce block drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "text-red-400"}>
                  {mode === 'Online' && onlineRole === 1 ? t('you_won') : `${nomsJoueurs[1]} ${t('remporte')}`}
                </span>
              ) : (
                <span className="text-amber-400">{t('perfect_draw')}</span>
              )}
            </h3>
            
            <div className="space-y-3">
              {mode !== 'Online' && restartGame && (
                <button onClick={restartGame} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                  <RotateCcw size={20} /> {t('restart_game')}
                </button>
              )}
              <button onClick={handleShareClick} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                <Share2 size={20} /> {t('share_result')}
              </button>
              {showShareOptions && (
                <div className="flex justify-center gap-4 py-2 animate-in fade-in slide-in-from-top-2">
                  <button onClick={shareToWhatsApp} className="bg-green-500 hover:bg-green-400 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="WhatsApp">
                    <MessageCircle size={24} />
                  </button>
                  <button onClick={shareToTwitter} className="bg-black hover:bg-stone-800 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="X (Twitter)">
                    <Twitter size={24} />
                  </button>
                  <button onClick={shareToFacebook} className="bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="Facebook">
                    <Facebook size={24} />
                  </button>
                  <button onClick={copyLink} className="bg-stone-700 hover:bg-stone-600 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="Copier le lien">
                    <Link size={24} />
                  </button>
                </div>
              )}
              <button onClick={() => setShowHistoryModal(true)} className="w-full bg-stone-900 hover:bg-stone-800 text-stone-400 py-4 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest">
                <History size={20} /> {t('view_history')}
              </button>
              <button onClick={resetToMenu} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-purple-900/20 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 text-sm uppercase tracking-widest">
                {t('back_to_menu')}
              </button>
            </div>
          </>
        ) : (
          <>
            {forfeitLoser !== null ? (
              <div className="mb-8 animate-pulse">
                <span className="text-[10px] text-red-400 font-black uppercase tracking-widest bg-red-950/40 px-6 py-3 rounded-2xl border border-red-500/20 shadow-lg flex items-center justify-center gap-3 w-fit mx-auto">
                  <AlertTriangle size={20} /> {mode === 'Online' && onlineRole === forfeitLoser ? t('you_abandoned') : `${nomsJoueurs[forfeitLoser]} ${t('has_abandoned')}`}
                </span>
              </div>
            ) : (
              <div className={`bg-stone-950/40 w-24 h-24 rounded-[2rem] border-2 flex items-center justify-center mx-auto mb-8 shadow-2xl ${winner === 0 ? 'border-green-500/30 text-green-400' : winner === 1 ? 'border-red-500/30 text-red-400' : 'border-amber-500/30 text-amber-400'} ${isLocalWinner ? 'animate-bounce' : ''}`}>
                <Trophy size={48} />
              </div>
            )}

            <h2 className={`text-3xl md:text-5xl font-black text-stone-50 mb-2 tracking-tight ${isLocalWinner ? 'text-green-400' : isLocalLoser ? 'text-red-500' : ''}`}>
              {isDraw ? t('draw') : isLocalWinner ? t('victory') : isLocalLoser ? t('defeat') : (winner === 0 ? (
                <>
                  <span className="block">{t('victory')}</span>
                  <span className="block text-2xl md:text-4xl mt-1 text-stone-300">{nomsJoueurs[0]}</span>
                </>
              ) : winner === 1 ? (
                <>
                  <span className="block">{t('victory')}</span>
                  <span className="block text-2xl md:text-4xl mt-1 text-stone-300">{nomsJoueurs[1]}</span>
                </>
              ) : t('draw'))}
            </h2>

            <p className="text-xs md:text-sm text-amber-200/40 tracking-widest uppercase mb-10">
              {isLocalWinner ? t('strategy_paid_off') : isLocalLoser ? t('failure_foundation') : (forfeitLoser !== null ? t('victory_forfeit') : (tournoi.actif ? t('end_of_round').replace('{0}', String(tournoi.mancheActuelle)).replace('{1}', String(tournoi.totalManches)) : t('joust_over')))}
            </p>

            <div className="flex justify-between bg-stone-950/60 p-6 rounded-3xl mb-10 border border-white/5 shadow-inner relative overflow-hidden">
              {isLocalWinner && <div className="absolute inset-0 bg-green-500/5 animate-pulse pointer-events-none"></div>}
              {isLocalLoser && <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>}
              
              <div className={`text-center w-1/2 border-r border-white/5 px-2 overflow-hidden ${mode === 'Online' && onlineRole === 0 ? 'scale-110' : ''}`}>
                <div className={`text-4xl md:text-5xl font-black mb-2 drop-shadow-lg ${winner === 0 ? 'text-green-400' : (winner === 2 ? 'text-amber-400' : 'text-stone-600')}`}>{greniers[0]}</div>
                <div className="text-[10px] text-stone-500 font-black tracking-widest uppercase truncate">{nomsJoueurs[0]} {mode === 'Online' && onlineRole === 0 && `(${t('you')})`}</div>
              </div>
              <div className={`text-center w-1/2 px-2 overflow-hidden ${mode === 'Online' && onlineRole === 1 ? 'scale-110' : ''}`}>
                <div className={`text-4xl md:text-5xl font-black mb-2 drop-shadow-lg ${winner === 1 ? 'text-red-400' : (winner === 2 ? 'text-amber-400' : 'text-stone-600')}`}>{greniers[1]}</div>
                <div className="text-[10px] text-stone-500 font-black tracking-widest uppercase truncate">{nomsJoueurs[1]} {mode === 'Online' && onlineRole === 1 && `(${t('you')})`}</div>
              </div>
            </div>

            {mode === 'Apprenti' && (
              <div className="mb-10 p-6 bg-blue-950/20 border border-blue-500/20 rounded-[2rem] relative overflow-hidden text-left shadow-inner">
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 pointer-events-none" aria-hidden="true">🐉</div>
                <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-3 relative z-10">{t('master_judgment')}</h4>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="text-3xl font-black text-stone-50">{statsApprenti.joues > 0 ? Math.round((statsApprenti.optimaux / statsApprenti.joues) * 100) : 0}%</span>
                  <span className="text-[10px] text-blue-300/40 font-black uppercase tracking-tighter">{t('harmony')}</span>
                </div>
                <p className="text-[10px] text-blue-300/30 mt-1 relative z-10 font-mono">({statsApprenti.optimaux} optimaux / {statsApprenti.joues} joués)</p>
                <div className="mt-6 p-4 bg-stone-950/60 rounded-2xl border border-white/5 relative z-10 shadow-inner">
                  <p className="text-sm text-blue-100">
                    "{statsApprenti.joues > 0 && (statsApprenti.optimaux / statsApprenti.joues) >= 0.8 ? t('master_quote_high') : t('master_quote_low')}"
                  </p>
                </div>
              </div>
            )}
            {masterFeedback ? (
              <div className="mb-10 p-6 bg-blue-950/20 border border-blue-500/20 rounded-[2rem] relative overflow-hidden text-left shadow-inner">
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 pointer-events-none" aria-hidden="true">🐉</div>
                <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-3 relative z-10">{t('master_analysis')}</h4>
                <p className="text-sm text-blue-100 relative z-10 whitespace-pre-wrap">"{masterFeedback}"</p>
              </div>
            ) : onAskMaster && (
              <button onClick={onAskMaster} disabled={isAskingMaster} className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-blue-900/50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 mb-3 flex items-center justify-center gap-3 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-sm uppercase tracking-widest">
                {isAskingMaster ? (
                  <span className="animate-pulse">{t('master_analyzing')}</span>
                ) : (
                  <>🐉 {t('master_analysis')}</>
                )}
              </button>
            )}
            
            <div className="space-y-3">
              {mode !== 'Online' && !tournoi.actif && restartGame && (
                <button onClick={restartGame} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                  <RotateCcw size={20} /> {t('restart_game')}
                </button>
              )}
              <button onClick={handleShareClick} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                <Share2 size={20} /> {t('share_result')}
              </button>
              {showShareOptions && (
                <div className="flex justify-center gap-4 py-2 animate-in fade-in slide-in-from-top-2">
                  <button onClick={shareToWhatsApp} className="bg-green-500 hover:bg-green-400 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="WhatsApp">
                    <MessageCircle size={24} />
                  </button>
                  <button onClick={shareToTwitter} className="bg-black hover:bg-stone-800 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="X (Twitter)">
                    <Twitter size={24} />
                  </button>
                  <button onClick={shareToFacebook} className="bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="Facebook">
                    <Facebook size={24} />
                  </button>
                  <button onClick={copyLink} className="bg-stone-700 hover:bg-stone-600 text-white p-3 rounded-full transition-all shadow-lg hover:scale-110" aria-label="Copier le lien">
                    <Link size={24} />
                  </button>
                </div>
              )}
              <button onClick={() => setShowHistoryModal(true)} className="w-full bg-stone-900 hover:bg-stone-800 text-stone-400 py-4 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest">
                <History size={20} /> {t('history_title')}
              </button>
              {tournoi.actif && tournoi.mancheActuelle < tournoi.totalManches ? (
                <button onClick={nextTournamentRound} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-purple-900/20 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 text-sm uppercase tracking-widest">
                  <Swords size={20} /> {t('next_round')}
                </button>
              ) : (
                <button onClick={resetToMenu} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-900/20 border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 text-sm uppercase tracking-widest">
                  {t('back_to_menu')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
