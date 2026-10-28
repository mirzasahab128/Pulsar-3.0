import React, { useEffect, useRef, useState } from 'react';
import { Atom, Leap } from 'loading-dev';
import { useTheme } from '../context/ThemeContext';
import { useDisplay } from '../context/DisplayContext';
import { 
  Sparkles, 
  Activity, 
  PhoneCall, 
  ShieldCheck, 
  Zap, 
  Flame, 
  Cpu, 
  Maximize2, 
  Minimize2, 
  Volume2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers
} from 'lucide-react';
import { NicheTemplate } from '../data/nicheTemplates';

interface ZoeyPulsarCoreProps {
  onDialTrigger?: () => void;
  onOpenBriefing?: () => void;
  onOpenNicheLibrary?: () => void;
  nicheTemplate?: NicheTemplate;
  stats?: {
    callsPlaced: number;
    humanConnects: number;
    warmTransfersBridged: number;
    auditsBooked: number;
    pipelineAdded: string;
  };
}

export function AtomSize() {
  return (
    <div className="flex items-center gap-6">
      <Atom size={16} />
      <Atom size={24} />
      <Atom size={40} />
    </div>
  );
}

export { LeapDemo } from './ui/LeapDemo';

export const ZoeyPulsarCore: React.FC<ZoeyPulsarCoreProps> = ({
  onDialTrigger,
  onOpenBriefing,
  onOpenNicheLibrary,
  nicheTemplate,
  stats = {
    callsPlaced: 42,
    humanConnects: 19,
    warmTransfersBridged: 6,
    auditsBooked: 3,
    pipelineAdded: '$145,000 / mo'
  }
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { coreWidgetMode, setCoreWidgetMode } = useDisplay();
  const isExpanded = coreWidgetMode === 'expanded';
  const isCollapsed = coreWidgetMode === 'collapsed';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [activeMode, setActiveMode] = useState<'voice' | 'scrubber' | 'transfer' | 'briefing'>('voice');
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Canvas-based ZoeyOS Fluid Orb & Gyroscopic Rings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 240);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle nodes for orbiting quantum electrons
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      orbitRadius: 40 + Math.random() * 45,
      speed: 0.015 + Math.random() * 0.02,
      size: Math.random() * 2.2 + 0.8,
      color: i % 3 === 0 ? '#14b8a6' : i % 3 === 1 ? '#06b6d4' : '#10b981',
      verticalDrift: (Math.random() - 0.5) * 18,
      phase: Math.random() * Math.PI * 2
    }));

    let time = 0;

    const render = () => {
      time += 0.025;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2 + mousePos.x * 12;
      const centerY = height / 2 + mousePos.y * 10;
      const baseRadius = isExpanded ? 58 : 46;

      // Outer luminous atmospheric aura
      const auraGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 2.6
      );
      if (isDark) {
        auraGradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
        auraGradient.addColorStop(0.4, 'rgba(56, 189, 248, 0.25)');
        auraGradient.addColorStop(0.8, 'rgba(37, 99, 235, 0.12)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        auraGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        auraGradient.addColorStop(0.4, 'rgba(56, 189, 248, 0.2)');
        auraGradient.addColorStop(0.8, 'rgba(37, 99, 235, 0.1)');
        auraGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();

      // Gyroscopic 3D-feel Orbit Rings (Signature ZoeyOS aesthetic)
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringAngle = time * (0.8 + r * 0.4) + r * (Math.PI / 3);
        const ringRadiusX = baseRadius * (1.35 + r * 0.32);
        const ringRadiusY = ringRadiusX * (0.35 + Math.sin(time * 0.5 + r) * 0.12);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ringAngle * 0.4 + mousePos.x * 0.2);

        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadiusX, ringRadiusY, ringAngle * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = r === 0 
          ? (isDark ? 'rgba(16, 185, 129, 0.75)' : 'rgba(5, 150, 105, 0.7)') 
          : r === 1 
            ? (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(2, 132, 199, 0.6)')
            : (isDark ? 'rgba(37, 99, 235, 0.55)' : 'rgba(29, 78, 216, 0.45)');
        ctx.lineWidth = r === 0 ? 1.5 : 1;
        ctx.setLineDash(r === 1 ? [6, 4] : []);
        ctx.stroke();

        // Little bright node on each orbit ring
        const nodeAngle = time * (1.2 + r * 0.6);
        const nx = Math.cos(nodeAngle) * ringRadiusX;
        const ny = Math.sin(nodeAngle) * ringRadiusY;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#ffffff' : '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      // Dynamic Fluid Core with breathing wave deformation
      ctx.save();
      ctx.beginPath();
      const points = 16;
      for (let p = 0; p <= points; p++) {
        const angle = (p / points) * Math.PI * 2;
        // Wavy displacement
        const wave = Math.sin(angle * 3 + time * 2) * 4.5 + Math.cos(angle * 2 - time * 1.5) * 3;
        const r = baseRadius + wave;
        const px = centerX + Math.cos(angle) * r;
        const py = centerY + Math.sin(angle) * r;
        if (p === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      // Fluid interior gradient (Green, Blue, and White)
      const coreGradient = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );
      if (isDark) {
        coreGradient.addColorStop(0, '#10b981');
        coreGradient.addColorStop(0.35, '#06b6d4');
        coreGradient.addColorStop(0.7, '#2563eb');
        coreGradient.addColorStop(1, '#1d4ed8');
      } else {
        coreGradient.addColorStop(0, '#059669');
        coreGradient.addColorStop(0.4, '#0284c7');
        coreGradient.addColorStop(0.8, '#2563eb');
        coreGradient.addColorStop(1, '#1d4ed8');
      }

      ctx.fillStyle = coreGradient;
      ctx.shadowColor = isDark ? '#10b981' : '#059669';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Internal Specular Refraction Highlight (Glossy Million-Dollar Glass Look)
      const glossGradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.35,
        centerY - baseRadius * 0.35,
        2,
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.8
      );
      glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
      glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(centerX - baseRadius * 0.25, centerY - baseRadius * 0.25, baseRadius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = glossGradient;
      ctx.fill();

      ctx.restore();

      // Moving synaptic particle constellation
      particles.forEach((p) => {
        p.angle += p.speed * (isHovered ? 1.8 : 1);
        const yOffset = Math.sin(time + p.phase) * p.verticalDrift;
        const px = centerX + Math.cos(p.angle) * p.orbitRadius;
        const py = centerY + Math.sin(p.angle) * (p.orbitRadius * 0.55) + yOffset;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = isDark ? 0.85 : 0.75;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      // Soundwave Telemetry Pulse in voice mode
      if (activeMode === 'voice') {
        const barCount = 18;
        const barSpacing = 4;
        const startX = centerX - (barCount * barSpacing) / 2;
        const barY = centerY + baseRadius + 18;

        for (let b = 0; b < barCount; b++) {
          const barHeight = 4 + Math.abs(Math.sin(time * 3 + b * 0.45)) * 14;
          ctx.beginPath();
          ctx.roundRect(startX + b * barSpacing, barY - barHeight / 2, 2.5, barHeight, 2);
          ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
          ctx.globalAlpha = 0.75;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [isDark, isExpanded, activeMode, mousePos, isHovered]);

  // Track subtle mouse movement inside container for organic parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
    setIsHovered(false);
  };

  // 1. Slim Ticker Mode (space-saving on smaller screens / dense data views)
  if (isCollapsed) {
    return (
      <div className={`relative w-full rounded-2xl p-3 sm:p-4 border backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 ${
        isDark 
          ? 'glass-panel border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]' 
          : 'bg-white/90 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-md text-emerald-400">
            <Atom size={24} color={isDark ? '#34d399' : '#059669'} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-bold text-xs font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Pulsar Autonomous Telephony Active
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30">
                142ms Latency
              </span>
              <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-bold hidden md:inline">
                • 98.4% Clean Claims
              </span>
              <span className="text-[10px] font-mono text-blue-500 dark:text-blue-400 font-bold hidden lg:inline">
                • {stats.auditsBooked} Audits Booked
              </span>
            </div>
            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Self-operating revenue agent qualifying physician practices & bridging calls live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {onDialTrigger && (
            <button
              onClick={onDialTrigger}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 dark:text-teal-300 border border-teal-500/40 text-xs font-bold transition cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Dial</span>
            </button>
          )}

          <button
            onClick={() => setCoreWidgetMode('standard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Expand AI Kinetic Core Box"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Expand Core</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full rounded-3xl overflow-hidden backdrop-blur-2xl transition-all duration-500 border ${
        isExpanded ? 'min-h-[420px]' : ''
      } ${
        isDark
          ? 'bg-[#111C2E]/90 border-slate-700/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-teal-500/40'
          : 'bg-white/92 border-[#DCE5EC] shadow-[0_12px_36px_rgba(23,35,56,0.06)] hover:border-teal-600/40'
      }`}
    >
      {/* Top Ambient Glow Bar & Size Toggle Controls */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 opacity-90" />

      {/* Box View Size Adjuster Controls in Top-Right Corner */}
      <div className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl backdrop-blur-md border ${
        isDark ? 'bg-slate-950/60 border-white/10' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        <button
          onClick={() => setCoreWidgetMode('collapsed')}
          className={`p-1 rounded-lg transition cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Minimize to slim ticker"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setCoreWidgetMode(isExpanded ? 'standard' : 'expanded')}
          className={`p-1 rounded-lg transition cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={isExpanded ? "Collapse to standard size" : "Expand to full studio"}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Grid: Visualizer Canvas on Left, Telemetry & Controls on Right */}
      <div className="relative z-10 p-5 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Left Section: Moving AI Agent Orb */}
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
          {/* Canvas Orb Container */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 shrink-0 flex items-center justify-center cursor-pointer group">
            {/* Outer subtle radar ring pulse */}
            <div className="absolute inset-0 rounded-full border border-teal-500/20 animate-pulse pointer-events-none" />
            <canvas
              ref={canvasRef}
              className="w-full h-full transition-transform duration-500 group-hover:scale-105"
            />

            {/* Kinetic Atomic Core Active Animation at Orb Center (loading-dev Atom size 40) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500 group-hover:scale-110">
              <div className="flex items-center justify-center p-3 rounded-full bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-[2px] shadow-[0_0_35px_rgba(52,211,153,0.35)] text-emerald-400">
                <Atom size={40} color={isDark ? '#34d399' : '#059669'} />
              </div>
            </div>

            {/* Center Status Beacon Pill with Pulsar Core Active Atom Icon (Atom size 16) */}
            <div className={`absolute bottom-1 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider flex items-center gap-2 shadow-lg backdrop-blur-md border ${
              isDark 
                ? 'bg-slate-950/90 text-teal-300 border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.3)] ring-1 ring-teal-500/20' 
                : 'bg-white/95 text-teal-800 border-teal-300 shadow-md ring-1 ring-teal-400/20'
            }`}>
              <div className="flex items-center justify-center text-emerald-400 shrink-0">
                <Atom size={16} color={isDark ? '#34d399' : '#059669'} />
              </div>
              <span className="tracking-wider">PULSAR CORE ACTIVE</span>
            </div>
          </div>

          {/* Agent Narrative & Mode Switcher */}
          <div className="space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-teal-500/10 text-teal-500 dark:text-teal-400 font-bold border border-teal-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-400" />
                ZoeyOS Kinetic Engine
              </span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                isDark 
                  ? 'bg-slate-900/80 text-slate-300 border-white/10' 
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                <Activity className="w-3 h-3 text-emerald-400" />
                142ms Telephony Latency
              </span>
              {nicheTemplate && onOpenNicheLibrary && (
                <button
                  type="button"
                  onClick={onOpenNicheLibrary}
                  className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 transition cursor-pointer font-bold ${
                    isDark 
                      ? 'bg-teal-950/60 text-teal-300 border-teal-500/40 hover:bg-teal-900/60' 
                      : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                  }`}
                  title="Switch or customize business niche template"
                >
                  <Layers className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>Niche: {nicheTemplate.name.split('&')[0].trim()}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-200 uppercase">
                    {nicheTemplate.agentConfig.agentName}
                  </span>
                </button>
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight flex items-center justify-center sm:justify-start gap-2">
                <span className={isDark ? 'text-white' : 'text-slate-900'}>
                  {nicheTemplate ? `${nicheTemplate.name.split('&')[0].trim()} Outreach Agent` : 'Autonomous Telephony & Growth Bot'}
                </span>
              </h2>
              <p className={`text-xs sm:text-sm mt-1 max-w-md ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {nicheTemplate?.description || 'Autonomous outbound AI sales agent: scrapes leads, personalizes outreach, handles objections, and bridges qualified prospects live.'}
              </p>
            </div>

            {/* Mode Switcher Buttons */}
            <div className={`inline-flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md text-xs font-semibold ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <button
                onClick={() => setActiveMode('voice')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeMode === 'voice'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Voice Telephony</span>
              </button>

              <button
                onClick={() => setActiveMode('scrubber')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeMode === 'scrubber'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>NPI Scrubber</span>
              </button>

              <button
                onClick={() => setActiveMode('transfer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeMode === 'transfer'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Live Bridge</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Section: Real-time Telemetry Metrics in Glass Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 w-full lg:w-auto">
          {/* Card 1: Clean Claim Rate */}
          <div className={`p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
            isDark
              ? 'bg-slate-950/50 border-teal-500/20 shadow-lg shadow-teal-500/5'
              : 'bg-white/90 border-teal-200/80 shadow-md shadow-teal-500/5'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Clean Claims
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-teal-400">
              98.4%
            </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              First-Pass Acceptance
            </div>
          </div>

          {/* Card 2: Human Connects */}
          <div className={`p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
            isDark
              ? 'bg-slate-950/50 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
              : 'bg-white/90 border-emerald-200/80 shadow-md shadow-emerald-500/5'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Connects
              </span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-emerald-400">
              {stats.humanConnects} / {stats.callsPlaced}
            </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              45.2% Contact Rate
            </div>
          </div>

          {/* Card 3: Hot Leads & Audits */}
          <div className={`p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
            isDark
              ? 'bg-slate-950/50 border-blue-500/20 shadow-lg shadow-blue-500/5'
              : 'bg-white/90 border-blue-200/80 shadow-md shadow-blue-500/5'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Audits Booked
              </span>
              <Flame className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-blue-400">
              {stats.auditsBooked} Free Audits
            </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              High-Intent Practice Leads
            </div>
          </div>

          {/* Card 4: Pipeline Added */}
          <div className={`p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
            isDark
              ? 'bg-slate-950/50 border-blue-500/20 shadow-lg shadow-blue-500/5'
              : 'bg-white/90 border-blue-200/80 shadow-md shadow-blue-500/5'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Pipeline Value
              </span>
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-blue-400">
              {stats.pipelineAdded}
            </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              Estimated Business Value
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Quick-Action Ticker Bar */}
      <div className={`px-6 py-2.5 border-t flex flex-wrap items-center justify-between gap-4 text-xs ${
        isDark ? 'bg-slate-950/40 border-white/[0.06]' : 'bg-slate-50/60 border-slate-200/70'
      }`}>
        <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-semibold">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>Voice Synthesizer: Neural ElevenLabs Sarah (Ultra-Realistic)</span>
          </span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>|</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            Carrier: WhatsApp VoIP + SIP Direct
          </span>
          <span className="hidden xl:inline text-slate-600">|</span>
          <div className="hidden xl:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Atom Scale:</span>
              <div className="flex items-center gap-2 text-emerald-400">
                <span title="Atom size 16" className="inline-flex"><Atom size={16} color={isDark ? '#34d399' : '#059669'} /></span>
                <span title="Atom size 24" className="inline-flex"><Atom size={24} color={isDark ? '#34d399' : '#059669'} /></span>
                <span title="Atom size 40" className="inline-flex"><Atom size={40} color={isDark ? '#34d399' : '#059669'} /></span>
              </div>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Leap Loader:</span>
              <span title="Leap size 24" className="inline-flex text-sky-400"><Leap size={24} color={isDark ? '#38bdf8' : '#0284c7'} /></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDialTrigger && (
            <button
              onClick={onDialTrigger}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 transition text-xs font-bold cursor-pointer"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Launch Calling Studio</span>
            </button>
          )}

          {onOpenBriefing && (
            <button
              onClick={onOpenBriefing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 border border-blue-500/30 transition text-xs font-bold cursor-pointer"
            >
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>4 PM Executive Briefing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
