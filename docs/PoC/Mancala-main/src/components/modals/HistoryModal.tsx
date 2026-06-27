import React from 'react';
import { History, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { GameLog } from '../../types';

interface HistoryModalProps {
  logs: GameLog[];
  setShowHistoryModal: (v: boolean) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ logs, setShowHistoryModal }) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md" onClick={() => setShowHistoryModal(false)}>
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-900/20 rounded-[2.5rem] max-w-2xl w-full flex flex-col shadow-2xl relative overflow-hidden max-h-[90vh] ring-1 ring-white/5" onClick={e => e.stopPropagation()}>
        <div className="bg-stone-950/60 p-6 md:p-8 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 shadow-lg">
              <History size={28} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-50 tracking-tight">{t('history_title')}</h2>
              <p className="text-[10px] text-amber-200/40 tracking-widest uppercase">{t('history_subtitle')}</p>
            </div>
          </div>
          <button onClick={() => setShowHistoryModal(false)} className="text-stone-500 hover:text-white transition-colors bg-stone-900/50 hover:bg-stone-800 rounded-xl p-2 border border-white/5" aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-3 text-stone-300 text-xs md:text-sm">
          {logs.filter(l => l.isMove).length === 0 ? (
            <div className="text-center py-20 bg-stone-950/20 rounded-[2rem] border border-dashed border-white/5">
              <History size={48} className="mx-auto text-stone-800 mb-4 opacity-20" />
              <p className="text-stone-500 text-lg">{t('history_empty')}</p>
              <p className="text-[10px] text-stone-600 uppercase tracking-widest mt-2">{t('history_empty_sub')}</p>
            </div>
          ) : (
            logs.filter(l => l.isMove).map((log, i) => {
              let bColor = "border-stone-800", bg = "bg-stone-950/40", text = "text-stone-400";
              let Icon = null;
              if (log.type === 'sud') { bColor = "border-green-500/30"; bg = "bg-green-950/20"; text = "text-green-100/80"; }
              else if (log.type === 'nord') { bColor = "border-red-500/30"; bg = "bg-red-950/20"; text = "text-red-100/80"; }
              else if (log.type === 'success') { bColor = "border-blue-400/30"; bg = "bg-blue-950/20"; text = "text-blue-100/80"; Icon = CheckCircle; }
              else if (log.type === 'warning') { bColor = "border-amber-500/30"; bg = "bg-amber-950/20"; text = "text-amber-100/80"; Icon = AlertTriangle; }
              else if (log.type === 'info') { Icon = Info; }

              return (
                <div key={i} className={`p-4 rounded-2xl border ${bColor} ${bg} ${text} flex gap-4 items-start shadow-inner transition-all hover:bg-stone-950/60`}>
                  <div className="text-stone-600 font-mono text-[10px] mt-0.5 w-6 text-right shrink-0 font-black">#{i + 1}</div>
                  {Icon && <Icon size={16} className="mt-0.5 shrink-0 opacity-50" />}
                  <span className="leading-relaxed text-sm">{log.text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
