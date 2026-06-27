import { TOTAL_TROUS, TAILLE_CAMP, GRAINES_BOUCLE } from '../utils/constants';

interface AppliquerCoupAnimeProps {
  plateauInit: number[];
  greniersInit: number[];
  joueur: number;
  move: number;
  checkActive: () => boolean;
  setPlateau: (plateau: number[]) => void;
  setGreniers: (greniers: number[]) => void;
  setAnimActiveCase: (idx: number | null) => void;
  playSound: (sound: string, enabled: boolean) => void;
  soundEnabled: boolean;
  t?: (key: string, defaultStr?: string) => string;
}

export const appliquerCoupAnime = async ({
  plateauInit,
  greniersInit,
  joueur,
  move,
  checkActive,
  setPlateau,
  setGreniers,
  setAnimActiveCase,
  playSound,
  soundEnabled,
  t = (k, d) => d || k
}: AppliquerCoupAnimeProps) => {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  let p = plateauInit.slice();
  let g = greniersInit.slice();
  const graines = p[move];
  const case7 = joueur === 0 ? 6 : 13;

  if (move === case7 && (graines === 1 || graines === 2)) {
    g[1 - joueur] += graines;
    p[move] = 0;
    if (!checkActive()) return { aborted: true };
    setPlateau(p.slice());
    setGreniers(g.slice());
    playSound('error', soundEnabled);
    return { msg: t('penalty_case_7', "Pénalité de la case 7 ! Graines à l'adversaire."), newPlateau: p, newGreniers: g };
  }

  p[move] = 0;
  if (!checkActive()) return { aborted: true };
  setPlateau(p.slice());
  playSound('pickup', soundEnabled);
  setAnimActiveCase(move);
  await delay(250);
  if (!checkActive()) return { aborted: true };
  setAnimActiveCase(null);

  let idx = move;
  const advStart = joueur === 0 ? TAILLE_CAMP : 0;
  const animSpeed = graines > 12 ? 80 : 180;

  if (graines > GRAINES_BOUCLE) {
    for (let i = 0; i < GRAINES_BOUCLE; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      p[idx]++;
      if (!checkActive()) return { aborted: true };
      setPlateau(p.slice());
      setAnimActiveCase(idx);
      playSound('drop', soundEnabled);
      await delay(animSpeed);
    }
    let restant = graines - GRAINES_BOUCLE;
    let advIdx = 0;
    while (restant > 0) {
      const cible = advStart + (advIdx % TAILLE_CAMP);
      p[cible]++;
      restant--;
      idx = cible;
      advIdx++;
      if (!checkActive()) return { aborted: true };
      setPlateau(p.slice());
      setAnimActiveCase(idx);
      playSound('drop', soundEnabled);
      await delay(animSpeed);
    }
  } else {
    for (let i = 0; i < graines; i++) {
      idx = (idx + 1) % TOTAL_TROUS;
      p[idx]++;
      if (!checkActive()) return { aborted: true };
      setPlateau(p.slice());
      setAnimActiveCase(idx);
      playSound('drop', soundEnabled);
      await delay(animSpeed);
    }
  }

  if (!checkActive()) return { aborted: true };
  setAnimActiveCase(null);
  await delay(200);
  if (!checkActive()) return { aborted: true };

  const inAdvCamp = (i: number) => joueur === 0 ? (i >= TAILLE_CAMP && i < TOTAL_TROUS) : (i >= 0 && i < TAILLE_CAMP);
  const case1Adv = joueur === 0 ? 7 : 0;

  if (inAdvCamp(idx) && idx !== case1Adv) {
    if (p[idx] >= 2 && p[idx] <= 4) {
      let tempIdx = idx;
      const captures = [];
      while (inAdvCamp(tempIdx)) {
        if (p[tempIdx] >= 2 && p[tempIdx] <= 4) {
          captures.push(tempIdx);
          tempIdx = (tempIdx - 1 + TOTAL_TROUS) % TOTAL_TROUS;
        } else {
          break;
        }
      }

      let totalAdv = 0;
      for (let i = advStart; i < advStart + TAILLE_CAMP; i++) totalAdv += p[i];
      const totalCapture = captures.reduce((sum, i) => sum + p[i], 0);

      if (totalAdv === totalCapture) {
        playSound('error', soundEnabled);
        return { msg: t('solidarity_msg', "Solidarité ! Capture annulée pour ne pas vider le camp adverse."), newPlateau: p, newGreniers: g };
      } else {
        for (let c of captures) {
          if (!checkActive()) return { aborted: true };
          setAnimActiveCase(c);
          await delay(150);
          if (!checkActive()) return { aborted: true };
          g[joueur] += p[c];
          p[c] = 0;
          setPlateau(p.slice());
          setGreniers(g.slice());
          playSound('capture', soundEnabled);
          await delay(250);
        }
        if (!checkActive()) return { aborted: true };
        setAnimActiveCase(null);
        return { msg: t('tactical_capture', `Prise tactique ! {0} graines capturées.`).replace('{0}', String(totalCapture)), newPlateau: p, newGreniers: g };
      }
    }
  }
  return { msg: null, newPlateau: p, newGreniers: g };
};
