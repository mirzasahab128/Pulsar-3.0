import React from 'react';

export type PulsarGalaxySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type PulsarGalaxyState = 'idle' | 'active' | 'processing' | 'pulse';

export interface PulsarGalaxyProps {
  /** Configurable size: preset keyword or raw pixel number */
  size?: PulsarGalaxySize | number;
  /** Animation state of the core and orbital satellite pixels */
  state?: PulsarGalaxyState;
  /** Whether to render the subtle ambient halo depth */
  showHalo?: boolean;
  /** Optional custom CSS classes */
  className?: string;
  /** Toggle core radiant glow */
  glow?: boolean;
  /** Optional custom title for accessible SVG tooltip */
  title?: string;
}

const PRESET_SIZES: Record<PulsarGalaxySize, number> = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 48,
  xl: 64,
  hero: 104,
};

/**
 * PulsarGalaxy — Signature Animated Galaxy Logo Component
 * 
 * Implements the Pulsar Master Design System:
 * - Luminous central pulsar energy core with multi-frequency pulse
 * - Dual counter-rotating orbital arcs indicating connected business ecosystems
 * - Quantum pixel nodes drifting and orbiting along elliptical vectors
 * - Subtle transition from Healthcare Teal (#0D9488) to Intelligent Cyan (#38BDF8)
 * - Deep Space Blue (#2563EB) atmospheric halo
 * - Fully responsive with dynamic SVG viewBox
 * - Full `prefers-reduced-motion` compliance
 */
export const PulsarGalaxy: React.FC<PulsarGalaxyProps> = ({
  size = 'md',
  state = 'active',
  showHalo = true,
  className = '',
  glow = true,
  title = 'Pulsar Galaxy Mark'
}) => {
  const pixelSize = typeof size === 'number' ? size : PRESET_SIZES[size] || 36;
  const isMini = pixelSize <= 24;

  // Dynamic animation classes per operational state
  const primaryOrbitSpeed = 
    state === 'processing' 
      ? 'animate-[spin_4s_linear_infinite]' 
      : state === 'pulse' 
      ? 'animate-[spin_16s_linear_infinite]' 
      : state === 'idle'
      ? 'animate-[spin_24s_linear_infinite]'
      : 'animate-[spin_10s_linear_infinite]';

  const counterOrbitSpeed = 
    state === 'processing'
      ? 'animate-[spin_6s_linear_infinite_reverse]'
      : 'animate-[spin_14s_linear_infinite_reverse]';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      role="img"
      aria-label={title}
    >
      {/* Restrained Atmospheric Halo (Teal & Cyan depth glow) */}
      {showHalo && glow && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500 motion-reduce:opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.24) 0%, rgba(13, 148, 136, 0.16) 45%, rgba(37, 99, 235, 0.06) 70%, transparent 100%)',
            transform: 'scale(1.45)',
            filter: pixelSize > 32 ? 'blur(4px)' : 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* SVG Galaxy Mark */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Core Pulsar Gradient */}
          <linearGradient id="pulsarCoreGradientV2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="45%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Dual Orbital Track Gradients */}
          <linearGradient id="pulsarOrbitA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#0D9488" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="pulsarOrbitB" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
          </linearGradient>

          {/* Central Pulsar Glow Filter */}
          <filter id="pulsarGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Counter-Orbital Elliptical System */}
        <g className={`${counterOrbitSpeed} origin-center transition-transform motion-reduce:animate-none`}>
          <ellipse
            cx="50"
            cy="50"
            rx="42"
            ry="22"
            transform="rotate(-28 50 50)"
            stroke="url(#pulsarOrbitA)"
            strokeWidth={isMini ? 1.6 : 1.4}
            strokeDasharray={isMini ? '8 6' : '12 8 4 6'}
          />

          {/* Satellite Pixel 1 */}
          <rect
            x="84"
            y="39"
            width={isMini ? 3.5 : 3}
            height={isMini ? 3.5 : 3}
            rx="0.8"
            fill="#38BDF8"
            className="animate-pulse motion-reduce:animate-none"
          />

          {/* Satellite Pixel 2 */}
          <rect
            x="14"
            y="57"
            width={isMini ? 3 : 2.5}
            height={isMini ? 3 : 2.5}
            rx="0.6"
            fill="#2DD4BF"
          />
        </g>

        {/* Inner Orbital Arc System */}
        <g className={`${primaryOrbitSpeed} origin-center transition-transform motion-reduce:animate-none`}>
          <ellipse
            cx="50"
            cy="50"
            rx="33"
            ry="18"
            transform="rotate(42 50 50)"
            stroke="url(#pulsarOrbitB)"
            strokeWidth={isMini ? 1.5 : 1.2}
            strokeDasharray={isMini ? '6 5' : '9 6 3 5'}
          />

          {!isMini && (
            <>
              {/* Discrete Square Pixel Nodes */}
              <rect x="68" y="22" width="2.4" height="2.4" rx="0.5" fill="#38BDF8" />
              <rect x="29" y="74" width="2.2" height="2.2" rx="0.5" fill="#0D9488" />
              <rect x="79" y="66" width="2" height="2" rx="0.4" fill="#60A5FA" opacity="0.85" />
              <rect x="20" y="32" width="2" height="2" rx="0.4" fill="#38BDF8" opacity="0.75" />
            </>
          )}

          {/* Fine orbital particles */}
          <circle cx="50" cy="18" r="1.4" fill="#38BDF8" opacity="0.9" />
          <circle cx="50" cy="82" r="1.2" fill="#0D9488" opacity="0.75" />
          <circle cx="21" cy="50" r="1.3" fill="#2DD4BF" opacity="0.85" />
          <circle cx="79" cy="50" r="1.5" fill="#60A5FA" opacity="0.85" />
        </g>

        {/* Central Pulsar Aura Wave */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 14 : 16}
          fill="url(#pulsarCoreGradientV2)"
          opacity="0.2"
          className="animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] motion-reduce:animate-none"
        />

        {/* Micro Cosmic Dust Pixel Cluster */}
        {!isMini && (
          <g opacity="0.9">
            <rect x="42" y="44" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
            <rect x="56" y="52" width="2" height="2" rx="0.5" fill="#38BDF8" />
            <rect x="44" y="55" width="1.8" height="1.8" rx="0.4" fill="#2DD4BF" />
            <rect x="54" y="43" width="1.8" height="1.8" rx="0.4" fill="#60A5FA" />
          </g>
        )}

        {/* Central Luminous Pulsar Energy Core */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 9 : 8}
          fill="url(#pulsarCoreGradientV2)"
          filter={glow ? 'url(#pulsarGlowFilter)' : undefined}
        />

        {/* Inner High-Density White Core Spark */}
        <circle
          cx="50"
          cy="50"
          r={isMini ? 3.5 : 3.2}
          fill="#FFFFFF"
          className={state === 'active' || state === 'processing' ? 'animate-pulse motion-reduce:animate-none' : ''}
        />

        {/* Subtle Horizontal & Vertical Pulsar Ray Beams */}
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

export default PulsarGalaxy;
