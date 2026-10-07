import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Legend of Zeldo: The Verdant Crest',
  description: 'A complete 3D overhead Zeldo-like action adventure in low-poly 3D, powered by Babylon.js, Zustand, and Web Audio API.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white overflow-hidden w-screen h-screen">
        {children}
      </body>
    </html>
  );
}
