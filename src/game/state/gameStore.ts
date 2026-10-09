import { create } from 'zustand';
import {
  GameState,
  MapId,
  PlayerState,
  EnemyState,
  BreakableState,
  PickupState,
  ParticleState,
  QuestState,
  GameStats,
  BannerInfo,
  ProjectileState,
  GroundHazardState,
  ContextAction,
  Vector2D,
} from '@/types/game';
import {
  generateOverworld,
  generateDungeon,
  MapData,
} from '../worldData';
import {
  SPAWN_POSITION,
  PLAYER_MAX_HEALTH,
  OVERWORLD_AREAS,
  DUNGEON_AREAS,
  SCREEN_WIDTH_TILES,
  SCREEN_HEIGHT_TILES,
  DUNGEON_SPAWN_POS,
  DUNGEON_EXIT_POS,
} from '../constants';
import { soundManager } from '@/audio/soundManager';
import { defaultNavGrid, defaultPathfindingSystem } from '../engine/pathfinding';

export interface GameStoreState {
  // Navigation / screen
  gameState: GameState;
  currentMap: MapId;
  currentAreaName: string;

  // Maps
  overworldMap: MapData;
  dungeonMap: MapData;

  // Entities
  player: PlayerState;
  enemies: EnemyState[];
  breakables: BreakableState[];
  pickups: PickupState[];
  projectiles: ProjectileState[];
  groundHazards: GroundHazardState[];
  activeParticles: ParticleState[];

  // Quest & Progression
  quest: QuestState;
  stats: GameStats;

  // Audio / Feedback
  isMuted: boolean;
  screenShake: number;
  damageFlash: number;
  banner: BannerInfo | null;

  // RPG UI & Mobile Controls
  contextAction: ContextAction;
  isMapModalOpen: boolean;
  activeModalTab: 'map' | 'quest' | 'inventory' | 'stats';
  showVirtualControls: boolean;
  tapTargetPos: Vector2D | null;

  // Actions
  startGame: () => void;
  retryGame: () => void;
  resetToTitle: () => void;
  toggleMute: () => void;
  showBanner: (title: string, message: string, icon?: BannerInfo['icon'], duration?: number) => void;
  clearBanner: () => void;
  switchMap: (mapId: MapId, x: number, z: number) => void;
  openMapModal: (tab?: 'map' | 'quest' | 'inventory' | 'stats') => void;
  closeMapModal: () => void;
  toggleVirtualControls: () => void;
  setContextAction: (action: ContextAction) => void;
  setTapTargetPos: (pos: Vector2D | null) => void;
  updateFromLoop: (partial: Partial<GameStoreState>) => void;
}

const initialOverworld = generateOverworld();
const initialDungeon = generateDungeon();

function computeAreaName(mapId: MapId, x: number, z: number): string {
  if (mapId === 'dungeon') {
    return z >= 12 ? DUNGEON_AREAS.bossRoom : DUNGEON_AREAS.antechamber;
  }
  const col = Math.min(2, Math.max(0, Math.floor(x / SCREEN_WIDTH_TILES)));
  const row = Math.min(1, Math.max(0, Math.floor(z / SCREEN_HEIGHT_TILES)));
  return OVERWORLD_AREAS[`${col},${row}`] || 'The Wilds';
}

const initialPlayer: PlayerState = {
  x: SPAWN_POSITION.x,
  z: SPAWN_POSITION.z,
  vx: 0,
  vz: 0,
  facingAngle: Math.PI, // Facing down/south at start
  facingDir: 'S',
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  iFrames: 0,
  isAttacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  isRolling: false,
  rollTimer: 0,
  rollCooldown: 0,
  isBlinking: false,
  isMoving: false,
  walkCycle: 0,
};

const initialQuest: QuestState = {
  hasDungeonKey: false,
  dungeonGateOpen: false,
  gateOpenProgress: 0,
  bossDefeated: false,
  chestSpawned: false,
  chestOpened: false,
  chestOpenProgress: 0,
};

