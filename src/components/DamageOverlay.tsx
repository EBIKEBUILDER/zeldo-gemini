'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';

export const DamageOverlay: React.FC = () => {
  const damageFlash = useGameStore((state) => state.damageFlash);

  if (damageFlash <= 0.01) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-25 transition-opacity duration-75"
      style={{
        opacity: Math.min(1.0, damageFlash),
        background:
          'radial-gradient(circle at center, rgba(239, 68, 68, 0) 45%, rgba(220, 38, 38, 0.45) 85%, rgba(185, 28, 28, 0.8) 100%)',
      }}
    />
  );
};
