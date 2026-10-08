'use client';

import React, { useEffect } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import {
  X,
  Map as MapIcon,
  BookOpen,
  Shield,
  BarChart3,
  CheckCircle2,
  Circle,
  Key,
  Trophy,
  Sword,
  Compass,
  Sparkles,
} from 'lucide-react';
import { OVERWORLD_AREAS, DUNGEON_AREAS, SCREEN_WIDTH_TILES, SCREEN_HEIGHT_TILES } from '@/game/constants';

export const WorldMapModal: React.FC = () => {
  const isMapModalOpen = useGameStore((state) => state.isMapModalOpen);
  const activeTab = useGameStore((state) => state.activeModalTab);
  const openMapModal = useGameStore((state) => state.openMapModal);
  const closeMapModal = useGameStore((state) => state.closeMapModal);

  const player = useGameStore((state) => state.player);
  const currentMap = useGameStore((state) => state.currentMap);
  const quest = useGameStore((state) => state.quest);
  const stats = useGameStore((state) => state.stats);

  // Close with Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapModalOpen) {
        closeMapModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapModalOpen, closeMapModal]);

  if (!isMapModalOpen) return null;

  // Compute player overworld screen column and row (0..2, 0..1)
  const currentCol = Math.min(2, Math.max(0, Math.floor(player.x / SCREEN_WIDTH_TILES)));
  const currentRow = Math.min(1, Math.max(0, Math.floor(player.z / SCREEN_HEIGHT_TILES)));

  // Format playtime
  const elapsedSecs = stats.startTime ? Math.floor((Date.now() - stats.startTime) / 1000) : 0;
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const screens = [
    // Top Row (Row 1: North)
    { col: 0, row: 1, name: OVERWORLD_AREAS['0,1'], desc: 'Ancient stone crags & aggressive red slimes', icon: '⛰️' },
    { col: 1, row: 1, name: OVERWORLD_AREAS['1,1'], desc: 'Dense briar maze guarding the north trail', icon: '🌲' },
    { col: 2, row: 1, name: OVERWORLD_AREAS['2,1'], desc: 'The rocky cliff archway into the Sanctum', icon: '🏛️', isEntrance: true },
    // Bottom Row (Row 0: South)
    { col: 0, row: 0, name: OVERWORLD_AREAS['0,0'], desc: 'Hero awakening, cottage, and fresh well', icon: '🏡', isSpawn: true },
    { col: 1, row: 0, name: OVERWORLD_AREAS['1,0'], desc: 'Open grasslands with pots & hidden rupees', icon: '🌿' },
    { col: 2, row: 0, name: OVERWORLD_AREAS['2,0'], desc: 'Rushing azure river with stone-anchored bridge', icon: '🌊' },
  ];

  const questSteps = [
    {
      title: 'Awaken in the Whispering Glade',
      desc: 'Gather your bearings by the ancient cottage and prepare your blade.',
      completed: true,
    },
    {
      title: 'Traverse the Wild Meadows',
      desc: 'Cross through Sunlit Meadow or Briar Hollow towards the northern cliffs.',
      completed: currentMap === 'dungeon' || (player.x > 32 && player.z > 16),
    },
    {
      title: 'Enter the Mountain Arch',
      desc: 'Pass through the cliff portal to descend into the Sanctum Antechamber.',
      completed: currentMap === 'dungeon',
    },
    {
      title: 'Claim the Dungeon Key',
      desc: 'Retrieve the golden portcullis key resting upon the sacred stone pedestal.',
      completed: quest.hasDungeonKey || quest.dungeonGateOpen,
    },
    {
      title: 'Unlock the Iron Portcullis',
      desc: 'Insert the key to raise the heavy gate sealing the inner sanctum.',
      completed: quest.dungeonGateOpen,
    },
    {
      title: 'Vanquish Gorgoth the Bramble King',
      desc: 'Conquer the colossal sovereign of thorns in mortal combat.',
      completed: quest.bossDefeated,
    },
    {
      title: 'Recover the Sacred Sunstone',
      desc: 'Open the ancient golden chest to restore radiant sunlight to the realm.',
      completed: quest.chestOpened,
    },
  ];

  return (
    <div
      data-interactive="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 select-none font-sans overflow-y-auto"
      onClick={closeMapModal}
    >
      <div
        className="relative max-w-2xl w-full bg-gradient-to-b from-zinc-900/95 via-zinc-900/98 to-zinc-950 border-2 border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/30 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider text-amber-200 uppercase font-serif">
                Adventurer&apos;s Atlas &amp; Journal
              </h2>
              <span className="text-[11px] text-zinc-400 tracking-wide">
                Realm of Zeldo • Episode Guide
              </span>
            </div>
          </div>
          <button
            onClick={closeMapModal}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-white/10"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center justify-around bg-black/60 border-b border-white/10 px-2 py-2 gap-1 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => openMapModal('map')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'map'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>

          <button
            onClick={() => openMapModal('quest')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'quest'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Quests</span>
          </button>

          <button
            onClick={() => openMapModal('inventory')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Gear</span>
          </button>

          <button
            onClick={() => openMapModal('stats')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Stats</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* TAB 1: WORLD MAP */}
          {activeTab === 'map' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>The Overworld (3×2 Realm Grid)</span>
                <span className="text-amber-300 font-mono">
                  {currentMap === 'overworld' ? `Hero at (${player.x.toFixed(1)}, ${player.z.toFixed(1)})` : 'In Mountain Sanctum'}
                </span>
              </div>

              {/* 3x2 Grid View */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                {screens.map((s, idx) => {
                  const isCurrentScreen = currentMap === 'overworld' && s.col === currentCol && s.row === currentRow;
                  const isObjectiveScreen = currentMap === 'overworld' && s.col === 2 && s.row === 1;

                  return (
                    <div
                      key={idx}
                      className={`relative flex flex-col justify-between p-3 rounded-2xl border transition-all h-28 sm:h-32 ${
                        isCurrentScreen
                          ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)] ring-2 ring-emerald-400/40'
                          : isObjectiveScreen
                          ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-zinc-900/80 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-base sm:text-lg">{s.icon}</span>
                        {isCurrentScreen && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-zinc-950 text-[9px] font-black uppercase tracking-wider animate-pulse">
                            YOU
                          </span>
                        )}
                        {isObjectiveScreen && !isCurrentScreen && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[9px] font-black uppercase tracking-wider">
                            GOAL
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-snug">
                          {s.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dungeon Sanctum Card */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                  currentMap === 'dungeon'
                    ? 'bg-purple-950/70 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-2 ring-purple-400/40'
                    : 'bg-zinc-900/60 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏛️</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-zinc-100">
                        Mountain Sanctum (Underground)
                      </span>
                      {currentMap === 'dungeon' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-400 text-zinc-950 text-[9px] font-black uppercase">
                          ACTIVE DUNGEON
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      Antechamber (Key Pedestal) &bull; Iron Portcullis &bull; Bramble King Lair
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300">
                  {quest.chestOpened ? 'CLEARED' : quest.bossDefeated ? 'BOSS SLAIN' : quest.hasDungeonKey ? 'KEY FOUND' : 'SEALED'}
                </div>
              </div>

              {/* Map Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-400 pt-1 border-t border-white/5">
                <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Hero Location
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Quest Destination
                </span>
                <span className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-400" /> Ancient Key
                </span>
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-yellow-400" /> Sunstone Vault
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: QUEST JOURNAL */}
          {activeTab === 'quest' && (
            <div className="flex flex-col gap-4">
              <div className="bg-black/40 p-4 rounded-2xl border border-amber-500/20">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block">
                  Main Chronicle
                </span>
                <h3 className="text-lg font-black text-amber-200 font-serif mt-0.5">
                  The Verdant Crest &amp; The Bramble King
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Gorgoth the Bramble King has cast a thorny shadow over the realm and locked the sacred Sunstone within the Mountain Sanctum. Only a valiant adventurer wielding the sword of the grove can breach the vault and restore the realm.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Quest Objectives
                </span>
                {questSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition ${
                      step.completed
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-zinc-300'
                        : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className={`text-xs sm:text-sm font-bold ${step.completed ? 'text-emerald-200' : 'text-zinc-200'}`}>
                        {step.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                        {step.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY & GEAR */}
          {activeTab === 'inventory' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Sword */}
                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🗡️</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Equipped
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Hero&apos;s Blade</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Tempered steel blade. Wide 135° sweep that cleaves enemies, tall grass, and clay pots.
                    </p>
                  </div>
                </div>

                {/* Shield */}
                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🛡️</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Equipped
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Verdant Shield</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Carved timber shield with steel boss, providing steadfast guard against the wilds.
                    </p>
                  </div>
                </div>

                {/* Dungeon Key */}
                <div className={`p-3.5 rounded-2xl flex flex-col gap-2 border ${
                  quest.hasDungeonKey
                    ? 'bg-amber-950/40 border-amber-500/50 shadow-md'
                    : 'bg-zinc-900/40 border-white/5 opacity-70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🗝️</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      quest.hasDungeonKey ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {quest.hasDungeonKey ? 'In Pouch' : 'Unclaimed'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Sanctum Key</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Ancient golden key to unseal the heavy iron portcullis in the subterranean temple.
                    </p>
                  </div>
                </div>

                {/* Sunstone */}
                <div className={`p-3.5 rounded-2xl flex flex-col gap-2 border ${
                  quest.chestOpened
                    ? 'bg-yellow-950/50 border-yellow-400/60 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                    : 'bg-zinc-900/40 border-white/5 opacity-70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🏆</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      quest.chestOpened ? 'bg-yellow-400 text-zinc-950 font-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {quest.chestOpened ? 'Recovered!' : 'Locked'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">The Sunstone</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Sacred relic of radiant solar flame that dispels shadowy briars and secures realm peace.
                    </p>
                  </div>
                </div>

                {/* Rupees */}
                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="w-5 h-6 bg-emerald-400 rotate-45 rounded-xs" />
                    <span className="text-sm font-mono font-black text-emerald-300">
                      {stats.rupees}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Rupee Pouch</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Glimmering crystal currency discovered under sheared foliage and cracked clay pots.
                    </p>
                  </div>
                </div>

                {/* Life Hearts */}
                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">❤️</span>
                    <span className="text-sm font-mono font-black text-red-400">
                      {player.health} / {player.maxHealth} HP
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Heart Containers</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      3 vital heart containers. Restored by harvesting heart pickups in the field.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADVENTURE STATS */}
          {activeTab === 'stats' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Playtime</span>
                  <span className="text-xl font-black font-mono text-amber-300 mt-1">
                    {timeFormatted}
                  </span>
                </div>

                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Monsters Slain</span>
                  <span className="text-xl font-black font-mono text-red-400 mt-1">
                    {stats.enemiesDefeated}
                  </span>
                </div>

                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Grass Cut</span>
                  <span className="text-xl font-black font-mono text-emerald-400 mt-1">
                    {stats.grassCut}
                  </span>
                </div>

                <div className="bg-zinc-900/80 border border-white/10 p-3.5 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Pots Smashed</span>
                  <span className="text-xl font-black font-mono text-yellow-400 mt-1">
                    {stats.potsBroken}
                  </span>
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-xs text-zinc-300 flex items-center justify-between">
                <span>Current Exploration Realm:</span>
                <strong className="text-amber-200">
                  {currentMap === 'dungeon' ? DUNGEON_AREAS.antechamber : 'The Wild Overworld'}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-black/50 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Zeldo Quest of the Bramble King</span>
          </div>
          <button
            onClick={closeMapModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl transition shadow cursor-pointer"
          >
            Resume Journey
          </button>
        </div>
      </div>
    </div>
  );
};
