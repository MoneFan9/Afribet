import React from 'react';
import { Hole } from './Hole';

interface BoardProps {
  plateau: number[];
  joueurActuel: number;
  topPlayer: number;
  bottomPlayer: number;
  topIndices: number[];
  bottomIndices: number[];
  lastMove: number | null;
  animActiveCase: number | null;
  isThinking: boolean;
  isAnimating: boolean;
  canPlayerPlay: (idx: number) => boolean;
  getLabel: (idx: number) => number;
  onPlayStable: (idx: number) => void;
  nomsJoueurs: string[];
  previewDest?: number | null;
  meilleurCoupTuteur?: number | null;
  onPreview?: (idx: number | null) => void;
}

export const Board: React.FC<BoardProps> = React.memo(({
  plateau, joueurActuel, topPlayer, bottomPlayer, topIndices, bottomIndices,
  lastMove, animActiveCase, isThinking, isAnimating, canPlayerPlay, getLabel, onPlayStable, nomsJoueurs,
  previewDest, meilleurCoupTuteur, onPreview
}) => {
  const handleBoardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const currentActive = document.activeElement as HTMLElement;
      if (!currentActive || !currentActive.hasAttribute('data-hole-index')) return;
      
      const currentIdx = parseInt(currentActive.getAttribute('data-hole-index') || '-1', 10);
      if (currentIdx === -1) return;

      e.preventDefault();

      let nextIdx = currentIdx;
      
      // Top row: indices typically 7 to 13 (left to right from player's view? Wait, topIndices are 13 down to 7 usually in Songo, let's keep it simple: just iterate available focusable buttons)
      const allFocusable = Array.from(document.querySelectorAll('button[data-hole-index][tabindex="0"]')) as HTMLElement[];
      const currentIndexInArray = allFocusable.findIndex(el => el === currentActive);
      
      if (currentIndexInArray !== -1) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          const next = allFocusable[(currentIndexInArray + 1) % allFocusable.length];
          next?.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          const prev = allFocusable[(currentIndexInArray - 1 + allFocusable.length) % allFocusable.length];
          prev?.focus();
        }
      }
    }
  };

  return (
    <div 
      className="flex flex-col gap-2 sm:gap-4 lg:gap-6 w-full lg:w-auto flex-1 max-w-full bg-wood p-2 sm:p-6 rounded-[2rem] sm:rounded-[3rem] border border-amber-900/30 relative shadow-2xl backdrop-blur-sm"
      onKeyDown={handleBoardKeyDown}
    >
      {/* INDICATEUR CAMP HAUT (PC Uniquement) */}
      <div className={`hidden lg:flex text-center items-center justify-center gap-6 transition-all duration-500 ${joueurActuel === topPlayer ? 'opacity-100 scale-100' : 'opacity-20 scale-95'}`} aria-hidden="true">
        <span className={`flex-1 h-px bg-gradient-to-r from-transparent ${topPlayer === 1 ? 'to-red-500/40' : 'to-green-500/40'}`}></span>
        <span className={`text-sm font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full border-2 shadow-lg truncate max-w-[250px] ${topPlayer === 1 ? 'text-red-400 bg-red-950/60 border-red-500/30' : 'text-green-400 bg-green-950/60 border-green-500/30'}`}>
          {nomsJoueurs[topPlayer]}
          <span className="opacity-75 font-normal ml-2">⬅️</span>
        </span>
        <span className={`flex-1 h-px bg-gradient-to-l from-transparent ${topPlayer === 1 ? 'to-red-500/40' : 'to-green-500/40'}`}></span>
      </div>

      {/* RANGÉE HAUT */}
      <div className="grid grid-cols-7 gap-1 sm:gap-4 relative w-full pt-8 pb-4 px-1 sm:px-2">
        {topIndices.map(idx => (
          <Hole
            key={`top-${idx}`}
            idx={idx}
            graines={plateau[idx]}
            isNyindi={plateau[idx] >= 5 && plateau[idx] <= 12}
            isLastMove={lastMove === idx}
            isActiveAnim={animActiveCase === idx}
            canPlay={joueurActuel === topPlayer && canPlayerPlay(topPlayer) && !isThinking && !isAnimating && plateau[idx] > 0}
            isJoueurActuel={joueurActuel === topPlayer}
            isNord={idx >= 7}
            label={getLabel(idx)}
            onPlay={onPlayStable}
            isPreviewDest={previewDest === idx}
            isBestMove={meilleurCoupTuteur === idx}
            onPreview={onPreview}
            labelPosition="top"
          />
        ))}
      </div>

      {/* LIGNE DE SÉPARATION CENTRALE */}
      <div className="h-1.5 sm:h-3 w-full bg-stone-950/80 rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1),0_1px_1px_rgba(255,255,255,0.05)] my-1 sm:my-2 flex items-center justify-center gap-2 sm:gap-4" aria-hidden="true">
        <div className="w-1 h-1 rounded-full bg-amber-900/30"></div>
        <div className="w-1 h-1 rounded-full bg-amber-900/30"></div>
        <div className="w-1 h-1 rounded-full bg-amber-900/30"></div>
      </div>

      {/* RANGÉE BAS */}
      <div className="grid grid-cols-7 gap-1 sm:gap-4 relative w-full pt-4 pb-8 px-1 sm:px-2">
        {bottomIndices.map(idx => (
          <Hole
            key={`bottom-${idx}`}
            idx={idx}
            graines={plateau[idx]}
            isNyindi={plateau[idx] >= 5 && plateau[idx] <= 12}
            isLastMove={lastMove === idx}
            isActiveAnim={animActiveCase === idx}
            canPlay={joueurActuel === bottomPlayer && canPlayerPlay(bottomPlayer) && !isThinking && !isAnimating && plateau[idx] > 0}
            isJoueurActuel={joueurActuel === bottomPlayer}
            isNord={idx >= 7}
            label={getLabel(idx)}
            onPlay={onPlayStable}
            isPreviewDest={previewDest === idx}
            isBestMove={meilleurCoupTuteur === idx}
            onPreview={onPreview}
            labelPosition="bottom"
          />
        ))}
      </div>

      {/* INDICATEUR CAMP BAS (PC Uniquement) */}
      <div className={`hidden lg:flex text-center items-center justify-center gap-6 transition-all duration-500 ${joueurActuel === bottomPlayer ? 'opacity-100 scale-100' : 'opacity-20 scale-95'}`} aria-hidden="true">
        <span className={`flex-1 h-px bg-gradient-to-r from-transparent ${bottomPlayer === 1 ? 'to-red-500/40' : 'to-green-500/40'}`}></span>
        <span className={`text-sm font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full border-2 shadow-lg truncate max-w-[250px] ${bottomPlayer === 1 ? 'text-red-400 bg-red-950/60 border-red-500/30' : 'text-green-400 bg-green-950/60 border-green-500/30'}`}>
          <span className="opacity-75 font-normal mr-2">➡️</span>
          {nomsJoueurs[bottomPlayer]}
        </span>
        <span className={`flex-1 h-px bg-gradient-to-l from-transparent ${bottomPlayer === 1 ? 'to-red-500/40' : 'to-green-500/40'}`}></span>
      </div>
    </div>
  );
});
