import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
const analysisCache = new Map<string, string>();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 10000; // 10 seconds to avoid hitting 15 RPM limit
let isCircuitBroken = false;
let circuitBreakerResetTime = 0;
const CIRCUIT_BREAKER_DURATION = 60000; // 1 minute cooldown if quota hit
let quotaErrorLogged = false;

export const getGemini = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is missing. AI features will be disabled.');
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

/**
 * Helper to call Gemini with a simple retry mechanism for 429 and 500 errors
 */
export const callGemini = async (
  prompt: string,
  systemInstruction: string,
  fallback: string,
  model = 'gemini-3-flash-preview', // Switched to a supported model version
  retries = 2 // Reduced retries to avoid hammering the API
): Promise<string> => {
  const gemini = getGemini();
  if (!gemini) return fallback;

  // Check circuit breaker
  if (isCircuitBroken) {
    if (Date.now() < circuitBreakerResetTime) {
      return fallback;
    }
    isCircuitBroken = false;
    quotaErrorLogged = false;
  }

  // Simple rate limiting: ensure minimum interval between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  try {
    const response = await gemini.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text?.trim() || fallback;
  } catch (err: unknown) {
    const errorObj = err as any;
    const isQuotaError = errorObj?.message?.includes('429') || errorObj?.status === 429 || errorObj?.code === 429;
    const isRetryableError = 
      isQuotaError ||
      errorObj?.message?.includes('500') || errorObj?.status === 500 || errorObj?.code === 500 ||
      errorObj?.message?.includes('503') || errorObj?.status === 503 || errorObj?.code === 503 ||
      errorObj?.message?.includes('xhr error') || errorObj?.status === 'UNKNOWN';
    
    if (isRetryableError && retries > 0) {
      // Exponential backoff: 5s, 10s...
      const delay = Math.pow(2, 2 - retries) * 5000;
      if (!isQuotaError) console.warn(`Gemini API error, retrying in ${delay/1000}s... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGemini(prompt, systemInstruction, fallback, model, retries - 1);
    }
    
    if (isQuotaError) {
      if (!quotaErrorLogged) {
        console.warn('Gemini rate limit reached. Activating circuit breaker (1 min cooldown).');
        quotaErrorLogged = true;
      }
      isCircuitBroken = true;
      circuitBreakerResetTime = Date.now() + CIRCUIT_BREAKER_DURATION;
    } else {
      console.warn('Gemini error:', err);
    }

    return fallback;
  }
};

export const analyzeMove = async (
  plateau: number[],
  greniers: number[],
  joueur: number,
  move: number,
  isOptimal: boolean,
  uiIdx: number,
  uiMeilleurCoup: number | null,
  lang: string = 'fr'
): Promise<string> => {
  // Create a cache key based on board state and move
  const cacheKey = `${lang}|${plateau.join(',')}|${move}|${isOptimal}`;
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  const bonnesPhrases = [
    "Sois comme l'eau, mon ami. Parfait.",
    "Un coup fluide et sans effort.",
    "La voie est claire.",
    "Tu bouges avec la fluidité du vent.",
    "Précis et efficace. C'est la Voie.",
    "Ton esprit est calme, ton coup est juste.",
    "L'équilibre est maintenu. Excellent.",
    "Tu as trouvé le rythme du combat.",
    "Frappe sans intention, bouge sans effort.",
    "La simplicité est la clé de la maîtrise."
  ];

  const mauvaisesPhrases = [
    "L'esprit rigide se brise. Observe mieux le plateau.",
    "Concentre-toi sur l'essentiel.",
    "Ne regarde pas le doigt, ou tu manqueras toute la gloire céleste.",
    "La lenteur de l'esprit est le plus grand obstacle.",
    "Tu as bougé, mais ton esprit est resté immobile.",
    "La précipitation mène à la chute.",
    "Ne crains pas l'échec, crains l'absence d'effort.",
    "L'adversaire a vu ton intention avant ton geste.",
    "Reviens au centre. Ton équilibre est rompu.",
    "Apprends à voir ce qui n'est pas encore visible."
  ];

  // If optimal, use local phrases 85% of the time to save quota
  // Fallback to local phrases (will just be French, but it's offline fallback)
  if (isOptimal && Math.random() < 0.85) {
    return bonnesPhrases[Math.floor(Math.random() * bonnesPhrases.length)];
  }

  const gemini = getGemini();
  if (!gemini || isCircuitBroken) {
    if (!isOptimal && uiMeilleurCoup !== null) {
      const specificAdvice = [
        `La case ${uiMeilleurCoup} aurait été un coup plus tranchant.`,
        `Ton regard a manqué l'opportunité en case ${uiMeilleurCoup}.`,
        `La force résidait dans la case ${uiMeilleurCoup}, pas ici.`,
        `Maître Bruce Lee suggère d'étudier la case ${uiMeilleurCoup}.`
      ];
      return `${mauvaisesPhrases[Math.floor(Math.random() * mauvaisesPhrases.length)]} ${specificAdvice[Math.floor(Math.random() * specificAdvice.length)]}`;
    }
    const phrases = isOptimal ? bonnesPhrases : mauvaisesPhrases;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  const prompt = `
Tu es Maître Bruce Lee, expert du jeu de Songo.
L'apprenti a joué la case ${uiIdx}. ${isOptimal ? 'C\'était le meilleur coup.' : `Le meilleur coup était la case ${uiMeilleurCoup}.`}
Plateau AVANT le coup : Apprenti [${plateau.slice(0, 7).join(', ')}], Adversaire [${plateau.slice(7, 14).join(', ')}].

Sois TRÈS CONCIS pour répondre vite (3 phrases maximum au total).
Structure ta réponse ainsi :
Tactique : (1 phrase sur l'effet concret du coup)
Leçon : (1 phrase sur la stratégie ou pourquoi la case ${uiMeilleurCoup} était meilleure)
Philosophie : (1 courte métaphore martiale)

IMPORTANT: RESPOND ENTIRELY IN THIS LANGUAGE CODE: ${lang}.
  `;

  const fallback = isOptimal ? "Excellent coup, continue ainsi." : "Observe mieux le plateau la prochaine fois.";
  const result = await callGemini(
    prompt,
    "Tu es Maître Bruce Lee. Tu donnes des conseils de Songo extrêmement courts, rapides et structurés.",
    fallback
  );

  if (result !== fallback) {
    analysisCache.set(cacheKey, result);
    if (analysisCache.size > 100) {
      const firstKey = analysisCache.keys().next().value;
      if (firstKey !== undefined) analysisCache.delete(firstKey);
    }
  }

  return result;
};

