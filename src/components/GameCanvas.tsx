'use client';

import React, { useEffect, useRef } from 'react';
import { BabylonRenderer } from '@/game/graphics/babylonRenderer';
import { gameLoop } from '@/game/engine/gameLoop';
import { HUD } from './HUD';
import { ItemBanner } from './ItemBanner';
import { DamageOverlay } from './DamageOverlay';
import { TitleScreen } from './TitleScreen';
import { GameOverScreen } from './GameOverScreen';
import { VictoryScreen } from './VictoryScreen';

import { useGameStore } from '@/game/state/gameStore';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BabylonRenderer | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __gameStore: typeof useGameStore }).__gameStore = useGameStore;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize 3D Babylon renderer
    const renderer = new BabylonRenderer(canvas);
    rendererRef.current = renderer;

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D Babylon Viewport */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none outline-none cursor-crosshair"
        tabIndex={0}
      />

      {/* React UI Layers */}
      <HUD />
      <ItemBanner />
      <DamageOverlay />
      <TitleScreen />
      <GameOverScreen />
      <VictoryScreen />
    </div>
  );
};
