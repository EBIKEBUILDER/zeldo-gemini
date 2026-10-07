import {
  TileType,
  TileData,
  EnemyState,
  BreakableState,
  PickupState,
  Vector2D,
} from '@/types/game';
import {
  OVERWORLD_WIDTH_TILES,
  OVERWORLD_HEIGHT_TILES,
  DUNGEON_WIDTH_TILES,
  DUNGEON_HEIGHT_TILES,
  DUNGEON_KEY_POS,
  DUNGEON_BOSS_SPAWN_POS,
  ENEMY_SETTINGS,
} from './constants';

export interface WorldProp {
  id: string;
  type: 'tree' | 'rock' | 'house' | 'well' | 'pillar' | 'torch' | 'archway' | 'pedestal' | 'chest';
  x: number;
  z: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotationY?: number;
  radius: number; // collision radius (0 if non-colliding like wall torch)
}

export interface MapData {
  width: number;
  height: number;
  tiles: TileData[][]; // [x][z]
  props: WorldProp[];
  initialEnemies: EnemyState[];
  initialBreakables: BreakableState[];
  initialPickups: PickupState[];
}

// Generate Overworld Map
export function generateOverworld(): MapData {
  const width = OVERWORLD_WIDTH_TILES; // 48
  const height = OVERWORLD_HEIGHT_TILES; // 24

  // Initialize 2D tiles array [x][z]
  const tiles: TileData[][] = [];
  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    for (let z = 0; z < height; z++) {
      tiles[x][z] = { type: 'grass', solid: false };
    }
  }

  // 1. Boundary walls (hedges / cliffs on edges)
  for (let x = 0; x < width; x++) {
    tiles[x][0] = { type: 'hedge', solid: true };
    tiles[x][height - 1] = { type: 'hedge', solid: true };
  }
  for (let z = 0; z < height; z++) {
    tiles[0][z] = { type: 'hedge', solid: true };
    tiles[width - 1][z] = { type: 'hedge', solid: true };
  }

  // 2. Mountain Cliff along the North-East screen (Screen 2,1: x from 32 to 47, z from 18 to 23)
  for (let x = 32; x < width - 1; x++) {
    for (let z = 19; z < height - 1; z++) {
      tiles[x][z] = { type: 'dungeon_wall', solid: true };
    }
  }
  // Carve doorway into cliff at (41, 19)
  tiles[41][19] = { type: 'doorway', solid: false };
  tiles[42][19] = { type: 'doorway', solid: false };

  // 3. Dirt Paths connecting areas
  // Path from spawn in Glade (8, 6) eastward across Sunlit Meadow to River Bridge
  for (let x = 6; x < 35; x++) {
    for (let z = 5; z <= 6; z++) {
      tiles[x][z] = { type: 'dirt', solid: false };
    }
  }
  // North branch from Sunlit Meadow (20, 6) through Briar Hollow to Mountain Arch
  for (let z = 6; z < 16; z++) {
    tiles[20][z] = { type: 'dirt', solid: false };
    tiles[21][z] = { type: 'dirt', solid: false };
  }
  for (let x = 20; x < 42; x++) {
    tiles[x][16] = { type: 'dirt', solid: false };
    tiles[x][17] = { type: 'dirt', solid: false };
  }
  // Path up to dungeon door
  for (let z = 16; z <= 19; z++) {
    tiles[41][z] = { type: 'dirt', solid: false };
    tiles[42][z] = { type: 'dirt', solid: false };
  }
  // West path from Glade north to Skull Crag
  for (let z = 6; z < 18; z++) {
    tiles[7][z] = { type: 'dirt', solid: false };
    tiles[8][z] = { type: 'dirt', solid: false };
  }

  // 4. River Channel running in Screen (2, 0)
  // River x: 36 to 38, z: 1 to 14
  for (let z = 1; z < 14; z++) {
    for (let x = 36; x <= 38; x++) {
      tiles[x][z] = { type: 'water', solid: true, water: true };
    }
  }
  // Wooden Bridge crossing the river at z: 5 to 6
  for (let z = 5; z <= 6; z++) {
    for (let x = 36; x <= 38; x++) {
      tiles[x][z] = { type: 'bridge', solid: false };
    }
  }

  // 5. Flower patches
  const flowerCoords: [number, number][] = [
    [5, 4], [6, 4], [9, 8], [10, 8], [11, 7],
    [17, 3], [18, 3], [22, 4], [23, 4], [25, 8],
    [12, 16], [13, 16], [14, 17],
  ];
  flowerCoords.forEach(([fx, fz]) => {
    if (fx < width && fz < height && !tiles[fx][fz].solid) {
      tiles[fx][fz] = { type: 'flower', solid: false };
    }
  });

  // 6. Briar Hollow hedges / maze barriers (Screen 1, 1: x from 16 to 31, z from 12 to 23)
  for (let x = 24; x <= 30; x++) {
    tiles[x][14] = { type: 'hedge', solid: true };
  }
  for (let z = 14; z <= 20; z++) {
    tiles[30][z] = { type: 'hedge', solid: true };
  }
  for (let x = 17; x <= 22; x++) {
    tiles[x][19] = { type: 'hedge', solid: true };
  }

  // Props (Trees, Rocks, Cozy Cottage, Well, Dungeon Arch)
  const props: WorldProp[] = [];

  // Spawn Cottage in Whispering Glade (safe aesthetic landmark)
  props.push({
    id: 'cottage_spawn',
    type: 'house',
    x: 4.5,
    z: 9.0,
    scaleX: 2.2,
    scaleY: 2.0,
    scaleZ: 2.2,
    radius: 1.4,
  });

  // Cozy stone well near cottage
  props.push({
    id: 'well_glade',
    type: 'well',
    x: 9.5,
    z: 9.5,
    radius: 0.8,
  });

  // Mountain Dungeon Archway at (41.5, 19.0)
  props.push({
    id: 'dungeon_archway',
    type: 'archway',
    x: 41.5,
    z: 19.0,
    rotationY: 0,
    radius: 0, // non-colliding trigger doorway
  });

  // Trees around overworld perimeter and groves
  const treePositions: [number, number, number][] = [
    // Whispering Glade grove borders
    [2.5, 3.5, 1.1], [3.2, 5.0, 0.9], [2.0, 11.0, 1.2], [7.0, 11.5, 1.0],
    [13.5, 11.0, 1.15], [14.0, 3.0, 0.95], [14.5, 8.5, 1.05],
    // Sunlit Meadow trees
    [18.0, 9.5, 1.2], [26.0, 3.5, 1.0], [28.5, 9.0, 1.1], [32.0, 2.5, 0.9],
    // Riverbank trees
    [34.5, 11.0, 1.1], [40.5, 3.5, 1.0], [44.0, 9.5, 1.2], [45.5, 4.0, 0.95],
    // Skull Crag gloomy trees
    [3.0, 16.0, 1.3], [4.5, 21.0, 1.1], [11.0, 21.5, 1.25], [14.5, 14.5, 0.9],
    // Briar Hollow trees
    [18.0, 21.0, 1.15], [26.0, 21.5, 1.2], [31.5, 18.0, 1.0],
    // Dungeon Mountain approach trees
    [35.0, 17.5, 1.1], [45.0, 17.0, 1.2], [46.5, 21.0, 1.0],
  ];

  treePositions.forEach(([tx, tz, scale], idx) => {
    props.push({
      id: `tree_${idx}`,
      type: 'tree',
      x: tx,
      z: tz,
      scaleX: scale,
      scaleY: scale * 1.1,
      scaleZ: scale,
      rotationY: (idx * 1.3) % (Math.PI * 2),
      radius: 0.65 * scale,
    });
  });

  // Rocks around crags, river, and clearings (irregular low poly)
  const rockPositions: [number, number, number, number, number][] = [
    // x, z, scaleX, scaleY, scaleZ
    [12.0, 2.0, 0.9, 0.7, 1.1],
    [15.0, 6.8, 0.7, 0.6, 0.8],
    [35.0, 8.0, 1.2, 0.8, 1.0],
    [39.5, 7.5, 1.0, 0.9, 1.1],
    [40.0, 12.0, 1.1, 0.8, 1.3],
    [2.5, 14.0, 1.4, 1.1, 1.2],
    [7.0, 19.5, 1.3, 0.9, 1.4],
    [12.5, 18.0, 1.0, 0.8, 1.1],
    [34.0, 20.0, 1.5, 1.2, 1.4],
    [44.5, 20.0, 1.6, 1.3, 1.5],
  ];

  rockPositions.forEach(([rx, rz, sx, sy, sz], idx) => {
    props.push({
      id: `rock_${idx}`,
      type: 'rock',
      x: rx,
      z: rz,
      scaleX: sx,
      scaleY: sy,
      scaleZ: sz,
      rotationY: (idx * 0.85) % (Math.PI * 2),
      radius: 0.6 * ((sx + sz) / 2),
    });
  });

  // Breakables (Grass tufts & Clay pots)
  const initialBreakables: BreakableState[] = [];

  // Cuttable grass tufts in glades and meadows
  const grassCoords: [number, number][] = [
    // Whispering Glade (safe grass to practice sword swing)
    [6.0, 7.5], [6.8, 7.8], [6.2, 8.4], [10.5, 7.5], [11.2, 7.2],
    // Sunlit Meadow
    [19.0, 4.5], [19.8, 4.8], [21.5, 8.0], [22.2, 8.3], [24.0, 6.0], [24.8, 6.2],
    [27.5, 5.0], [28.2, 5.3], [29.0, 7.5],
    // Skull Crag
    [5.0, 18.0], [5.8, 18.3], [9.5, 15.0], [10.2, 15.3],
    // Briar Hollow
    [19.0, 14.0], [19.8, 14.3], [25.0, 17.0], [25.8, 17.3], [27.0, 19.0],
  ];

  grassCoords.forEach(([gx, gz], idx) => {
    initialBreakables.push({
      id: `grass_${idx}`,
      type: 'grass',
      x: gx,
      z: gz,
      radius: 0.35,
      isBroken: false,
      mapId: 'overworld',
    });
  });

  // Clay pots with rupees / hearts
  const potCoords: [number, number][] = [
    // Near cottage
    [3.0, 7.5], [3.0, 8.5],
    // Sunlit Meadow island & corners
    [23.0, 2.5], [30.5, 3.5], [31.5, 3.5],
    // Riverbank east island
    [41.5, 7.0], [42.5, 7.0], [42.0, 8.0],
    // Skull Crag ancient spot
    [2.0, 19.0], [3.0, 19.0],
    // Near Dungeon Entrance
    [39.0, 18.0], [44.0, 18.0],
  ];

  potCoords.forEach(([px, pz], idx) => {
    initialBreakables.push({
      id: `pot_${idx}`,
      type: 'pot',
      x: px,
      z: pz,
      radius: 0.38,
      isBroken: false,
      mapId: 'overworld',
    });
  });

  // Enemies (Carefully positioned outside spawn safe zone)
  const initialEnemies: EnemyState[] = [];

  const enemySpawns: { type: 'slime_green' | 'slime_red'; x: number; z: number }[] = [
    // Sunlit Meadow (Screen 1, 0)
    { type: 'slime_green', x: 21.0, z: 4.0 },
    { type: 'slime_green', x: 27.0, z: 7.5 },
    // River Crossing (Screen 2, 0)
    { type: 'slime_green', x: 42.0, z: 5.5 },
    { type: 'slime_red', x: 43.5, z: 10.5 },
    // Skull Crag (Screen 0, 1)
    { type: 'slime_red', x: 8.5, z: 18.0 },
    { type: 'slime_green', x: 12.0, z: 15.5 },
    // Briar Hollow (Screen 1, 1)
    { type: 'slime_green', x: 22.0, z: 17.5 },
    { type: 'slime_red', x: 27.5, z: 16.5 },
    // Dungeon Approach (Screen 2, 1)
    { type: 'slime_red', x: 37.5, z: 16.5 },
  ];

  enemySpawns.forEach((spawn, idx) => {
    const settings = ENEMY_SETTINGS[spawn.type];
    initialEnemies.push({
      id: `overworld_enemy_${idx}`,
      type: spawn.type,
      x: spawn.x,
      z: spawn.z,
      vx: 0,
      vz: 0,
      radius: settings.radius,
      hp: settings.hp,
      maxHp: settings.hp,
      speed: settings.speed,
      damage: settings.damage,
      state: 'idle',
      facingAngle: Math.random() * Math.PI * 2,
      hitstunTimer: 0,
      hitFlashTimer: 0,
      attackCooldown: 0,
      hopCycle: Math.random() * Math.PI,
      isDead: false,
      respawnTimer: 0,
      spawnX: spawn.x,
      spawnZ: spawn.z,
      mapId: 'overworld',
    });
  });

  return {
    width,
    height,
    tiles,
    props,
    initialEnemies,
    initialBreakables,
    initialPickups: [],
  };
}