export const analyzeGameHistory = async (
  historyLogs: string[],
  mode: string,
  onlineRole: number | null,
  nomsJoueurs: string[],
  lang: string = 'fr' // Add language
): Promise<string> => {
  const gemini = getGemini();
  if (!gemini) {
    return "Le véritable maître est celui qui apprend de chaque partie.";
  }

  let contextInstruction = "";
  if (mode === 'PvP') {
    contextInstruction = `Cette partie a été jouée en mode local entre deux joueurs humains (${nomsJoueurs[0]} et ${nomsJoueurs[1]}). Ton analyse doit s'adresser aux deux joueurs, en commentant leurs forces et faiblesses respectives.`;
  } else if (mode === 'Online') {
    const askingPlayerName = onlineRole !== null ? nomsJoueurs[onlineRole] : "le joueur";
    contextInstruction = `Cette partie a été jouée en ligne. Ton analyse doit s'adresser spécifiquement à ${askingPlayerName} (qui te demande conseil), en l'aidant à comprendre SES erreurs et comment IL peut s'améliorer face à son adversaire. Ne parle pas de l'adversaire sauf pour expliquer comment mieux le contrer.`;
  } else {
    const humanPlayerName = nomsJoueurs[0];
    contextInstruction = `Cette partie a été jouée contre l'Intelligence Artificielle. Ton analyse doit s'adresser uniquement au joueur humain (${humanPlayerName}), pour l'aider à s'améliorer face à la machine.`;
  }

  const prompt = `
Tu es Maître Bruce Lee, un expert du jeu de Songo.
Voici le résumé des coups d'une partie qui vient de se terminer :
${historyLogs.join('\n')}

${contextInstruction}

Fais une analyse globale de la partie en 3 ou 4 phrases. Ton analyse doit être constructive et axée sur l'amélioration du joueur qui te sollicite. Donne des conseils stratégiques précis basés sur les coups joués et conclus avec ta philosophie martiale.

IMPORTANT: RESPOND ENTIRELY IN THIS LANGUAGE CODE: ${lang}.
  `;

  return callGemini(
    prompt,
    "Tu es Maître Bruce Lee. Tu analyses une partie de jeu de société avec ta philosophie martiale.",
    "Le véritable maître est celui qui apprend de chaque partie."
  );
};

export const getProverb = async (lang: string = 'fr'): Promise<string> => {
  const localProverbs = [
    "La sagesse se construit graine par graine.",
    "Le fleuve remplit son lit petit à petit.",
    "Celui qui a planté un arbre avant de mourir n'a pas vécu inutilement."
  ];

  if (Math.random() < 0.5 || isCircuitBroken) {
    return localProverbs[Math.floor(Math.random() * localProverbs.length)];
  }

  return callGemini(
    `Donne-moi un proverbe africain court et inspirant sur la stratégie, la patience ou la sagesse. Seulement le proverbe, sans guillemets ni explication. IMPORTANT: DELIVER IT EXACTLY IN THIS LANGUAGE CODE: ${lang}.`,
    "Tu es un sage africain.",
    localProverbs[0]
  );
};
