import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { useFirebase } from './hooks/useFirebase';
import { useOnlineGame } from './hooks/useOnlineGame';
import { useAITurn } from './hooks/useAITurn';
// useOnlineSync removed
import { useAsyncError } from './hooks/useAsyncError';
import { initAudio, playSound } from './utils/audio';
import { appliquerCoupAnime } from './utils/gameAnimation';
import { getCoupsLegaux, checkFinPartie, appliquerCoup, estFamine, getDestinationHole } from './utils/gameLogic';
import { TOTAL_TROUS, TAILLE_CAMP, GRAINES_BOUCLE, PROVERBES, SEUIL_RARETE } from './utils/constants';
import { analyzeMove, analyzeGameHistory } from './services/gemini';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';
import { runStressTest } from './utils/stressTest';

// Expose stress test for manual load testing
if (typeof window !== 'undefined') {
  (window as any).runStressTest = runStressTest;
}

import { Menu } from './components/modals/Menu';
import { GameOver } from './components/modals/GameOver';
import { HistoryModal } from './components/modals/HistoryModal';
import { HelpModal } from './components/modals/HelpModal';
import { AboutModal } from './components/modals/AboutModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';
import { Header } from './components/game/Header';
import { Board } from './components/game/Board';
import { PlayerReserve } from './components/game/PlayerReserve';
import { LogPanel } from './components/game/LogPanel';
import { ChatMenu } from './components/modals/ChatMenu';
import { RefreshCcw, AlertTriangle, MessageCircle, X } from 'lucide-react';

import { useTranslation } from './utils/i18n';

const APP_ID = 'songo-master-online';

// Separate component for timer logic to prevent App re-renders every second
interface TurnIndicatorProps {
  joueurActuel: number;
  nomsJoueurs: string[];
  isThinking: boolean;
  mode: string;
  onlineRole: number | null;
}

