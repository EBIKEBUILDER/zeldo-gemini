'use client';

import React, { useEffect, useState } from 'react';

interface FpsCounterProps {
  className?: string;
  showDrawCalls?: boolean;
}

export const FpsCounter: React.FC<FpsCounterProps> = ({
  className = '',
  showDrawCalls = true,
}) => {
  const [fps, setFps] = useState<number>(60);
  const [drawCalls, setDrawCalls] = useState<number>(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;

      // Sample every 250ms for stable readout with minimal React re-render overhead
      if (elapsed >= 250) {
        let currentFps = Math.round((frameCount * 1000) / elapsed);
        const win =
          typeof window !== 'undefined'
            ? (window as unknown as {
                __renderer?: { getFps: () => number; getDrawCalls: () => number };
              })
            : null;

        if (win?.__renderer) {
          const engFps = win.__renderer.getFps();
          if (engFps > 0) currentFps = engFps;
          setDrawCalls(win.__renderer.getDrawCalls());
        }

        setFps(Math.min(120, Math.max(1, currentFps)));
        frameCount = 0;
        lastTime = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const colorClass =
    fps >= 55
      ? 'text-emerald-400'
      : fps >= 30
      ? 'text-amber-400'
      : 'text-rose-400';

  const dotClass =
    fps >= 55
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
      : fps >= 30
      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]';

  return (
    <div
      data-testid="fps-counter"
      className={`bg-black/75 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-1.5 font-mono text-[11px] sm:text-xs select-none ${className}`}
      title="Performance Monitor (FPS and Draw Calls)"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass} animate-pulse shrink-0`} />
      <span className={`font-bold tracking-tight ${colorClass}`}>{fps} FPS</span>
      {showDrawCalls && drawCalls > 0 && (
        <span className="text-zinc-500 text-[10px] hidden xs:inline ml-0.5">
          • {drawCalls} DC
        </span>
      )}
    </div>
  );
};
