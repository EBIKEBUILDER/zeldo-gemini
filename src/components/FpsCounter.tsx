'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Activity, X } from 'lucide-react';
import { RenderStats } from '@/game/graphics/babylonRenderer';

export interface FpsCounterProps {
  className?: string;
  showDrawCalls?: boolean;
  showFrameTime?: boolean;
  showTriangles?: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  totalMeshes: number;
  triangles: number;
  vertices: number;
  frameTimeMs: number;
  memoryMB?: number;
}

const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
};

export const FpsCounter: React.FC<FpsCounterProps> = ({
  className = '',
  showDrawCalls = true,
  showFrameTime = true,
  showTriangles = true,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    drawCalls: 0,
    activeMeshes: 0,
    totalMeshes: 0,
    triangles: 0,
    vertices: 0,
    frameTimeMs: 16.6,
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;

      // Sample every 250ms for stable telemetry readout with minimal React overhead
      if (elapsed >= 250) {
        let currentFps = Math.round((frameCount * 1000) / elapsed);
        const win =
          typeof window !== 'undefined'
            ? (window as unknown as {
                __renderer?: {
                  getFps: () => number;
                  getDrawCalls: () => number;
                  getStats?: () => RenderStats;
                };
              })
            : null;

        if (win?.__renderer) {
          if (typeof win.__renderer.getStats === 'function') {
            const stats = win.__renderer.getStats();
            setMetrics(stats);
          } else {
            const engFps = win.__renderer.getFps();
            const dc = win.__renderer.getDrawCalls();
            const finalFps = engFps > 0 ? engFps : currentFps;
            setMetrics((prev) => ({
              ...prev,
              fps: finalFps,
              drawCalls: dc,
              frameTimeMs: Math.round((1000 / Math.max(1, finalFps)) * 10) / 10,
            }));
          }
        } else {
          setMetrics((prev) => ({
            ...prev,
            fps: Math.min(120, Math.max(1, currentFps)),
            frameTimeMs: Math.round((elapsed / Math.max(1, frameCount)) * 10) / 10,
          }));
        }

        frameCount = 0;
        lastTime = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const colorClass =
    metrics.fps >= 55
      ? 'text-emerald-400'
      : metrics.fps >= 30
      ? 'text-amber-400'
      : 'text-rose-400';

  const dotClass =
    metrics.fps >= 55
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
      : metrics.fps >= 30
      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]';

  return (
    <div ref={containerRef} className="relative inline-block pointer-events-auto">
      {/* Primary Status Badge */}
      <div
        data-testid="fps-counter"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={`cursor-pointer bg-black/80 hover:bg-black/95 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-white/10 hover:border-amber-400/50 shadow-lg flex items-center gap-1 font-mono text-[11px] sm:text-xs select-none transition-all group ${className}`}
        title="Performance Telemetry (Click to toggle detailed breakdown)"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${dotClass} animate-pulse shrink-0 mr-0.5`} />
        <span className={`font-bold tracking-tight ${colorClass}`}>{metrics.fps} FPS</span>

        {showDrawCalls && (
          <span className="text-cyan-300 font-semibold inline-flex items-center">
            <span className="text-zinc-500 mx-1">•</span>
            {metrics.drawCalls} DC
          </span>
        )}

        {showFrameTime && (
          <span className="text-amber-300/90 font-medium inline-flex items-center">
            <span className="text-zinc-500 mx-1">•</span>
            {metrics.frameTimeMs}ms
          </span>
        )}

        {showTriangles && metrics.triangles > 0 && (
          <span className="text-purple-300 hidden sm:inline-flex items-center">
            <span className="text-zinc-500 mx-1">•</span>
            {formatCompactNumber(metrics.triangles)} Tris
          </span>
        )}

        {metrics.memoryMB && (
          <span className="text-zinc-400 hidden md:inline-flex items-center">
            <span className="text-zinc-500 mx-1">•</span>
            {metrics.memoryMB}MB
          </span>
        )}

        <Activity
          className={`w-3 h-3 text-zinc-400 group-hover:text-amber-300 transition-colors ml-0.5 shrink-0 ${
            isExpanded ? 'text-amber-400' : ''
          }`}
        />
      </div>

      {/* Expanded Telemetry Popover */}
      {isExpanded && (
        <div
          data-testid="fps-telemetry-popover"
          className="absolute right-0 top-full mt-2 w-72 max-w-[90vw] bg-black/90 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3 shadow-2xl z-50 animate-fade-in font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-200 tracking-wide uppercase font-mono">
                Engine Telemetry
              </span>
            </div>
            <button
              data-testid="close-telemetry-btn"
              onClick={() => setIsExpanded(false)}
              className="text-zinc-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition cursor-pointer"
              title="Close telemetry"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {/* FPS */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Framerate</div>
              <div className={`text-sm font-bold ${colorClass}`}>
                {metrics.fps} <span className="text-[10px] text-zinc-500">FPS</span>
              </div>
            </div>

            {/* Frame Time */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Frame Time</div>
              <div className="text-sm font-bold text-amber-300">
                {metrics.frameTimeMs} <span className="text-[10px] text-zinc-500">ms</span>
              </div>
            </div>

            {/* Draw Calls */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Draw Calls</div>
              <div className="text-sm font-bold text-cyan-300">
                {metrics.drawCalls} <span className="text-[10px] text-zinc-500">DC</span>
              </div>
            </div>

            {/* Scene Meshes */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Active Meshes</div>
              <div className="text-sm font-bold text-emerald-300">
                {metrics.activeMeshes || metrics.drawCalls}{' '}
                <span className="text-[10px] text-zinc-500">/ {metrics.totalMeshes}</span>
              </div>
            </div>

            {/* Triangles */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Triangles</div>
              <div className="text-sm font-bold text-purple-300">
                {metrics.triangles > 0 ? metrics.triangles.toLocaleString() : 'N/A'}
              </div>
            </div>

            {/* Vertices */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Vertices</div>
              <div className="text-sm font-bold text-indigo-300">
                {metrics.vertices > 0 ? metrics.vertices.toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Optional Memory & Engine Footer */}
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>Babylon.js 9.29 (WebGL2)</span>
            {metrics.memoryMB ? (
              <span className="text-zinc-300">{metrics.memoryMB} MB Heap</span>
            ) : (
              <span className="text-emerald-400/90 font-semibold">Merged Batched</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
