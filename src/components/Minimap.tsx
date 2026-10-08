'use client';

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import {
  DUNGEON_ENTRANCE_POS,
  DUNGEON_KEY_POS,
  DUNGEON_GATE_POS,
  DUNGEON_BOSS_SPAWN_POS,
  DUNGEON_CHEST_POS,
} from '@/game/constants';
import { Map, Compass } from 'lucide-react';

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const openMapModal = useGameStore((state) => state.openMapModal);
  const currentMap = useGameStore((state) => state.currentMap);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const store = useGameStore.getState();
      const player = store.player;
      const map = store.currentMap === 'dungeon' ? store.dungeonMap : store.overworldMap;
      const quest = store.quest;
      const enemies = store.enemies;
      const pickups = store.pickups;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = cx - 8;
      const scale = 5.2; // pixels per tile

      ctx.clearRect(0, 0, width, height);

      // 1. Clip circular viewport
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Background fill
      ctx.fillStyle = store.currentMap === 'dungeon' ? '#18181b' : '#14532d';
      ctx.fillRect(0, 0, width, height);

      // 2. Render visible terrain tiles around player
      const minTileX = Math.max(0, Math.floor(player.x - 14));
      const maxTileX = Math.min(map.width - 1, Math.ceil(player.x + 14));
      const minTileZ = Math.max(0, Math.floor(player.z - 14));
      const maxTileZ = Math.min(map.height - 1, Math.ceil(player.z + 14));

      for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let tz = minTileZ; tz <= maxTileZ; tz++) {
          const tile = map.tiles[tx]?.[tz];
          if (!tile) continue;

          // Babylon coordinates: +X is East (right), +Z is North (up on screen)
          const sx = cx + (tx - player.x) * scale;
          const sy = cy - (tz - player.z) * scale;
          const size = scale + 0.6; // slight overlap to prevent seams

          switch (tile.type) {
            case 'water':
              ctx.fillStyle = '#2563eb';
              break;
            case 'bridge':
              ctx.fillStyle = '#b45309';
              break;
            case 'dirt':
              ctx.fillStyle = '#ca8a04';
              break;
            case 'hedge':
              ctx.fillStyle = '#052e16';
              break;
            case 'dungeon_wall':
              ctx.fillStyle = '#334155';
              break;
            case 'stone_floor':
              ctx.fillStyle = '#1e293b';
              break;
            case 'doorway':
              ctx.fillStyle = '#9333ea';
              break;
            case 'grass':
            default:
              ctx.fillStyle = store.currentMap === 'dungeon' ? '#0f172a' : '#15803d';
              break;
          }

          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
      }

      // 3. Render Pickups (Key, Chest)
      pickups.forEach((p) => {
        if (p.mapId === store.currentMap && !p.collected) {
          const sx = cx + (p.x - player.x) * scale;
          const sy = cy - (p.z - player.z) * scale;
          if (p.type === 'key') {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // 4. Render Enemies (Red Blips, Boss crimson skull)
      enemies.forEach((e) => {
        if (e.mapId === store.currentMap && !e.isDead) {
          const sx = cx + (e.x - player.x) * scale;
          const sy = cy - (e.z - player.z) * scale;
          const d = Math.hypot(sx - cx, sy - cy);
          if (d <= radius) {
            if (e.type === 'boss_gorgoth') {
              ctx.fillStyle = '#dc2626';
              ctx.beginPath();
              ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#fef08a';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              ctx.fillStyle = e.type === 'slime_red' ? '#f87171' : '#fbbf24';
              ctx.beginPath();
              ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      });

      // 5. Objective Tracking & Waypoint Beacon
      let objPos: { x: number; z: number } | null = null;
      if (store.currentMap === 'overworld') {
        objPos = DUNGEON_ENTRANCE_POS;
      } else {
        if (!quest.hasDungeonKey) {
          objPos = DUNGEON_KEY_POS;
        } else if (!quest.dungeonGateOpen) {
          objPos = DUNGEON_GATE_POS;
        } else if (!quest.bossDefeated) {
          objPos = DUNGEON_BOSS_SPAWN_POS;
        } else if (!quest.chestOpened) {
          objPos = DUNGEON_CHEST_POS;
        }
      }

      if (objPos) {
        const odx = (objPos.x - player.x) * scale;
        const ody = -(objPos.z - player.z) * scale;
        const odist = Math.hypot(odx, ody);

        if (odist < radius - 8) {
          // Inside radar view: Pulsing golden diamond
          const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.25;
          ctx.save();
          ctx.translate(cx + odx, cy + ody);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-3 * pulse, -3 * pulse, 6 * pulse, 6 * pulse);
          ctx.restore();
        } else {
          // Outside radar view: Pointer chevron on perimeter rim pointing toward objective
          const angle = Math.atan2(ody, odx);
          const px = cx + Math.cos(angle) * (radius - 5);
          const py = cy + Math.sin(angle) * (radius - 5);

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle);
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.lineTo(-4, -3.5);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // 6. Player Marker (Center Green Arrow / Chevron)
      ctx.save();
      ctx.translate(cx, cy);
      // player.facingAngle: 0 = +Z (North / Up on screen), PI/2 = +X (East / Right on screen)
      // Screen angle: 0 is right, -PI/2 is up
      const screenAngle = player.facingAngle - Math.PI / 2;
      ctx.rotate(screenAngle);

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -4.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 4.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // Restore unclipped

      // 7. Ornate Compass Border & Rose
      ctx.save();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal N Marker
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', cx, 2);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      data-interactive="true"
      onClick={() => openMapModal('map')}
      className="pointer-events-auto flex flex-col items-center gap-1 cursor-pointer group"
      title="Click or Tap to open Realm Atlas & Quest Journal"
    >
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-black/80 p-0.5 shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-amber-500/40 group-hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all transform group-active:scale-95">
        <canvas
          ref={canvasRef}
          width={112}
          height={112}
          className="w-full h-full block rounded-full"
        />
        {/* Subtle Map Icon Overlay */}
        <div className="absolute bottom-0 right-0 bg-amber-500/90 text-zinc-950 p-1 rounded-full shadow-md border border-amber-200">
          <Map className="w-3 h-3" />
        </div>
      </div>
      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300/80 group-hover:text-amber-200 drop-shadow flex items-center gap-1">
        <Compass className="w-2.5 h-2.5" />
        Atlas
      </span>
    </div>
  );
};
