import React, { useState } from 'react';
import { 
  Smartphone, 
  Share2, 
  PlusSquare, 
  Download, 
  Check, 
  Copy, 
  QrCode, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  X,
  Zap,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useTheme } from '../context/ThemeContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isInstallable, isIOS, isAndroid, install } = usePWAInstall();

  const [activePlatform, setActivePlatform] = useState<'ios' | 'android' | 'qr'>(isIOS ? 'ios' : 'android');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);

  if (!isOpen) return null;

  // The actual production/preview URL
  const appUrl = typeof window !== 'undefined' 
    ? window.location.href.split('?')[0]
    : 'https://ais-pre-kvi7uey7ux5dyigistnznk-872493298242.us-east1.run.app';

  // Quick QR code API via qrserver
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(appUrl)}&color=0d9488&bgcolor=ffffff&qzone=1`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Failed to copy to clipboard', e);
    }
  };

  const handleNativeInstall = async () => {
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-2xl animate-in fade-in duration-200 bg-slate-950/80">
      <div className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
        isDark 
          ? 'glass-modal border-white/15 text-slate-100' 
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.2)]'
      }`}>
        
        {/* Top Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between gap-4 ${
          isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 via-emerald-400 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25 ring-1 ring-white/30">
              <Smartphone className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Install Pulsar on Your Phone
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30 uppercase tracking-wider">
                  PWA Standalone
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Run as a full-screen native mobile application with zero app store friction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="p-6 space-y-5">
          <div className={`p-1 rounded-2xl border flex items-center gap-1 text-xs font-semibold backdrop-blur-md ${
            isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActivePlatform('ios')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
                activePlatform === 'ios'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🍎 iPhone / iOS (Safari)</span>
            </button>

            <button
              onClick={() => setActivePlatform('android')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
                activePlatform === 'android'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🤖 Android (Chrome)</span>
            </button>

            <button
              onClick={() => setActivePlatform('qr')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activePlatform === 'qr'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Scan QR Code to open on mobile"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code</span>
            </button>
          </div>

          {/* iOS Instructions */}
          {activePlatform === 'ios' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-2xl border space-y-3.5 ${
                isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Open Safari on your iPhone
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Make sure you are using <strong>Apple Safari</strong> (Apple restricts Home Screen installation in third-party in-app browsers).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <div className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span>Tap the Share Button</span>
                      <Share2 className="w-3.5 h-3.5 text-teal-400" />
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Located in the bottom toolbar of Safari (the square box with an upward-pointing arrow).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <div className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span>Select "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Scroll down the share sheet menu and tap <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                    4
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Tap "Add" in Top-Right
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      The Pulsar app icon will now appear on your home screen. When launched, it opens without the browser address bar!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions */}
          {activePlatform === 'android' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {isInstallable && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/20 via-emerald-500/20 to-teal-500/20 border border-teal-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-teal-400" />
                      1-Click Instant Install Available!
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                      Chrome Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Your browser supports direct installation. Tap below to add Pulsar directly to your apps.
                  </p>
                  <button
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/30 transition transform active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{installing ? 'Prompting Install...' : 'Install Pulsar App to Device Now'}</span>
                  </button>
                </div>
              )}

              <div className={`p-4 rounded-2xl border space-y-3.5 ${
                isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Open Google Chrome on Android
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Navigate to the shared link in Chrome.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Tap the Menu (⋮) or "Add to Home screen" banner
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Often Chrome will automatically show an <strong>"Add Pulsar to Home screen"</strong> banner at the bottom.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Confirm "Install"
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pulsar will install like a native APK, appears in your app drawer, and functions offline with full cached assets.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Tab */}
          {activePlatform === 'qr' && (
            <div className="space-y-4 animate-in fade-in duration-150 text-center">
              <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center space-y-3 ${
                isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="p-3 bg-white rounded-2xl shadow-xl ring-4 ring-teal-500/30">
                  <img
                    src={qrCodeUrl}
                    alt="Scan to open Pulsar on phone"
                    width={176}
                    height={176}
                    className="w-44 h-44 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Scan with your Phone Camera
                  </div>
                  <p className={`text-[11px] max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Point your iPhone or Android camera at this QR code to immediately open Pulsar in your mobile browser.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Direct Link Copier */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-slate-900/80 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <div className="min-w-0 flex-1">
              <span className={`text-[10px] font-mono block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Direct App Link for Phone:
              </span>
              <span className="font-mono truncate block text-[11px] text-teal-400">
                {appUrl}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 ${
                copiedLink
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* PWA Benefits Pill Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <ShieldCheck className="w-4 h-4 mx-auto text-teal-400 mb-1" />
              <div className="text-[10px] font-bold">No App Store</div>
              <div className="text-[9px] text-slate-500">Instant Access</div>
            </div>

            <div className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Zap className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
              <div className="text-[10px] font-bold">Offline Cache</div>
              <div className="text-[9px] text-slate-500">Service Worker</div>
            </div>

            <div className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Sparkles className="w-4 h-4 mx-auto text-cyan-400 mb-1" />
              <div className="text-[10px] font-bold">Full-Screen</div>
              <div className="text-[9px] text-slate-500">Native Feel</div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${
          isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50/80'
        }`}>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>PWA Manifest v2.0 Ready</span>
          </span>

          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
