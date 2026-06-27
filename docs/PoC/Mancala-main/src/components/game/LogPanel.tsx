import React, { useEffect, useRef } from 'react';
import { BookOpen, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';

interface Log {
  text: string;
  type: string;
  isMove?: boolean;
}

interface LogPanelProps {
  logs: Log[];
  mode: string;
}

export const LogPanel: React.FC<LogPanelProps> = React.memo(({ logs, mode }) => {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs]);

  return (
    <div className="w-full lg:w-80 bg-stone-900 rounded-2xl lg:rounded-3xl p-4 sm:p-6 border border-stone-700 flex flex-col shadow-2xl h-64 sm:h-72 lg:h-[550px] shrink-0 relative overflow-hidden">
      <BookOpen className="absolute -bottom-6 -right-6 text-stone-800/50 w-32 h-32 lg:w-48 lg:h-48 pointer-events-none" aria-hidden="true" />

      <h3 className="text-base sm:text-lg font-bold text-amber-500 mb-4 lg:mb-6 flex-none flex items-center gap-2 sm:gap-3 border-b border-stone-800 pb-3 sm:pb-5 pt-1 sm:pt-2 relative z-10">
        {mode === 'Apprenti' ? <><span className="text-xl sm:text-2xl">🐉</span> {t('wisdom')}</> : <><BookOpen size={20} className="sm:w-[22px] sm:h-[22px]" /> {t('journal')}</>}
      </h3>

      <div ref={logsContainerRef} aria-live="polite" aria-atomic="false" className="flex-1 overflow-y-auto min-h-0 space-y-3 lg:space-y-4 pr-2 sm:pr-3 text-xs sm:text-sm custom-scrollbar relative z-10">
        {logs.map((log, i) => {
          let bColor = "border-stone-600", bg = "bg-stone-800/50", text = "text-stone-300";
          let Icon = null;

          if (log.type === 'sud') {
            bColor = "border-green-500"; bg = "bg-green-950/20"; text = "text-green-100";
          } else if (log.type === 'nord') {
            bColor = "border-red-500"; bg = "bg-red-950/20"; text = "text-red-100";
          } else if (log.type === 'success') {
            bColor = "border-blue-400"; bg = "bg-blue-950/30"; text = "text-blue-100"; Icon = CheckCircle;
          } else if (log.type === 'warning') {
            bColor = "border-amber-500"; bg = "bg-amber-950/30"; text = "text-amber-100"; Icon = AlertTriangle;
          } else if (log.type === 'info') {
            Icon = Info;
          }

          return (
            <div key={i} className={`p-2 sm:p-3 rounded-lg border-l-4 ${bColor} ${bg} ${text} flex gap-2 items-start shadow-sm transition-opacity duration-300`}>
              {Icon && <Icon size={14} className="sm:w-4 sm:h-4 mt-0.5 shrink-0 opacity-70" />}
              <span className="leading-snug sm:leading-relaxed font-medium whitespace-pre-wrap">{log.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
