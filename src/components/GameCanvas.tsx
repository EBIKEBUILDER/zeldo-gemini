'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { BabylonRenderer } from '@/game/graphics/babylonRenderer';
import { gameLoop } from '@/game/engine/gameLoop';
import { soundManager } from '@/audio/soundManager';
import { HUD } from './HUD';
import { ItemBanner } from './ItemBanner';
import { DamageOverlay } from './DamageOverlay';
import { TitleScreen } from './TitleScreen';
import { GameOverScreen } from './GameOverScreen';
import { VictoryScreen } from './VictoryScreen';
import { VirtualControls } from './VirtualControls';
import { WorldMapModal } from './WorldMapModal';

import { useGameStore } from '@/game/state/gameStore';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BabylonRenderer | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __gameStore: typeof useGameStore }).__gameStore = useGameStore;
      (window as unknown as { __gameLoop: typeof gameLoop }).__gameLoop = gameLoop;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize 3D Babylon renderer
    const renderer = new BabylonRenderer(canvas);
    rendererRef.current = renderer;
    if (typeof window !== 'undefined') {
      (window as unknown as { __renderer: BabylonRenderer }).__renderer = renderer;
    }

    // Start simulation loop
    gameLoop.start();

    return () => {
      gameLoop.stop();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  // Handle tap-to-move on world canvas
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useGameStore.getState();
    if (store.gameState !== 'playing') return;

    // Mobile touch tap on the ground triggers tap-to-move
    // Desktop right-click on the ground also triggers tap-to-move
    if (e.pointerType === 'touch' || e.button === 2) {
      const pos = rendererRef.current?.pickGroundPosition(e.clientX, e.clientY);
      if (pos) {
        gameLoop.setTapTarget(pos.x, pos.z);
        rendererRef.current?.showTapBeacon(pos.x, pos.z);
        soundManager.playTapBeacon();
      }
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none touch-none">
      {/* 3D Babylon Viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block touch-none outline-none cursor-crosshair"
        tabIndex={0}
      />

      {/* Mobile Touch & Virtual Controller Overlay */}
      <VirtualControls />

      {/* React UI Layers */}
      <HUD />
      <ItemBanner />
      <DamageOverlay />
      <WorldMapModal />
      <TitleScreen />
      <GameOverScreen />
      <VictoryScreen />
    </div>
  );
};
