import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionCompositionProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  label?: string;
  description?: string;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => void;
}

export function MaccessGlassButton({
  className,
  style,
  children,
  label = "Explore Platform",
  onClick,
}: SectionCompositionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "group relative isolate inline-flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-white/25 hover:bg-white/[0.07] hover:shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_30px_rgba(147,51,234,0.2)] active:scale-[0.98]",
        className
      )}
    >
      {/* Animated background orb with keyframe */}
      <div
        className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent blur-2xl"
        style={{
          animation: "maccess-button-circle 8s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-gradient-to-tl from-teal-400/20 via-cyan-500/20 to-transparent blur-2xl"
        style={{
          animation: "maccess-button-circle 10s ease-in-out infinite reverse",
        }}
      />

      {/* Glass sheen highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Button content */}
      <div className="relative z-10 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-indigo-300 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-110 group-hover:text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          {children || (
            <span className="font-sans text-sm font-semibold tracking-wide text-white">
              {label}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 ring-1 ring-white/10 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-white/15 group-hover:text-white">
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}

export default MaccessGlassButton;
