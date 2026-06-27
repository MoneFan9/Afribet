import { getZobristHash } from '../utils/zobrist';
import { estFamine, simulerNourrissage, getCoupsLegaux, appliquerCoup, checkFinPartie } from '../utils/gameLogic';
import { TOTAL_TROUS, TAILLE_CAMP, SEUIL_VICTOIRE, SEUIL_RARETE, GRAINES_BOUCLE, TT_MAX_SIZE } from '../utils/constants';

// --- ADAPTIVE NEURAL NETWORK ---
class AdaptiveSongoNN {
  weights: number[];
  playerProfile: {
    favoredHoles: number[];
    vulnerabilityRate: number;
    totalMoves: number;
  };

  constructor() {
    // Features: [ScoreDiff, MyNyindis, OppNyindis, MyVuln, OppVuln]
    this.weights = [1.0, 0.5, -0.5, -0.8, 0.8];
    this.playerProfile = {
      favoredHoles: new Array(TAILLE_CAMP).fill(0),
      vulnerabilityRate: 0,
      totalMoves: 0
    };
  }

  evaluate(plateau: Int8Array, greniers: number[], joueurIa: number) {
    const diff = greniers[joueurIa] - greniers[1 - joueurIa];
    let myNyindis = 0, oppNyindis = 0;
    let myVuln = 0, oppVuln = 0;
    
    const myStart = joueurIa === 0 ? 0 : TAILLE_CAMP;
    const oppStart = joueurIa === 0 ? TAILLE_CAMP : 0;
    
    for (let i = 0; i < TAILLE_CAMP; i++) {
      const mySeeds = plateau[myStart + i];
      if (mySeeds >= 5 && mySeeds <= 12) myNyindis++;
      if (mySeeds === 1 || mySeeds === 2) myVuln++;
      
      const oppSeeds = plateau[oppStart + i];
      if (oppSeeds >= 5 && oppSeeds <= 12) oppNyindis++;
      if (oppSeeds === 1 || oppSeeds === 2) oppVuln++;
    }

    // Adapt evaluation based on player profile
    // If player leaves many vulnerabilities, increase the weight of exploiting them
    const dynamicOppVulnWeight = this.weights[4] + (this.playerProfile.vulnerabilityRate * 0.5);
    
    const score = (diff * this.weights[0]) + 
                  (myNyindis * this.weights[1]) + 
                  (oppNyindis * this.weights[2]) + 
                  (myVuln * this.weights[3]) + 
                  (oppVuln * dynamicOppVulnWeight);
    return score;
  }

  learn(move: number, plateauBefore: Int8Array, joueur: number) {
    this.playerProfile.totalMoves++;
    const relativeMove = move % TAILLE_CAMP;
    this.playerProfile.favoredHoles[relativeMove]++;
    
    // Check if player left vulnerabilities
    const start = joueur === 0 ? 0 : TAILLE_CAMP;
    let vuln = 0;
    for (let i = 0; i < TAILLE_CAMP; i++) {
      if (plateauBefore[start + i] === 1 || plateauBefore[start + i] === 2) vuln++;
    }
    // Moving average of vulnerability rate
    this.playerProfile.vulnerabilityRate = (this.playerProfile.vulnerabilityRate * 0.9) + (vuln > 0 ? 0.1 : 0);
  }
}

const adaptiveNN = new AdaptiveSongoNN();

// --- MONTE CARLO TREE SEARCH (AlphaZero style) ---
class MCTSNode {
  state: { plateau: Int8Array, greniers: number[], joueurActuel: number };
  parent: MCTSNode | null;
  moveFromParent: number | null;
  children: MCTSNode[];
  visits: number;
  score: number;
  untriedMoves: number[];

  constructor(state: { plateau: Int8Array, greniers: number[], joueurActuel: number }, parent: MCTSNode | null = null, moveFromParent: number | null = null) {
    this.state = state;
    this.parent = parent;
    this.moveFromParent = moveFromParent;
    this.children = [];
    this.visits = 0;
    this.score = 0;
    this.untriedMoves = getCoupsLegaux(Array.from(state.plateau), state.joueurActuel);
  }

