'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { gameLoop } from '@/game/engine/gameLoop';
import { Sword, Key, DoorClosed, RotateCw, Wind } from 'lucide-react';

export const VirtualControls: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const showVirtualControls = useGameStore((state) => state.showVirtualControls);
  const contextAction = useGameStore((state) => state.contextAction);

  // Joystick state
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const activePointerId = useRef<number | null>(null);
  const centerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const MAX_RADIUS = 48; // Max thumb displacement in pixels

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    centerPos.current = { x: cx, y: cy };

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobPos({ x: kx, y: ky });
    setIsDragging(true);

    // Babylon coordinates: +X East (right), +Z North (up, so -dy)
    const normX = kx / MAX_RADIUS;
    const normZ = -ky / MAX_RADIUS;
    gameLoop.setJoystick(normX, normZ);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }, [MAX_RADIUS]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId || !isDragging) return;

    const dx = e.clientX - centerPos.current.x;
    const dy = e.clientY - centerPos.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobPos({ x: kx, y: ky });

    const normX = kx / MAX_RADIUS;
    const normZ = -ky / MAX_RADIUS;
    gameLoop.setJoystick(normX, normZ);
  }, [isDragging, MAX_RADIUS]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture already lost
    }
    activePointerId.current = null;
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    gameLoop.setJoystick(0, 0);
  }, []);

  const handleAttackDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    gameLoop.requestAttack();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const handleActionDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    gameLoop.requestAction();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  if (gameState !== 'playing' || !showVirtualControls) return null;

  // Determine Action button icon and visual style
  const renderActionIcon = () => {
    switch (contextAction.type) {
      case 'open_chest':
        return <span className="text-xl">🏆</span>;
      case 'unlock_gate':
        return <Key className="w-6 h-6 text-amber-300" />;
      case 'enter_dungeon':
      case 'exit_dungeon':
        return <DoorClosed className="w-6 h-6 text-emerald-300" />;
      case 'roll':
      default:
        return <Wind className="w-6 h-6 text-sky-300" />;
    }
  };

  const isContextHighlighted = contextAction.type !== 'roll' && contextAction.type !== 'none';

  return (
    <div
      data-interactive="true"
      className="pointer-events-none fixed inset-0 z-30 flex justify-between items-end p-4 sm:p-8 select-none font-sans touch-none"
    >
      {/* LEFT: VIRTUAL JOYSTICK */}
      <div className="pointer-events-auto relative pb-2 pl-2">
        <div
          ref={joystickRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-zinc-950/60 backdrop-blur-md border-2 ${
            isDragging ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]' : 'border-amber-500/30 shadow-xl'
          } flex items-center justify-center transition-colors cursor-pointer touch-none`}
        >
          {/* Outer Compass Cardinal Markings */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-amber-400/80" />

          {/* Inner Resting Ring */}
          <div className="w-16 h-16 rounded-full border border-dashed border-amber-400/20 pointer-events-none" />

          {/* Directional connecting line during drag */}
          {isDragging && (
            <div
              className="absolute w-1 bg-gradient-to-t from-amber-500/20 to-amber-400 origin-bottom pointer-events-none"
              style={{
                height: `${Math.hypot(knobPos.x, knobPos.y)}px`,
                transform: `rotate(${Math.atan2(knobPos.y, knobPos.x) + Math.PI / 2}rad)`,
                bottom: '50%',
                left: 'calc(50% - 2px)',
              }}
            />
          )}

          {/* Movable Thumb Knob */}
          <div
            className={`absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-400 border-2 border-amber-300 shadow-[0_6px_16px_rgba(0,0,0,0.8)] flex items-center justify-center pointer-events-none transition-transform ${
              isDragging ? 'scale-105' : 'scale-100'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {/* Center Gem Seal */}
            <div className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 shadow-inner border border-amber-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
            </div>
          </div>
        </div>

        {/* Joystick Label */}
        <span className="block text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400/70 mt-1 pointer-events-none">
          Move Hero
        </span>
      </div>

      {/* RIGHT: RPG ACTION BUTTONS */}
      <div className="pointer-events-auto relative flex flex-col items-end gap-3 pb-2 pr-2">
        {/* Secondary Context Button (ROLL / OPEN / UNLOCK / ENTER) */}
        <div className="flex flex-col items-center mr-14 sm:mr-16">
          <button
            onPointerDown={handleActionDown}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all cursor-pointer transform active:scale-90 active:translate-y-1 ${
              isContextHighlighted
                ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-zinc-950 border-2 border-yellow-200 shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-pulse'
                : 'bg-gradient-to-tr from-sky-800 via-cyan-700 to-teal-600 text-white border-2 border-sky-300/60 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
            }`}
            title={contextAction.label}
          >
            {renderActionIcon()}
            <span className="text-[9px] font-black uppercase tracking-wider -mt-0.5">
              {contextAction.label}
            </span>
          </button>
        </div>

        {/* Primary Action Button (SWORD ATTACK) */}
        <div className="flex flex-col items-center">
          <button
            onPointerDown={handleAttackDown}
            className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-red-700 via-amber-600 to-yellow-500 text-zinc-950 border-3 border-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:shadow-[0_0_40px_rgba(245,158,11,0.7)] flex flex-col items-center justify-center transition-all cursor-pointer transform active:scale-90 active:translate-y-1"
            title="Swing Sword (Space / Left Click)"
          >
            <Sword className="w-8 h-8 text-zinc-950 -rotate-45 drop-shadow" />
            <span className="text-[10px] font-black uppercase tracking-wider -mt-1 text-zinc-950">
              ATTACK
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
