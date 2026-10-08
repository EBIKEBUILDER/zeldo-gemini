export type Vector2D = {
  x: number;
  z: number;
};

export type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type GameState = 'title' | 'playing' | 'game_over' | 'victory';

export type MapId = 'overworld' | 'dungeon';

export type TileType =
  | 'grass'
  | 'dirt'
  | 'flower'
  | 'water'
  | 'bridge'
  | 'hedge'
  | 'stone_floor'
  | 'dungeon_wall'
  | 'doorway';

export interface TileData {
  type: TileType;
  solid: boolean;
  water?: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingAngle: number; // in radians: 0 = +Z (up), PI/2 = +X (right), etc.
  facingDir: Direction8;
  health: number; // 6 = 3 full hearts (each heart has 2 HP)
  maxHealth: number;
  iFrames: number; // invulnerability timer in seconds
  isAttacking: boolean;
  attackTimer: number; // remaining attack duration
  attackCooldown: number;
  isBlinking: boolean;
  isMoving: boolean;
  walkCycle: number;
}

export type EnemyType = 'slime_green' | 'slime_red' | 'boss_gorgoth';

export interface EnemyState {
  id: string;
  type: EnemyType;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  state: 'idle' | 'chase' | 'charge' | 'hurt' | 'dead';
  facingAngle: number;
  hitstunTimer: number;
  hitFlashTimer: number;
  attackCooldown: number;
  chargeTimer?: number;
  chargeDirection?: Vector2D;
  hopCycle: number;
  isDead: boolean;
  respawnTimer: number;
  spawnX: number;
  spawnZ: number;
  mapId: MapId;
  poiseTimer?: number;
  rangedCooldown?: number;
  castTimer?: number;
  steeringBias?: number;
  chaseTimer?: number;
}

export interface ProjectileState {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  source: 'boss' | 'player' | 'enemy';
  color?: string;
  mapId: MapId;
}

export type BreakableType = 'grass' | 'pot';

export interface BreakableState {
  id: string;
  type: BreakableType;
  x: number;
  z: number;
  radius: number;
  isBroken: boolean;
  mapId: MapId;
}

export type PickupType = 'rupee' | 'heart' | 'key';

export interface PickupState {
  id: string;
  type: PickupType;
  x: number;
  z: number;
  value: number;
  bobOffset: number;
  collected: boolean;
  magnetActive: boolean;
  mapId: MapId;
}

export interface ParticleState {
  id: string;
  type: 'spark' | 'leaf' | 'shard' | 'poof' | 'stomp_ring' | 'heart_heal';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface QuestState {
  hasDungeonKey: boolean;
  dungeonGateOpen: boolean;
  gateOpenProgress: number; // 0 (closed) to 1 (fully open)
  bossDefeated: boolean;
  chestSpawned: boolean;
  chestOpened: boolean;
  chestOpenProgress: number; // 0 to 1
}

export interface GameStats {
  rupees: number;
  enemiesDefeated: number;
  grassCut: number;
  potsBroken: number;
  startTime: number;
  completionTime: number; // in seconds
}

export interface BannerInfo {
  title: string;
  message: string;
  icon?: 'key' | 'chest' | 'sword' | 'heart';
  duration: number; // seconds
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  interact: boolean;
}
