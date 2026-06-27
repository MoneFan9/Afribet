import { User } from 'firebase/auth';

export interface UserStats {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  role?: string;
  displayName?: string;
  photoURL?: string;
}

export interface TournamentState {
  actif: boolean;
  mancheActuelle: number;
  totalManches: number;
  scores: number[];
}

export interface GameLog {
  text: string;
  type: string;
  isMove?: boolean;
}

export interface GameHistoryEntry {
  plateau: number[];
  greniers: number[];
  joueurActuel: number;
  logs: GameLog[];
  lastMove: number | null;
}

export interface GameStateToSave {
  plateau: number[];
  greniers: number[];
  joueurActuel: number;
  mode: string;
  difficulty: string;
  logs: GameLog[];
  statsApprenti: { joues: number; optimaux: number };
  tournoi: TournamentState;
  history: GameHistoryEntry[];
  lastMove: number | null;
  nomsJoueurs: string[];
  timestamp: number;
}

export type UserType = User | null;
