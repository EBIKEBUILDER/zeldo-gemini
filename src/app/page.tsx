'use client';

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(
  () => import('@/components/GameCanvas').then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 font-sans select-none">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-amber-300 font-bold uppercase tracking-widest text-sm">
          Entering the Realm of Zeldo...
        </span>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden">
      <GameCanvas />
    </main>
  );
}
