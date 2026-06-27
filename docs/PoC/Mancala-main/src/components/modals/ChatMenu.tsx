import React, { useState } from 'react';
import { MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { callGemini } from '../../services/gemini';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';

interface ChatMenuProps {
  onClose: () => void;
  sendQuickChat: (msg: string) => void;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({ onClose, sendQuickChat }) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);
  const [customMsg, setCustomMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCustom = async () => {
    if (!customMsg.trim()) return;
    setIsSending(true);
    setError(null);

    try {
      // AI Moderation
      const prompt = `Tu es un modérateur de chat pour un jeu de société (Songo). 
Analyse le message suivant et réponds UNIQUEMENT par "OK" si le message est respectueux et approprié, ou par "REJECT" s'il contient des insultes, de la haine, du spam ou un comportement toxique.
Message : "${customMsg}"`;
      
      const systemInstruction = "Tu es un modérateur strict.";
      const fallback = "OK";
      const moderationResult = await callGemini(prompt, systemInstruction, fallback);
      
      if (moderationResult.includes('REJECT')) {
        setError(t('chat_moderation_error'));
        setIsSending(false);
        return;
      }

      sendQuickChat(customMsg.trim());
      onClose();
    } catch (err) {
      console.error("Moderation error:", err);
      // Fallback to sending if AI fails, or block. Let's send to not block gameplay.
      sendQuickChat(customMsg.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-900 border border-blue-700/50 p-5 rounded-3xl max-w-xs sm:max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2"><MessageCircle size={20} /> {t('chat_emotes')}</h3>
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['👏', '🤔', '😡', '😭', '😎', '🙏'].map(emo => (
            <button key={emo} onClick={() => { sendQuickChat(emo); onClose(); }} className="text-3xl p-3 bg-stone-800 hover:bg-stone-700 rounded-xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center">{emo}</button>
          ))}
        </div>
        
        <div className="flex flex-col gap-2 mb-4">
          {[t('chat_solidarity'), t('chat_well_played'), t('chat_fast'), t('chat_ouch')].map(txt => (
            <button key={txt} onClick={() => { sendQuickChat(txt); onClose(); }} className="p-3 bg-stone-800 hover:bg-blue-900/50 hover:text-blue-200 text-stone-300 rounded-xl font-bold transition-colors">{txt}</button>
          ))}
        </div>

        <div className="border-t border-stone-700 pt-4 mb-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCustom()}
              placeholder={t('chat_custom_placeholder')}
              className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              maxLength={50}
            />
            <button 
              onClick={handleSendCustom}
              disabled={isSending || !customMsg.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-stone-700 text-white p-2 rounded-xl transition-colors flex items-center justify-center"
            >
              {isSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><ShieldAlert size={12} /> {error}</p>}
        </div>

        <button onClick={onClose} className="w-full bg-stone-800 text-stone-400 hover:text-white py-3 rounded-xl font-bold transition-colors">{t('close')}</button>
      </div>
    </div>
  );
};
