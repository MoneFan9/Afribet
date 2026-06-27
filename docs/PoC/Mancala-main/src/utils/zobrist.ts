import { TOTAL_TROUS } from './constants';

export const ZOBRIST = {
  board: Array.from({ length: TOTAL_TROUS }, () =>
    Array.from({ length: 150 }, () => Math.floor(Math.random() * 0xFFFFFFFF) | 0)
  ),
  playerTurn: Math.floor(Math.random() * 0xFFFFFFFF) | 0
};

export const getZobristHash = (plateau: Int8Array | number[], joueur: number) => {
  let h = 0;
  for (let i = 0; i < TOTAL_TROUS; i++) {
    if (plateau[i] > 0) h ^= ZOBRIST.board[i][Math.min(plateau[i], 149)];
  }
  if (joueur === 1) h ^= ZOBRIST.playerTurn;
  return h;
};
