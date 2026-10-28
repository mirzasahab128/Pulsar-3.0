import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export const FuturisticOrbWorld: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse cursor coordinates for interactive constellation paths
    const mouse = {
      x: -9999,
      y: -9999,
      active: false,
      radius: 175
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    // Star types:
    // 'hub': Bright anchor star with 4-point flare and halo (Growth/Network Hub)
    // 'node': Healthcare & Executive decision-maker node
    // 'dust': Micro distant star providing ease and cosmic depth
    interface Star {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      type: 'hub' | 'node' | 'dust';
      color: string;
      glowColor: string;
      baseAlpha: number;
      twinkleSpeed: number;
      phase: number;
      spikes?: number;
    }

    interface LightPacket {
      starFromIndex: number;
      starToIndex: number;
      progress: number; // 0 to 1
      speed: number;
      color: string;
    }

    // Colors reflecting Growth (Emerald/Jade), Ease (Sky/Cyan), and Social Networks (Blue/Indigo)
    const growthColors = ['#10b981', '#059669', '#34d399', '#0d9488'];
    const networkColors = ['#2563eb', '#3b82f6', '#60a5fa', '#6366f1'];
    const easeColors = ['#38bdf8', '#06b6d4', '#0284c7', '#e0f2fe'];

    let stars: Star[] = [];
    const lightPackets: LightPacket[] = [];

    const initStars = () => {
      stars = [];
      const count = Math.min(68, Math.max(36, Math.floor(width / 26)));

      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        let type: 'hub' | 'node' | 'dust' = 'node';
        let radius = 2.2;
        let color = '#38bdf8';
        let glowColor = 'rgba(56, 189, 248, 0.4)';

        if (rand < 0.18) {
          // Major Hub Star (Growth & Executive Anchor)
          type = 'hub';
          radius = 3.6 + Math.random() * 1.6;
          color = growthColors[Math.floor(Math.random() * growthColors.length)];
          glowColor = isDark ? 'rgba(16, 185, 129, 0.55)' : 'rgba(5, 150, 105, 0.45)';
        } else if (rand < 0.70) {
          // Network Node Star (Social Connections & Doctors)
          type = 'node';
          radius = 2.0 + Math.random() * 1.4;
          const isNetwork = Math.random() > 0.45;
          color = isNetwork 
            ? networkColors[Math.floor(Math.random() * networkColors.length)]
            : easeColors[Math.floor(Math.random() * easeColors.length)];
          glowColor = isNetwork
            ? (isDark ? 'rgba(37, 99, 235, 0.45)' : 'rgba(37, 99, 235, 0.35)')
            : (isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.35)');
        } else {
          // Distant ambient stellar dust (Ease & Tranquility)
          type = 'dust';
          radius = 1.0 + Math.random() * 0.9;
          color = isDark ? '#ffffff' : '#94a3b8';
          glowColor = 'rgba(255, 255, 255, 0.3)';
        }

        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          // Gentle, calm drift that conveys effortless ease
          vx: (Math.random() - 0.5) * (type === 'dust' ? 0.18 : 0.38),
          vy: (Math.random() - 0.5) * (type === 'dust' ? 0.18 : 0.38),
          radius,
          type,
          color,
          glowColor,
          baseAlpha: type === 'dust' ? 0.35 : 0.7,
          twinkleSpeed: 0.015 + Math.random() * 0.025,
          phase: Math.random() * Math.PI * 2,
          spikes: type === 'hub' ? 4 : 0
        });
      }
    };

    initStars();

    // Periodically spawn flowing light packets along invisible paths
    const maybeSpawnPacket = () => {
      if (lightPackets.length >= 7 || stars.length < 2) return;
      if (Math.random() < 0.04) {
        const i1 = Math.floor(Math.random() * stars.length);
        const p1 = stars[i1];
        if (p1.type === 'dust') return;

        // Find a nearby star
        let closestIdx = -1;
        let closestDist = 145;

        for (let j = 0; j < stars.length; j++) {
          if (j === i1) continue;
          const p2 = stars[j];
          if (p2.type === 'dust') continue;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = j;
          }
        }

        if (closestIdx !== -1) {
          lightPackets.push({
            starFromIndex: i1,
            starToIndex: closestIdx,
            progress: 0,
            speed: 0.012 + Math.random() * 0.018,
            color: p1.color
          });
        }
      }
    };

    // Helper: Draw 4-point star flare on major hub stars
    const drawStarSpikes = (cx: number, cy: number, length: number, alpha: number, color: string) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.85;

      // Horizontal spike
      ctx.beginPath();
      ctx.moveTo(cx - length, cy);
      ctx.lineTo(cx + length, cy);
      ctx.stroke();

      // Vertical spike
      ctx.beginPath();
      ctx.moveTo(cx, cy - length);
      ctx.lineTo(cx, cy + length);
      ctx.stroke();

      ctx.restore();
    };

    let time = 0;

    const render = () => {
      time += 0.014;
      ctx.clearRect(0, 0, width, height);

      maybeSpawnPacket();

      // 1. UPDATE STAR POSITIONS & DRAW INVISIBLE CONNECTION PATHS
      const maxConnectDist = 135;

      // Update positions
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges seamlessly
        if (star.x < -10) star.x = width + 10;
        if (star.x > width + 10) star.x = -10;
        if (star.y < -10) star.y = height + 10;
        if (star.y > height + 10) star.y = -10;
      }

      // Draw invisible/ethereal paths between connected stars
      for (let i = 0; i < stars.length; i++) {
        const s1 = stars[i];
        if (s1.type === 'dust') continue;

        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          if (s2.type === 'dust') continue;

          const dx = s1.x - s2.x;
          const dy = s1.y - s2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDist) {
            // Invisible paths: faint baseline opacity (0.035 to 0.18)
            // They glow softly when closer or when connected to hub stars
            const proximityFactor = 1 - dist / maxConnectDist;
            const isHubLink = s1.type === 'hub' || s2.type === 'hub';
            const baseLineAlpha = (isDark ? 0.04 : 0.03) + proximityFactor * (isHubLink ? 0.18 : 0.12);

            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);

            // Shimmering path gradient showing growth & social connectivity
            const lineGrad = ctx.createLinearGradient(s1.x, s1.y, s2.x, s2.y);
            lineGrad.addColorStop(0, s1.color);
            lineGrad.addColorStop(1, s2.color);

            ctx.strokeStyle = lineGrad;
            ctx.globalAlpha = Math.min(0.35, baseLineAlpha);
            ctx.lineWidth = isHubLink ? 1.0 : 0.75;
            ctx.stroke();
          }
        }

        // Interactive mouse connection: Reveal invisible paths near cursor
        if (mouse.active) {
          const mdx = s1.x - mouse.x;
          const mdy = s1.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mDist < mouse.radius) {
            const mouseProximity = 1 - mDist / mouse.radius;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(mouse.x, mouse.y);

            const mGrad = ctx.createLinearGradient(s1.x, s1.y, mouse.x, mouse.y);
            mGrad.addColorStop(0, s1.color);
            mGrad.addColorStop(1, '#38bdf8');

            ctx.strokeStyle = mGrad;
            ctx.globalAlpha = mouseProximity * (isDark ? 0.38 : 0.25);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // 2. DRAW FLOWING LIGHT PACKETS (DATA & REFERRALS TRAVERSING INVISIBLE PATHS)
      for (let pIdx = lightPackets.length - 1; pIdx >= 0; pIdx--) {
        const packet = lightPackets[pIdx];
        packet.progress += packet.speed;

        if (packet.progress >= 1) {
          lightPackets.splice(pIdx, 1);
          continue;
        }

        const fromStar = stars[packet.starFromIndex];
        const toStar = stars[packet.starToIndex];
        if (!fromStar || !toStar) continue;

        const px = fromStar.x + (toStar.x - fromStar.x) * packet.progress;
        const py = fromStar.y + (toStar.y - fromStar.y) * packet.progress;

        // Glowing pulse particle along path
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = packet.color;
        ctx.globalAlpha = (1 - Math.abs(packet.progress - 0.5) * 1.5) * 0.85;
        ctx.shadowColor = packet.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 3. DRAW STARS (HUBS, NODES, DUST)
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const twinkle = Math.sin(time * 2.5 + star.phase);
        const currentAlpha = Math.max(0.15, Math.min(0.95, star.baseAlpha + twinkle * 0.22));

        // Soft celestial halo for Hub and Node stars (Ease & Growth)
        if (star.type !== 'dust') {
          const haloSize = star.radius * (star.type === 'hub' ? 3.4 : 2.2);
          const haloGrad = ctx.createRadialGradient(
            star.x,
            star.y,
            star.radius * 0.4,
            star.x,
            star.y,
            haloSize
          );
          haloGrad.addColorStop(0, star.glowColor);
          haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.arc(star.x, star.y, haloSize, 0, Math.PI * 2);
          ctx.fillStyle = haloGrad;
          ctx.globalAlpha = currentAlpha * 0.65;
          ctx.fill();
        }

        // Star Core
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = currentAlpha;
        ctx.fill();

        // 4-point star flare spikes on Major Hub stars
        if (star.type === 'hub') {
          const spikeLength = star.radius * (2.8 + twinkle * 0.8);
          drawStarSpikes(star.x, star.y, spikeLength, currentAlpha * 0.5, star.color);
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Dynamic 3D Floating Growth & Network Atmospheric Gradient Orbs */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-35 transition-all duration-1000 animate-pulse ${
          isDark
            ? 'bg-gradient-to-tr from-emerald-500/25 via-teal-500/20 to-blue-500/15'
            : 'bg-gradient-to-tr from-emerald-400/20 via-teal-300/15 to-blue-300/15'
        }`}
        style={{ animationDuration: '8s' }}
      />

      <div
        className={`absolute top-1/4 -right-40 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-30 transition-all duration-1000 animate-pulse ${
          isDark
            ? 'bg-gradient-to-br from-blue-600/20 via-sky-500/15 to-emerald-500/15'
            : 'bg-gradient-to-br from-blue-400/15 via-sky-300/10 to-emerald-300/15'
        }`}
        style={{ animationDuration: '11s', animationDelay: '2s' }}
      />

      <div
        className={`absolute -bottom-36 left-1/3 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-25 transition-all duration-1000 animate-pulse ${
          isDark
            ? 'bg-gradient-to-tr from-blue-600/20 via-teal-600/15 to-emerald-500/15'
            : 'bg-gradient-to-tr from-blue-400/15 via-teal-300/10 to-emerald-300/15'
        }`}
        style={{ animationDuration: '9s', animationDelay: '4s' }}
      />

      {/* Subtle fine cyber grid lines representing interconnected neural web */}
      <div 
        className={`absolute inset-0 opacity-[0.03] ${
          isDark ? 'mix-blend-screen' : 'mix-blend-multiply opacity-[0.02]'
        }`}
        style={{
          backgroundImage: `linear-gradient(${isDark ? '#38bdf8' : '#0284c7'} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? '#38bdf8' : '#0284c7'} 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Living Constellation & Star Network Canvas with Invisible Paths */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

