import { useEffect, MutableRefObject } from 'react';
import { getCoupsLegaux } from '../utils/gameLogic';
import { PROVERBES } from '../utils/constants';

interface UseAITurnProps {
  gameState: string;
  joueurActuel: number;
  mode: string;
  difficulty: string;
  plateau: number[];
  greniers: number[];
  isThinking: boolean;
  isAnimating: boolean;
  setIsThinking: (thinking: boolean) => void;
  addLog: (msg: string, type?: string) => void;
  getBestMoveAsync: (plateauArr: number[], greniersArr: number[], joueurAct: number, profondeur: number, isMax: boolean, joueurIa: number, clearTT?: boolean, useMCTS?: boolean, iterations?: number) => Promise<{bestMove: number | null, score: number}>;
  handleMoveRef: MutableRefObject<(i: number) => Promise<void>>;
  gameSessionIdRef: MutableRefObject<number>;
  t?: (key: string, defaultString?: string) => string;
}

export const useAITurn = ({
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
  t = (k, d) => d || k
}: UseAITurnProps) => {
  useEffect(() => {
    // addLog(`useAITurn effect triggered: isThinking=${isThinking}`, 'info');
    let isActive = true;
    if (gameState !== 'playing' || joueurActuel === 0 || mode === 'PvP' || mode === 'Online' || isThinking || isAnimating) {
      // addLog("useAITurn returning early", 'info');
      return;
    }

    const playAI = async () => {
      // addLog("playAI started", 'info');
      const currentSession = gameSessionIdRef.current;
      setIsThinking(true);

      let msgReflexion = t('ai_thinking', "L'IA réfléchit...");
      if (mode === 'Apprenti') msgReflexion = t('ai_observing', "Maître Bruce Lee observe ton esprit...");
      else if (difficulty === 'Enfant') msgReflexion = t('ai_child_hesitates', "L'enfant hésite sur la case à jouer...");
      else if (difficulty === 'Initié') msgReflexion = t('ai_initiate_counts', "L'initié compte ses graines...");
      else if (difficulty === 'Vieux Sage') {
        const prov = PROVERBES[Math.floor(Math.random() * PROVERBES.length)];
        msgReflexion = t('ai_sage_meditates', `Le Vieux Sage médite : "{0}"`).replace('{0}', prov);
      }
      else if (difficulty === 'Grand Maître') {
        const prov = PROVERBES[Math.floor(Math.random() * PROVERBES.length)];
        msgReflexion = t('ai_grandmaster_teaches', `Le Grand Maître enseigne : "{0}"`).replace('{0}', prov);
      }
      else if (difficulty === 'AlphaSongo') {
        msgReflexion = t('ai_alphasongo_explores', "AlphaSongo explore les futurs possibles...");
      }

      addLog(msgReflexion, 'info');
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1500) + 1500));

      // addLog(`playAI after timeout, isActive=${isActive}`, 'info');
      if (!isActive || currentSession !== gameSessionIdRef.current) return;

      try {
        // addLog("playAI calculating move", 'info');
        const coups = getCoupsLegaux(plateau, 1);
        let bestMove;
        let profondeurIA = difficulty === 'Enfant' ? 0 : difficulty === 'Initié' ? 1 : difficulty === 'Vieux Sage' ? 4 : 6;
        if (mode === 'Apprenti') profondeurIA = 4;

        if (difficulty === 'AlphaSongo') {
          // Use MCTS with 5000 iterations
          const res = await getBestMoveAsync(plateau, greniers, 1, 0, true, 1, false, true, 5000);
          bestMove = res?.bestMove ?? coups[0];
        } else if (profondeurIA === 0) {
          bestMove = coups[Math.floor(Math.random() * coups.length)];
        } else if (profondeurIA === 1) {
          const res = await getBestMoveAsync(plateau, greniers, 1, 1, true, 1, true);
          bestMove = res?.bestMove ?? coups[0];
        } else if (profondeurIA === 4) {
          const res = await getBestMoveAsync(plateau, greniers, 1, 4, true, 1, true);
          bestMove = res?.bestMove ?? coups[0];
        } else {
          let lastBest = coups[0];
          for (let d = 1; d <= 6; d++) {
            if (!isActive) break;
            const res = await getBestMoveAsync(plateau, greniers, 1, d, true, 1, d === 1);
            if (res && res.bestMove !== null) lastBest = res.bestMove;
          }
          bestMove = lastBest;
        }

        if (!isActive || currentSession !== gameSessionIdRef.current) {
          // addLog("playAI aborted after calculation", 'warning');
          return;
        }
        setIsThinking(false);
        // addLog(`playAI finished, bestMove: ${bestMove}`, 'info');

        if (bestMove !== undefined) {
          if (isActive && currentSession === gameSessionIdRef.current) {
            if (handleMoveRef.current) handleMoveRef.current(bestMove, false, true, joueurActuel);
          }
        }
      } catch (err) {
        console.error("AI Error:", err);
        setIsThinking(false);
      }
    };

    playAI();
    return () => { 
      // addLog("useAITurn cleanup", 'warning');
      isActive = false; 
    };
  }, [joueurActuel, gameState, mode, difficulty, plateau, greniers, isAnimating, addLog, getBestMoveAsync, handleMoveRef, gameSessionIdRef]);
};
