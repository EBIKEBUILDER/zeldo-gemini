# ⚔️ Zeldo: Quest of the Bramble King

A complete, playable 3D Zelda-like browser game inspired by the structure, quest flow, and aesthetic charm of *A Link to the Past*, rendered as a vibrant low-poly overhead adventure.

---

## 🌟 Game Highlights

- **The Overworld**: A hand-crafted 3×2 grid of thematic screens (Whispering Glade, Sunlit Meadow, River Crossing, Skull Crag, Briar Hollow, Mountain Arch) with rivers, bridges, cottage, stone well, faceted pine trees, cuttable grass, and smashable pots.
- **Classic Overhead Camera & Lighting**: Angled 56° follow camera with smooth lerping, screen shake, and warm directional sunlight.
- **Fluid Combat & Movement**: Smooth 8-way acceleration/friction movement (WASD/Arrows), responsive wall-sliding, circle-circle repulsion (player and enemies never overlap or stack), and forward sword sweeps with hitstun, knockback, and impact sparks.
- **The Quest Loop**:
  1. Explore the Overworld and find the rocky Mountain Arch.
  2. Enter the ancient 2-room stone dungeon (Sanctum Antechamber).
  3. Retrieve the Dungeon Key from the sacred stone pedestal.
  4. Unlock the heavy iron portcullis.
  5. Slay **Gorgoth the Bramble King** (dynamic boss battle with top HP bar and enraged charges).
  6. Open the Sunstone Treasure Chest to claim victory!
- **Pure Web Audio API Synthesizer**: Complete 8-bit procedural sound effects (sword swings, impacts, enemy deaths, rupee sparkles, heart chimes, gate grinding, fanfare) plus continuous 16-step procedural chiptune music (Overworld, Dungeon, and Boss themes). Mute toggle with `M`.
- **Pure Architectural Separation**:
  - **Zustand**: 100% serializable game state.
  - **Babylon.js**: Pure view layer reading store frames and positioning meshes.
  - **GameLoop**: 60Hz fixed-timestep simulation accumulator for deterministic gameplay.
  - **React**: Clean HUD, floating banners, damage vignette, title, game over, and victory screens.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` or `Arrow Keys` |
| **Sword Attack** | `Spacebar` or `Left Mouse Click` |
| **Interact / Open Chest** | `E`, `Spacebar`, or `Enter` |
| **Toggle Sound / Music** | `M` (or mute button in top right HUD) |
| **Start / Retry** | `Enter` or `Click` |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack) + React 19 + TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **3D Engine**: [Babylon.js](https://www.babylonjs.com/) (low-poly mesh generators, no external model files)
- **State Management**: [Zustand](https://zustand.docs.pmnd.rs/)
- **Audio**: Web Audio API (100% procedural, no external audio files)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
```
Creates an optimized zero-error production build.