  getBestChild(c = 1.414) {
    let bestValue = -Infinity;
    let bestNode = this.children[0];
    for (const child of this.children) {
      const ucb1 = (child.score / child.visits) + c * Math.sqrt(Math.log(this.visits) / child.visits);
      if (ucb1 > bestValue) {
        bestValue = ucb1;
        bestNode = child;
      }
    }
    return bestNode;
  }
}

const runMCTS = (plateau: Int8Array, greniers: number[], joueurActuel: number, iterations: number, joueurIa: number) => {
  const rootState = { plateau: new Int8Array(plateau), greniers: [...greniers], joueurActuel };
  const rootNode = new MCTSNode(rootState);

  for (let i = 0; i < iterations; i++) {
    let node = rootNode;
    let state = { plateau: new Int8Array(node.state.plateau), greniers: [...node.state.greniers], joueurActuel: node.state.joueurActuel };

    // Selection
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = node.getBestChild();
      appliquerCoup(state.plateau, state.greniers, state.joueurActuel, node.moveFromParent!);
      state.joueurActuel = 1 - state.joueurActuel;
    }

    // Expansion
    if (node.untriedMoves.length > 0) {
      const move = node.untriedMoves.pop()!;
      appliquerCoup(state.plateau, state.greniers, state.joueurActuel, move);
      state.joueurActuel = 1 - state.joueurActuel;
      const childNode = new MCTSNode({ plateau: new Int8Array(state.plateau), greniers: [...state.greniers], joueurActuel: state.joueurActuel }, node, move);
      node.children.push(childNode);
      node = childNode;
    }

    // Simulation (Rollout with Adaptive NN bias)
    let currentJoueur = state.joueurActuel;
    let depth = 0;
    while (checkFinPartie(state.plateau, state.greniers) === -1 && depth < 30) {
      const moves = getCoupsLegaux(Array.from(state.plateau), currentJoueur);
      if (moves.length === 0) break;
      const move = moves[Math.floor(Math.random() * moves.length)];
      appliquerCoup(state.plateau, state.greniers, currentJoueur, move);
      currentJoueur = 1 - currentJoueur;
      depth++;
    }

    // Backpropagation
    const fin = checkFinPartie(state.plateau, state.greniers);
    let result = 0;
    if (fin === joueurIa) result = 1;
    else if (fin === 1 - joueurIa) result = 0;
    else {
      const evalScore = adaptiveNN.evaluate(state.plateau, state.greniers, joueurIa);
      result = 1 / (1 + Math.exp(-evalScore / 10)); // Sigmoid normalization
    }

    let curr: MCTSNode | null = node;
    while (curr !== null) {
      curr.visits++;
      if (curr.parent && curr.parent.state.joueurActuel === joueurIa) {
        curr.score += result;
      } else {
        curr.score += (1 - result);
      }
      curr = curr.parent;
    }
  }

  let bestMove = null;
  let maxVisits = -1;
  for (const child of rootNode.children) {
    if (child.visits > maxVisits) {
      maxVisits = child.visits;
      bestMove = child.moveFromParent;
    }
  }
  return bestMove;
};

interface TTEntry { depth: number; score: number; flag: string; bestMove: number | null; }
const transpositionTable = new Map<string, TTEntry>();
const safeSetTT = (key: string, val: TTEntry) => {
  if (transpositionTable.size >= TT_MAX_SIZE) transpositionTable.clear();
  transpositionTable.set(key, val);
};

