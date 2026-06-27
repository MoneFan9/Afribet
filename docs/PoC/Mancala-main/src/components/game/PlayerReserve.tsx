import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';

interface PlayerReserveProps {
  joueurActuel: number;
  playerIdx: number;
  grenier: number;
  nomJoueur: string;
  isTopPlayer: boolean;
  chatBubble: string | null;
  apprenticeScore?: number | null;
}

export const PlayerReserve: React.FC<PlayerReserveProps> = React.memo(({
  joueurActuel, playerIdx, grenier, nomJoueur, isTopPlayer, chatBubble, apprenticeScore
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);
  const isCurrent = joueurActuel === playerIdx;
  const isRed = playerIdx === 1;

  const formatReservoirName = (name: string) => {
    // If name matches something like "IA (Diff)" or localized equivalent
    const aiPrefix = t('ai', 'IA') || 'IA';
    const match = name?.match(new RegExp(`^(?:IA|AI|KI)${aiPrefix}? \\((.+)\\)$`, 'i')) || name?.match(/^(IA|AI|KI) \((.+)\)$/i);
    // Alternatively just check the pattern "XXX (YYY)"
    const simpleMatch = name?.match(/^(.+?) \((.+)\)$/);

    if (simpleMatch && (simpleMatch[1].toUpperCase() === 'IA' || simpleMatch[1].toUpperCase() === 'AI' || simpleMatch[1].toUpperCase() === 'KI')) {
      return (
        <>
          <span className="block text-[10px] sm:text-xs lg:text-sm">{simpleMatch[1]}</span>
          <span className="block text-[9px] sm:text-[10px] lg:text-xs opacity-75 break-words">{simpleMatch[2]}</span>
        </>
      );
    }
    if (name === t('master_bruce_lee', "Maître Bruce Lee") || name === "Maître Bruce Lee" || name === "Master Bruce Lee") {
      return (
        <>
          <span className="block text-[10px] sm:text-xs lg:text-sm">{t('master')}</span>
          <span className="block text-[9px] sm:text-[10px] lg:text-xs opacity-75 break-words">Bruce Lee</span>
        </>
      );
    }
    return <span className="line-clamp-2 break-words text-[10px] sm:text-xs lg:text-sm">{name}</span>;
  };

  return (
    <div className="relative w-full lg:w-24 shrink-0 flex items-center justify-center">
      <div className={`w-full h-14 sm:h-16 lg:h-80 bg-stone-950/60 rounded-xl sm:rounded-2xl lg:rounded-[3rem] flex flex-row lg:flex-col items-center justify-between lg:justify-center px-2 sm:px-4 lg:px-0 border-2 lg:border-[3px] relative overflow-hidden transition-all duration-500
        ${isCurrent
          ? (isRed ? 'border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.3),inset_0_5px_15px_rgba(0,0,0,0.8)]' : 'border-green-500/70 shadow-[0_0_20px_rgba(34,197,94,0.3),inset_0_5px_15px_rgba(0,0,0,0.8)]')
          : 'border-amber-950 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)]'}
      `}>
        {/* LEFT SIDE (Mobile) / TOP/BOTTOM (Desktop) */}
        <div className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 lg:absolute ${isTopPlayer ? (apprenticeScore != null ? 'lg:bottom-6' : 'lg:top-6') : 'lg:bottom-6'} lg:left-1/2 lg:-translate-x-1/2 text-center w-[35%] lg:w-[85%] z-10 overflow-hidden`}>
          {!isTopPlayer && (
            <span className={`text-lg sm:text-xl font-bold animate-pulse lg:hidden shrink-0 ${isCurrent ? 'opacity-100' : 'opacity-0'} ${isRed ? 'text-red-500/40' : 'text-green-500/40'}`}>
              ➡️
            </span>
          )}
          <div className={`font-black uppercase tracking-widest leading-tight transition-colors w-full text-center ${isCurrent ? (isRed ? 'text-red-300' : 'text-green-300') : 'text-amber-500/80'}`}>
            {formatReservoirName(nomJoueur)}
          </div>
        </div>

        {/* CENTER (Grenier) */}
        <span className={`text-3xl sm:text-4xl lg:text-5xl font-black drop-shadow-lg z-10 text-center w-[30%] lg:w-full shrink-0 ${isRed ? 'text-red-400/90' : 'text-green-400/90'}`}>
          {grenier}
        </span>

        {/* RIGHT SIDE (Mobile) / TOP (Desktop) */}
        <div className={`flex items-center justify-center gap-1 sm:gap-2 lg:absolute lg:top-6 lg:left-1/2 lg:-translate-x-1/2 text-center w-[35%] lg:w-[80%] z-10`}>
          {isTopPlayer && apprenticeScore != null && (
            <div className="min-w-0">
              <span className="text-[8px] sm:text-[10px] lg:text-xs text-blue-400 font-black uppercase tracking-widest block truncate">{t('score').replace(' :', '')}</span>
              <span className="text-xs sm:text-sm lg:text-lg text-blue-200 font-black block truncate">{apprenticeScore}%</span>
            </div>
          )}
          {isTopPlayer && (
            <span className={`text-lg sm:text-xl font-bold animate-pulse lg:hidden shrink-0 ${isCurrent ? 'opacity-100' : 'opacity-0'} ${isRed ? 'text-red-500/40' : 'text-green-500/40'}`}>
              ⬅️
            </span>
          )}
        </div>
      </div>

      {/* Bulle de chat */}
      {chatBubble && (
        <div className={`absolute top-[-30px] left-1/2 -translate-x-1/2 ${isTopPlayer ? 'lg:top-4 lg:-right-16 lg:left-auto lg:translate-x-0 rounded-bl-none' : 'lg:bottom-4 lg:-left-16 lg:top-auto lg:right-auto lg:translate-x-0 rounded-br-none'} bg-white text-stone-900 px-3 py-1.5 rounded-2xl shadow-xl border-2 border-stone-300 font-bold z-50 animate-bounce whitespace-nowrap text-xs md:text-sm`}>
          {chatBubble}
        </div>
      )}
    </div>
  );
});
