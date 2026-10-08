'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import {
  Volume2,
  VolumeX,
  Key,
  Shield,
  Sparkles,
  BookOpen,
  Smartphone,
  Target,
  Maximize,
  Minimize,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Minimap } from './Minimap';
import { isFullscreenActive, toggleFullscreen } from '@/utils/fullscreen';

export const HUD: React.FC = () => {
  const player = useGameStore((state) => state.player);
  const stats = useGameStore((state) => state.stats);
  const quest = useGameStore((state) => state.quest);
  const currentAreaName = useGameStore((state) => state.currentAreaName);
  const currentMap = useGameStore((state) => state.currentMap);
  const isMuted = useGameStore((state) => state.isMuted);
  const toggleMute = useGameStore((state) => state.toggleMute);
  const openMapModal = useGameStore((state) => state.openMapModal);
  const showVirtualControls = useGameStore((state) => state.showVirtualControls);
  const toggleVirtualControls = useGameStore((state) => state.toggleVirtualControls);
  const contextAction = useGameStore((state) => state.contextAction);
  const enemies = useGameStore((state) => state.enemies);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(isFullscreenActive());
    handleFsChange();
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setIsHeaderCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
            className={`w-6 h-6 sm:w-8 sm:h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${fillClass}`}
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

  const gameState = useGameStore((state) => state.gameState);

  // Determine current RPG Objective ribbon text
  const getObjectiveText = () => {
    if (currentMap === 'overworld') {
      return 'Seek the Mountain Arch to enter the Sanctum';
    }
    if (!quest.hasDungeonKey && !quest.dungeonGateOpen) {
      return 'Retrieve the Key from the Sacred Pedestal';
    }
    if (!quest.dungeonGateOpen) {
      return 'Unlock the Heavy Iron Portcullis';
    }
    if (!quest.bossDefeated) {
      return 'Vanquish Gorgoth the Bramble King!';
    }
    if (!quest.chestOpened) {
      return 'Open the Sunstone Chest to claim victory!';
    }
    return 'The Sunstone is restored!';
  };

  if (gameState !== 'playing') return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-6 select-none font-sans pt-safe pb-safe pl-safe pr-safe">
      {/* TOP ROW: RPG STATUS BARS */}
      {isHeaderCollapsed ? (
        <div className="flex items-center justify-between gap-2 w-full animate-fade-in">
          {/* Minimalist Hearts & Quick Rupees */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-amber-500/30 shadow-lg">
              {renderHearts()}
              <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-300 ml-1">
                {player.health}/{player.maxHealth} HP
              </span>
            </div>
            {stats.rupees > 0 && (
              <div className="hidden xs:flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-emerald-500/30 shadow-lg">
                <div className="w-3.5 h-5 bg-gradient-to-br from-emerald-300 via-green-500 to-emerald-700 rotate-45 transform rounded-xs border border-emerald-200/80 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="font-mono text-sm font-black text-emerald-300 tracking-wider">
                  {String(stats.rupees).padStart(3, '0')}
                </span>
              </div>
            )}
            {quest.hasDungeonKey && (
              <div className="flex items-center gap-1 bg-amber-950/80 backdrop-blur-md px-2 py-1 rounded-xl border border-amber-400/50 shadow-lg animate-bounce">
                <Key className="w-4 h-4 text-amber-300" />
              </div>
            )}
          </div>

          {/* Center: Boss HP Bar */}
          {showBossBar && boss && (
            <div className="absolute left-1/2 -translate-x-1/2 top-3 sm:top-5 w-64 sm:w-96 flex flex-col items-center gap-1 bg-black/85 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-fade-in z-30">
              <div className="flex items-center justify-between w-full text-[10px] sm:text-xs font-black tracking-widest text-red-400 uppercase">
                <span>Gorgoth the Bramble King</span>
                <span>{boss.hp} / {boss.maxHp} HP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 bg-zinc-950 rounded-full overflow-hidden border border-red-950">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Right: Expand Button, Fullscreen Toggle, and Minimap */}
          <div className="flex items-center gap-2">
            <button
              data-interactive="true"
              onClick={() => setIsHeaderCollapsed(false)}
              className="pointer-events-auto bg-black/80 hover:bg-black/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-amber-400/40 text-amber-300 hover:text-amber-100 transition shadow-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Expand In-Game Header (H)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HUD</span>
            </button>

            <button
              data-interactive="true"
              onClick={() => toggleFullscreen()}
              className={`pointer-events-auto backdrop-blur-md p-1.5 sm:p-2 rounded-xl border transition shadow-lg cursor-pointer ${
                isFullscreen
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-black/75 hover:bg-black/90 border-white/10 text-zinc-300 hover:text-white'
              }`}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <Minimap />
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 sm:gap-4 w-full animate-fade-in">
          {/* Left: Hearts, Rupees & RPG Objective */}
          <div className="flex flex-col gap-2">
            {/* Hearts Container with HP counter */}
            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border border-amber-500/30 shadow-lg">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {renderHearts()}
              </div>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-300 ml-1">
                {player.health}/{player.maxHealth} HP
              </span>
            </div>

            {/* Rupees and Key */}
            <div className="flex items-center gap-2">
              {/* Rupees */}
              <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl border border-emerald-500/30 shadow-lg">
                <div className="w-3.5 h-5 sm:w-4 sm:h-5.5 bg-gradient-to-br from-emerald-300 via-green-500 to-emerald-700 rotate-45 transform rounded-xs border border-emerald-200/80 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="font-mono text-base sm:text-lg font-black text-emerald-300 tracking-wider">
                  {String(stats.rupees).padStart(3, '0')}
                </span>
              </div>

              {/* Dungeon Key Badge */}
              {quest.hasDungeonKey && (
                <div className="flex items-center gap-1.5 bg-amber-950/80 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-amber-400/50 shadow-lg animate-bounce">
                  <Key className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] sm:text-xs font-bold text-amber-200 uppercase tracking-wider">Key</span>
                </div>
              )}
            </div>

            {/* RPG Objective Ribbon */}
            <div className="hidden sm:flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl border border-amber-500/20 shadow-md text-amber-200/90 text-[11px] max-w-xs">
              <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium line-clamp-1">{getObjectiveText()}</span>
            </div>
          </div>

          {/* Center: Boss HP Bar */}
          {showBossBar && boss && (
            <div className="absolute left-1/2 -translate-x-1/2 top-3 sm:top-5 w-64 sm:w-96 flex flex-col items-center gap-1 bg-black/85 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-fade-in z-30">
              <div className="flex items-center justify-between w-full text-[10px] sm:text-xs font-black tracking-widest text-red-400 uppercase">
                <span>Gorgoth the Bramble King</span>
                <span>{boss.hp} / {boss.maxHp} HP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 bg-zinc-950 rounded-full overflow-hidden border border-red-950">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Right: Area Name, Menu Buttons & Mini-Map */}
          <div className="flex items-start gap-2.5 sm:gap-3">
            {/* Action & Menu Button Column */}
            <div className="flex flex-col items-end gap-1.5 sm:gap-2">
              {/* Current Area Badge */}
              <div className="bg-black/75 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-semibold tracking-wide text-zinc-200">
                  {currentAreaName}
                </span>
              </div>

              {/* Quick Button Row */}
              <div className="flex items-center gap-1.5">
                {/* Journal / Atlas Button */}
                <button
                  data-interactive="true"
                  onClick={() => openMapModal('quest')}
                  className="pointer-events-auto bg-black/70 hover:bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 hover:text-amber-200 transition shadow-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  title="Quest Journal & Map"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Journal</span>
                </button>

                {/* Controls Toggle Button */}
                <button
                  data-interactive="true"
                  onClick={toggleVirtualControls}
                  className={`pointer-events-auto backdrop-blur-md p-1.5 sm:p-2 rounded-xl border transition shadow-lg cursor-pointer ${
                    showVirtualControls
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-black/70 border-white/10 text-zinc-400'
                  }`}
                  title="Toggle On-screen Virtual Controls"
                >
                  <Smartphone className="w-4 h-4" />
                </button>

                {/* Fullscreen Button */}
                <button
                  data-interactive="true"
                  onClick={() => toggleFullscreen()}
                  className={`pointer-events-auto backdrop-blur-md p-1.5 sm:p-2 rounded-xl border transition shadow-lg cursor-pointer ${
                    isFullscreen
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-black/70 hover:bg-black/90 border-white/10 text-zinc-300 hover:text-white'
                  }`}
                  title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>

                {/* Mute Button */}
                <button
                  data-interactive="true"
                  onClick={toggleMute}
                  className="pointer-events-auto bg-black/70 hover:bg-black/90 backdrop-blur-md p-1.5 sm:p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white transition shadow-lg cursor-pointer"
                  title="Toggle Sound (M)"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>

                {/* Collapse Header Button */}
                <button
                  data-interactive="true"
                  onClick={() => setIsHeaderCollapsed(true)}
                  className="pointer-events-auto bg-black/70 hover:bg-black/90 backdrop-blur-md p-1.5 sm:p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white transition shadow-lg cursor-pointer"
                  title="Hide In-Game Top Header (H)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* RPG Radar Mini-Map */}
            <Minimap />
          </div>
        </div>
      )}

      {/* BOTTOM ROW: CONTEXT PROMPT & DESKTOP CONTROLS */}
      <div className="flex items-center justify-between text-xs text-zinc-400/80 pb-1">
        {/* Contextual Action Notification (if near an interactive object) */}
        {contextAction.type !== 'roll' && contextAction.type !== 'none' && (
          <div className="bg-amber-950/80 backdrop-blur-md border border-amber-400/60 text-amber-200 px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="font-bold uppercase tracking-wider text-[11px]">
              Tap Action or Press [E] to {contextAction.label}
            </span>
          </div>
        )}

        <div className="hidden" />

        {/* Desktop Controls Info (hidden when virtual controls or on tiny screens) */}
        {!showVirtualControls && (
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5 hidden md:flex items-center gap-3 text-[11px]">
            <span><strong className="text-zinc-200">WASD / Arrows</strong> Move</span>
            <span>•</span>
            <span><strong className="text-zinc-200">Space / Click</strong> Sword</span>
            <span>•</span>
            <span><strong className="text-zinc-200">E / Shift</strong> Roll &amp; Action</span>
            <span>•</span>
            <span><strong className="text-zinc-200">F</strong> Fullscreen</span>
            <span>•</span>
            <span><strong className="text-zinc-200">H</strong> Toggle HUD</span>
            <span>•</span>
            <span><strong className="text-zinc-200">M</strong> Audio</span>
          </div>
        )}
      </div>
    </div>
  );
};
