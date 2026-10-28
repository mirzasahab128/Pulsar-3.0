import { RectangleButtons } from "@/components/ui/maccess-glass-button";

export default function DarkGlassDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-[#0a0b14] p-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">Maccess Glass & Lumen CTA Showcase</h2>
        <p className="text-sm text-slate-400">Interactive premium glassmorphism buttons with custom fluid keyframe lighting</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <RectangleButtons variant="dark-pill" label="Explore Autonomous AI" />
        <RectangleButtons variant="lumen-cta" label="Start Free Trial" />
        <RectangleButtons variant="lumen-cta-ghost" label="Documentation" />
      </div>
    </div>
  );
}

export { DarkGlassDemo };
