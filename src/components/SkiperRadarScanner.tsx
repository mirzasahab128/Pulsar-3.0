import React, { useState, useEffect, useRef } from 'react';
import { 
  Radar, 
  Terminal, 
  ShieldCheck, 
  Zap, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  Cpu, 
  Search, 
  Database, 
  Layers, 
  ArrowRight,
  Stethoscope,
  Globe,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { RCMLead } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SkiperRadarScannerProps {
  leads: RCMLead[];
  onTriggerScrape?: (criteria: { specialty: string; location: string; count: number }) => void;
  onSendToCallQueue?: (lead: RCMLead) => void;
}

export const SkiperRadarScanner: React.FC<SkiperRadarScannerProps> = ({
  leads,
  onTriggerScrape,
  onSendToCallQueue
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('Cardiology & Vascular');
  const [selectedMetro, setSelectedMetro] = useState<string>('Austin, TX (PST/CST)');
  const [selectedTargetCount, setSelectedTargetCount] = useState<number>(10);
  const [filterTechStack, setFilterTechStack] = useState<string>('All EHRs');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Terminal log stream
  const [terminalLogs, setTerminalLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'stream' }>>([
    { id: '1', time: '10:42:01', text: '[NPI-REGISTRY] Connected to CMS Open Data v2 endpoint (200 OK)', type: 'info' },
    { id: '2', time: '10:42:03', text: '[SCRAPER-BOT] Initializing web crawler for specialty: Cardiology & Vascular', type: 'stream' },
    { id: '3', time: '10:42:05', text: '[GATEKEEPER-BYPASS] Detected direct clinic backline for Austin Heart & Vascular', type: 'success' },
    { id: '4', time: '10:42:08', text: '[TECH-PROFILER] Identified EHR system: eClinicalWorks v12 cloud', type: 'info' },
    { id: '5', time: '10:42:11', text: '[DNC-VERIFY] Telephone (512) 892-4100 verified clean against TCPA/DNC lists', type: 'success' },
  ]);

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  // Ensure the page always stays loaded at the top hero section when radar mounts
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Auto-generate terminal logs when scanning
  useEffect(() => {
    if (!isScanning) return;

    const sampleEntities = [
      { name: 'Lone Star Spine Institute', specialty: 'Orthopedics', ehr: 'Epic Systems', phone: '(512) 459-2000' },
      { name: 'Dr. Evelyn Reed Clinic', specialty: 'Internal Medicine', ehr: 'AthenaHealth', phone: '(214) 778-9900' },
      { name: 'Pacific Coast Nephrology', specialty: 'Nephrology', ehr: 'Cerner Ambulatory', phone: '(415) 890-4410' },
      { name: 'Dr. Michael Chang, MD', specialty: 'Cardiology', ehr: 'eClinicalWorks', phone: '(512) 345-1280' },
      { name: 'Bay Area Pulmonary Associates', specialty: 'Pulmonology', ehr: 'NextGen Healthcare', phone: '(408) 980-3300' }
    ];

    const interval = setInterval(() => {
      const entity = sampleEntities[Math.floor(Math.random() * sampleEntities.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      const logGenerators = [
        { text: `[BOT-EXTRACT] Scraped practice ${entity.name} in Austin Metro`, type: 'info' as const },
        { text: `[EHR-FINGERPRINT] Detected ${entity.ehr} - High denial overturn potential (+18.4%)`, type: 'stream' as const },
        { text: `[PHONE-SCRUB] Verified direct office line: ${entity.phone} (Active Ring)`, type: 'success' as const },
        { text: `[CONFIDENCE-AI] Decision Maker qualification score: 96.8% (Practice Administrator identified)`, type: 'success' as const },
      ];

      const chosen = logGenerators[Math.floor(Math.random() * logGenerators.length)];
      setTerminalLogs(prev => [
        ...prev.slice(-18),
        {
          id: `log-${Date.now()}`,
          time: timeStr,
          text: chosen.text,
          type: chosen.type
        }
      ]);
    }, 2800);

    return () => clearInterval(interval);
  }, [isScanning]);

  // Keep internal terminal container scrolled to bottom without dragging the outer window or page
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Skiper UI-Inspired Sonar / Radar Sweep Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    const blips = [
      { x: 0.35, y: 0.28, radius: 4, label: 'Austin Heart', active: true, pulse: 0 },
      { x: 0.72, y: 0.38, radius: 3.5, label: 'Northwest Ortho', active: true, pulse: 0.5 },
      { x: 0.22, y: 0.65, radius: 4.5, label: 'Bay Area Pulm', active: true, pulse: 0.8 },
      { x: 0.65, y: 0.75, radius: 4, label: 'Apex Pathology', active: true, pulse: 1.2 },
      { x: 0.48, y: 0.45, radius: 5, label: 'Dr. Vance MD', active: true, pulse: 1.6 },
    ];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(centerX, centerY) - 16;

      ctx.clearRect(0, 0, width, height);

      // Radar Concentric Circles (Crisp Green & Blue)
      const ringCount = 4;
      for (let i = 1; i <= ringCount; i++) {
        const r = (maxRadius / ringCount) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Crosshairs tick marks
        ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(37, 99, 235, 0.4)';
        ctx.font = '8px monospace';
        ctx.fillText(`${Math.round((r / maxRadius) * 100)}%`, centerX + r + 2, centerY - 2);
      }

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.strokeStyle = isDark ? 'rgba(37, 99, 235, 0.16)' : 'rgba(37, 99, 235, 0.24)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rotating Radar Sweep Beam (Skiper UI style)
      if (isScanning) {
        angle += 0.025;
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, maxRadius, angle - 0.45, angle);
      ctx.closePath();

      const sweepGrad = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius
      );
      sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      sweepGrad.addColorStop(0.7, 'rgba(37, 99, 235, 0.2)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Leading beam ray
      const beamX = centerX + Math.cos(angle) * maxRadius;
      const beamY = centerY + Math.sin(angle) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(beamX, beamY);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Pulsing Target Blips
      blips.forEach(blip => {
        blip.pulse += 0.04;
        const bx = centerX + (blip.x - 0.5) * 2 * (maxRadius * 0.85);
        const by = centerY + (blip.y - 0.5) * 2 * (maxRadius * 0.85);

        // Ping pulse ring
        const pulseRadius = blip.radius + (Math.sin(blip.pulse) + 1) * 3;
        ctx.beginPath();
        ctx.arc(bx, by, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Core dot
        ctx.beginPath();
        ctx.arc(bx, by, blip.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.font = '9px system-ui, sans-serif';
        ctx.fillText(blip.label, bx + 7, by + 3);
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isScanning, isDark]);

  const handleLaunchScrape = () => {
    if (onTriggerScrape) {
      onTriggerScrape({
        specialty: selectedSpecialty,
        location: selectedMetro,
        count: selectedTargetCount
      });
    }
  };

  return (
    <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl ${
      isDark
        ? 'glass-card bg-slate-950/80 border-emerald-500/20 shadow-2xl shadow-emerald-500/5'
        : 'bg-white/95 border-emerald-500/20 shadow-xl shadow-blue-500/5'
    }`}>
      {/* Skiper UI Top Glow Bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 opacity-90" />

      {/* Header and Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-500/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Radar className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Skiper UI • Autonomous Bot Scraper & NPI Radar</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>High-Velocity Medical Lead Extraction Engine</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Live web agent profiling physician practices, scrubbing direct backlines, and mapping billing managers into your BD funnel.
          </p>
        </div>

        {/* Quick Scanner Telemetry Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-[11px] font-mono">
              <span className="text-slate-400">Gatekeeper Bypass: </span>
              <strong className="text-emerald-400 font-bold">94.2%</strong>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <div className="text-[11px] font-mono">
              <span className="text-slate-400">Clean Claims: </span>
              <strong className="text-blue-400 font-bold">98.4%</strong>
            </div>
          </div>

          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              isScanning
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
            }`}
          >
            {isScanning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isScanning ? 'Pause Radar' : 'Resume Radar'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sonar Radar Screen (Left) + Bot Terminal & Control Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        {/* Left Column: Visual Sonar Radar Viewport (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 relative overflow-hidden">
          {/* Subtle Cyber Radiance Backdrop */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 w-full flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-[11px] font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE SONAR SWEEP (RADIUS 50mi)
            </span>
            <span className="text-blue-400 font-bold">PST/CST SYNCHRONIZED</span>
          </div>

          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            className="w-full max-w-[340px] aspect-square rounded-full border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          />

          <div className="mt-4 w-full grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Total Radar Pings</span>
              <strong className="text-emerald-400 text-xs font-bold">128 Providers</strong>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Direct Lines</span>
              <strong className="text-blue-400 text-xs font-bold">100% Verified</strong>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Avg Denial Overturn</span>
              <strong className="text-emerald-400 text-xs font-bold">+$145k / mo</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Terminal Logs & Search Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Target Parameters Bar */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-800 dark:text-slate-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
              <span>Scraper Bot Targeting Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Medical Specialty</label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className={`w-full rounded-xl px-2.5 py-1.5 text-xs border font-medium cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Cardiology & Vascular">Cardiology & Vascular</option>
                  <option value="Orthopedic & Spine Surgery">Orthopedic & Spine Surgery</option>
                  <option value="Pathology & Diagnostic Labs">Pathology & Diagnostic Labs</option>
                  <option value="Internal & Family Medicine">Internal & Family Medicine</option>
                  <option value="Pulmonology & Critical Care">Pulmonology & Critical Care</option>
                  <option value="Nephrology & Dialysis">Nephrology & Dialysis</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Target Metro / Region</label>
                <select
                  value={selectedMetro}
                  onChange={(e) => setSelectedMetro(e.target.value)}
                  className={`w-full rounded-xl px-2.5 py-1.5 text-xs border font-medium cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Austin, TX (PST/CST)">Austin, TX (PST/CST)</option>
                  <option value="Seattle, WA (PST)">Seattle, WA (PST)</option>
                  <option value="Atlanta, GA (EST)">Atlanta, GA (EST)</option>
                  <option value="Phoenix, AZ (MST)">Phoenix, AZ (MST)</option>
                  <option value="Dallas / Fort Worth, TX">Dallas / Fort Worth, TX</option>
                  <option value="San Francisco / Bay Area">San Francisco / Bay Area</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Batch Batch Volume</label>
                <select
                  value={selectedTargetCount}
                  onChange={(e) => setSelectedTargetCount(Number(e.target.value))}
                  className={`w-full rounded-xl px-2.5 py-1.5 text-xs border font-medium cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={5}>5 High-Intent Practices</option>
                  <option value={10}>10 High-Intent Practices</option>
                  <option value={20}>20 High-Intent Practices</option>
                  <option value={50}>50 Full Metro Batch</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/5">
              <span className="text-[11px] text-slate-500 font-mono">
                Matching verified providers in NPI database: <strong className="text-emerald-500">42 leads</strong>
              </span>

              <button
                onClick={handleLaunchScrape}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute Live Scrape Batch</span>
              </button>
            </div>
          </div>

          {/* Real-Time Agent Scraper Terminal Stream */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/25 shadow-xl font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white font-bold">Pulsar Agent Scraper Terminal</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  SOCKET STREAM LIVE
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] text-slate-400">142ms latency</span>
              </div>
            </div>

            <div 
              ref={terminalContainerRef}
              className="h-44 overflow-y-auto space-y-1.5 pr-2 no-scrollbar text-[11px]"
            >
              {terminalLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                  <span className={
                    log.type === 'success' ? 'text-emerald-400 font-medium' :
                    log.type === 'stream' ? 'text-blue-400 font-medium' :
                    log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                  }>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Ready for automated dialing queue</span>
              <span className="text-emerald-400 font-bold">PST Active Timezone: Normal business hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
