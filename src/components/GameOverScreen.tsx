'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { RotateCcw, Skull } from 'lucide-react';

export const GameOverScreen: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const retryGame = useGameStore((state) => state.retryGame);
  const stats = useGameStore((state) => state.stats);

  if (gameState !== 'game_over') return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 select-none font-sans">
      <div className="relative max-w-md w-full flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-300">
        {/* Skull Icon */}
        <div className="w-20 h-20 bg-red-950/80 border-2 border-red-500/50 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.5)]">
          <Skull className="w-10 h-10 text-red-500 animate-pulse" />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl sm:text-5xl font-black tracking-widest text-red-500 font-serif uppercase drop-shadow-[0_4px_16px_rgba(239,68,68,0.6)]">
            GAME OVER
          </h2>
          <p className="text-sm text-zinc-400">
            Your journey was cut short in the wilds... but courage endures.
          </p>
        </div>

        {/* Interim Stats */}
        <div className="grid grid-cols-2 gap-4 w-full bg-zinc-900/80 border border-white/10 rounded-2xl p-4 text-left">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider block">Rupees Gathered</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{stats.rupees}</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider block">Monsters Slain</span>
            <span className="text-lg font-bold text-red-400 font-mono">{stats.enemiesDefeated}</span>
          </div>
        </div>

        {/* Retry Button */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={retryGame}
            className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-lg rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RotateCcw className="w-5 h-5" />
            <span>TRY AGAIN</span>
          </button>
          <span className="text-xs text-zinc-500">
            Press <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono">ENTER</kbd> or Click to retry
          </span>
        </div>
      </div>
    </div>
  );
};