const alphaBeta = (plateauTyped: Int8Array, greniers: number[], joueurActuel: number, profondeur: number, alpha: number, beta: number, isMaximizing: boolean, joueurIa: number): { score: number, bestMove: number | null } => {
  const stateKey = getZobristHash(plateauTyped, joueurActuel) + ':' + (greniers[0] - greniers[1]);
  let ttMove = null;

  if (transpositionTable.has(stateKey)) {
    const entry = transpositionTable.get(stateKey);
    if (entry.depth >= profondeur) {
      if (entry.flag === 'EXACT') return { score: entry.score, bestMove: entry.bestMove };
      if (entry.flag === 'LOWER') alpha = Math.max(alpha, entry.score);
      if (entry.flag === 'UPPER') beta = Math.min(beta, entry.score);
      if (alpha >= beta) return { score: entry.score, bestMove: entry.bestMove };
    }
    ttMove = entry.bestMove;
  }

  const fin = checkFinPartie(plateauTyped, greniers);
  if (fin !== -1) {
    if (fin === joueurIa) return { score: 1000 + profondeur, bestMove: null };
    if (fin === 1 - joueurIa) return { score: -1000 - profondeur, bestMove: null };
    return { score: 0, bestMove: null };
  }

  if (profondeur === 0) {
    const score = greniers[joueurIa] - greniers[1 - joueurIa];
    const campStart = joueurIa === 1 ? TAILLE_CAMP : 0;
    let nyindis = 0;
    for (let i = campStart; i < campStart + TAILLE_CAMP; i++) {
      if (plateauTyped[i] >= 5 && plateauTyped[i] <= 12) nyindis++;
    }
    return { score: score + (nyindis * 0.5), bestMove: null };
  }

  let coups = getCoupsLegaux(Array.from(plateauTyped), joueurActuel);

  if (coups.length === 0) {
    let g0 = greniers[0] + Array.from(plateauTyped).slice(0, TAILLE_CAMP).reduce((a, b) => a + b, 0);
    let g1 = greniers[1] + Array.from(plateauTyped).slice(TAILLE_CAMP, TOTAL_TROUS).reduce((a, b) => a + b, 0);
    let finalScore = g0 - g1;
    return { score: joueurIa === 0 ? finalScore : -finalScore, bestMove: null };
  }

  const scoredCoups = coups.map(move => {
    if (move === ttMove) return { move, score: 10000 };
    let pCopy = new Int8Array(plateauTyped);
    let gCopy = greniers.slice();
    appliquerCoup(pCopy, gCopy, joueurActuel, move);
    return { move, score: gCopy[joueurActuel] - greniers[joueurActuel] };
  });

  scoredCoups.sort((a, b) => b.score - a.score);
  coups = scoredCoups.map(c => c.move);

  let bestMove = coups[0];
  const originalAlpha = alpha;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of coups) {
      const pCopy = new Int8Array(plateauTyped);
      const gCopy = greniers.slice();
      appliquerCoup(pCopy, gCopy, joueurActuel, move);
      const { score } = alphaBeta(pCopy, gCopy, 1 - joueurActuel, profondeur - 1, alpha, beta, false, joueurIa);
      if (score > maxEval) {
        maxEval = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    let flag = 'EXACT';
    if (maxEval <= originalAlpha) flag = 'UPPER';
    else if (maxEval >= beta) flag = 'LOWER';
    safeSetTT(stateKey, { score: maxEval, bestMove, depth: profondeur, flag });
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    for (const move of coups) {
      const pCopy = new Int8Array(plateauTyped);
      const gCopy = greniers.slice();
      appliquerCoup(pCopy, gCopy, joueurActuel, move);
      const { score } = alphaBeta(pCopy, gCopy, 1 - joueurActuel, profondeur - 1, alpha, beta, true, joueurIa);
      if (score < minEval) {
        minEval = score;
        bestMove = move;
      }
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    let flag = 'EXACT';
    if (minEval <= alpha) flag = 'UPPER';
    else if (minEval >= beta) flag = 'LOWER';
    safeSetTT(stateKey, { score: minEval, bestMove, depth: profondeur, flag });
    return { score: minEval, bestMove };
  }
};

self.onmessage = function(e) {
  const { msgId, action, plateau, greniers, joueurActuel, profondeur, isMaximizing, joueurIa, clearTT, useMCTS, iterations, move } = e.data;
  
  if (action === 'learn') {
    const plateauTyped = new Int8Array(plateau);
    adaptiveNN.learn(move, plateauTyped, joueurActuel);
    return;
  }

  if (action === 'calculate') {
    if (clearTT) transpositionTable.clear();
    const plateauTyped = new Int8Array(plateau);
    
    if (useMCTS) {
      // Use AlphaZero-style MCTS with Adaptive NN
      const bestMove = runMCTS(plateauTyped, greniers, joueurActuel, iterations || 5000, joueurIa);
      self.postMessage({ msgId, result: { bestMove, score: 0 } });
    } else {
      // Standard Alpha-Beta
      const res = alphaBeta(plateauTyped, greniers, joueurActuel, profondeur, -Infinity, Infinity, isMaximizing, joueurIa);
      self.postMessage({ msgId, result: { bestMove: res.bestMove, score: res.score } });
    }
  }
};
