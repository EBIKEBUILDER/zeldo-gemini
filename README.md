# ⚔️ Zeldo: Quest of the Bramble King

A complete, playable 3D Zeldo-like browser game inspired by classic overhead adventure structure, rendered as a vibrant low-poly overhead adventure.

---

## 🌟 Game Highlights

- **The Overworld**: A hand-crafted 3×2 grid of thematic screens (Whispering Glade, Sunlit Meadow, River Crossing, Skull Crag, Briar Hollow, Mountain Arch) with rivers, bridges, cottage, stone well, faceted pine trees, cuttable grass, and smashable pots.
- **Classic Overhead Camera & Lighting**: Angled 56° follow camera with smooth lerping, screen shake, and warm directional sunlight.
- **Fluid Combat & Movement**: Smooth 8-way acceleration/friction movement (WASD/Arrows), responsive wall-sliding, circle-circle repulsion (player and enemies never overlap or stack), and forward sword sweeps with hitstun, knockback, and impact sparks.
- **Mobile Touch & RPG Experience**:
  - **Dynamic Virtual Joystick**: Smooth 360° analog thumbstick with golden compass accents, spring-back centering, and haptic feedback.
  - **Tactile Tap-to-Move**: Tap anywhere on the 3D ground plane to send a golden magic beacon and navigate using A* pathfinding and obstacle avoidance.
  - **Ergonomic Action Cluster**: Dedicated Attack button plus dynamic Context Action button (Dodge Roll / Dash with dust poofs and invulnerability, Open Chest, Unlock Gate, Enter/Exit Dungeon).
  - **Tactical Radar Mini-Map**: Top-right brass compass radar tracking terrain, dirt trails, water, enemy blips, and an objective needle pointing towards quest goals.
  - **Full RPG Adventurer's Atlas & Journal**: Full-screen modal with World Map (3×2 overworld realm & dungeon), Quest Journal with step-by-step progress checklist, Equipment & Inventory slots, and Adventure Stats.
- **The Quest Loop**:
  1. Explore the Overworld and find the rocky Mountain Arch.
  2. Enter the ancient 2-room stone dungeon (Sanctum Antechamber).
  3. Retrieve the Dungeon Key from the sacred stone pedestal.
  4. Unlock the heavy iron portcullis.
  5. Slay **Gorgoth the Bramble King** (dynamic boss battle with top HP bar and enraged charges).
  6. Open the Sunstone Treasure Chest to claim victory!
- **Pure Web Audio API Synthesizer**: Complete 8-bit procedural sound effects (sword swings, impacts, enemy deaths, rupee sparkles, heart chimes, gate grinding, dodge roll whoosh, tap beacon chime, fanfare) plus continuous 16-step procedural chiptune music (Overworld, Dungeon, and Boss themes). Mute toggle with `M`.
- **Pure Architectural Separation**:
  - **Zustand**: 100% serializable game state.
  - **Babylon.js**: Pure view layer reading store frames and positioning meshes.
  - **GameLoop**: 60Hz fixed-timestep simulation accumulator for deterministic gameplay.
  - **React**: Clean HUD, floating banners, damage vignette, title, game over, victory screens, and RPG Atlas.

---

## 🎮 Controls

### Mobile Touch Controls
| Control | Action |
| :--- | :--- |
| **Virtual Joystick (Left Thumb)** | 360° Analog Hero Movement |
| **Tap Anywhere on Ground** | Tap-to-Move with A* Pathfinding & Beacon |
| **Attack Button (Right Thumb)** | Sword Swing (Cleaves foes, grass & pots) |
| **Action Button (Right Thumb)** | Context Action: Dodge Roll / Open / Unlock / Enter |
| **Radar Mini-Map (Top Right)** | Tap to open full World Map & Quest Journal |
| **Controls Toggle (HUD)** | Toggle on-screen virtual buttons on/off |

### Keyboard & Mouse Controls
| Action | Control |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` or `Arrow Keys` |
| **Sword Attack** | `Spacebar` or `Left Mouse Click` |
| **Dodge Roll / Interact** | `E`, `Shift`, or `Enter` |
| **Tap to Move** | `Right Click` anywhere on ground |
| **Toggle Sound / Music** | `M` (or mute button in HUD) |
| **Start / Retry** | `Enter`, `Click`, or `Tap` |

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
