import React, { useEffect } from 'react';
import { 
  PhoneCall, 
  UserCheck, 
  PhoneForwarded, 
  Mic, 
  Volume2, 
  ArrowRight, 
  ShieldAlert, 
  Sparkles,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { RCMLead, ManagerSettings } from '../types';
import { speechService } from '../utils/speech';

interface WarmTransferModalProps {
  lead: RCMLead;
  settings: ManagerSettings;
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  triggerReason: string;
}

export const WarmTransferModal: React.FC<WarmTransferModalProps> = ({
  lead,
  settings,
  isOpen,
  onAccept,
  onDecline,
  triggerReason
}) => {
  const isWhatsApp = settings.routeToWhatsApp !== false;
  const targetPhone = settings.whatsAppNumber || settings.managerPhone || '+1 (555) 382-9104';
  const cleanNumber = targetPhone.replace(/[^0-9]/g, '');

  useEffect(() => {
    if (isOpen) {
      // Play audio ringing chime
      speechService.playTelephoneRing('transfer_chime');
      const interval = setInterval(() => {
        speechService.playTelephoneRing('ring');
      }, 3500);

      // Auto-launch WhatsApp if configured
      if (isWhatsApp && settings.autoOpenWhatsAppOnTransfer) {
        const textMsg = encodeURIComponent(
          `📞 Pulsar Incoming Warm Transfer: Connecting with ${lead.doctorName} at ${lead.practiceName} (${lead.phone}). Specialty: ${lead.specialty}. EHR: ${lead.ehrSystem}. Trigger: ${triggerReason || 'Prospect ready to discuss billing audit.'}`
        );
        const waUrl = `https://wa.me/${cleanNumber}?text=${textMsg}`;
        window.open(waUrl, '_blank');
      }

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAcceptWithWhatsApp = () => {
    if (isWhatsApp) {
      const textMsg = encodeURIComponent(
        `📞 Pulsar Live Call: Connected with ${lead.doctorName} (${lead.practiceName}). Phone: ${lead.phone}. Notes: ${triggerReason || 'Prospect on line.'}`
      );
      window.open(`https://wa.me/${cleanNumber}?text=${textMsg}`, '_blank');
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/70 rounded-2xl p-6 shadow-2xl shadow-emerald-500/20 text-slate-100 overflow-hidden">
        {/* Glow backdrop pulse */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
        
        {/* Header alert pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {isWhatsApp ? 'WhatsApp Call Bridge Active' : 'Live Call Bridge Active'}
          </div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            {isWhatsApp && <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-emerald-300 font-semibold">{targetPhone}</span>
          </div>
        </div>

        {/* Practice & Doctor Card */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {lead.doctorName}
              </h3>
              <p className="text-sm text-teal-400 font-medium">{lead.practiceName}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                  {lead.specialty}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-700 text-cyan-300 font-mono">
                  EHR: {lead.ehrSystem}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                  {lead.phone}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 animate-bounce">
              {isWhatsApp ? <MessageCircle className="w-6 h-6" /> : <PhoneForwarded className="w-6 h-6" />}
            </div>
          </div>

          {/* Trigger Context */}
          <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Transfer Reason:</strong> {triggerReason || 'Prospect answered the phone and is ready to talk with the manager.'}
            </span>
          </div>
        </div>

        {/* Sound & Telephony Indicator */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 mb-6 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-1 h-5">
              <span className="w-1 bg-emerald-400 rounded-full animate-wave-1" />
              <span className="w-1 bg-emerald-400 rounded-full animate-wave-2" />
              <span className="w-1 bg-emerald-400 rounded-full animate-wave-3" />
              <span className="w-1 bg-emerald-400 rounded-full animate-wave-4" />
              <span className="w-1 bg-emerald-400 rounded-full animate-wave-5" />
            </div>
            <span>
              {isWhatsApp 
                ? `Forwarding provider line to WhatsApp (${targetPhone})...` 
                : 'Ringing your device & bridging audio line...'}
            </span>
          </div>
          <span className="font-mono text-emerald-300 font-bold">
            {isWhatsApp ? 'WhatsApp Ringing' : 'Line 1 Ringing'}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleAcceptWithWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition transform active:scale-98 cursor-pointer"
          >
            {isWhatsApp ? <MessageCircle className="w-4 h-4 fill-slate-950" /> : <PhoneCall className="w-4 h-4 fill-slate-950" />}
            <span>{isWhatsApp ? 'Accept on WhatsApp' : 'Accept Call & Talk'}</span>
          </button>
          <button
            onClick={onDecline}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700 transition cursor-pointer"
          >
            Let AI Sarah Continue
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          {isWhatsApp
            ? 'Accepting connects the doctor directly to your WhatsApp voice line with real-time AI transcription.'
            : 'Accepting switches the microphone directly to you while live transcription captures the conversation in real-time.'}
        </p>
      </div>
    </div>
  );
};