const TurnIndicator = ({ joueurActuel, nomsJoueurs, isThinking, mode, onlineRole }: TurnIndicatorProps) => {
  const { language } = useSettingsStore();

  const t = useTranslation(language);
  const timeLeft = useGameStore(state => state.timeLeft);
  const timerActive = useGameStore(state => state.timerActive);
  const gameState = useGameStore(state => state.gameState);
  
  const showTimer = timerActive && gameState === 'playing';

  return (
    <div className="absolute top-3 lg:top-6 left-1/2 -translate-x-1/2 bg-stone-950/95 px-4 sm:px-8 py-2 sm:py-3 rounded-full border border-amber-700/40 font-bold tracking-widest shadow-2xl z-20 backdrop-blur-md text-[9px] sm:text-xs lg:text-sm ring-1 ring-amber-500/20 flex items-center gap-2 sm:gap-3 max-w-[95vw]">
      <div className="flex items-center gap-1.5 sm:gap-2 truncate">
        {joueurActuel === 1 ? (
          <span className="text-red-400 flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
            <span className="truncate">{t('turn_of')} {nomsJoueurs[1]}</span>
          </span>
        ) : (
          <span className="text-green-400 flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
            <span className="truncate">{t('turn_of')} {nomsJoueurs[0]}</span>
          </span>
        )}
        {isThinking && <span className="animate-bounce text-amber-200 shrink-0">...</span>}
      </div>
      
      {showTimer && (
        <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg border font-mono font-black shrink-0 ${timeLeft <= 10 ? 'text-red-400 bg-red-900/30 border-red-500/40 animate-pulse' : 'text-amber-400 bg-amber-900/30 border-amber-500/40'}`}>
          {timeLeft}s
        </span>
      )}

      {mode === 'Online' && joueurActuel === onlineRole && <span className="text-blue-400 font-black animate-pulse bg-blue-500/10 px-1.5 sm:px-2 py-0.5 rounded-md border border-blue-500/20 shrink-0 text-[8px] sm:text-[10px]">{t('your_turn')}</span>}
    </div>
  );
};

interface TimerLogicProps {
  mode: string;
  onlineRole: number | null;
  nomsJoueurs: string[];
  addLog: (msg: string, type: string) => void;
  handleMoveRef: React.MutableRefObject<((i: number) => Promise<void>) | undefined>;
}

// Separate component for timer logic to prevent App re-renders every second
const TimerLogic = ({ mode, onlineRole, nomsJoueurs, addLog, handleMoveRef }: TimerLogicProps) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);
  const timeLeft = useGameStore(state => state.timeLeft);
  const timerActive = useGameStore(state => state.timerActive);
  const gameState = useGameStore(state => state.gameState);
  const plateau = useGameStore(state => state.plateau);
  const greniers = useGameStore(state => state.greniers);
  const joueurActuel = useGameStore(state => state.joueurActuel);
  const setTimerActive = useGameStore(state => state.setTimerActive);
  const setTimeLeft = useGameStore(state => state.setTimeLeft);
  const setWinner = useGameStore(state => state.setWinner);
  const setGameState = useGameStore(state => state.setGameState);

  useEffect(() => {
    if (!timerActive || gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timerActive, gameState, setTimeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && timerActive && gameState === 'playing') {
      setTimerActive(false);
      if (mode === 'Online' && joueurActuel !== onlineRole) return;

      const coups = getCoupsLegaux(plateau, joueurActuel);
      if (coups.length > 0) {
        addLog(t('time_elapsed').replace('{0}', nomsJoueurs[joueurActuel]), 'warning');
        let worstMove = coups[0];
        let worstScore = Infinity;
        for (const move of coups) {
          let pCopy = plateau.slice();
          let gCopy = greniers.slice();
          appliquerCoup(pCopy, gCopy, joueurActuel, move);
          const myGain = gCopy[joueurActuel] - greniers[joueurActuel];
          const opp = 1 - joueurActuel;
          const oppCoups = getCoupsLegaux(pCopy, opp);
          let maxOppGain = 0;
          for (const oppMove of oppCoups) {
            let pCopy2 = pCopy.slice();
            let gCopy2 = gCopy.slice();
            appliquerCoup(pCopy2, gCopy2, opp, oppMove);
            const oppGain = gCopy2[opp] - gCopy[opp];
            if (oppGain > maxOppGain) maxOppGain = oppGain;
          }
          const score = myGain - maxOppGain;
          if (score < worstScore) {
            worstScore = score;
            worstMove = move;
          }
        }
        setTimeout(() => {
          if (handleMoveRef.current) handleMoveRef.current(worstMove, false, true, joueurActuel);
        }, 0);
      } else {
        setWinner(1 - joueurActuel);
        setGameState('gameover');
      }
    }
  }, [timeLeft, timerActive, gameState, joueurActuel, nomsJoueurs, mode, onlineRole, plateau, greniers, addLog, setTimerActive, setWinner, setGameState, handleMoveRef]);

  return null;
};

export default function App() {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  // Use individual selectors to prevent App re-renders on every store change (like timeLeft)
  const plateau = useGameStore(state => state.plateau);
  const setPlateau = useGameStore(state => state.setPlateau);
  const greniers = useGameStore(state => state.greniers);
  const setGreniers = useGameStore(state => state.setGreniers);
  const joueurActuel = useGameStore(state => state.joueurActuel);
  const setJoueurActuel = useGameStore(state => state.setJoueurActuel);
  const logs = useGameStore(state => state.logs);
  const setLogs = useGameStore(state => state.setLogs);
  const addLog = useGameStore(state => state.addLog);
  const history = useGameStore(state => state.history);
  const setHistory = useGameStore(state => state.setHistory);
  const lastMove = useGameStore(state => state.lastMove);
  const setLastMove = useGameStore(state => state.setLastMove);
  const isThinking = useGameStore(state => state.isThinking);
  const setIsThinking = useGameStore(state => state.setIsThinking);
  const isAnimating = useGameStore(state => state.isAnimating);
  const setIsAnimating = useGameStore(state => state.setIsAnimating);
  const animActiveCase = useGameStore(state => state.animActiveCase);
  const setAnimActiveCase = useGameStore(state => state.setAnimActiveCase);
  const winner = useGameStore(state => state.winner);
  const setWinner = useGameStore(state => state.setWinner);
  const gameState = useGameStore(state => state.gameState);
  const setGameState = useGameStore(state => state.setGameState);
  const setTimeLeft = useGameStore(state => state.setTimeLeft);
  const timerActive = useGameStore(state => state.timerActive);
  const setTimerActive = useGameStore(state => state.setTimerActive);
  const resetGame = useGameStore(state => state.resetGame);

  const throwError = useAsyncError();
  const { user, userStats, hasSave, quotaExceeded, saveGame: saveGameToFirebase, loadGame: loadGameFromFirebase, deleteSave, login, logout, resetElo, updateUserStats, getLeaderboard, getUserRank } = useFirebase(APP_ID, throwError);

  const workerRef = useRef<Worker | null>(null);
  const workerCallbacks = useRef<Record<number, Function>>({});
  const workerMsgId = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/aiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { msgId, result } = e.data;
      if (workerCallbacks.current[msgId]) {
        workerCallbacks.current[msgId](result);
        delete workerCallbacks.current[msgId];
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const getBestMoveAsync = useCallback((plateauArr: number[], greniersArr: number[], joueurAct: number, profondeur: number, isMax: boolean, joueurIa: number, clearTT = false, useMCTS = false, iterations = 5000) => {
    return new Promise<{bestMove: number | null, score: number}>((resolve) => {
      if (!workerRef.current) {
        resolve({ bestMove: null, score: 0 });
        return;
      }
      const id = ++workerMsgId.current;
      workerCallbacks.current[id] = resolve;
      workerRef.current.postMessage({
        msgId: id,
        action: 'calculate',
        plateau: Array.from(plateauArr),
        greniers: greniersArr,
        joueurActuel: joueurAct,
        profondeur,
        isMaximizing: isMax,
        joueurIa,
        clearTT,
        useMCTS,
        iterations
      });
    });
  }, []);

  const notifyPlayerMoveToAI = useCallback((plateauArr: number[], joueurActuel: number, move: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        action: 'learn',
        plateau: Array.from(plateauArr),
        joueurActuel,
        move
      });
    }
  }, []);

  const [mode, setMode] = useState('PvE');
  const [difficulty, setDifficulty] = useState('Vieux Sage');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [meilleurCoupTuteur, setMeilleurCoupTuteur] = useState<number | null>(null);
  const [statsApprenti, setStatsApprenti] = useState({ joues: 0, optimaux: 0 });
  const [tournoi, setTournoi] = useState({ actif: false, mancheActuelle: 1, totalManches: 2, scores: [0, 0] });
  const [nomsJoueurs, setNomsJoueurs] = useState(['SUD', 'NORD']);

  const [showPvPSetup, setShowPvPSetup] = useState(false);
  const [masterFeedback, setMasterFeedback] = useState<string | null>(null);
  const [isAskingMaster, setIsAskingMaster] = useState(false);
  const [showTournamentSetup, setShowTournamentSetup] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [forfeitLoser, setForfeitLoser] = useState<number | null>(null);
  const [finalMatchScores, setFinalMatchScores] = useState<number[]>([0, 0]);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [previewDest, setPreviewDest] = useState<number | null>(null);
  const [showOrientationBanner, setShowOrientationBanner] = useState(true);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);

  useEffect(() => {
    if (quotaExceeded) {
      setShowQuotaWarning(true);
      const timer = setTimeout(() => setShowQuotaWarning(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [quotaExceeded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOrientationBanner(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && userStats && (gameState === 'menu' || gameState === 'gameover')) {
      getUserRank().then(rank => setUserRank(rank));
    }
    // Only update rank when entering menu or game over, not on every stats change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, getUserRank, gameState]);

  const handlePreview = useCallback((idx: number | null) => {
    if (idx === null || plateau[idx] === 0 || isAnimating || isThinking) {
      setPreviewDest(null);
      return;
    }
    const dest = getDestinationHole(idx, plateau[idx], joueurActuel);
    setPreviewDest(dest);
  }, [plateau, isAnimating, isThinking, joueurActuel]);

  const {
    onlineRoomId, setOnlineRoomId, onlineRole, setOnlineRole,
    isWaitingForOpponent, setIsWaitingForOpponent, showOnlineModal, setShowOnlineModal,
    tempName1, setTempName1, tempName2, setTempName2, inputRoomId, setInputRoomId,
    chatBubbles, setChatBubbles, pendingStakeAmount, setPendingStakeAmount, opponentElo, lastSyncMoveRef, remoteMoveQueue, lastEmojiTimestampRef,
    createOnlineRoom, joinOnlineRoom, leaveOnlineRoom, rejectStake, forfeitOnlineMatch, sendQuickChat, nextOnlineTournamentRound,
    playOnlineMove, confirmPaymentOnline
  } = useOnlineGame(user, userStats, addLog, t);

  const handleAskMaster = useCallback(async () => {
    setIsAskingMaster(true);
    const historyLogs = logs.map(l => l.text);
    const feedback = await analyzeGameHistory(historyLogs, mode, onlineRole, nomsJoueurs, language);
    setMasterFeedback(feedback);
    setIsAskingMaster(false);
  }, [logs, mode, onlineRole, nomsJoueurs, language]);

  const stateRef = useRef({ plateau, greniers, joueurActuel });
  useEffect(() => { stateRef.current = { plateau, greniers, joueurActuel }; }, [plateau, greniers, joueurActuel]);

  const isAnimatingRef = useRef(false);
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);

  const handleMoveRef = useRef<((i: number) => Promise<void>) | undefined>();
  const gameSessionIdRef = useRef(0);

  useEffect(() => {
    if (!isAnimating && remoteMoveQueue.current.length > 0 && handleMoveRef.current) {
      const nextMove = remoteMoveQueue.current.shift();
      setTimeout(() => {
        if (handleMoveRef.current) handleMoveRef.current(nextMove!, true);
      }, 50);
    }
  }, [isAnimating]);

  const confirmForfeit = useCallback(async (forfeitingPlayer: number | null = null, emitToNetwork: boolean = true) => {
    if (gameState === 'gameover') return; // Sécurité : ne pas traiter un abandon si la partie est déjà finie
    setShowForfeitConfirm(false);
    gameSessionIdRef.current += 1;
    setIsAnimating(false);
    setIsThinking(false);
    playSound('abandon', soundEnabled);

    const loser = forfeitingPlayer !== null ? forfeitingPlayer : 0;
    const forfaitWinner = 1 - loser;

    setWinner(forfaitWinner);
    setForfeitLoser(loser);
    setFinalMatchScores([...greniers]);
    addLog(t('player_forfeit').replace('{0}', nomsJoueurs[loser]), 'warning', true);

    if (mode === 'Online' && onlineRole !== null) {
      if (emitToNetwork && forfeitingPlayer === onlineRole) {
        forfeitOnlineMatch();
      }
      if (forfaitWinner === onlineRole) updateUserStats('win', opponentElo);
      else updateUserStats('loss', opponentElo);
    }

    if (mode === 'Tournoi' || tournoi.actif) {
      setTournoi(prev => {
        const newScores = [...prev.scores];
        newScores[forfaitWinner]++;
        return { ...prev, scores: newScores };
      });
    }
    setGameState('gameover');
  }, [soundEnabled, nomsJoueurs, mode, tournoi.actif, addLog, onlineRoomId, onlineRole, user, gameState, updateUserStats, opponentElo, forfeitOnlineMatch]);

  useEffect(() => {
    const handleRemoteForfeit = (e: Event) => {
       const role = (e as CustomEvent<{ role: number }>).detail?.role;
       if (role !== undefined && role !== null) {
          confirmForfeit(role, false);
       }
    };
    window.addEventListener('remoteForfeit', handleRemoteForfeit as EventListener);
    return () => {
       window.removeEventListener('remoteForfeit', handleRemoteForfeit as EventListener);
    };
  }, [confirmForfeit]);

  useEffect(() => {
    // Before unload forfeit handled by leaveRoom via Socket.io if possible,
    // but typically we rely on server detecting disconnection.
    // Manual forfeit via button already emits 'leaveRoom' in leaveOnlineRoom.
    return () => {};
  }, []);

  // useOnlineSync is no longer needed as Socket.io handles real-time updates

  const saveGame = useCallback(async () => {
    if (mode === 'Online') {
      addLog(t('online_sync_msg'), 'warning');
      return;
    }
    const stateToSave = {
      plateau, greniers, joueurActuel, mode, difficulty, logs, statsApprenti,
      tournoi, history, lastMove, nomsJoueurs, timestamp: Date.now()
    };
    const success = await saveGameToFirebase(stateToSave, mode === 'Online');
    if (success) addLog(t('save_success'), 'success');
    else addLog(t('save_error'), 'warning');
  }, [mode, plateau, greniers, joueurActuel, difficulty, logs, statsApprenti, tournoi, history, lastMove, nomsJoueurs, saveGameToFirebase, addLog, t]);

  const loadGame = useCallback(async () => {
    initAudio();
    gameSessionIdRef.current += 1;
    const state = await loadGameFromFirebase();
    if (state) {
      setPlateau(state.plateau);
      setGreniers(state.greniers);
      setJoueurActuel(state.joueurActuel);
      setMode(state.mode);
      setDifficulty(state.difficulty);
      setLogs(state.logs);
      setStatsApprenti(state.statsApprenti);
      setTournoi(state.tournoi);
      setHistory(state.history || []);
      setLastMove(state.lastMove || null);
      setNomsJoueurs(state.nomsJoueurs || ['SUD', 'NORD']);
      setGameState('playing');
      setWinner(null);
      setForfeitLoser(null);
      setFinalMatchScores([0, 0]);
      addLog(t('restore_success'), 'success');
    } else {
      addLog(t('no_save_found'), 'warning');
    }
  }, [loadGameFromFirebase, addLog, setPlateau, setGreniers, setJoueurActuel, setMode, setDifficulty, setLogs, setStatsApprenti, setTournoi, setHistory, setLastMove, setNomsJoueurs, setGameState, setWinner, t]);

  const startGame = useCallback((selectedMode: string, selectedDiff: string, premierJoueur = 0, isNextRound = false, roundNum = 1, customNames: string[] | null = null) => {
    initAudio();
    playSound('start', soundEnabled);
    gameSessionIdRef.current += 1;
    setIsThinking(false);
    setIsAnimating(false);
    setAnimActiveCase(null);
    setShowForfeitConfirm(false);
    setForfeitLoser(null);
    setFinalMatchScores([0, 0]);

    setMode(selectedMode);
    setDifficulty(selectedDiff);
    setPlateau(Array(TOTAL_TROUS).fill(5));
    setGreniers([0, 0]);
    setJoueurActuel(premierJoueur);
    setHistory([]);
    setLastMove(null);
    setMeilleurCoupTuteur(null);
    setTimeLeft(30);
    setTimerActive(true);

    if (customNames) {
      setNomsJoueurs(customNames);
    } else if (selectedMode === 'Apprenti') {
      setNomsJoueurs([t('little_dragon', 'Petit Dragon'), t('master_bruce_lee', 'Maître Bruce Lee')]);
    } else if (selectedMode !== 'PvP') {
      setNomsJoueurs([t('you', 'Vous'), t('ai_bot', `IA ({0})`).replace('{0}', selectedDiff)]);
    }

    if (!isNextRound) {
      setStatsApprenti({ joues: 0, optimaux: 0 });
      if (selectedMode !== 'Tournoi') {
        setTournoi({ actif: false, mancheActuelle: 1, totalManches: 2, scores: [0, 0] });
      }
      setLogs([]);
    }

    let debutMsg = t('game_started').replace('{0}', selectedMode === 'PvP' ? t('mode_pvp_label') : selectedMode === 'Apprenti' ? t('mode_dojo_label') : t('mode_pve_label').replace('{0}', selectedDiff));
    if (selectedMode === 'Tournoi') debutMsg = t('mode_tournament_start').replace('{0}', String(roundNum)).replace('{1}', selectedDiff);
    addLog(debutMsg, 'info');

    const nomAfficheur = customNames ? customNames[premierJoueur] :
      (selectedMode === 'Apprenti' && premierJoueur === 1 ? t('master_bruce_lee', 'Maître Bruce Lee') :
        (selectedMode !== 'PvP' && premierJoueur === 1 ? t('ai_bot', `IA ({0})`).replace('{0}', selectedDiff) :
          (premierJoueur === 0 && selectedMode === 'Apprenti' ? t('little_dragon', 'Petit Dragon') :
            (premierJoueur === 0 ? t('you') : t('north_warrior', 'NORD')))));

    addLog(`${nomAfficheur} ${t('has_the_lead')}`, 'warning');
    setGameState('playing');
    setWinner(null);
  }, [soundEnabled, addLog, t]);

  const startTournament = useCallback((manches: number, diff: string) => {
    setTournoi({ actif: true, mancheActuelle: 1, totalManches: manches, scores: [0, 0] });
    startGame('Tournoi', diff, 0, false, 1);
    setShowTournamentSetup(false);
  }, [startGame]);

  const nextTournamentRound = useCallback(() => {
    const nextRound = tournoi.mancheActuelle + 1;
    const premierJoueur = (nextRound - 1) % 2;
    setTournoi(prev => ({ ...prev, mancheActuelle: nextRound }));
    startGame('Tournoi', difficulty, premierJoueur, true, nextRound);
  }, [tournoi.mancheActuelle, difficulty, startGame]);

  const handleUndo = useCallback(() => {
    if (isThinking || isAnimating || history.length === 0 || mode === 'Online') return;
    let stepBack = 1;
    const isPvE = (mode === 'PvE' || mode === 'Apprenti' || mode === 'Tournoi');
    if (isPvE && history.length >= 2) stepBack = 2;
    const targetIndex = history.length - stepBack;
    const prevState = history[targetIndex];
    setPlateau(prevState.plateau);
    setGreniers(prevState.greniers);
    setJoueurActuel(prevState.joueurActuel);
    setLogs(prevState.logs);
    setLastMove(prevState.lastMove);
    setMeilleurCoupTuteur(null);
    setHistory(prev => prev.slice(0, targetIndex));
    setWinner(null);
    setGameState('playing');
    addLog(t('action_undone'), 'warning');
  }, [isThinking, isAnimating, history.length, mode, addLog, t]);

  useEffect(() => {
    let isActive = true;
    if (mode === 'Apprenti' && joueurActuel === 0 && gameState === 'playing' && !isThinking && !isAnimating) {
      setMeilleurCoupTuteur(null);
      const currentSession = gameSessionIdRef.current;
      getBestMoveAsync(plateau, greniers, 0, 4, true, 0, true).then(res => {
        if (isActive && currentSession === gameSessionIdRef.current && res) {
          setMeilleurCoupTuteur(res.bestMove);
        }
      });
    }
    return () => { isActive = false; };
  }, [joueurActuel, plateau, greniers, mode, gameState, isThinking, isAnimating, getBestMoveAsync]);

  const handleMove = useCallback(async (move: number, isRemote = false, force = false, expectedPlayer?: number) => {
    if (expectedPlayer !== undefined && joueurActuel !== expectedPlayer) return;
    if (!force && isThinking) return;
    if (isAnimating || plateau[move] === 0) return;
    if (mode === 'Online' && !isRemote && joueurActuel !== onlineRole) return;

    setTimerActive(false);

    const coupsLegaux = getCoupsLegaux(plateau, joueurActuel);
    if (!coupsLegaux.includes(move)) {
      if (!isRemote) {
        addLog(t('move_forbidden'), 'warning');
        playSound('error', soundEnabled);
      }
      return;
    }

    if (mode === 'Online' && !isRemote && db && user) {
      const moveId = Date.now();
      lastSyncMoveRef.current = moveId;
      playOnlineMove(move);
    }

    // Notify AI for adaptive learning if it's a player move against AI
    if (!isRemote && (mode === 'PvE' || mode === 'Apprenti' || mode === 'Tournoi')) {
      notifyPlayerMoveToAI(plateau, joueurActuel, move);
    }

    setHistory(prev => [...prev, { plateau: plateau.slice(), greniers: greniers.slice(), joueurActuel, logs: [...logs], lastMove }]);
    setIsAnimating(true);
    setLastMove(move);
    const uiIdx = getLabel(move);
    addLog(`${nomsJoueurs[joueurActuel]} joue la case ${uiIdx}.`, joueurActuel === 0 ? 'sud' : 'nord', true);

    if (mode === 'Apprenti' && joueurActuel === 0 && !force) {
      setStatsApprenti(prev => ({ ...prev, joues: prev.joues + 1 }));
      const isOptimal = move === meilleurCoupTuteur || meilleurCoupTuteur === null;
      if (isOptimal) setStatsApprenti(prev => ({ ...prev, optimaux: prev.optimaux + 1 }));
      
      // Use Gemini to analyze the move (non-blocking)
      const uiMeilleurCoup = meilleurCoupTuteur !== null ? getLabel(meilleurCoupTuteur) : null;
      analyzeMove(plateau, greniers, 0, move, isOptimal, uiIdx, uiMeilleurCoup, language)
        .then(analysis => {
          addLog(`🐉 Bruce Lee : "${analysis}"`, isOptimal ? 'success' : 'warning');
        })
        .catch(err => console.error("Gemini analysis failed:", err));
        
      setMeilleurCoupTuteur(null);
    }

    const currentSession = gameSessionIdRef.current;
    const checkActive = () => gameSessionIdRef.current === currentSession;

    const result = await appliquerCoupAnime({
      plateauInit: plateau,
      greniersInit: greniers,
      joueur: joueurActuel,
      move,
      checkActive,
      setPlateau,
      setGreniers,
      setAnimActiveCase,
      playSound,
      soundEnabled,
      t
    });
    if (result.aborted) return;

    const { msg, newPlateau, newGreniers } = result;
    if (msg) {
      addLog(msg, joueurActuel === 0 ? 'sud' : 'nord', true);
    }

    const fin = checkFinPartie(newPlateau!, newGreniers!);
    if (fin !== -1) {
      if ((mode === 'PvE' || mode === 'Apprenti' || mode === 'Tournoi') && fin === 1) playSound('lose', soundEnabled);
      else playSound('win', soundEnabled);

      // Si la fin est due à la rareté des graines, on ramasse les restes pour l'affichage final
      const totalRestant = newPlateau!.reduce((a, b) => a + b, 0);
      if (totalRestant < SEUIL_RARETE && totalRestant > 0) {
        const sumSud = newPlateau!.slice(0, TAILLE_CAMP).reduce((a, b) => a + b, 0);
        const sumNord = newPlateau!.slice(TAILLE_CAMP, TOTAL_TROUS).reduce((a, b) => a + b, 0);
        newGreniers![0] += sumSud;
        newGreniers![1] += sumNord;
        newPlateau!.fill(0);
        setPlateau([...newPlateau!]);
        setGreniers([...newGreniers!]);
      }

      setWinner(fin);
      setFinalMatchScores([...newGreniers!]);
      if (mode === 'Tournoi' || tournoi.actif) {
        setTournoi(prev => {
          const newScores = [...prev.scores];
          if (fin === 0) newScores[0]++;
          else if (fin === 1) newScores[1]++;
          else if (fin === 2) {
            // Égalité parfaite : 1 point pour chacun
            newScores[0]++;
            newScores[1]++;
          }
          
          if (mode === 'Online' && onlineRole === 0 && db && onlineRoomId) {
            // Server now handles tournament score updates for online games
          }
          
          return { ...prev, scores: newScores };
        });
      }
      setIsAnimating(false);
      setGameState('gameover');
      return;
    }

    const nextJoueur = 1 - joueurActuel;
    const nextCoups = getCoupsLegaux(newPlateau!, nextJoueur);

    if (nextCoups.length === 0) {
      addLog(t('famine_irreversible', `Famine irréversible ! {0} ne peut pas jouer.`).replace('{0}', nomsJoueurs[nextJoueur]), 'warning', true);
      let sumSud = 0, sumNord = 0;
      for (let i = 0; i < TAILLE_CAMP; i++) sumSud += newPlateau![i];
      for (let i = TAILLE_CAMP; i < TOTAL_TROUS; i++) sumNord += newPlateau![i];

      newGreniers![0] += sumSud;
      newGreniers![1] += sumNord;

      const finalPlateau = Array(TOTAL_TROUS).fill(0);
      setPlateau(finalPlateau);
      setGreniers(newGreniers!);

      const finFamine = newGreniers![0] > newGreniers![1] ? 0 : (newGreniers![1] > newGreniers![0] ? 1 : 2);
      if ((mode === 'PvE' || mode === 'Apprenti' || mode === 'Tournoi') && finFamine === 1) playSound('lose', soundEnabled);
      else playSound('win', soundEnabled);

      setWinner(finFamine);
      setFinalMatchScores([...newGreniers!]);

      if (mode === 'Online' && onlineRole !== null) {
        if (finFamine === onlineRole) updateUserStats('win', opponentElo);
        else if (finFamine === 2) updateUserStats('draw', opponentElo);
        else updateUserStats('loss', opponentElo);
      }

      if (mode === 'Tournoi' || tournoi.actif) {
        setTournoi(prev => {
          const newScores = [...prev.scores];
          if (finFamine === 0) newScores[0]++;
          else if (finFamine === 1) newScores[1]++;
          else if (finFamine === 2) {
            // Égalité parfaite en famine : 1 point pour chacun
            newScores[0]++;
            newScores[1]++;
          }
          
          if (mode === 'Online' && onlineRole === 0 && db && onlineRoomId) {
            // Server now handles tournament score updates for online games
          }
          
          return { ...prev, scores: newScores };
        });
      }
      setIsAnimating(false);
      setGameState('gameover');
      return;
    }

    setJoueurActuel(nextJoueur);
    setIsAnimating(false);
    setTimeLeft(30);
    setTimerActive(true);

  }, [plateau, greniers, joueurActuel, isThinking, isAnimating, mode, meilleurCoupTuteur, tournoi, logs, nomsJoueurs, soundEnabled, addLog, onlineRoomId, onlineRole, user, setTimeLeft, setTimerActive]);

  useEffect(() => {
    handleMoveRef.current = handleMove;
  }, [handleMove]);

  const onPlayStable = useCallback((idx: number) => {
    if (handleMoveRef.current) handleMoveRef.current(idx);
  }, []);

  useAITurn({
    gameState,
    joueurActuel,
    mode,
    difficulty,
    plateau,
    greniers,
    isThinking,
    isAnimating,
    setIsThinking,
    addLog,
    getBestMoveAsync,
    handleMoveRef,
    gameSessionIdRef,
    t
  });

  if (gameState === 'menu') {
    return (
      <>
        <Menu
          hasSave={hasSave} loadGame={loadGame} deleteSave={deleteSave}
          showOnlineModal={showOnlineModal} setShowOnlineModal={setShowOnlineModal}
          isWaitingForOpponent={isWaitingForOpponent} onlineRoomId={onlineRoomId} leaveOnlineRoom={() => leaveOnlineRoom(setGameState, setMode)} rejectStake={rejectStake}
          tempName1={tempName1} setTempName1={setTempName1} tempName2={tempName2} setTempName2={setTempName2}
          inputRoomId={inputRoomId} setInputRoomId={setInputRoomId}
          pendingStakeAmount={pendingStakeAmount} setPendingStakeAmount={setPendingStakeAmount}
          createOnlineRoom={(rounds, stake) => createOnlineRoom(setPlateau, setGreniers, setJoueurActuel, setNomsJoueurs, setMode, setGameState, setTournoi, rounds, stake)}
          joinOnlineRoom={(id) => joinOnlineRoom(id, setPlateau, setGreniers, setJoueurActuel, setNomsJoueurs, setMode, setGameState, setTournoi)}
          confirmPaymentOnline={confirmPaymentOnline}
          showPvPSetup={showPvPSetup} setShowPvPSetup={setShowPvPSetup}
          startGame={startGame}
          showTournamentSetup={showTournamentSetup} setShowTournamentSetup={setShowTournamentSetup}
          tournoi={tournoi} setTournoi={setTournoi}
          difficulty={difficulty} setDifficulty={setDifficulty}
          startTournament={startTournament}
          addLog={addLog}
          user={user}
          userStats={userStats}
          login={login}
          logout={logout}
          resetElo={resetElo}
          setShowHelp={setShowHelp}
          setShowAbout={setShowAbout}
          setShowLeaderboard={setShowLeaderboard}
          userRank={userRank}
        />
        {showHelp && <HelpModal setShowHelp={setShowHelp} />}
        {showAbout && (
          <AboutModal 
            onClose={() => setShowAbout(false)} 
          />
        )}
        {showLeaderboard && (
          <LeaderboardModal 
            onClose={() => setShowLeaderboard(false)} 
            getLeaderboard={getLeaderboard}
            currentUserUid={user?.uid}
          />
        )}
      </>
    );
  }

  const isFlipped = mode === 'Online' && onlineRole === 1;
  const topPlayer = isFlipped ? 0 : 1;
  const bottomPlayer = isFlipped ? 1 : 0;
  const topIndices = isFlipped ? [6, 5, 4, 3, 2, 1, 0] : [13, 12, 11, 10, 9, 8, 7];
  const bottomIndices = isFlipped ? [7, 8, 9, 10, 11, 12, 13] : [0, 1, 2, 3, 4, 5, 6];

  const canPlayerPlay = (playerIdx: number) => {
    if (mode === 'PvP') return true;
    if (mode === 'Online') return onlineRole === playerIdx;
    return playerIdx === 0;
  };

  const getLabel = (idx: number) => idx < 7 ? idx + 1 : idx - 6;

  return (
    <div className="min-h-[100dvh] bg-stone-950 text-stone-50 flex flex-col items-center justify-start lg:justify-center p-2 lg:p-6 overflow-x-hidden max-w-[100vw] selection:bg-amber-500/30">
      {showQuotaWarning && (
        <div className="fixed top-0 left-0 w-full bg-red-950/90 text-red-200 text-[10px] sm:text-xs p-2 z-[100] flex justify-center items-center gap-2 backdrop-blur-md border-b border-red-500/30 animate-in fade-in slide-in-from-top duration-500">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="flex-1 text-center">{t('quota_exceeded_msg')}</span>
          <button onClick={() => setShowQuotaWarning(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCcw size={14} className="rotate-45" />
          </button>
        </div>
      )}
      {showOrientationBanner && (
        <div className="hidden portrait:flex md:portrait:hidden fixed top-0 left-0 w-full bg-blue-950/95 text-blue-100 text-[10px] sm:text-xs p-3 z-50 justify-center items-center gap-3 backdrop-blur-md border-b border-blue-500/30 shadow-lg">
          <div className="bg-blue-500 p-1 rounded-full animate-pulse">
            <RefreshCcw size={14} className="text-white" />
          </div>
          <span className="font-medium">{t('landscape_hint')}</span>
        </div>
      )}

      <Header
        mode={mode} tournoi={tournoi} onlineRoomId={onlineRoomId} statsApprenti={statsApprenti}
        soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} initAudio={initAudio}
        handleUndo={handleUndo} historyLength={history.length} isThinking={isThinking} isAnimating={isAnimating}
        setShowHelp={setShowHelp} setShowAbout={setShowAbout} saveGame={saveGame} setShowForfeitConfirm={setShowForfeitConfirm} setShowChatMenu={setShowChatMenu}
      />

      <TimerLogic mode={mode} onlineRole={onlineRole} nomsJoueurs={nomsJoueurs} addLog={addLog} handleMoveRef={handleMoveRef} />

      {quotaExceeded && (
        <div className="w-full max-w-6xl mb-4 bg-red-900/40 border border-red-500/50 p-3 rounded-xl flex items-center gap-3 animate-pulse">
          <div className="bg-red-500 p-1.5 rounded-full">
            <RefreshCcw size={16} className="text-white" />
          </div>
          <div className="text-red-200 text-xs sm:text-sm font-bold">
            {t('quota_exceeded_msg', "Le service est temporairement saturé (quota atteint). Certaines fonctionnalités peuvent être indisponibles.")}
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch lg:items-start">
        <div className="flex-1 w-full bg-gradient-to-br from-amber-900/90 to-amber-950 rounded-3xl lg:rounded-[2.5rem] p-2 sm:p-6 lg:p-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.9),_0_20px_40px_rgba(0,0,0,0.6)] border-2 lg:border-4 border-amber-950/80 relative overflow-hidden flex flex-col min-h-[400px] lg:min-h-[600px]">
          <RefreshCcw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-900/5 w-64 h-64 lg:w-96 lg:h-96 pointer-events-none" aria-hidden="true" />
          
          <TurnIndicator joueurActuel={joueurActuel} nomsJoueurs={nomsJoueurs} isThinking={isThinking} mode={mode} onlineRole={onlineRole} />

          <div className="flex flex-col lg:flex-row items-center justify-center mt-16 lg:mt-20 gap-6 sm:gap-8 lg:gap-12 relative z-10 w-full flex-1">
            <PlayerReserve 
              joueurActuel={joueurActuel} 
              playerIdx={topPlayer} 
              grenier={greniers[topPlayer]} 
              nomJoueur={nomsJoueurs[topPlayer]} 
              isTopPlayer={true} 
              chatBubble={chatBubbles[topPlayer]} 
              apprenticeScore={mode === 'Apprenti' ? (statsApprenti.joues > 0 ? Math.round((statsApprenti.optimaux / statsApprenti.joues) * 100) : 0) : null}
            />
            <Board
              plateau={plateau} joueurActuel={joueurActuel} topPlayer={topPlayer} bottomPlayer={bottomPlayer}
              topIndices={topIndices} bottomIndices={bottomIndices} lastMove={lastMove} animActiveCase={animActiveCase}
              isThinking={isThinking} isAnimating={isAnimating} canPlayerPlay={canPlayerPlay} getLabel={getLabel} onPlayStable={onPlayStable} nomsJoueurs={nomsJoueurs}
              previewDest={previewDest} meilleurCoupTuteur={meilleurCoupTuteur} onPreview={handlePreview}
            />
            <PlayerReserve joueurActuel={joueurActuel} playerIdx={bottomPlayer} grenier={greniers[bottomPlayer]} nomJoueur={nomsJoueurs[bottomPlayer]} isTopPlayer={false} chatBubble={chatBubbles[bottomPlayer]} />
          </div>

          <div className="mt-6 lg:mt-8 flex justify-center items-center gap-2 sm:gap-3 shrink-0">
            <div className="h-px w-12 sm:w-16 bg-gradient-to-r from-transparent to-amber-500/30"></div>
            <div className="text-center text-amber-500/50 text-[10px] sm:text-xs lg:text-sm font-bold tracking-widest whitespace-nowrap">
              GRAINES EN JEU : <span className="text-amber-200/80 bg-stone-900/50 px-2 py-1 rounded-md ml-1">{plateau.reduce((a, b) => a + b, 0)}</span>
            </div>
            <div className="h-px w-12 sm:w-16 bg-gradient-to-l from-transparent to-amber-500/30"></div>
          </div>
        </div>

        <LogPanel logs={logs} mode={mode} />
      </div>

      {gameState === 'gameover' && (
        <GameOver
          tournoi={tournoi} nomsJoueurs={nomsJoueurs} winner={winner} forfeitLoser={forfeitLoser} greniers={finalMatchScores} mode={mode} statsApprenti={statsApprenti}
          setShowHistoryModal={setShowHistoryModal} nextTournamentRound={mode === 'Online' ? nextOnlineTournamentRound : nextTournamentRound}
          onAskMaster={handleAskMaster} masterFeedback={masterFeedback} isAskingMaster={isAskingMaster}
          onlineRole={onlineRole}
          restartGame={() => {
            startGame(mode, difficulty, 0, false, 1, mode === 'PvP' ? nomsJoueurs : null);
          }}
          resetToMenu={async () => {
            // On quitte d'abord la salle pour éviter de voir le plateau
            await leaveOnlineRoom(setGameState, setMode, true);
            setGameState('menu'); 
            setTournoi({ actif: false, mancheActuelle: 1, totalManches: 2, scores: [0, 0] });
            setShowPvPSetup(false); setLogs([]); setHistory([]); gameSessionIdRef.current += 1; setForfeitLoser(null); 
            setMasterFeedback(null);
          }}
        />
      )}

      {showForfeitConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-red-700/50 p-5 md:p-8 rounded-3xl max-w-md w-full text-center shadow-[0_0_80px_rgba(220,38,38,0.3)] relative">
            <AlertTriangle size={40} className="mx-auto text-red-500 mb-3 md:mb-4 md:w-12 md:h-12" />
            <h2 className="text-xl md:text-2xl font-bold text-red-400 mb-3 md:mb-4">{t('forfeit', 'Déclarer Forfait ?')}</h2>
            {mode === 'PvP' ? (
              <>
                <p className="text-sm md:text-base text-stone-300 mb-5 md:mb-6 font-medium">{t('forfeit_who', 'Qui souhaite abandonner le combat ?')}</p>
                <div className="flex flex-col gap-2 md:gap-3 mb-3 md:mb-4">
                  <button onClick={() => confirmForfeit(0)} className="w-full bg-green-950/60 hover:bg-green-900 text-green-200 font-bold py-3 rounded-xl border border-green-700/50 transition-colors focus:ring-4 focus:ring-green-500/50 outline-none text-sm md:text-base">{nomsJoueurs[0]} {t('abandons', 'abandonne')}</button>
                  <button onClick={() => confirmForfeit(1)} className="w-full bg-red-950/60 hover:bg-red-900 text-red-200 font-bold py-3 rounded-xl border border-red-700/50 transition-colors focus:ring-4 focus:ring-red-500/50 outline-none text-sm md:text-base">{nomsJoueurs[1]} {t('abandons', 'abandonne')}</button>
                </div>
                <button onClick={() => setShowForfeitConfirm(false)} className="w-full bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 rounded-xl transition-colors border border-stone-700 mt-2 focus:ring-4 focus:ring-stone-500/50 outline-none text-sm md:text-base">{t('pvp_cancel', 'Annuler')}</button>
              </>
            ) : (
              <>
                <p className="text-sm md:text-base text-stone-300 mb-6 md:mb-8 font-medium">{t('forfeit_consequence', "L'adversaire sera immédiatement déclaré vainqueur.")}</p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <button onClick={() => setShowForfeitConfirm(false)} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 rounded-xl transition-colors border border-stone-700 focus:ring-4 focus:ring-stone-500/50 outline-none text-sm md:text-base">{t('continue_combat', 'Non, continuer')}</button>
                  <button onClick={() => confirmForfeit(mode === 'Online' ? onlineRole : 0)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] focus:ring-4 focus:ring-red-500/50 outline-none text-sm md:text-base">{t('abandon_button', "Oui, j'abandonne").replace("{0}", nomsJoueurs[0])}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showHistoryModal && <HistoryModal logs={logs} setShowHistoryModal={setShowHistoryModal} />}
      {showHelp && <HelpModal setShowHelp={setShowHelp} />}
      {showAbout && (
        <AboutModal 
          onClose={() => setShowAbout(false)} 
        />
      )}
      {showLeaderboard && (
        <LeaderboardModal 
          onClose={() => setShowLeaderboard(false)} 
          getLeaderboard={getLeaderboard}
          currentUserUid={user?.uid}
        />
      )}

      {showChatMenu && (
        <ChatMenu 
          onClose={() => setShowChatMenu(false)} 
          sendQuickChat={sendQuickChat} 
        />
      )}
    </div>
  );
}
