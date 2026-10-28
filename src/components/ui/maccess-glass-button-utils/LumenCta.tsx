import React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LumenCtaProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  label?: string;
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  variant?: "primary" | "ghost";
}

export function LumenCta({
  className,
  style,
  children,
  label = "Get Started Now",
  href,
  onClick,
  variant = "primary",
}: LumenCtaProps) {
  const isGhost = variant === "ghost";

  const content = (
    <>
      {/* Outer shimmer / ambient glow */}
      <span
        className={cn(
          "pointer-events-none absolute -inset-[1px] rounded-full opacity-70 transition-opacity duration-300 group-hover:opacity-100",
          isGhost
            ? "bg-gradient-to-r from-purple-500/20 via-indigo-500/10 to-teal-500/20"
            : "bg-gradient-to-r from-violet-600 via-indigo-500 to-teal-400 blur-[2px]"
        )}
      />

      {/* Button surface */}
      <span
        className={cn(
          "relative z-10 inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300",
          isGhost
            ? "bg-slate-900/80 text-slate-200 ring-1 ring-white/10 backdrop-blur-md group-hover:bg-slate-800/90 group-hover:text-white"
            : "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-[0_10px_25px_-5px_rgba(99,102,241,0.5)] ring-1 ring-white/20 group-hover:shadow-[0_15px_30px_-5px_rgba(99,102,241,0.65)]"
        )}
      >
        <span>{children || label}</span>
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        style={style}
        className={cn("group relative isolate inline-flex cursor-pointer transition-transform duration-200 active:scale-95", className)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn("group relative isolate inline-flex cursor-pointer transition-transform duration-200 active:scale-95", className)}
    >
      {content}
    </button>
  );
}

export default LumenCta;