// Generate Dungeon Map (2-Room Stone Dungeon: Antechamber + Boss Chamber)
export function generateDungeon(): MapData {
  const width = DUNGEON_WIDTH_TILES; // 20
  const height = DUNGEON_HEIGHT_TILES; // 24

  const tiles: TileData[][] = [];
  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    for (let z = 0; z < height; z++) {
      tiles[x][z] = { type: 'dungeon_wall', solid: true };
    }
  }

  // Room 1: Sanctum Antechamber (x: 4 to 15, z: 2 to 11)
  for (let x = 4; x <= 15; x++) {
    for (let z = 2; z <= 11; z++) {
      tiles[x][z] = { type: 'stone_floor', solid: false };
    }
  }

  // Room 2: Boss Chamber (x: 3 to 16, z: 12 to 22)
  for (let x = 3; x <= 16; x++) {
    for (let z = 12; z <= 22; z++) {
      tiles[x][z] = { type: 'stone_floor', solid: false };
    }
  }

  // Doorway back to Overworld (Exit at bottom center)
  tiles[9][1] = { type: 'doorway', solid: false };
  tiles[10][1] = { type: 'doorway', solid: false };

  // Doorway / Gate portal between Room 1 and Room 2 at z = 11 to 12
  // We allow walking through once gate is open; the Gate prop mesh will handle physical blocking when closed.
  tiles[9][11] = { type: 'stone_floor', solid: false };
  tiles[10][11] = { type: 'stone_floor', solid: false };
  tiles[9][12] = { type: 'stone_floor', solid: false };
  tiles[10][12] = { type: 'stone_floor', solid: false };

  // Props (Pedestal for key, Stone Pillars, Wall Torches, Chest)
  const props: WorldProp[] = [];

  // Pedestal for the Dungeon Key in center of Antechamber
  props.push({
    id: 'key_pedestal',
    type: 'pedestal',
    x: DUNGEON_KEY_POS.x,
    z: DUNGEON_KEY_POS.z,
    radius: 0.6,
  });

  // Pillars in Boss Chamber for tactical cover
  const pillarCoords: [number, number][] = [
    [6.0, 15.0],
    [13.5, 15.0],
    [6.0, 19.5],
    [13.5, 19.5],
  ];
  pillarCoords.forEach(([px, pz], idx) => {
    props.push({
      id: `dungeon_pillar_${idx}`,
      type: 'pillar',
      x: px,
      z: pz,
      scaleX: 1.1,
      scaleY: 2.2,
      scaleZ: 1.1,
      radius: 0.65,
    });
  });

  // Wall Torches in Antechamber and Boss Chamber
  const torchCoords: [number, number][] = [
    [4.2, 5.0], [15.2, 5.0], [4.2, 9.0], [15.2, 9.0],
    [3.2, 14.0], [16.2, 14.0], [3.2, 20.0], [16.2, 20.0],
    [9.0, 22.2], [11.0, 22.2],
  ];
  torchCoords.forEach(([tx, tz], idx) => {
    props.push({
      id: `torch_${idx}`,
      type: 'torch',
      x: tx,
      z: tz,
      radius: 0, // non-colliding
    });
  });

  // The Golden Treasure Chest in the Boss Chamber
  props.push({
    id: 'treasure_chest',
    type: 'chest',
    x: DUNGEON_BOSS_SPAWN_POS.x,
    z: DUNGEON_BOSS_SPAWN_POS.z + 0.5,
    radius: 0.65,
  });

  // Breakables in Dungeon (Pots in corners)
  const initialBreakables: BreakableState[] = [
    { id: 'dungeon_pot_1', type: 'pot', x: 5.0, z: 3.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
    { id: 'dungeon_pot_2', type: 'pot', x: 14.0, z: 3.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
    { id: 'dungeon_pot_3', type: 'pot', x: 5.0, z: 10.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
    { id: 'dungeon_pot_4', type: 'pot', x: 14.0, z: 10.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
    // Boss room pots for mid-fight healing hearts
    { id: 'dungeon_pot_5', type: 'pot', x: 4.0, z: 13.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
    { id: 'dungeon_pot_6', type: 'pot', x: 15.0, z: 13.0, radius: 0.38, isBroken: false, mapId: 'dungeon' },
  ];

  // Pickups: The Dungeon Key resting on the Pedestal
  const initialPickups: PickupState[] = [
    {
      id: 'dungeon_key',
      type: 'key',
      x: DUNGEON_KEY_POS.x,
      z: DUNGEON_KEY_POS.z,
      value: 1,
      bobOffset: 0,
      collected: false,
      magnetActive: false,
      mapId: 'dungeon',
    },
  ];

  // Enemies: 2 Antechamber Guardian Slimes + Boss Gorgoth in Boss Chamber
  const initialEnemies: EnemyState[] = [];

  // Antechamber guardians
  const guardianSpawns: [number, number][] = [
    [7.5, 8.5],
    [12.0, 8.5],
  ];
  guardianSpawns.forEach(([gx, gz], idx) => {
    const s = ENEMY_SETTINGS.slime_red;
    initialEnemies.push({
      id: `dungeon_guardian_${idx}`,
      type: 'slime_red',
      x: gx,
      z: gz,
      vx: 0,
      vz: 0,
      radius: s.radius,
      hp: s.hp,
      maxHp: s.hp,
      speed: s.speed,
      damage: s.damage,
      state: 'idle',
      facingAngle: Math.PI,
      hitstunTimer: 0,
      hitFlashTimer: 0,
      attackCooldown: 0,
      hopCycle: Math.random() * Math.PI,
      isDead: false,
      respawnTimer: 0,
      spawnX: gx,
      spawnZ: gz,
      mapId: 'dungeon',
    });
  });

  // The Boss: Gorgoth the Bramble King!
  const bossSettings = ENEMY_SETTINGS.boss_gorgoth;
  initialEnemies.push({
    id: 'boss_gorgoth',
    type: 'boss_gorgoth',
    x: DUNGEON_BOSS_SPAWN_POS.x,
    z: DUNGEON_BOSS_SPAWN_POS.z,
    vx: 0,
    vz: 0,
    radius: bossSettings.radius,
    hp: bossSettings.hp,
    maxHp: bossSettings.hp,
    speed: bossSettings.speed,
    damage: bossSettings.damage,
    state: 'idle',
    facingAngle: Math.PI,
    hitstunTimer: 0,
    hitFlashTimer: 0,
    attackCooldown: 0,
    hopCycle: 0,
    isDead: false,
    respawnTimer: 0,
    spawnX: DUNGEON_BOSS_SPAWN_POS.x,
    spawnZ: DUNGEON_BOSS_SPAWN_POS.z,
    mapId: 'dungeon',
  });

  return {
    width,
    height,
    tiles,
    props,
    initialEnemies,
    initialBreakables,
    initialPickups,
  };
}
