import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { auth, db, initAuth, loginWithGoogle, logoutUser } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { UserStats, GameStateToSave } from '../types';

export const useFirebase = (appId: string, onError?: (e: Error | unknown) => void) => {
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const leaderboardCache = useRef<{data: UserStats[], timestamp: number} | null>(null);
  const rankCache = useRef<{data: number, timestamp: number} | null>(null);
  const lastRankFetchRef = useRef<number>(0);

  useEffect(() => {
    initAuth().then(u => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setUserStats(null);
      setHasSave(false);
      return;
    }

    // Real-time listener for stats
    const statsRef = doc(db, 'users', user.uid);
    const unsubStats = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setUserStats(snap.data() as UserStats);
        setQuotaExceeded(false);
      } else {
        // Initialize if not exists
        const initialStats: UserStats = { 
          elo: 1200, 
          wins: 0, 
          losses: 0, 
          draws: 0,
          role: 'user'
        };
        setDoc(statsRef, { 
          ...initialStats, 
          displayName: user.displayName || 'Joueur',
          photoURL: user.photoURL || null 
        }).catch(e => {
          const errorMessage = e?.message || String(e);
          if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
            setQuotaExceeded(true);
            return;
          }
          handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
        });
      }
    }, (e) => {
      const errorMessage = e?.message || String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        // Fallback to local storage if possible or just show error
        return;
      }
      handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
    });

    // Check for saves - only once per user change
    const checkSaves = async () => {
      try {
        const saveRef = doc(db, 'users', user.uid, 'saves', 'current');
        const snap = await getDoc(saveRef);
        if (snap.exists()) {
          setHasSave(true);
        } else if (localStorage.getItem('songo_save')) {
          setHasSave(true);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
          setQuotaExceeded(true);
          if (localStorage.getItem('songo_save')) setHasSave(true);
          return;
        }
      }
    };
    checkSaves();

    return () => unsubStats();
  }, [user]);

  const login = useCallback(async () => {
    const u = await loginWithGoogle();
    if (u) {
      setUser(u);
    }
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setUserStats(null);
    setHasSave(false);
  }, []);

  const resetElo = useCallback(async () => {
    if (!user) return;
    try {
      const statsRef = doc(db, 'users', user.uid);
      await updateDoc(statsRef, {
        elo: 1200,
        wins: 0,
        losses: 0,
        draws: 0
      });
      setQuotaExceeded(false);
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        return;
      }
      try {
        handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
      } catch (err) {
        if (onError) onError(err);
      }
    }
  }, [user, onError]);

  const updateUserStats = useCallback(async (result: 'win' | 'loss' | 'draw', opponentElo?: number) => {
    if (!user || !userStats) return;
    try {
      const statsRef = doc(db, 'users', user.uid);
      const newStats = { ...userStats };
      
      let actualScore = 0.5;
      if (result === 'win') {
        newStats.wins += 1;
        actualScore = 1;
      } else if (result === 'loss') {
        newStats.losses += 1;
        actualScore = 0;
      } else {
        newStats.draws += 1;
      }

      if (opponentElo !== undefined) {
        // Call the secure server logic for Elo calculation
        try {
          const response = await fetch('/api/calculate-elo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerElo: newStats.elo,
              opponentElo: opponentElo,
              result: actualScore
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            newStats.elo = Math.max(0, data.newElo);
          } else {
            console.error("Failed to calculate Elo on server");
          }
        } catch (err) {
          console.error("Error calling Elo API:", err);
        }
      } else {
        // Fallback simple si pas d'Elo adverse
        if (result === 'win') {
          newStats.elo += 15;
        } else if (result === 'loss') {
          newStats.elo = Math.max(0, newStats.elo - 15);
        }
      }
      
      await updateDoc(statsRef, newStats);
      setUserStats(newStats);
      setQuotaExceeded(false);
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        console.error("Stats update failed: Quota exceeded");
        return;
      }
      try {
        handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
      } catch (err) {
        if (onError) onError(err);
      }
    }
  }, [user, userStats, onError]);

  const saveGame = useCallback(async (stateToSave: GameStateToSave, isOnline: boolean) => {
    if (isOnline) return false;
    try {
      if (user && db) {
        const saveRef = doc(db, 'users', user.uid, 'saves', 'current');
        await setDoc(saveRef, stateToSave);
        setHasSave(true);
        setQuotaExceeded(false);
        return true;
      } else {
        localStorage.setItem('songo_save', JSON.stringify(stateToSave));
        setHasSave(true);
        return true;
      }
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        console.error("Save failed: Quota exceeded");
        return false;
      }
      try {
        handleFirestoreError(e, OperationType.WRITE, `users/${user?.uid}/saves/current`);
      } catch (err) {
        if (onError) onError(err);
      }
      return false;
    }
  }, [user, onError]);

  const loadGame = useCallback(async () => {
    try {
      if (user && db) {
        const saveRef = doc(db, 'users', user.uid, 'saves', 'current');
        const snap = await getDoc(saveRef);
        setQuotaExceeded(false);
        if (snap.exists()) return snap.data();
      }
      const savedData = localStorage.getItem('songo_save');
      if (savedData) return JSON.parse(savedData);
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        console.warn("Load failed: Quota exceeded");
        const savedData = localStorage.getItem('songo_save');
        if (savedData) return JSON.parse(savedData);
        return null;
      }
      try {
        handleFirestoreError(e, OperationType.GET, `users/${user?.uid}/saves/current`);
      } catch (err) {
        if (onError) onError(err);
      }
    }
    return null;
  }, [user, onError]);

  const deleteSave = useCallback(async () => {
    try {
      if (user && db) {
        const saveRef = doc(db, 'users', user.uid, 'saves', 'current');
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(saveRef);
      }
      localStorage.removeItem('songo_save');
      setHasSave(false);
      return true;
    } catch (e) {
      try {
        handleFirestoreError(e, OperationType.DELETE, `users/${user?.uid}/saves/current`);
      } catch (err) {
        if (onError) onError(err);
      }
      return false;
    }
  }, [user, onError]);

  const getLeaderboard = useCallback(async (limitCount: number = 10) => {
    if (!db) return [];
    
    // Use cache if it's less than 5 minutes old
    const now = Date.now();
    if (leaderboardCache.current && now - leaderboardCache.current.timestamp < 5 * 60 * 1000) {
      return leaderboardCache.current.data;
    }

    try {
      // Try fetching from the Edge API first (simulating Cloudflare Workers)
      try {
        const response = await fetch(`/api/leaderboard?limit=${limitCount}`);
        if (response.ok) {
          const result = await response.json();
          leaderboardCache.current = { data: result.data, timestamp: now };
          return result.data;
        }
      } catch (apiError) {
        console.warn("Edge API failed, falling back to direct Firestore query", apiError);
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('elo', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      leaderboardCache.current = { data, timestamp: now };
      return data;
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        console.warn("Leaderboard quota exceeded. Using empty list.");
        return [];
      }
      try {
        handleFirestoreError(e, OperationType.LIST, 'users');
      } catch (err) {
        if (onError) onError(err);
      }
      return [];
    }
  }, [onError]);

  const getUserRank = useCallback(async () => {
    if (!user || !userStats || !db) return null;
    
    // Use cache if it's less than 30 minutes old (increased from 10)
    const now = Date.now();
    if (rankCache.current && now - rankCache.current.timestamp < 30 * 60 * 1000) {
      return rankCache.current.data;
    }

    // Throttle: don't fetch more than once every 5 minutes even if cache is cleared
    if (now - lastRankFetchRef.current < 5 * 60 * 1000) {
      return rankCache.current?.data || null;
    }

    try {
      lastRankFetchRef.current = now;
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('elo', '>', userStats.elo));
      const snap = await getCountFromServer(q);
      const rank = snap.data().count + 1;
      rankCache.current = { data: rank, timestamp: now };
      setQuotaExceeded(false);
      return rank;
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota-exceeded') || errorMessage.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
        console.warn("Rank calculation quota exceeded.");
        return rankCache.current?.data || null;
      }
      if (errorMessage.includes('Connection failed') || errorMessage.includes('offline') || errorMessage.includes('CANCELLED')) {
        console.warn("Could not get user rank due to connection issues.");
        return rankCache.current?.data || null;
      }
      try {
        handleFirestoreError(e, OperationType.GET, `users_count_rank`);
      } catch (err) {
        if (onError) onError(err);
      }
      return rankCache.current?.data || null;
    }
  }, [user, userStats, onError]);

  return { user, userStats, hasSave, quotaExceeded, saveGame, loadGame, deleteSave, login, logout, resetElo, updateUserStats, getLeaderboard, getUserRank };
};