const initialStats: GameStats = {
  rupees: 0,
  enemiesDefeated: 0,
  grassCut: 0,
  potsBroken: 0,
  startTime: 0,
  completionTime: 0,
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: 'title',
  currentMap: 'overworld',
  currentAreaName: OVERWORLD_AREAS['0,0'],

  overworldMap: initialOverworld,
  dungeonMap: initialDungeon,

  player: { ...initialPlayer },
  enemies: [...initialOverworld.initialEnemies, ...initialDungeon.initialEnemies],
  breakables: [...initialOverworld.initialBreakables, ...initialDungeon.initialBreakables],
  pickups: [...initialOverworld.initialPickups, ...initialDungeon.initialPickups],
  projectiles: [],
  groundHazards: [],
  activeParticles: [],

  quest: { ...initialQuest },
  stats: { ...initialStats },

  isMuted: false,
  screenShake: 0,
  damageFlash: 0,
  banner: null,

  contextAction: { type: 'roll', label: 'ROLL', icon: 'roll' },
  isMapModalOpen: false,
  activeModalTab: 'map',
  showVirtualControls: true,
  tapTargetPos: null,

  startGame: () => {
    soundManager.ensureAudio();
    soundManager.startMusic('overworld');
    const overworld = generateOverworld();
    const dungeon = generateDungeon();
    const initialBreakables = [...overworld.initialBreakables, ...dungeon.initialBreakables];

    defaultNavGrid.build(overworld, dungeon, false, initialBreakables);
    defaultPathfindingSystem.clearQueue();

    set({
      gameState: 'playing',
      currentMap: 'overworld',
      currentAreaName: OVERWORLD_AREAS['0,0'],
      overworldMap: overworld,
      dungeonMap: dungeon,
      player: {
        ...initialPlayer,
        x: SPAWN_POSITION.x,
        z: SPAWN_POSITION.z,
        health: PLAYER_MAX_HEALTH,
      },
      enemies: [...overworld.initialEnemies, ...dungeon.initialEnemies],
      breakables: initialBreakables,
      pickups: [...overworld.initialPickups, ...dungeon.initialPickups],
      projectiles: [],
      groundHazards: [],
      activeParticles: [],
      quest: { ...initialQuest },
      stats: {
        ...initialStats,
        startTime: Date.now(),
      },
      screenShake: 0,
      damageFlash: 0,
      banner: {
        title: 'Whispering Glade',
        message: 'Seek the Mountain Crypt to claim the Sunstone of the Ancients.',
        icon: 'sword',
        duration: 4.5,
      },
      isMapModalOpen: false,
      tapTargetPos: null,
      contextAction: { type: 'roll', label: 'ROLL', icon: 'roll' },
    });
  },

  retryGame: () => {
    get().startGame();
  },

  resetToTitle: () => {
    soundManager.stopMusic();
    defaultPathfindingSystem.clearQueue();
    set({
      gameState: 'title',
      banner: null,
      projectiles: [],
      groundHazards: [],
      isMapModalOpen: false,
      tapTargetPos: null,
    });
  },

  toggleMute: () => {
    const isMuted = soundManager.toggleMute();
    set({ isMuted });
  },

  showBanner: (title: string, message: string, icon?: BannerInfo['icon'], duration = 3.5) => {
    set({ banner: { title, message, icon, duration } });
  },

  clearBanner: () => {
    set({ banner: null });
  },

  switchMap: (mapId: MapId, x: number, z: number) => {
    const currentTheme = mapId === 'dungeon' ? 'dungeon' : 'overworld';
    soundManager.startMusic(currentTheme);

    set((state) => ({
      currentMap: mapId,
      currentAreaName: computeAreaName(mapId, x, z),
      projectiles: [],
      groundHazards: [],
      player: {
        ...state.player,
        x,
        z,
        vx: 0,
        vz: 0,
      },
    }));
  },

  openMapModal: (tab = 'map') => {
    set({ isMapModalOpen: true, activeModalTab: tab });
  },

  closeMapModal: () => {
    set({ isMapModalOpen: false });
  },

  toggleVirtualControls: () => {
    set((state) => ({ showVirtualControls: !state.showVirtualControls }));
  },

  setContextAction: (action: ContextAction) => {
    set({ contextAction: action });
  },

  setTapTargetPos: (pos: Vector2D | null) => {
    set({ tapTargetPos: pos });
  },

  updateFromLoop: (partial: Partial<GameStoreState>) => {
    set(partial);
  },
}));
