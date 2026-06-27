import React from 'react';

interface HoleProps {
  idx: number;
  graines: number;
  isNyindi: boolean;
  isLastMove: boolean;
  isActiveAnim: boolean;
  canPlay: boolean;
  isJoueurActuel: boolean;
  isNord: boolean;
  label: number;
  onPlay: (idx: number) => void;
  isPreviewDest?: boolean;
  isBestMove?: boolean;
  onPreview?: (idx: number | null) => void;
  labelPosition: 'top' | 'bottom';
}

export const Hole = React.memo(({
  idx, graines, isNyindi, isLastMove, isActiveAnim, canPlay, isJoueurActuel, isNord, label, onPlay, isPreviewDest, isBestMove, onPreview, labelPosition
}: HoleProps) => {
  // Generate deterministic positions for seed visuals (up to 8 to avoid clutter)
  const displaySeedsCount = Math.min(graines, 8);
  const seedPositions = Array.from({ length: displaySeedsCount }, (_, i) => {
    // Spiral pattern using Golden Angle
    const radius = 6 + (i * 3); // spread outward in pixels
    const angle = i * 137.5 * (Math.PI / 180);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  });

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      {labelPosition === 'top' && <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-mono font-bold whitespace-nowrap ${isNord ? 'text-red-400/60' : 'text-green-400/60'}`} aria-hidden="true">{label}</div>}

      <button
        onClick={() => canPlay && onPlay(idx)}
        onPointerDown={() => onPreview && onPreview(idx)}
        onPointerUp={() => onPreview && onPreview(null)}
        onPointerLeave={() => onPreview && onPreview(null)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && canPlay) {
            e.preventDefault();
            onPlay(idx);
          }
        }}
        aria-disabled={!canPlay}
        tabIndex={canPlay ? 0 : -1}
        data-hole-index={idx}
        aria-label={`Trou ${label}, contenant ${graines} graines.`}
        className={`w-full aspect-square min-w-[1.75rem] max-w-[4.5rem] sm:min-w-[3rem] sm:max-w-[5.5rem] rounded-full flex items-center justify-center text-lg sm:text-2xl lg:text-4xl font-black hole-carved transition-all duration-300 relative select-none touch-manipulation focus:outline-none focus:ring-4 focus:ring-amber-400/60 leading-none group
          ${isNyindi ? 'bg-gradient-to-br from-amber-800 to-amber-950 border-2 border-blue-400/40 text-blue-100' : isNord ? 'bg-gradient-to-br from-stone-900 to-black border-2 border-stone-800/50 text-red-400/90' : 'bg-gradient-to-br from-stone-800 to-stone-950 border-2 border-stone-700/50 text-green-400/90'}
          ${isActiveAnim ? 'ring-4 ring-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.9)] scale-110 z-20 bg-amber-500 !text-white' : ''}
          ${isPreviewDest ? 'ring-4 ring-blue-400 shadow-[0_0_35px_rgba(96,165,250,0.9)] scale-110 z-20 bg-blue-500 !text-white' : ''}
          ${isBestMove && !isActiveAnim && !isPreviewDest ? 'ring-4 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.5)]' : ''}
          ${canPlay ? `hover:brightness-125 hover:-translate-y-1.5 active:scale-90 active:translate-y-0 cursor-pointer ring-[4px] ring-offset-4 ring-offset-amber-950 ${isNord ? 'ring-red-500/30' : 'ring-green-500/30'}` : 'opacity-90 cursor-not-allowed'}
          ${isLastMove && !isActiveAnim && !isPreviewDest ? 'ring-4 ring-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.8)] animate-pulse' : (isJoueurActuel && !isLastMove && !isActiveAnim && !isPreviewDest && canPlay ? `ring-2 ring-offset-4 ring-offset-amber-950/50 ${isNord ? 'ring-red-500/10' : 'ring-green-500/10'}` : '')}
        `}
      >
        {/* Organic seeds visual cluster */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-full">
          {seedPositions.map((pos, sIdx) => {
            // Slightly wobble seed shape for maximum organic look (some are round, some are oval-ish, turned differently)
            const radiusX = 4 + (sIdx % 3 === 0 ? 1 : 0);
            const radiusY = 3.5 + (sIdx % 2 === 0 ? 0.5 : 0);
            return (
              <div
                key={sIdx}
                className="absolute bg-seed rounded-full border border-amber-950/50 opacity-90 transition-transform duration-300"
                style={{
                  width: `${radiusX * 2}px`,
                  height: `${radiusY * 2}px`,
                  transform: `translate(${pos.x}px, ${pos.y}px) rotate(${sIdx * 43}deg)`,
                }}
              />
            );
          })}
        </div>

        <span className="relative z-10 drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)] font-bold text-white tracking-tight">{graines}</span>
        {/* Subtle radial lighting for deep cavity look */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_30%_30%,_white_0%,_transparent_60%)]"></div>
      </button>

      {labelPosition === 'bottom' && <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-mono font-bold whitespace-nowrap ${isNord ? 'text-red-400/60' : 'text-green-400/60'}`} aria-hidden="true">{label}</div>}
    </div>
  );
});
