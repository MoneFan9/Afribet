import { useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export const useGameEngine = () => {
  const store = useGameStore();

  const workerRef = useRef<Worker | null>(null);
  const workerCallbacks = useRef<Record<number, Function>>({});
  const workerMsgId = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/aiWorker.ts', import.meta.url), { type: 'module' });
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

  const notifyPlayerMoveToAI = useCallback((plateauArr: number[], joueurAct: number, move: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        action: 'learn',
        plateau: Array.from(plateauArr),
        joueurActuel: joueurAct,
        move
      });
    }
  }, []);

  return {
    ...store,
    getBestMoveAsync,
    notifyPlayerMoveToAI
  };
};
