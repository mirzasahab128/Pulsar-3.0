import React, { useEffect, useRef } from 'react';

interface CallWaveformVisualizerProps {
  isActive: boolean;
  isAiSpeaking?: boolean;
  isDictating?: boolean;
  micVolume?: number;
  height?: number;
}

export const CallWaveformVisualizer: React.FC<CallWaveformVisualizerProps> = ({
  isActive,
  isAiSpeaking = false,
  isDictating = false,
  micVolume = 0,
  height = 48
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const barCount = 36;

    const render = () => {
      phase += 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const ch = canvas.height;
      const barWidth = Math.max(2, (width / barCount) - 3);

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;

        if (isActive) {
          // Dynamic frequency calculation
          const wave1 = Math.sin(phase + (i * 0.25));
          const wave2 = Math.cos(phase * 0.8 + (i * 0.4));
          const baseAmp = isAiSpeaking ? 0.85 : isDictating ? 0.75 : 0.35;
          const volBoost = micVolume > 0 ? (micVolume / 100) * 1.5 : 1;

          const normalized = Math.abs(wave1 * 0.6 + wave2 * 0.4) * baseAmp * volBoost;
          barHeight = Math.max(4, normalized * (ch - 8));
        }

        const x = i * (barWidth + 3);
        const y = (ch - barHeight) / 2;

        // Skiper UI-inspired Green to Electric Blue gradient
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isAiSpeaking) {
          gradient.addColorStop(0, '#10b981'); // Emerald 500
          gradient.addColorStop(0.5, '#34d399'); // Emerald 400
          gradient.addColorStop(1, '#059669'); // Emerald 600
        } else if (isDictating) {
          gradient.addColorStop(0, '#38bdf8'); // Sky 400
          gradient.addColorStop(0.5, '#2563eb'); // Blue 600
          gradient.addColorStop(1, '#10b981'); // Emerald 500
        } else {
          gradient.addColorStop(0, '#2563eb'); // Royal Blue
          gradient.addColorStop(1, '#10b981'); // Emerald
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();

        // Subtle glow peak
        if (isActive && barHeight > 16) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isAiSpeaking, isDictating, micVolume]);

  return (
    <div className="w-full flex items-center justify-center overflow-hidden py-1">
      <canvas
        ref={canvasRef}
        width={320}
        height={height}
        className="w-full max-w-md h-12"
      />
    </div>
  );
};
