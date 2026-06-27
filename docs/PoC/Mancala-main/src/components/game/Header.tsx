import React from 'react';
import { Info, MessageCircle, Volume2, VolumeX, Undo2, HelpCircle, Save, RefreshCcw, Swords, Mic, Contrast } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../utils/i18n';
import { TournamentState } from '../../types';

interface HeaderProps {
  mode: string;
  tournoi: TournamentState;
  onlineRoomId: string | null;
  statsApprenti: { joues: number; optimaux: number };
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  initAudio: () => void;
  handleUndo: () => void;
  historyLength: number;
  isThinking: boolean;
  isAnimating: boolean;
  setShowHelp: (v: boolean) => void;
  setShowAbout: (v: boolean) => void;
  saveGame: () => void;
  setShowForfeitConfirm: (v: boolean) => void;
  setShowChatMenu: (v: boolean) => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  mode, tournoi, onlineRoomId, statsApprenti, soundEnabled, setSoundEnabled, initAudio,
  handleUndo, historyLength, isThinking, isAnimating, setShowHelp, setShowAbout, saveGame, setShowForfeitConfirm, setShowChatMenu
}) => {
  const { language, highContrast, setHighContrast } = useSettingsStore();
  const timeLeft = useGameStore(state => state.timeLeft);
  const timerActive = useGameStore(state => state.timerActive);
  const gameState = useGameStore(state => state.gameState);
  const t = useTranslation(language);

  const showTimer = timerActive && gameState === 'playing';

  return (
    <div className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 px-1 lg:px-2 gap-3 sm:gap-0 mt-2 lg:mt-0 shrink-0">
      <div className="w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-500 tracking-widest flex items-center gap-2 sm:gap-3">
          {t('game_title')}
        </h1>
        <div className="flex flex-col items-start gap-1 text-[10px] sm:text-xs lg:text-sm text-amber-300/60 sm:mt-1">
          <span className="flex items-center gap-1"><Info size={12} /> {t('objective')}</span>
          {mode === 'Online' && onlineRoomId && (
            <span className="flex items-center gap-1 text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap">
              {t('village')} {onlineRoomId}
            </span>
          )}
          {(mode === 'Tournoi' || tournoi.actif) && (
            <span className="text-[10px] sm:text-xs lg:text-sm bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
              <Swords size={12} /> {t('round')} {tournoi.mancheActuelle}/{tournoi.totalManches}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-row flex-wrap w-full sm:w-auto justify-center sm:justify-end gap-1.5 sm:gap-2 mt-2 sm:mt-0">
        {mode === 'Online' && (
          <button onClick={() => setShowChatMenu(true)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none min-w-[3.5rem]"
            title={t('chat')}
            aria-label={t('chat')}>
            <MessageCircle size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap font-medium">{t('chat')}</span>
          </button>
        )}

        <button onClick={() => setHighContrast(!highContrast)}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none min-w-[3.5rem] ${highContrast ? 'bg-stone-800 hover:bg-blue-900/50 text-blue-200 border-stone-700' : 'bg-stone-900 text-stone-500 border-stone-800'}`}
          title={t('high_contrast')}
          aria-label={t('high_contrast')}
          aria-pressed={highContrast}>
          <Contrast size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button onClick={() => { setSoundEnabled(!soundEnabled); initAudio(); }}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none min-w-[3.5rem] ${soundEnabled ? 'bg-stone-800 hover:bg-blue-900/50 text-blue-200 border-stone-700' : 'bg-stone-900 text-stone-500 border-stone-800'}`}
          title={t('sound')}
          aria-label={t('sound')}
          aria-pressed={soundEnabled}>
          {soundEnabled ? <Volume2 size={16} className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX size={16} className="w-4 h-4 sm:w-5 sm:h-5" />}
          <span className="whitespace-nowrap font-medium">{t('sound')}</span>
        </button>

        <button onClick={handleUndo} disabled={historyLength === 0 || isThinking || isAnimating || mode === 'Online'}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border focus:outline-none focus:ring-2 focus:ring-orange-500/50 flex-1 sm:flex-none min-w-[3.5rem] ${historyLength > 0 && !isThinking && !isAnimating && mode !== 'Online' ? 'bg-stone-800 hover:bg-orange-900/50 text-orange-200 border-stone-700' : 'bg-stone-900 text-stone-600 border-stone-800 cursor-not-allowed'}`}
          title={t('undo')}
          aria-label={t('undo')}>
          <Undo2 size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="whitespace-nowrap font-medium">{t('undo')}</span>
        </button>

        <button onClick={() => setShowHelp(true)}
          className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm bg-stone-800 hover:bg-indigo-900/50 text-indigo-200 px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-stone-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex-1 sm:flex-none min-w-[3.5rem]"
          title={t('help')}
          aria-label={t('help')}>
          <HelpCircle size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="whitespace-nowrap font-medium">{t('help')}</span>
        </button>

        <button onClick={() => setShowAbout(true)}
          className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm bg-stone-800 hover:bg-teal-900/50 text-teal-200 px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 flex-1 sm:flex-none min-w-[3.5rem]"
          title={t('about')}
          aria-label={t('about')}>
          <Info size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="whitespace-nowrap font-medium">{t('about')}</span>
        </button>

        <button onClick={saveGame} disabled={mode === 'Online'}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border focus:outline-none focus:ring-2 flex-1 sm:flex-none min-w-[3.5rem] ${mode === 'Online' ? 'bg-stone-900 text-stone-600 border-stone-800 cursor-not-allowed' : 'bg-stone-800 hover:bg-green-900/50 text-green-200 border-stone-700 focus:ring-green-500/50'}`}
          title={t('save')}
          aria-label={t('save')}>
          <Save size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="whitespace-nowrap font-medium">{t('save')}</span>
        </button>

        <button onClick={() => setShowForfeitConfirm(true)}
          className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm bg-stone-800 hover:bg-red-900/50 text-red-200 px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 flex-1 sm:flex-none min-w-[3.5rem]"
          title={t('forfeit')}
          aria-label={t('forfeit')}>
          <RefreshCcw size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="whitespace-nowrap font-medium">{t('forfeit')}</span>
        </button>
      </div>
    </div>
  );
});
