'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { Trophy, Clock, Sparkles, RotateCcw } from 'lucide-react';

export const VictoryScreen: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const startGame = useGameStore((state) => state.startGame);
  const stats = useGameStore((state) => state.stats);

  if (gameState !== 'victory') return null;

  // Format completion time in MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 select-none font-sans overflow-y-auto">
      <div className="relative max-w-lg w-full flex flex-col items-center text-center gap-6 py-6 animate-in zoom-in-95 duration-500">
        {/* Golden Trophy / Sunstone Glow */}
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 rounded-full border-4 border-amber-200/90 shadow-[0_0_60px_rgba(245,158,11,0.7)] flex items-center justify-center animate-bounce">
            <Trophy className="w-12 h-12 text-zinc-950" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-spin" />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-emerald-400">
            Adventure Complete
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-yellow-500 font-serif drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
            TRIUMPHANT VICTORY!
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-sm">
            You vanquished <strong className="text-red-400">Gorgoth</strong> and recovered the ancient Sunstone for the realm!
          </p>
        </div>

        {/* Quest Summary Stats Card */}
        <div className="w-full bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="flex flex-col items-center gap-1 p-2 bg-black/40 rounded-xl">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Time</span>
            <span className="text-lg font-mono font-black text-amber-200">
              {formatTime(stats.completionTime || 120)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2 bg-black/40 rounded-xl">
            <div className="w-3.5 h-4.5 bg-emerald-400 rotate-45 rounded-xs" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Rupees</span>
            <span className="text-lg font-mono font-black text-emerald-300">
              {stats.rupees}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2 bg-black/40 rounded-xl">
            <span className="text-sm">⚔️</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Foes Slain</span>
            <span className="text-lg font-mono font-black text-red-300">
              {stats.enemiesDefeated}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2 bg-black/40 rounded-xl">
            <span className="text-sm">🏺</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Pots & Grass</span>
            <span className="text-lg font-mono font-black text-yellow-300">
              {stats.potsBroken + stats.grassCut}
            </span>
          </div>
        </div>

        {/* Play Again Action */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black text-lg rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>PLAY AGAIN</span>
          </button>
          <span className="text-xs text-zinc-500">
            Press <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono">ENTER</kbd>, Click, or Tap to embark again
          </span>
        </div>
      </div>
    </div>
  );
};
