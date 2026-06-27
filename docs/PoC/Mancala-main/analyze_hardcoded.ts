import fs from 'fs';

const grepOutput = `
src/hooks/useAITurn.ts:49:      let msgReflexion = "L'IA réfléchit...";
src/hooks/useAITurn.ts:50:      if (mode === 'Apprenti') msgReflexion = "Maître Bruce Lee observe ton esprit...";
src/hooks/useAITurn.ts:51:      else if (difficulty === 'Enfant') msgReflexion = "L'enfant hésite sur la case à jouer...";
src/hooks/useAITurn.ts:52:      else if (difficulty === 'Initié') msgReflexion = "L'initié compte ses graines...";
src/hooks/useAITurn.ts:55:        msgReflexion = \`Le Vieux Sage médite : "\${prov}"\`;
src/hooks/useAITurn.ts:57:      else if (difficulty === 'Grand Maître') {
src/hooks/useAITurn.ts:59:        msgReflexion = \`Le Grand Maître enseigne : "\${prov}"\`;
src/hooks/useAITurn.ts:75:        let profondeurIA = difficulty === 'Enfant' ? 0 : difficulty === 'Initié' ? 1 : difficulty === 'Vieux Sage' ? 4 : 6;
src/hooks/useOnlineGame.ts:42:      addLog(\`Salle \${room.roomId} créée. En attente d'un adversaire...\`, 'success');
src/hooks/useOnlineGame.ts:60:        addLog(\`Connecté à la salle \${room.roomId}. Bonne chance !\`, 'success');
src/hooks/useOnlineGame.ts:81:            addLog("Mises confirmées. La partie va commencer.", "success");
src/hooks/useOnlineGame.ts:124:      addLog("L'adversaire a quitté la partie.", 'warning');
src/hooks/useOnlineGame.ts:144:      addLog("Le mode en ligne nécessite une connexion active.", "warning");
src/hooks/useOnlineGame.ts:178:      name: tempName2 || 'Invité',
src/hooks/useOnlineGame.ts:191:    addLog("Vous avez refusé la mise.", 'info');
src/hooks/useOnlineGame.ts:209:    addLog("Partie en ligne quittée.", 'info');
src/components/game/PlayerReserve.tsx:24:    const match = name?.match(/^(IA|Maître) \((.+)\)$/);
src/components/game/PlayerReserve.tsx:33:    if (name === "Maître Bruce Lee") {
src/components/modals/HelpModal.tsx:97:          {/* 4. Règles Sacrées */}
src/components/modals/HelpModal.tsx:131:          {/* 5. Conseils de Maître */}
src/components/modals/OnlineSetupModal.tsx:139:              <p className="text-stone-400 font-bold text-center mb-4">Choisissez votre rôle dans l'arène</p>
src/components/modals/OnlineSetupModal.tsx:148:                    <div className="text-xs text-stone-500 uppercase tracking-widest mt-1">Créer une salle</div>
src/components/modals/OnlineSetupModal.tsx:191:                          <div className="text-white font-bold text-sm tracking-tight">Format {n === 3 ? 'Court' : n === 5 ? 'Classique' : n === 7 ? 'Épique' : 'Légende'}</div>
src/components/modals/OnlineSetupModal.tsx:240:                  placeholder="Montant personnalisé" 
src/components/modals/OnlineSetupModal.tsx:256:              <h4 className="text-blue-400 font-black flex items-center gap-2 uppercase tracking-tighter">Paiement Sécurisé</h4>
src/components/modals/OnlineSetupModal.tsx:259:                   <span>Mise à déposer</span>
src/components/modals/OnlineSetupModal.tsx:262:                 <p className="text-[10px] text-stone-600 italic">L'argent sera conservé dans notre coffre-fort numérique jusqu'à la fin de la partie.</p>
src/components/modals/OnlineSetupModal.tsx:313:                  <div className="font-black text-white text-xl uppercase tracking-widest">Paiement Réussi !</div>
src/components/modals/OnlineSetupModal.tsx:314:                  <p className="text-stone-400 text-sm">Transfert vers l'arène...</p>
src/components/modals/OnlineSetupModal.tsx:319:                  <button onClick={() => setPaymentStatus('idle')} className="text-stone-400 underline uppercase text-xs">Réessayer</button>
src/components/modals/OnlineSetupModal.tsx:327:              <h4 className="text-amber-400 font-black flex items-center gap-2 uppercase tracking-tighter">Défi avec mise</h4>
src/components/modals/OnlineSetupModal.tsx:333:                <h5 className="text-xl font-bold text-white">Cette partie nécessite une mise</h5>
src/components/modals/OnlineSetupModal.tsx:334:                <p className="text-stone-400 mb-6">L'hôte a configuré cette partie avec une mise obligatoire de :</p>
src/components/modals/OnlineSetupModal.tsx:358:              <h4 className="text-green-400 font-black flex items-center gap-2 uppercase tracking-tighter">Entrez le code d'accès</h4>
src/components/modals/ChatMenu.tsx:26:      const prompt = \`Tu es un modérateur de chat pour un jeu de société (Songo). 
src/components/modals/ChatMenu.tsx:27:Analyse le message suivant et réponds UNIQUEMENT par "OK" si le message est respectueux et approprié, ou par "REJECT" s'il contient des insultes, de la haine, du spam ou un comportement toxique.
src/components/modals/ChatMenu.tsx:30:      const systemInstruction = "Tu es un modérateur strict.";
src/components/modals/TournamentSetupModal.tsx:46:          {['Enfant', 'Initié', 'Vieux Sage', 'Grand Maître', 'AlphaSongo'].map(lvl => (
src/components/modals/ProfileModal.tsx:90:                Déconnexion
src/components/modals/GameOver.tsx:211:                <p className="text-[10px] text-blue-300/30 mt-1 relative z-10 font-mono">({statsApprenti.optimaux} optimaux / {statsApprenti.joues} joués)</p>
src/components/modals/Menu.tsx:221:              <button onClick={() => startGame('Apprenti', 'Initié')} className="w-full mt-6 bg-stone-950/80 hover:bg-indigo-900/40 text-indigo-200 py-3 rounded-xl font-black transition-all border border-indigo-900/20 text-sm uppercase tracking-widest">{t('online_enter')}</button>
src/components/modals/Menu.tsx:236:                {['Enfant', 'Initié', 'Vieux Sage', 'Grand Maître', 'AlphaSongo'].map((lvl, i) => (
src/components/ErrorBoundary.tsx:60:                ? "Le village a atteint sa limite de lecture quotidienne gratuite. Les esprits se reposent. Revenez demain pour continuer votre quête ou contactez l'ancien du village."
src/components/ErrorBoundary.tsx:61:                : "Une erreur inattendue s'est produite. Le Songo demande un instant de réflexion."}
src/components/ErrorBoundary.tsx:68:              Réessayer
src/utils/constants.ts:9:  "L'eau qui coule ne revient pas à sa source.",
src/utils/gameAnimation.ts:41:    return { msg: "Pénalité de la case 7 ! Graines à l'adversaire.", newPlateau: p, newGreniers: g };
src/utils/gameAnimation.ts:120:        return { msg: "Solidarité ! Capture annulée pour ne pas vider le camp adverse.", newPlateau: p, newGreniers: g };
src/utils/gameAnimation.ts:136:        return { msg: \`Prise tactique ! \${totalCapture} graines capturées.\`, newPlateau: p, newGreniers: g };
src/utils/gameLogic.ts:74:    return "Pénalité de la case 7 ! Graines à l'adversaire.";
src/utils/gameLogic.ts:121:        return "Solidarité ! Capture annulée pour ne pas vider le camp adverse.";
src/utils/gameLogic.ts:127:        return \`Prise tactique ! \${totalCapture} graines capturées.\`;
src/App.tsx:344:    if (gameState === 'gameover') return; // Sécurité : ne pas traiter un abandon si la partie est déjà finie
src/App.tsx:464:      setNomsJoueurs(['Petit Dragon', 'Maître Bruce Lee']);
src/App.tsx:482:      (selectedMode === 'Apprenti' && premierJoueur === 1 ? 'Maître Bruce Lee' :
src/App.tsx:615:      // Si la fin est due à la rareté des graines, on ramasse les restes pour l'affichage final
src/App.tsx:635:            // Égalité parfaite : 1 point pour chacun
src/App.tsx:656:      addLog(\`Famine irréversible ! \${nomsJoueurs[nextJoueur]} ne peut pas jouer.\`, 'warning', true);
src/App.tsx:831:            Le service est temporairement saturé (quota atteint). Certaines fonctionnalités de classement ou de sauvegarde peuvent être indisponibles.
src/App.tsx:883:            // On quitte d'abord la salle pour éviter de voir le plateau
src/App.tsx:897:            <h2 className="text-xl md:text-2xl font-bold text-red-400 mb-3 md:mb-4">Déclarer Forfait ?</h2>
src/App.tsx:909:                <p className="text-sm md:text-base text-stone-300 mb-6 md:mb-8 font-medium">L'adversaire sera immédiatement déclaré vainqueur.</p>
src/services/gemini.ts:112:    "Tu bouges avec la fluidité du vent."`;
