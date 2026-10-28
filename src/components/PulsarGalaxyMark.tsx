import React from 'react';

export type GalaxyMarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type GalaxyAnimationState = 'idle' | 'active' | 'processing' | 'pulse';

interface PulsarGalaxyMarkProps {
  size?: GalaxyMarkSize | number;
  state?: GalaxyAnimationState;
  showHalo?: boolean;
  className?: string;
  glow?: boolean;
}

const SIZE_MAP: Record<GalaxyMarkSize, number> = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 48,
  xl: 64,
  hero: 104,
};

/**
 * PulsarGalaxyMark — Signature Brand Mark for Pulsar
 * Features:
 * - Luminous central pulsar energy core with multi-frequency pulse
 * - Compact cluster of fine cosmic particle pixels
 * - Orbital elliptical arcs suggesting connected systems & momentum
 * - Dynamic pixel satellites radiating outward and inward
 * - Smooth Teal (#0D9488) to Cyan (#38BDF8) gradient transition
 * - Restrained Deep Space Blue (#2563EB) halo
 * - Scalable vector precision from 18px navigation icons to 128px dashboard hero
 * - Full prefers-reduced-motion compliance
 */
export const PulsarGalaxyMark: React.FC<PulsarGalaxyMarkProps> = ({
  size = 'md',
  state = 'active',
  showHalo = true,
  className = '',
  glow = true,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 36;
  const isMini = pixelSize <= 24;

  // Animation speed classes based on state
  const rotationClass = 
    state === 'processing' 
      ? 'animate-[spin_4s_linear_infinite]' 
      : state === 'pulse' 
      ? 'animate-[spin_16s_linear_infinite]' 
      : state === 'idle'
      ? 'animate-[spin_24s_linear_infinite]'
      : 'animate-[spin_10s_linear_infinite]';

  const reverseRotationClass = 
    state === 'processing'
      ? 'animate-[spin_6s_linear_infinite_reverse]'
      : 'animate-[spin_14s_linear_infinite_reverse]';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      role="img"
      aria-label="Pulsar Galaxy Icon"
    >
      {/* Restrained Blue/Teal Halo (Ambient depth) */}
      {showHalo && glow && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(13, 148, 136, 0.15) 45%, rgba(37, 99, 235, 0.05) 70%, transparent 100%)',
            transform: 'scale(1.4)',
            filter: pixelSize > 32 ? 'blur(4px)' : 'none',
          }}
        />
      )}

      {/* SVG Canvas for Galaxy Pixels & Orbital Momentum */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 overflow-visible"
      >
        <defs>
          {/* Core Pulsar Linear Gradient (Teal to Intelligent Cyan) */}
          <linearGradient id="pulsarCoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="45%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Orbital Arc Gradients with fade out */}
          <linearGradient id="orbitArcA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#0D9488" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="orbitArcB" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
          </linearGradient>

          {/* Central Core Glow Filter */}
          <filter id="coreGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Orbital Interconnected System (Reverse rotation) */}
        <g className={`${reverseRotationClass} origin-center transition-transform motion-reduce:animate-none`}>
          {/* Orbital Arc Track 1 */}
          <ellipse
            cx="50"
            cy="50"
            rx="41"
            ry="22"
            transform="rotate(-28 50 50)"
            stroke="url(#orbitArcA)"
            strokeWidth={isMini ? 1.6 : 1.4}
            strokeDasharray={isMini ? '8 6' : '12 8 4 6'}
          />

          {/* Orbiting Pixel Node A (Micro system node) */}
          <rect
            x="84"
            y="39"
            width={isMini ? 3.5 : 3}
            height={isMini ? 3.5 : 3}
            rx="0.8"
            fill="#38BDF8"
            className="animate-pulse"
          />

          {/* Orbiting Pixel Node B (Teal node) */}
          <rect
            x="14"
            y="57"
            width={isMini ? 3 : 2.5}
            height={isMini ? 3 : 2.5}
            rx="0.6"
            fill="#2DD4BF"
          />
        </g>

        {/* Inner Orbital Arc System (Forward rotation) */}
        <g className={`${rotationClass} origin-center transition-transform motion-reduce:animate-none`}>
          {/* Counter-orbital Track 2 */}
          <ellipse
            cx="50"
            cy="50"
            rx="33"
            ry="18"
            transform="rotate(42 50 50)"
            stroke="url(#orbitArcB)"
            strokeWidth={isMini ? 1.5 : 1.2}
            strokeDasharray={isMini ? '6 5' : '9 6 3 5'}
          />

          {/* Outer Quantum Satellites (Tiny square pixel particles) */}
          {!isMini && (
            <>
              {/* Top-Right Cyan Pixel */}
              <rect x="68" y="22" width="2.4" height="2.4" rx="0.5" fill="#38BDF8" />
              {/* Bottom-Left Teal Pixel */}
              <rect x="29" y="74" width="2.2" height="2.2" rx="0.5" fill="#0D9488" />
              {/* Far Momentum Pixel */}
              <rect x="79" y="66" width="2" height="2" rx="0.4" fill="#60A5FA" opacity="0.8" />
              {/* Inbound Connection Pixel */}
              <rect x="20" y="32" width="2" height="2" rx="0.4" fill="#38BDF8" opacity="0.75" />
            </>
          )}

          {/* Radiating pixel dots along orbital paths */}
          <circle cx="50" cy="18" r="1.4" fill="#38BDF8" opacity="0.9" />
          <circle cx="50" cy="82" r="1.2" fill="#0D9488" opacity="0.7" />
          <circle cx="21" cy="50" r="1.3" fill="#2DD4BF" opacity="0.8" />
          <circle cx="79" cy="50" r="1.5" fill="#60A5FA" opacity="0.85" />
        </g>

        {/* Central Core Aura / Energy Pulse */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 14 : 16}
          fill="url(#pulsarCoreGradient)"
          opacity="0.18"
          className="animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] motion-reduce:animate-none"
        />

        {/* Dense Intermediate Star Cluster */}
        {!isMini && (
          <g opacity="0.85">
            <rect x="42" y="44" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
            <rect x="56" y="52" width="2" height="2" rx="0.5" fill="#38BDF8" />
            <rect x="44" y="55" width="1.8" height="1.8" rx="0.4" fill="#2DD4BF" />
            <rect x="54" y="43" width="1.8" height="1.8" rx="0.4" fill="#60A5FA" />
          </g>
        )}

        {/* Central Luminous Pulsar Core */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 9 : 8}
          fill="url(#pulsarCoreGradient)"
          filter={glow ? 'url(#coreGlow)' : undefined}
        />

        {/* Pure White Central Spark */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 3.5 : 3.2}
          fill="#FFFFFF"
          className={state === 'active' || state === 'processing' ? 'animate-pulse' : ''}
        />

        {/* Crosshair Pixel Highlights (Pulsar Beams) */}
        {!isMini && (
          <g stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.75">
            <line x1="50" y1="42" x2="50" y2="40" />
            <line x1="50" y1="58" x2="50" y2="60" />
            <line x1="42" y1="50" x2="40" y2="50" />
            <line x1="58" y1="50" x2="60" y2="50" />
          </g>
        )}
      </svg>
    </div>
  );
};
