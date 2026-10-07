'use client';

import React from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { Key, Sparkles, Sword, Heart } from 'lucide-react';

export const ItemBanner: React.FC = () => {
  const banner = useGameStore((state) => state.banner);

  if (!banner) return null;

  const renderIcon = () => {
    switch (banner.icon) {
      case 'key':
        return <Key className="w-8 h-8 text-amber-300 animate-bounce" />;
      case 'chest':
        return <Sparkles className="w-8 h-8 text-yellow-300 animate-spin" />;
      case 'sword':
        return <Sword className="w-8 h-8 text-emerald-300" />;
      case 'heart':
        return <Heart className="w-8 h-8 text-red-400" />;
      default:
        return <Sparkles className="w-8 h-8 text-emerald-400" />;
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-4 bg-zinc-950/90 backdrop-blur-xl border border-amber-500/40 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.25)] max-w-lg text-center">
        <div className="shrink-0 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
          {renderIcon()}
        </div>
        <div className="flex flex-col text-left">
          <h3 className="text-base sm:text-lg font-black tracking-wide text-amber-200 uppercase font-serif">
            {banner.title}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 font-medium">
            {banner.message}
          </p>
        </div>
      </div>
    </div>
  );
};
