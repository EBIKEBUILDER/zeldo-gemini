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

export interface NavPortal {
  id: string;
  name?: string;
  fromChunk: string; // e.g. 'overworld' or 'overworld:2,1'
  fromTile: Vector2D;
  toChunk: string;   // e.g. 'dungeon' or 'dungeon:0,0'
  toTile: Vector2D;
  cost: number;
  traversableByAI: boolean; // false for dungeon mouths (classic Zelda leashing), true where chase continues
  bidirectional?: boolean;
}

export interface PathWaypoint extends Vector2D {
  mapId?: MapId;
  chunkId?: string;
  isPortalTransition?: boolean;
  portalId?: string;
}

export type PathStatus = 'complete' | 'partial' | 'unreachable';

export interface PathResult {
  waypoints: PathWaypoint[];
  status: PathStatus;
  targetReached: boolean;
  totalCost: number;
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
  isRolling?: boolean;
  rollTimer?: number;
  rollCooldown?: number;
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
  state: 'idle' | 'chase' | 'charge' | 'hurt' | 'dead' | 'returning';
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
  spawnMapId?: MapId;
  poiseTimer?: number;
  rangedCooldown?: number;
  castTimer?: number;
  steeringBias?: number;
  chaseTimer?: number;
  stuckTimer?: number;
  stuckSampleTimer?: number;
  lastSamplePos?: Vector2D;
  pathWaypoints?: Vector2D[];
  aStarPath?: Vector2D[];
  pathUpdateTimer?: number;
  pathPending?: boolean;
  pathStatus?: PathStatus;
  steeringBiasTimer?: number;
  fallbackPacingTimer?: number;
  fallbackPacingDir?: number;
  bossAction?:
    | 'none'
    | 'telegraphing_ricochet'
    | 'telegraphing_eruption'
    | 'spore_burst'
    | 'telegraphing_lunge'
    | 'lunging'
    | 'lunge_recovery'
    | 'telegraphing_ranged';
  bossAttackType?: 'ricochet_volley' | 'ground_eruption' | 'spore_burst' | 'lunge' | 'spore_bomb';
  bossTelegraphTimer?: number;
  bossTelegraphMax?: number;
  bossTelegraphTarget?: Vector2D;
  lungeTimer?: number;
  lungeCooldown?: number;
  lungeRecoveryTimer?: number;
  lungeDirection?: Vector2D;
  lungeDistance?: number;
  lungeTarget?: Vector2D;
}

export interface GroundHazardState {
  id: string;
  type: 'briar_eruption' | 'toxic_patch';
  x: number;
  z: number;
  radius: number;
  timer: number;
  maxTimer: number;
  duration: number;
  erupted: boolean;
  damage: number;
  mapId: MapId;
}

export interface ProjectileState {
  id: string;
  type?: 'thorn' | 'spore_bomb';
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
  bounces?: number;
  maxBounces?: number;
  targetX?: number;
  targetZ?: number;
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

export interface ContextAction {
  type: 'none' | 'attack' | 'open_chest' | 'unlock_gate' | 'enter_dungeon' | 'exit_dungeon' | 'roll' | 'take_key';
  label: string;
  icon: 'sword' | 'chest' | 'key' | 'door' | 'roll';
}

