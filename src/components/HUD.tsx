'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { Volume2, VolumeX, Key, Shield, Sparkles } from 'lucide-react';

export const HUD: React.FC = () => {
  const player = useGameStore((state) => state.player);
  const stats = useGameStore((state) => state.stats);
  const quest = useGameStore((state) => state.quest);
  const currentAreaName = useGameStore((state) => state.currentAreaName);
  const currentMap = useGameStore((state) => state.currentMap);
  const isMuted = useGameStore((state) => state.isMuted);
  const toggleMute = useGameStore((state) => state.toggleMute);
  const enemies = useGameStore((state) => state.enemies);

  // Find boss in enemies
  const boss = enemies.find((e) => e.type === 'boss_gorgoth');
  const showBossBar =
    currentMap === 'dungeon' &&
    player.z >= 12.0 &&
    boss &&
    !boss.isDead;

  // Hearts calculation (3 hearts, 2 HP each = 6 HP)
  const renderHearts = () => {
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      const heartHp = player.health - i * 2;
      let fillClass = 'text-zinc-700'; // empty

      if (heartHp >= 2) {
        fillClass = 'text-red-500 fill-red-500'; // full
      } else if (heartHp === 1) {
        fillClass = 'text-red-400 fill-red-400/50'; // half
      }

      const isLowHealth = player.health <= 2;

      hearts.push(
        <div
          key={i}
          className={`relative transform transition-transform duration-200 ${
            isLowHealth ? 'animate-pulse scale-105' : ''
          }`}
        >
          <svg
            className={`w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${fillClass}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </div>
      );
    }
    return hearts;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
      {/* TOP BAR */}
      <div className="flex items-start justify-between">
        {/* Left: Hearts & Rupees */}
        <div className="flex flex-col gap-2.5">
          {/* Hearts Container */}
          <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-lg">
            {renderHearts()}
          </div>

          {/* Rupees and Quest Items */}
          <div className="flex items-center gap-2">
            {/* Rupees */}
            <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg">
              {/* Green Rupee Icon */}
              <div className="w-4 h-5.5 bg-gradient-to-br from-emerald-300 via-green-500 to-emerald-700 rotate-45 transform rounded-sm border border-emerald-200/80 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="font-mono text-lg sm:text-xl font-black text-emerald-300 tracking-wider">
                {String(stats.rupees).padStart(3, '0')}
              </span>
            </div>

            {/* Dungeon Key Badge */}
            {quest.hasDungeonKey && (
              <div className="flex items-center gap-1 bg-amber-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-400/40 shadow-lg animate-bounce">
                <Key className="w-5 h-5 text-amber-300" />
                <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Key</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Boss HP Bar (if active) */}
        {showBossBar && boss && (
          <div className="absolute left-1/2 -translate-x-1/2 top-4 w-72 sm:w-96 flex flex-col items-center gap-1 bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.35)] animate-fade-in">
            <div className="flex items-center justify-between w-full text-xs font-black tracking-widest text-red-400 uppercase">
              <span>Gorgoth the Bramble King</span>
              <span>{boss.hp} / {boss.maxHp} HP</span>
            </div>
            <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-red-950">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Right: Area Name & Mute Toggle */}
        <div className="flex items-center gap-3">
          {/* Current Area Badge */}
          <div className="bg-black/65 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-200">
              {currentAreaName}
            </span>
          </div>

          {/* Sound Mute Button */}
          <button
            onClick={toggleMute}
            className="pointer-events-auto bg-black/65 hover:bg-black/85 backdrop-blur-md p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white transition shadow-lg cursor-pointer"
            title="Toggle Sound (M)"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* BOTTOM CONTROLS HINT */}
      <div className="flex items-center justify-between text-xs text-zinc-400/80">
        <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5 hidden sm:flex items-center gap-3">
          <span><strong className="text-zinc-200">WASD / Arrows</strong> Move</span>
          <span>•</span>
          <span><strong className="text-zinc-200">Space / Click</strong> Sword</span>
          <span>•</span>
          <span><strong className="text-zinc-200">M</strong> Mute</span>
        </div>
      </div>
    </div>
  );
};
