import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserType, UserStats, TournamentState } from '../types';
import { useGameStore } from '../store/gameStore';

export const useOnlineGame = (user: UserType, userStats: UserStats | null, addLog: (msg: string, type: string) => void, t: (key: string, def?: string) => string = (k,d) => d||k) => {
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<number | null>(null);
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [tempName1, setTempName1] = useState('Joueur 1');
  const [tempName2, setTempName2] = useState('Joueur 2');
  const [inputRoomId, setInputRoomId] = useState('');
  const [chatBubbles, setChatBubbles] = useState<Record<number, string | null>>({ 0: null, 1: null });
  const [pendingStakeAmount, setPendingStakeAmount] = useState<number | null>(null);
  const [opponentElo, setOpponentElo] = useState<number | undefined>(undefined);

  const socketRef = useRef<Socket | null>(null);
  const setPlateauRef = useRef<((p: number[]) => void) | null>(null);
  const setGreniersRef = useRef<((g: number[]) => void) | null>(null);
  const setJoueurActuelRef = useRef<((j: number) => void) | null>(null);
  const setNomsJoueursRef = useRef<((n: string[]) => void) | null>(null);
  const setModeRef = useRef<((m: string) => void) | null>(null);
  const setGameStateRef = useRef<((s: string) => void) | null>(null);
  const setTournoiRef = useRef<((t: TournamentState) => void) | null>(null);

  const lastSyncMoveRef = useRef<number | null>(null);
  const remoteMoveQueue = useRef<number[]>([]);
  const lastEmojiTimestampRef = useRef(0);

  useEffect(() => {
    // Connect to the Socket.io server
    socketRef.current = io();

    socketRef.current.on('roomCreated', (room) => {
      setOnlineRoomId(room.roomId);
      setOnlineRole(0);
      setIsWaitingForOpponent(true);
      setShowOnlineModal(true);
      if (setPlateauRef.current) setPlateauRef.current(room.plateau);
      if (setGreniersRef.current) setGreniersRef.current(room.greniers);
      if (setJoueurActuelRef.current) setJoueurActuelRef.current(room.joueurActuel);
      addLog(t('room_created', `Salle {0} créée. En attente d'un adversaire...`).replace('{0}', room.roomId), 'success');
    });

    socketRef.current.on('gameStarted', (room) => {
      if (setPlateauRef.current) setPlateauRef.current(room.plateau);
      if (setGreniersRef.current) setGreniersRef.current(room.greniers);
      if (setJoueurActuelRef.current) setJoueurActuelRef.current(room.joueurActuel);
      if (setTournoiRef.current) setTournoiRef.current(room.tournoi);
      
      setOnlineRoomId(room.roomId);
      // If we are the guest, we set role to 1
      if (user && room.guestId === user.uid) {
        setOnlineRole(1);
        setOpponentElo(room.hostElo);
        if (setNomsJoueursRef.current) setNomsJoueursRef.current([room.hostName, room.guestName]);
        if (setModeRef.current) setModeRef.current('Online');
        if (setGameStateRef.current) setGameStateRef.current('playing');
        setShowOnlineModal(false);
        addLog(t('connected_room', `Connecté à la salle {0}. Bonne chance !`).replace('{0}', room.roomId), 'success');
      } else if (user && room.hostId === user.uid) {
        // We are the host, the guest just joined
        setIsWaitingForOpponent(false);
        setOpponentElo(room.guestElo);
        setShowOnlineModal(false);
        if (setNomsJoueursRef.current) setNomsJoueursRef.current([room.hostName, room.guestName]);
        if (setModeRef.current) setModeRef.current('Online');
        if (setGameStateRef.current) setGameStateRef.current('playing');
        addLog(t('opponent_joined', `Un adversaire a rejoint la salle !`), 'success');
      }
    });

    socketRef.current.on('paymentRequired', (data) => {
        const amount = data.stakeAmount || data.amount || data.stake;
        setPendingStakeAmount(amount);
        addLog(t('bet_required', `Mise requise : {0}€`).replace('{0}', amount), 'info');
    });

    socketRef.current.on('paymentStatusUpdate', (data) => {
        if (data.hostPaid && data.guestPaid) {
            addLog(t('bet_confirmed', "Mises confirmées. La partie va commencer."), "success");
        } else {
            addLog(t('waiting_bets', `En attente des mises... (H: {0}, G: {1})`).replace('{0}', data.hostPaid ? 'OK' : '...').replace('{1}', data.guestPaid ? 'OK' : '...'), "info");
        }
    });

    socketRef.current.on('gameStateUpdate', (state) => {
      // If it's a new game or reset, apply directly
      if (state.moveCounter === 0) {
        if (setPlateauRef.current) setPlateauRef.current(state.plateau);
        if (setGreniersRef.current) setGreniersRef.current(state.greniers);
        if (setJoueurActuelRef.current) setJoueurActuelRef.current(state.joueurActuel);
      } else {
        // If we are currently onlineRole, and the state says it's our turn (or not), we check who made the last move.
        // The last person to move was (1 - state.joueurActuel).
        // If the last person to move was our opponent, we animate it.
        const lastPlayer = 1 - state.joueurActuel;
        setOnlineRole(currentRole => {
          if (currentRole !== null && lastPlayer !== currentRole && state.lastMove !== null) {
            // It's the opponent's move! Animate it instead of snapping.
            remoteMoveQueue.current.push(state.lastMove);
            // Trigger an empty state update to fire the useEffect
            if (setGameStateRef.current) setGameStateRef.current('playing');
          } else if (currentRole === null) {
             // Spectator or not fully joined? Snap it.
            if (setPlateauRef.current) setPlateauRef.current(state.plateau);
            if (setGreniersRef.current) setGreniersRef.current(state.greniers);
            if (setJoueurActuelRef.current) setJoueurActuelRef.current(state.joueurActuel);
          }
          return currentRole;
        });
      }

      if (setTournoiRef.current && state.tournoi) setTournoiRef.current(state.tournoi);
      
      if (state.message) {
        addLog(state.message, 'info');
      }

      if (state.lastMoveTime && state.serverTime) {
        // Calculate exact remaining time based on server
        const elapsed = Math.floor((state.serverTime - state.lastMoveTime) / 1000);
        const newTimeLeft = Math.max(0, 30 - elapsed);
        useGameStore.getState().setTimeLeft(newTimeLeft);
        useGameStore.getState().setTimerActive(true);
      }

      if (state.status === 'finished') {
        // We still let local animation finish and it will naturally compute fin partie.
        if (setGameStateRef.current) setGameStateRef.current('gameover');
      }
    });

    socketRef.current.on('emojiReceived', (data) => {
      setChatBubbles(prev => ({ ...prev, [data.sender]: data.text }));
      setTimeout(() => {
        setChatBubbles(prev => ({ ...prev, [data.sender]: null }));
      }, 3000);
    });

    socketRef.current.on('playerForfeit', (data) => {
      // Create a custom event to notify App.tsx
      window.dispatchEvent(new CustomEvent('remoteForfeit', { detail: { role: data.role } }));
    });

    socketRef.current.on('roomCanceled', (data) => {
      addLog(data.reason, 'warning');
      if (setGameStateRef.current) setGameStateRef.current('menu');
      if (setModeRef.current) setModeRef.current('PvE');
      setOnlineRoomId(null);
      setOnlineRole(null);
      setShowOnlineModal(false);
    });

    socketRef.current.on('playerLeft', (room) => {
      addLog(t('opponent_left', "L'adversaire a quitté la partie."), 'warning');
      if (setGameStateRef.current) setGameStateRef.current('menu');
      if (setModeRef.current) setModeRef.current('PvE');
      setOnlineRoomId(null);
      setOnlineRole(null);
    });

    socketRef.current.on('error', (err) => {
      addLog(err.message, 'error');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, addLog, t]);

  const createOnlineRoom = useCallback(async (setPlateau: (p: number[]) => void, setGreniers: (g: number[]) => void, setJoueurActuel: (j: number) => void, setNomsJoueurs: (n: string[]) => void, setMode: (m: string) => void, setGameState: (s: string) => void, setTournoi: (t: TournamentState) => void, rounds: number = 1, stakeAmount: number = 0) => {
    if (!user) {
      addLog(t('online_requires_connection', "Le mode en ligne nécessite une connexion active."), "warning");
      return;
    }
    setPlateauRef.current = setPlateau;
    setGreniersRef.current = setGreniers;
    setJoueurActuelRef.current = setJoueurActuel;
    setNomsJoueursRef.current = setNomsJoueurs;
    setModeRef.current = setMode;
    setGameStateRef.current = setGameState;
    setTournoiRef.current = setTournoi;

    socketRef.current?.emit('createRoom', {
      uid: user.uid,
      name: tempName1 || 'Anonyme',
      elo: userStats?.elo || 1200,
      rounds,
      stakeAmount
    });
  }, [user, userStats, tempName1, addLog, t]);

  const joinOnlineRoom = useCallback(async (id: string, setPlateau: (p: number[]) => void, setGreniers: (g: number[]) => void, setJoueurActuel: (j: number) => void, setNomsJoueurs: (n: string[]) => void, setMode: (m: string) => void, setGameState: (s: string) => void, setTournoi: (t: TournamentState) => void) => {
    if (!user || !id) return;
    
    setPlateauRef.current = setPlateau;
    setGreniersRef.current = setGreniers;
    setJoueurActuelRef.current = setJoueurActuel;
    setNomsJoueursRef.current = setNomsJoueurs;
    setModeRef.current = setMode;
    setGameStateRef.current = setGameState;
    setTournoiRef.current = setTournoi;

    socketRef.current?.emit('joinRoom', {
      roomId: id,
      uid: user.uid,
      name: tempName2 || 'Invité',
      elo: userStats?.elo || 1200
    });
  }, [user, userStats, tempName2]);

  const rejectStake = useCallback(() => {
    if (onlineRoomId && user) {
      socketRef.current?.emit('rejectStake', { roomId: onlineRoomId, uid: user.uid });
    }
    setIsWaitingForOpponent(false);
    setOnlineRoomId(null);
    setOnlineRole(null);
    setShowOnlineModal(false);
    addLog(t('you_declined_bet', "Vous avez refusé la mise."), 'info');
  }, [onlineRoomId, user, addLog, t]);

  const forfeitOnlineMatch = useCallback(() => {
    if (onlineRoomId && user && onlineRole !== null) {
      socketRef.current?.emit('forfeit', { roomId: onlineRoomId, uid: user.uid, role: onlineRole });
    }
  }, [onlineRoomId, user, onlineRole]);

  const leaveOnlineRoom = useCallback(async (setGameState: (s: string) => void, setMode: (m: string) => void, isGameOver: boolean = false) => {
    if (onlineRoomId && user) {
      socketRef.current?.emit('leaveRoom', { roomId: onlineRoomId, uid: user.uid });
    }
    setIsWaitingForOpponent(false);
    setOnlineRoomId(null);
    setOnlineRole(null);
    setGameState('menu');
    setMode('PvE');
    addLog(t('online_game_quit', "Partie en ligne quittée."), 'info');
  }, [onlineRoomId, user, addLog, t]);

  const sendQuickChat = useCallback(async (text: string) => {
    if (onlineRoomId && onlineRole !== null) {
      socketRef.current?.emit('sendEmoji', {
        roomId: onlineRoomId,
        text,
        role: onlineRole
      });
    }
  }, [onlineRoomId, onlineRole]);

  const nextOnlineTournamentRound = useCallback(async () => {
    if (onlineRoomId && user) {
      socketRef.current?.emit('nextRound', {
        roomId: onlineRoomId,
        uid: user.uid
      });
    }
  }, [onlineRoomId, user]);

  // Expose the socket to allow sending moves
  const playOnlineMove = useCallback((move: number) => {
    if (onlineRoomId && user) {
      socketRef.current?.emit('playMove', {
        roomId: onlineRoomId,
        uid: user.uid,
        move
      });
    }
  }, [onlineRoomId, user]);

  const confirmPaymentOnline = useCallback(() => {
    if (onlineRoomId && user) {
      socketRef.current?.emit('confirmPayment', {
        roomId: onlineRoomId,
        uid: user.uid
      });
    }
  }, [onlineRoomId, user]);

  return {
    onlineRoomId, setOnlineRoomId,
    onlineRole, setOnlineRole,
    isWaitingForOpponent, setIsWaitingForOpponent,
    showOnlineModal, setShowOnlineModal,
    tempName1, setTempName1,
    tempName2, setTempName2,
    inputRoomId, setInputRoomId,
    chatBubbles, setChatBubbles,
    pendingStakeAmount, setPendingStakeAmount,
    opponentElo,
    lastSyncMoveRef, remoteMoveQueue, lastEmojiTimestampRef,
    createOnlineRoom, joinOnlineRoom, leaveOnlineRoom, rejectStake, forfeitOnlineMatch, sendQuickChat, nextOnlineTournamentRound,
    playOnlineMove, confirmPaymentOnline
  };
};
