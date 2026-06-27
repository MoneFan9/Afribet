import { describe, it, expect } from 'vitest';
import {
  getDestinationHole,
  estFamine,
  simulerNourrissage,
  getCoupsLegaux,
  appliquerCoup,
  checkFinPartie
} from './gameLogic';
import { TAILLE_CAMP, TOTAL_TROUS, GRAINES_BOUCLE, SEUIL_VICTOIRE, SEUIL_RARETE } from './constants';

describe('gameLogic', () => {
  describe('getDestinationHole', () => {
    it('should return null if graines is 0', () => {
      expect(getDestinationHole(0, 0, 0)).toBeNull();
    });

    it('should calculate destination for normal move (<= GRAINES_BOUCLE)', () => {
      expect(getDestinationHole(0, 5, 0)).toBe(5);
      expect(getDestinationHole(10, 5, 1)).toBe(1); // (10 + 5) % 14 = 1
    });

    it('should calculate destination for move > GRAINES_BOUCLE (player 0)', () => {
      // GRAINES_BOUCLE = 13. If graines = 15. restant = 2. advStart = 7.
      // (2 - 1) % 7 = 1. 7 + 1 = 8.
      expect(getDestinationHole(0, 15, 0)).toBe(8);
    });

    it('should calculate destination for move > GRAINES_BOUCLE (player 1)', () => {
      // GRAINES_BOUCLE = 13. If graines = 15. restant = 2. advStart = 0.
      // (2 - 1) % 7 = 1. 0 + 1 = 1.
      expect(getDestinationHole(7, 15, 1)).toBe(1);
    });

    it('should return correct destination for player 0 when move > GRAINES_BOUCLE and restant is exact multiple', () => {
      // GRAINES_BOUCLE = 13. graines = 20. restant = 7. advStart = 7.
      // (7 - 1) % 7 = 6. 7 + 6 = 13.
      expect(getDestinationHole(0, 20, 0)).toBe(13);
    });
  });

  describe('estFamine', () => {
    it('should return true if opponent camp is empty', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 5; // Player 0 has seeds, Player 1 has 0
      expect(estFamine(plateau, 0)).toBe(true);
      
      const plateau2 = Array(TOTAL_TROUS).fill(0);
      plateau2[7] = 5; // Player 1 has seeds, Player 0 has 0
      expect(estFamine(plateau2, 1)).toBe(true);
    });

    it('should return false if opponent camp is not empty', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[7] = 1; // Player 1 has 1 seed
      expect(estFamine(plateau, 0)).toBe(false);
      
      const plateau2 = Array(TOTAL_TROUS).fill(0);
      plateau2[0] = 1; // Player 0 has 1 seed
      expect(estFamine(plateau2, 1)).toBe(false);
    });
  });

  describe('simulerNourrissage', () => {
    it('should count seeds landing in opponent camp (<= GRAINES_BOUCLE)', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3; // Lands in 6, 7, 8. Opponent camp is 7-13. So 2 seeds in opponent camp.
      expect(simulerNourrissage(plateau, 5, 0)).toBe(2);
    });

    it('should count seeds landing in opponent camp (> GRAINES_BOUCLE)', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 15; // 15 seeds. GRAINES_BOUCLE = 13.
      // 13 seeds will distribute 1 in every hole except the starting one.
      // So 7 seeds will land in opponent camp (7-13).
      // Remaining 2 seeds will land in opponent camp (because > GRAINES_BOUCLE logic forces them into opponent camp).
      // Total = 7 + 2 = 9.
      expect(simulerNourrissage(plateau, 5, 0)).toBe(9);
    });

    it('should count seeds landing in opponent camp (> GRAINES_BOUCLE) for player 1', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[10] = 15; // 15 seeds. GRAINES_BOUCLE = 13.
      // 13 seeds will distribute 1 in every hole except 10.
      // 7 seeds land in opponent camp (0-6).
      // Remaining 2 seeds land in opponent camp.
      // Total = 9.
      expect(simulerNourrissage(plateau, 10, 1)).toBe(9);
    });
  });

  describe('getCoupsLegaux', () => {
    it('should return all non-empty holes if not famine and no penalty', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 5;
      plateau[1] = 5;
      plateau[7] = 5; // Opponent has seeds
      expect(getCoupsLegaux(plateau, 0)).toEqual([0, 1]);
    });

    it('should filter out penalty move (case 7 with 1 or 2 seeds)', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 5;
      plateau[6] = 2; // Case 7 for player 0
      plateau[7] = 5; // Opponent has seeds (no famine)
      expect(getCoupsLegaux(plateau, 0)).toEqual([0]);

      const plateau2 = Array(TOTAL_TROUS).fill(0);
      plateau2[7] = 5;
      plateau2[13] = 1; // Case 7 for player 1
      plateau2[0] = 5; // Opponent has seeds
      expect(getCoupsLegaux(plateau2, 1)).toEqual([7]);
    });

    it('should return [] if famine and no nourishing move possible', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 1; // Can only reach 1, opponent camp is 7-13
      expect(getCoupsLegaux(plateau, 0)).toEqual([]);
    });

    it('should prioritize moves that nourish >= TAILLE_CAMP', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 15; // Feeds 9
      plateau[1] = 5;  // Feeds 0
      expect(getCoupsLegaux(plateau, 0)).toEqual([0]);
    });

    it('should return moves with max feed if no move feeds >= TAILLE_CAMP', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3; // Feeds 2
      plateau[6] = 1; // Feeds 1
      expect(getCoupsLegaux(plateau, 0)).toEqual([5]);
    });
  });

  describe('appliquerCoup', () => {
    it('should apply penalty if case 7 has 1 or 2 seeds', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[6] = 2;
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 6);
      expect(result).toBe("Pénalité de la case 7 ! Graines à l'adversaire.");
      expect(greniers[1]).toBe(2);
      expect(plateau[6]).toBe(0);
    });

    it('should apply penalty if case 7 has 1 or 2 seeds for player 1', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[13] = 1;
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 1, 13);
      expect(result).toBe("Pénalité de la case 7 ! Graines à l'adversaire.");
      expect(greniers[0]).toBe(1);
      expect(plateau[13]).toBe(0);
    });

    it('should distribute seeds normally (<= GRAINES_BOUCLE)', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 3;
      const greniers = [0, 0];
      appliquerCoup(plateau, greniers, 0, 0);
      expect(plateau[0]).toBe(0);
      expect(plateau[1]).toBe(1);
      expect(plateau[2]).toBe(1);
      expect(plateau[3]).toBe(1);
    });

    it('should distribute seeds correctly for > GRAINES_BOUCLE', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 15;
      plateau[9] = 5; // Add seeds to avoid solidarité
      const greniers = [0, 0];
      appliquerCoup(plateau, greniers, 0, 0);
      expect(plateau[0]).toBe(0);
      // 13 seeds distribute 1 everywhere except 0.
      // 2 remaining seeds go to opponent camp (7 and 8).
      expect(plateau[1]).toBe(1);
      // 7 and 8 will have 2 seeds and be captured!
      expect(plateau[7]).toBe(0);
      expect(plateau[8]).toBe(0);
      expect(greniers[0]).toBe(4);
    });

    it('should capture seeds if landing in opponent camp with 2-4 seeds', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3;
      plateau[8] = 1; // Will become 2
      plateau[9] = 5; // To avoid solidarité
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 5);
      expect(result).toBe("Prise tactique ! 2 graines capturées.");
      expect(greniers[0]).toBe(2);
      expect(plateau[8]).toBe(0);
    });

    it('should capture multiple holes backwards', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3;
      plateau[7] = 2; // Will become 3
      plateau[8] = 2; // Will become 3
      plateau[9] = 1; // To avoid solidarité
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 5);
      expect(result).toBe("Prise tactique ! 6 graines capturées.");
      expect(greniers[0]).toBe(6);
      expect(plateau[7]).toBe(0);
      expect(plateau[8]).toBe(0);
    });

    it('should not capture if it empties the opponent camp (Solidarité)', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3;
      plateau[7] = 1; // Will become 2
      plateau[8] = 1; // Will become 2
      // No other seeds in opponent camp
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 5);
      expect(result).toBe("Solidarité ! Capture annulée pour ne pas vider le camp adverse.");
      expect(greniers[0]).toBe(0);
      expect(plateau[7]).toBe(2); // Not captured
      expect(plateau[8]).toBe(2); // Not captured
    });

    it('should NOT capture if landing in case 1 of opponent', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 2;
      plateau[7] = 1; // Case 1 of opponent (index 7 for player 0). Will become 2.
      plateau[8] = 5; // To avoid solidarité
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 5);
      expect(result).toBeNull();
      expect(greniers[0]).toBe(0);
      expect(plateau[7]).toBe(2);
    });

    it('should NOT capture if landing in case 1 of opponent for player 1', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[12] = 2;
      plateau[0] = 1; // Case 1 of opponent (index 0 for player 1). Will become 2.
      plateau[1] = 5; // To avoid solidarité
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 1, 12);
      expect(result).toBeNull();
      expect(greniers[1]).toBe(0);
      expect(plateau[0]).toBe(2);
    });

    it('should not capture if ending in opponent camp but seeds are not 2-4', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[5] = 3;
      plateau[8] = 2; // Will become 3 -> capture
      plateau[9] = 5; // To avoid solidarité
      const greniers = [0, 0];
      const result = appliquerCoup(plateau, greniers, 0, 5);
      expect(result).toBe("Prise tactique ! 3 graines capturées.");
      
      const plateau2 = Array(TOTAL_TROUS).fill(0);
      plateau2[5] = 3;
      plateau2[8] = 4; // Will become 5 -> no capture
      const greniers2 = [0, 0];
      const result2 = appliquerCoup(plateau2, greniers2, 0, 5);
      expect(result2).toBeNull();
    });
  });

  describe('checkFinPartie', () => {
    it('should return 0 if player 0 reaches SEUIL_VICTOIRE', () => {
      expect(checkFinPartie(Array(TOTAL_TROUS).fill(0), [40, 0])).toBe(0);
    });

    it('should return 1 if player 1 reaches SEUIL_VICTOIRE', () => {
      expect(checkFinPartie(Array(TOTAL_TROUS).fill(0), [0, 40])).toBe(1);
    });

    it('should return winner based on remaining seeds if total < SEUIL_RARETE', () => {
      const plateau = Array(TOTAL_TROUS).fill(0);
      plateau[0] = 5; // Player 0 gets 5
      plateau[7] = 3; // Player 1 gets 3
      // Total = 8 < 10 (SEUIL_RARETE)
      expect(checkFinPartie(plateau, [10, 10])).toBe(0); // 15 vs 13
      
      const plateau2 = Array(TOTAL_TROUS).fill(0);
      plateau2[0] = 3;
      plateau2[7] = 5;
      expect(checkFinPartie(plateau2, [10, 10])).toBe(1); // 13 vs 15
      
      const plateau3 = Array(TOTAL_TROUS).fill(0);
      plateau3[0] = 4;
      plateau3[7] = 4;
      expect(checkFinPartie(plateau3, [10, 10])).toBe(2); // 14 vs 14 (tie)
    });

    it('should return -1 if game is not over', () => {
      const plateau = Array(TOTAL_TROUS).fill(5); // Total 70
      expect(checkFinPartie(plateau, [0, 0])).toBe(-1);
    });
  });
});
