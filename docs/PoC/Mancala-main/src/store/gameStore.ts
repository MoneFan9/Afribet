import { create } from 'zustand';
import { TOTAL_TROUS } from '../utils/constants';
import { GameHistoryEntry, GameLog } from '../types';

interface GameState {
  plateau: number[];
  greniers: number[];
  joueurActuel: number;
  logs: GameLog[];
  history: GameHistoryEntry[];
  lastMove: number | null;
  isThinking: boolean;
  isAnimating: boolean;
  animActiveCase: number | null;
  winner: number | null;
  gameState: string;
  timeLeft: number;
  timerActive: boolean;

  setPlateau: (plateau: number[]) => void;
  setGreniers: (greniers: number[]) => void;
  setJoueurActuel: (joueur: number) => void;
  setLogs: (logs: GameLog[] | ((prev: GameLog[]) => GameLog[])) => void;
  addLog: (msg: string, type?: string, isMove?: boolean) => void;
  setHistory: (history: GameHistoryEntry[] | ((prev: GameHistoryEntry[]) => GameHistoryEntry[])) => void;
  setLastMove: (move: number | null) => void;
  setIsThinking: (isThinking: boolean) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setAnimActiveCase: (caseIdx: number | null) => void;
  setWinner: (winner: number | null) => void;
  setGameState: (state: string) => void;
  setTimeLeft: (time: number | ((prev: number) => number)) => void;
  setTimerActive: (active: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  plateau: Array(TOTAL_TROUS).fill(5),
  greniers: [0, 0],
  joueurActuel: 0,
  logs: [],
  history: [],
  lastMove: null,
  isThinking: false,
  isAnimating: false,
  animActiveCase: null,
  winner: null,
  gameState: 'menu',
  timeLeft: 30,
  timerActive: false,

  setPlateau: (plateau) => set({ plateau }),
  setGreniers: (greniers) => set({ greniers }),
  setJoueurActuel: (joueurActuel) => set({ joueurActuel }),
  setLogs: (logs) => set((state) => ({ logs: typeof logs === 'function' ? logs(state.logs) : logs })),
  addLog: (msg, type = 'info', isMove = false) => set((state) => ({ logs: [...state.logs, { text: msg, type, isMove }] })),
  setHistory: (history) => set((state) => ({ history: typeof history === 'function' ? history(state.history) : history })),
  setLastMove: (lastMove) => set({ lastMove }),
  setIsThinking: (isThinking) => set({ isThinking }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setAnimActiveCase: (animActiveCase) => set({ animActiveCase }),
  setWinner: (winner) => set({ winner }),
  setGameState: (gameState) => set({ gameState }),
  setTimeLeft: (timeLeft) => set((state) => ({ timeLeft: typeof timeLeft === 'function' ? timeLeft(state.timeLeft) : timeLeft })),
  setTimerActive: (timerActive) => set({ timerActive }),
  resetGame: () => set({
    plateau: Array(TOTAL_TROUS).fill(5),
    greniers: [0, 0],
    joueurActuel: 0,
    logs: [],
    history: [],
    lastMove: null,
    isThinking: false,
    isAnimating: false,
    animActiveCase: null,
    winner: null,
    timeLeft: 30,
    timerActive: false
  })
}));
