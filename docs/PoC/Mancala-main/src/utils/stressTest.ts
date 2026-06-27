import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

/**
 * Utility to simulate rapid Firestore updates for load testing.
 * This helps verify if the quota handling and rules are robust.
 * WARNING: Running this will consume Firestore write quota.
 */
export const runStressTest = async (iterations: number = 20, delayMs: number = 100) => {
  if (!auth.currentUser) {
    console.error("Stress Test: User must be logged in.");
    return;
  }

  const userId = auth.currentUser.uid;
  const userRef = doc(db, 'users', userId);

  console.log(`Starting Stress Test: ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    try {
      await updateDoc(userRef, {
        syncCounter: increment(1),
        lastStressTest: Date.now()
      });
      console.log(`Stress Test: Iteration ${i + 1} successful`);
    } catch (error) {
      console.error(`Stress Test: Iteration ${i + 1} failed`, error);
      break;
    }
    
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log("Stress Test: Completed.");
};
