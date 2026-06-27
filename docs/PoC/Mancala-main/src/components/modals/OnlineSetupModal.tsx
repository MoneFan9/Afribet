import React from 'react';
import { Globe, User, RefreshCcw, Copy, Send, Trophy, CheckCircle, Wallet, CreditCard, Smartphone, ArrowLeft, Shield, Coins, Link } from 'lucide-react';
import axios from 'axios';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { UserType } from '../../types';

interface OnlineSetupModalProps {
  user: UserType;
  login?: () => Promise<void>;
  isWaitingForOpponent: boolean;
  onlineRoomId: string | null;
  leaveOnlineRoom: () => void;
  rejectStake: () => void;
  inputRoomId: string;
  setInputRoomId: (v: string) => void;
  pendingStakeAmount: number | null;
  setPendingStakeAmount: (v: number | null) => void;
  createOnlineRoom: (rounds: number, stake: number) => void;
  joinOnlineRoom: (id: string) => void;
  confirmPaymentOnline: () => void;
  setShowOnlineModal: (v: boolean) => void;
  addLog: (msg: string, type: string) => void;
}

export const OnlineSetupModal: React.FC<OnlineSetupModalProps> = ({
  user, login, isWaitingForOpponent, onlineRoomId, leaveOnlineRoom, rejectStake, inputRoomId, setInputRoomId,
  pendingStakeAmount, setPendingStakeAmount, createOnlineRoom, joinOnlineRoom, confirmPaymentOnline, setShowOnlineModal,
  addLog
}) => {
  const { language } = useSettingsStore();
  const t = useTranslation(language);

  const [onlineTournamentRounds, setOnlineTournamentRounds] = React.useState(1);
  const [onlineSetupStep, setOnlineSetupStep] = React.useState<'role' | 'host_config' | 'host_stakes' | 'host_amount' | 'host_payment' | 'guest_code' | 'guest_confirm_stake' | 'guest_payment' | 'waiting'>('role');
  const [stakeAmount, setStakeAmount] = React.useState<number>(0);
  const [paymentMethod, setPaymentMethod] = React.useState<'card' | 'mobile'>('card');
  const [mobileMethod, setMobileMethod] = React.useState<'airtel' | 'moov' | 'orange'>('airtel');
  const [paymentStatus, setPaymentStatus] = React.useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (pendingStakeAmount !== null) {
      setStakeAmount(pendingStakeAmount);
      setOnlineSetupStep('guest_confirm_stake');
    }
  }, [pendingStakeAmount]);

  React.useEffect(() => {
    if (!isWaitingForOpponent) {
      setOnlineSetupStep('role');
    } else {
      setOnlineSetupStep('waiting');
    }
  }, [isWaitingForOpponent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(onlineRoomId || '');
    setCopied(true);
    addLog(t('code_copied'), "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayment = async () => {
    setPaymentStatus('processing');
    try {
      const { data } = await axios.post('/api/create-payment-intent', { amount: stakeAmount });
      console.log("Payment Intent Client Secret:", data.clientSecret);
      
      await new Promise(res => setTimeout(res, 2000));
      
      setPaymentStatus('success');
      setTimeout(() => {
        if (onlineSetupStep === 'host_payment') {
          createOnlineRoom(onlineTournamentRounds, stakeAmount);
        } else if (onlineSetupStep === 'guest_payment') {
          confirmPaymentOnline();
        }
      }, 1000);
    } catch (e) {
      console.error(e);
      setPaymentStatus('error');
    }
  };

  return (
    <div className="bg-stone-900/90 p-6 md:p-10 rounded-[2.5rem] border border-blue-700/30 text-left shadow-2xl backdrop-blur-2xl ring-1 ring-blue-500/20 min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl md:text-3xl font-black text-blue-400 flex items-center gap-3"><Globe size={32} /> {t('online_arena')}</h3>
        {onlineSetupStep !== 'role' && onlineSetupStep !== 'waiting' && (
          <button 
            onClick={() => {
              if (onlineSetupStep === 'host_payment' || onlineSetupStep === 'guest_payment') setOnlineSetupStep('role');
              else if (onlineSetupStep === 'host_amount') setOnlineSetupStep('host_stakes');
              else if (onlineSetupStep === 'host_stakes') setOnlineSetupStep('host_config');
              else if (onlineSetupStep === 'host_config') setOnlineSetupStep('role');
              else if (onlineSetupStep === 'guest_code') setOnlineSetupStep('role');
              else if (onlineSetupStep === 'guest_confirm_stake') { rejectStake(); setOnlineSetupStep('guest_code'); }
              setPaymentStatus('idle');
              setPendingStakeAmount(null);
            }} 
            className="bg-stone-800 p-2 rounded-xl text-stone-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        )}
      </div>

      {isWaitingForOpponent ? (
        <div className="text-center py-10 flex-1 flex flex-col justify-center">
          <p className="text-amber-200/60 mb-6 text-lg">{t('online_code_share')}</p>
          <div className="bg-stone-950/80 p-8 rounded-[2rem] border-4 border-dashed border-blue-500/30 mb-8 flex items-center justify-center gap-6 group relative shadow-inner">
            <span className="text-5xl md:text-6xl font-black tracking-[0.3em] text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">{onlineRoomId}</span>
            <button 
              onClick={handleCopy} 
              className={`p-4 rounded-2xl transition-all flex items-center gap-3 shadow-xl ${copied ? 'bg-green-600 scale-110' : 'bg-blue-600 hover:bg-blue-500 hover:scale-105'}`}
            >
              {copied ? <RefreshCcw size={24} className="animate-spin" /> : <Copy size={24} />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 text-blue-400/80 animate-pulse font-bold tracking-widest uppercase text-[10px]">
            <RefreshCcw size={16} className="animate-spin" />
            <span>{t('online_waiting')}</span>
          </div>
          <button onClick={leaveOnlineRoom} className="mt-10 text-stone-500 hover:text-red-400 transition-all underline underline-offset-8 font-bold uppercase text-[10px] tracking-widest">{t('online_abandon')}</button>
        </div>
      ) : !user ? (
        <div className="space-y-8 text-center py-10 flex-1 flex flex-col justify-center">
          <p className="text-amber-200/70 mb-6 text-xl">{t('online_auth_required')}</p>
          <button onClick={login} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 px-8 rounded-3xl font-black transition-all shadow-2xl flex items-center justify-center gap-4 border-2 border-blue-400/30 text-lg group">
            <User size={24} className="group-hover:scale-110 transition-transform" /> {t('online_login_google')}
          </button>
          <button onClick={() => setShowOnlineModal(false)} className="w-full py-4 bg-stone-950/50 rounded-2xl font-black text-stone-500 hover:bg-stone-900 transition-all uppercase tracking-widest text-[10px]">{t('online_back_village')}</button>
        </div>
      ) : (
        <div className="flex-1 space-y-6">
          {onlineSetupStep === 'role' && (
            <div className="space-y-6">
              <p className="text-stone-400 font-bold text-center mb-4">{t('choose_role_arena')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setOnlineSetupStep('host_config')}
                  className="p-8 bg-stone-950/60 hover:bg-blue-900/40 border-2 border-stone-800 hover:border-blue-500/50 rounded-3xl transition-all group flex flex-col items-center gap-4"
                >
                  <Send size={40} className="text-blue-400 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="font-black text-xl text-white">Joueur 1</div>
                    <div className="text-xs text-stone-500 uppercase tracking-widest mt-1">{t('create_room')}</div>
                  </div>
                </button>
                <button 
                  onClick={() => setOnlineSetupStep('guest_code')}
                  className="p-8 bg-stone-950/60 hover:bg-green-900/40 border-2 border-stone-800 hover:border-green-500/50 rounded-3xl transition-all group flex flex-col items-center gap-4"
                >
                  <Globe size={40} className="text-green-400 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="font-black text-xl text-white">Joueur 2</div>
                    <div className="text-xs text-stone-500 uppercase tracking-widest mt-1">Rejoindre une partie</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {onlineSetupStep === 'host_config' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-blue-400 font-black flex items-center gap-2 uppercase tracking-tighter">1. Type de jeu</h4>
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => { setOnlineTournamentRounds(1); setOnlineSetupStep('host_stakes'); }}
                  className="p-6 rounded-2xl border-2 bg-stone-950 border-stone-800 hover:border-blue-500 transition-all flex items-center justify-between group"
                >
                  <div className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">Partie Simple</div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-black tracking-widest uppercase">1 MANCHE</span>
                </button>

                <div className="p-6 rounded-2xl border-2 bg-stone-950 border-stone-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                     <div className="font-bold text-white text-lg">Tournoi</div>
                     <span className="text-[10px] bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg font-black tracking-widest uppercase">Plusieurs Manches</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[3, 5, 7, 9].map(n => (
                      <button 
                        key={n} 
                        onClick={() => { setOnlineTournamentRounds(n); setOnlineSetupStep('host_stakes'); }} 
                        className="group relative overflow-hidden p-4 rounded-2xl bg-stone-900 border-2 border-stone-800 hover:border-purple-500/50 transition-all text-left"
                      >
                        <div className="relative z-10">
                          <div className="text-stone-400 group-hover:text-purple-400 transition-colors font-black text-xs uppercase tracking-tighter mb-1">{n} Manches</div>
                          <div className="text-white font-bold text-sm tracking-tight">Format {n === 3 ? 'Court' : n === 5 ? 'Classique' : n === 7 ? 'Épique' : 'Légende'}</div>
                        </div>
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                          <Trophy size={24} className="text-purple-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {onlineSetupStep === 'host_stakes' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-blue-400 font-black flex items-center gap-2 uppercase tracking-tighter">2. Enjeu de la partie</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => { setStakeAmount(0); createOnlineRoom(onlineTournamentRounds, 0); }}
                  className="group relative overflow-hidden p-6 rounded-3xl bg-stone-950 border-2 border-stone-800 hover:border-blue-500/50 transition-all text-center flex flex-col items-center justify-center gap-2 shadow-xl"
                >
                  <div className="text-blue-400 font-bold text-[10px] uppercase tracking-widest">Village</div>
                  <div className="text-white font-black text-xl flex items-center gap-2">Sans Mise <CheckCircle size={20} className="text-blue-500" /></div>
                </button>

                <button 
                  onClick={() => setOnlineSetupStep('host_amount')}
                  className="group relative overflow-hidden p-6 rounded-3xl bg-stone-950 border-2 border-stone-800 hover:border-amber-500/50 transition-all text-center flex flex-col items-center justify-center gap-2 shadow-xl"
                >
                  <div className="text-amber-400 font-bold text-[10px] uppercase tracking-widest">Prestige</div>
                  <div className="text-white font-black text-xl flex items-center gap-2">Avec Mise <Wallet size={20} className="text-amber-500" /></div>
                </button>
              </div>
            </div>
          )}

          {onlineSetupStep === 'host_amount' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-blue-400 font-black flex items-center gap-2 uppercase tracking-tighter">3. Montant de la mise</h4>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[5, 10, 20, 50].map(amt => (
                    <button key={amt} onClick={() => setStakeAmount(amt)} className={`flex-1 py-4 rounded-xl font-black text-lg transition-all ${stakeAmount === amt ? 'bg-amber-600 text-white shadow-lg' : 'bg-stone-950 text-stone-500'}`}>{amt}€</button>
                  ))}
                </div>
                <input 
                  type="number" 
                  value={stakeAmount || ''} 
                  onChange={(e) => setStakeAmount(Number(e.target.value))} 
                  placeholder={t('custom_amount')} 
                  className="w-full bg-stone-950 border-2 border-stone-800 px-6 py-4 rounded-2xl text-xl font-black text-amber-400 outline-none focus:border-amber-500 transition-all"
                />
                <button 
                  onClick={() => setOnlineSetupStep('host_payment')}
                  disabled={stakeAmount <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all text-lg shadow-xl shadow-blue-900/20"
                >
                  Continuer vers le paiement
                </button>
              </div>
            </div>
          )}

          {(onlineSetupStep === 'host_payment' || onlineSetupStep === 'guest_payment') && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-blue-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Shield size={18} /> {t('secure_payment', 'Paiement Sécurisé')}</h4>
              <div className="bg-stone-950/40 p-5 rounded-2xl border border-white/5 mb-4">
                 <div className="flex justify-between items-center text-xs uppercase tracking-widest text-stone-500 font-black mb-2">
                   <span>{t('deposit_bet', 'Mise à déposer')}</span>
                   <span className="text-amber-400 text-lg">{stakeAmount} €</span>
                 </div>
                 <p className="text-[10px] text-stone-600 italic">{t('money_vault_msg', "L'argent sera conservé dans notre coffre-fort numérique jusqu'à la fin de la partie.")}</p>
              </div>

              {paymentStatus === 'idle' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'card' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}
                    >
                      <CreditCard size={24} />
                      <span className="text-[10px] font-black uppercase">{t('credit_card', 'Carte Bancaire')}</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('mobile')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'mobile' ? 'bg-amber-600/10 border-amber-500 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}
                    >
                      <Smartphone size={24} />
                      <span className="text-[10px] font-black uppercase">Mobile Money</span>
                    </button>
                  </div>

                  {paymentMethod === 'mobile' && (
                    <div className="flex gap-2">
                       {['airtel', 'moov', 'orange'].map(m => (
                         <button 
                           key={m} 
                           onClick={() => setMobileMethod(m as 'airtel' | 'moov' | 'orange')}
                           className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${mobileMethod === m ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-stone-800 text-stone-600'}`}
                         >
                           {m}
                         </button>
                       ))}
                    </div>
                  )}

                  <button 
                    onClick={handlePayment}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-green-900/20 flex items-center justify-center gap-3"
                  >
                    {paymentMethod === 'card' ? t('pay_stripe', 'Payer avec Stripe') : t('pay_mobile', 'Payer avec {0}').replace('{0}', mobileMethod.toUpperCase())}
                  </button>
                </div>
              ) : paymentStatus === 'processing' ? (
                <div className="text-center py-10 space-y-6">
                  <RefreshCcw size={48} className="mx-auto text-blue-400 animate-spin" />
                  <div className="font-black text-white text-lg animate-pulse tracking-widest uppercase">{t('processing', 'Traitement en cours...')}</div>
                </div>
              ) : paymentStatus === 'success' ? (
                <div className="text-center py-10 space-y-6 animate-in zoom-in-95">
                  <CheckCircle size={64} className="mx-auto text-green-500" />
                  <div className="font-black text-white text-xl uppercase tracking-widest">{t('payment_success', 'Paiement Réussi !')}</div>
                  <p className="text-stone-400 text-sm">{t('transfer_arena', "Transfert vers l'arène...")}</p>
                </div>
              ) : (
                <div className="text-center py-10 space-y-6">
                  <div className="text-red-500 font-black">{t('payment_error', 'Erreur de paiement')}</div>
                  <button onClick={() => setPaymentStatus('idle')} className="text-stone-400 underline uppercase text-xs">{t('retry', 'Réessayer')}</button>
                </div>
              )}
            </div>
          )}
          
          {onlineSetupStep === 'guest_confirm_stake' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-amber-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Coins size={18} /> {t('challenge_with_bet', 'Défi avec mise')}</h4>
              
              <div className="bg-stone-950 border border-amber-900/30 p-8 rounded-3xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto mb-2">
                  <Wallet size={32} />
                </div>
                <h5 className="text-xl font-bold text-white">{t('match_requires_bet', 'Cette partie nécessite une mise')}</h5>
                <p className="text-stone-400 mb-6">{t('host_configured_bet', "L'hôte a configuré cette partie avec une mise obligatoire de :")}</p>
                <div className="text-5xl font-black text-amber-400 drop-shadow-lg">{stakeAmount} €</div>
                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-black mt-4">{t('winner_takes_all', 'Le vainqueur remporte tout !')}</p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => { rejectStake(); setOnlineSetupStep('guest_code'); setPendingStakeAmount(null); }}
                  className="flex-1 py-4 bg-stone-900 hover:bg-stone-800 text-stone-400 font-bold rounded-2xl transition-all"
                >
                  {t('reject', 'Refuser')}
                </button>
                <button 
                  onClick={() => setOnlineSetupStep('guest_payment')}
                  className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-amber-900/20"
                >
                  {t('accept', 'Accepter')}
                </button>
              </div>
            </div>
          )}

          {onlineSetupStep === 'guest_code' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-green-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Link size={18} /> {t('enter_access_code', "Entrez le code d'accès")}</h4>
              <input 
                type="text" 
                value={inputRoomId} 
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())} 
                maxLength={6} 
                placeholder="CODE" 
                className="w-full bg-stone-950 border-4 border-stone-800 px-5 py-6 rounded-[2.5rem] text-5xl font-black tracking-[0.4em] text-center outline-none focus:border-green-500 transition-all uppercase text-white shadow-inner" 
              />
              <button 
                onClick={() => joinOnlineRoom(inputRoomId)}
                disabled={inputRoomId.length !== 6}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition-all text-lg shadow-xl shadow-green-900/20 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
              >
                {t('online_enter')}
              </button>
            </div>
          )}
          
          <button onClick={() => setShowOnlineModal(false)} className="w-full py-4 text-stone-500 hover:text-stone-300 transition-all uppercase tracking-widest text-[10px] font-black">{t('online_back_village')}</button>
        </div>
      )}
    </div>
  );
};
