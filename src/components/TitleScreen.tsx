'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { Sword, Play, Shield, Compass, Sparkles } from 'lucide-react';

export const TitleScreen: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const startGame = useGameStore((state) => state.startGame);

  if (gameState !== 'title') return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-zinc-950 via-emerald-950/90 to-zinc-950 p-6 select-none font-sans overflow-y-auto">
      {/* Background glow and subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative max-w-xl w-full flex flex-col items-center text-center gap-6 py-8">
        {/* Emblem / Zeldo Crest */}
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-300 rotate-45 rounded-lg border-2 border-amber-200/90 shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center">
            <Sword className="w-10 h-10 text-zinc-900 -rotate-45" />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.35em] text-emerald-400">
            A 3D Overhead Adventure
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 font-serif drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            THE LEGEND OF ZELDO
          </h1>
          <h2 className="text-lg sm:text-2xl font-bold tracking-widest text-emerald-200 uppercase font-serif">
            THE VERDANT CREST
          </h2>
        </div>

        {/* Lore / Story Blurb */}
        <p className="text-sm sm:text-base text-zinc-300/90 max-w-md leading-relaxed">
          An ancient shadow has locked away the sacred <strong className="text-amber-300 font-semibold">Sunstone</strong> inside the Mountain Sanctum.
          Traverse the wild meadows, uncover the dungeon key, conquer <strong className="text-red-400 font-semibold">Gorgoth the Bramble King</strong>, and claim the treasure!
        </p>

        {/* Start Game Action */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="w-full group flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black text-lg sm:text-xl rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Play className="w-6 h-6 fill-zinc-950" />
            <span>START ADVENTURE</span>
          </button>
          <span className="text-xs text-zinc-400 font-medium">
            Press <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono">ENTER</kbd>, Click, or Tap to begin
          </span>
        </div>

        {/* Controls Card */}
        <div className="w-full bg-zinc-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md flex flex-col gap-3 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Compass className="w-4 h-4" />
              Adventurer&apos;s Field Guide
            </span>
            <span className="text-[10px] text-amber-300 font-mono">Mobile &amp; Desktop</span>
          </h3>
          <div className="grid grid-cols-2 gap-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-200 border border-zinc-700 text-[11px]">Joystick / Tap</span>
              <span>Move &amp; Pathfind</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-200 border border-zinc-700 text-[11px]">Attack / Space</span>
              <span>Sword Swing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-200 border border-zinc-700 text-[11px]">Action / E</span>
              <span>Roll &amp; Interact</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-200 border border-zinc-700 text-[11px]">Radar Minimap</span>
              <span>Tap to Open Atlas</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>Real-time 3D Babylon.js • Fixed Timestep • Web Audio API Synthesizer</span>
        </div>
      </div>
    </div>
  );
};
