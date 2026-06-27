import { TAILLE_CAMP, TOTAL_TROUS, GRAINES_BOUCLE, SEUIL_VICTOIRE, SEUIL_RARETE } from './constants';

export const getDestinationHole = (move: number, graines: number, joueur: number) => {
  if (graines === 0) return null;
  let idx = move;
  const advStart = joueur === 0 ? TAILLE_CAMP : 0;
  
  if (graines > GRAINES_BOUCLE) {
    let restant = graines - GRAINES_BOUCLE;
    return advStart + ((restant - 1) % TAILLE_CAMP);
  } else {
    return (idx + graines) % TOTAL_TROUS;
  }
};

export const estFamine = (plateau: number[], joueur: number) => {
  const start = joueur === 0 ? TAILLE_CAMP : 0;
  const end = joueur === 0 ? TOTAL_TROUS : TAILLE_CAMP;
  let sum = 0;
  for (let i = start; i < end; i++) sum += plateau[i];
  return sum === 0;
};

export const simulerNourrissage = (plateau: number[], move: number, joueur: number) => {
  const graines = plateau[move];
  let idx = move;
  const inAdvCamp = (i: number) => joueur === 0 ? (i >= TAILLE_CAMP && i < TOTAL_TROUS) : (i >= 0 && i < TAILLE_CAMP);
  let count = 0;
  if (graines > GRAINES_BOUCLE) {
    for (let i = 0; i < GRAINES_BOUCLE; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      if (inAdvCamp(idx)) count++;
    }
    count += (graines - GRAINES_BOUCLE);
  } else {
    for (let i = 0; i < graines; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      if (inAdvCamp(idx)) count++;
    }
  }
  return count;
};

export const getCoupsLegaux = (plateau: number[], joueur: number) => {
  const start = joueur === 0 ? 0 : TAILLE_CAMP;
  const end = joueur === 0 ? TAILLE_CAMP : TOTAL_TROUS;
  const coupsDeBase = [];
  for (let i = start; i < end; i++) {
    if (plateau[i] > 0) coupsDeBase.push(i);
  }

  if (estFamine(plateau, joueur)) {
    const nourrissants = coupsDeBase.map(move => ({
      move,
      count: simulerNourrissage(plateau, move, joueur)
    })).filter(m => m.count > 0);
    if (nourrissants.length === 0) return [];
    const priorite7 = nourrissants.filter(m => m.count >= TAILLE_CAMP);
    if (priorite7.length > 0) return priorite7.map(m => m.move);
    const maxFeed = Math.max(...nourrissants.map(m => m.count));
    return nourrissants.filter(m => m.count === maxFeed).map(m => m.move);
  } else {
    const case7 = joueur === 0 ? 6 : 13;
    return coupsDeBase.filter(move => !(move === case7 && (plateau[move] === 1 || plateau[move] === 2)));
  }
};

export const appliquerCoup = (plateau: number[] | Int8Array, greniers: number[], joueur: number, move: number, t: (k: string, d?: string) => string = (k,d)=>d||k) => {
  const graines = plateau[move];
  const case7 = joueur === 0 ? 6 : 13;
  if (move === case7 && (graines === 1 || graines === 2)) {
    greniers[1 - joueur] += graines;
    plateau[move] = 0;
    return t('penalty_case_7', "Pénalité de la case 7 ! Graines à l'adversaire.");
  }
  plateau[move] = 0;
  let idx = move;
  const advStart = joueur === 0 ? TAILLE_CAMP : 0;

  if (graines > GRAINES_BOUCLE) {
    for (let i = 0; i < GRAINES_BOUCLE; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      plateau[idx]++;
    }
    let restant = graines - GRAINES_BOUCLE;
    let advIdx = 0;
    while (restant > 0) {
      const cible = advStart + (advIdx % TAILLE_CAMP);
      plateau[cible]++;
      restant--;
      idx = cible;
      advIdx++;
    }
  } else {
    for (let i = 0; i < graines; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      plateau[idx]++;
    }
  }

  const inAdvCamp = (i: number) => joueur === 0 ? (i >= TAILLE_CAMP && i < TOTAL_TROUS) : (i >= 0 && i < TAILLE_CAMP);
  const case1Adv = joueur === 0 ? 7 : 0;

  if (inAdvCamp(idx) && idx !== case1Adv) {
    if (plateau[idx] >= 2 && plateau[idx] <= 4) {
      let tempIdx = idx;
      const captures = [];
      while (inAdvCamp(tempIdx)) {
        if (plateau[tempIdx] >= 2 && plateau[tempIdx] <= 4) {
          captures.push(tempIdx);
          tempIdx = (tempIdx - 1 + TOTAL_TROUS) % TOTAL_TROUS;
        } else {
          break;
        }
      }
      let totalAdv = 0;
      for (let i = advStart; i < advStart + TAILLE_CAMP; i++) totalAdv += plateau[i];
      const totalCapture = captures.reduce((sum, i) => sum + plateau[i], 0);

      if (totalAdv === totalCapture) {
        return t('solidarity_msg', "Solidarité ! Capture annulée pour ne pas vider le camp adverse.");
      } else {
        captures.forEach(c => {
          greniers[joueur] += plateau[c];
          plateau[c] = 0;
        });
        return t('tactical_capture', `Prise tactique ! {0} graines capturées.`).replace('{0}', String(totalCapture));
      }
    }
  }
  return null;
};

export const checkFinPartie = (plateau: number[] | Int8Array, greniers: number[]) => {
  if (greniers[0] >= SEUIL_VICTOIRE) return 0;
  if (greniers[1] >= SEUIL_VICTOIRE) return 1;
  const totalPlateau = Array.from(plateau).reduce((a, b) => a + b, 0);
  if (totalPlateau < SEUIL_RARETE) {
    let g0 = greniers[0] + Array.from(plateau).slice(0, TAILLE_CAMP).reduce((a, b) => a + b, 0);
    let g1 = greniers[1] + Array.from(plateau).slice(TAILLE_CAMP, TOTAL_TROUS).reduce((a, b) => a + b, 0);
    return g0 > g1 ? 0 : (g1 > g0 ? 1 : 2);
  }
  return -1;
};
