export const TILE_SIZE = 1.0;

// Screen dimensions in tiles
export const SCREEN_WIDTH_TILES = 16;
export const SCREEN_HEIGHT_TILES = 12;

// Overworld grid (3 columns x 2 rows of screens)
export const OVERWORLD_COLS = 3;
export const OVERWORLD_ROWS = 2;
export const OVERWORLD_WIDTH_TILES = SCREEN_WIDTH_TILES * OVERWORLD_COLS; // 48
export const OVERWORLD_HEIGHT_TILES = SCREEN_HEIGHT_TILES * OVERWORLD_ROWS; // 24

// Dungeon dimensions in tiles
export const DUNGEON_WIDTH_TILES = 20;
export const DUNGEON_HEIGHT_TILES = 24;

// Area names by screen coordinate [col][row] (where row 0 is south, row 1 is north)
export const OVERWORLD_AREAS: Record<string, string> = {
  '0,0': 'Whispering Glade',
  '1,0': 'Sunlit Meadow',
  '2,0': 'River Crossing',
  '0,1': 'Skull Crag',
  '1,1': 'Briar Hollow',
  '2,1': 'Mountain Arch (Dungeon Entrance)',
};

export const DUNGEON_AREAS = {
  antechamber: 'Sanctum Antechamber',
  bossRoom: 'Sanctum of the Bramble King',
};

// Player physics
export const PLAYER_SPEED = 5.2; // units per second
export const PLAYER_ACCEL = 34.0; // units per second^2
export const PLAYER_FRICTION = 28.0; // units per second^2
export const PLAYER_RADIUS = 0.36; // collision radius
export const PLAYER_MAX_HEALTH = 6; // 6 HP = 3 full hearts (2 HP per heart)
export const PLAYER_IFRAMES_DURATION = 1.1; // seconds of invulnerability after damage
export const PLAYER_ATTACK_DURATION = 0.22; // sword swing arc animation duration
export const PLAYER_ATTACK_COOLDOWN = 0.32; // minimum delay between swings
export const SWORD_RANGE = 1.05; // attack reach
export const SWORD_ARC_ANGLE = Math.PI * 0.75; // 135-degree sweep
export const SWORD_DAMAGE = 1;

// Spawn safe zone (Whispering Glade around (7.5, 6))
export const SPAWN_POSITION = { x: 7.5, z: 6.0 };
export const SPAWN_SAFE_RADIUS = 5.5; // No enemies can enter or aggro in this radius

// Dungeon Entrance in Overworld (in screen 2, 1)
export const DUNGEON_ENTRANCE_POS = { x: 41.5, z: 20.0 };
// Dungeon Spawn Position (inside antechamber)
export const DUNGEON_SPAWN_POS = { x: 10.0, z: 3.5 };
// Dungeon Exit Door Position (back to overworld)
export const DUNGEON_EXIT_POS = { x: 10.0, z: 1.5 };
// Dungeon Gate Position (between antechamber and boss chamber)
export const DUNGEON_GATE_POS = { x: 10.0, z: 11.5 };
export const DUNGEON_BOSS_SPAWN_POS = { x: 10.0, z: 18.0 };
export const DUNGEON_KEY_POS = { x: 10.0, z: 6.5 };
export const DUNGEON_CHEST_POS = { x: 10.0, z: 18.5 };

// Enemy parameters
export const ENEMY_SETTINGS = {
  slime_green: {
    hp: 2,
    speed: 2.2,
    radius: 0.42,
    damage: 1, // 1/2 heart
    aggroRadius: 5.2,
    leashRadius: 14.0, // Long chase distance before mob drops pursuit
    pursuitDuration: 4.5, // Seconds of persistence when losing sight/distance
    knockbackForce: 7.5,
  },
  slime_red: {
    hp: 3,
    speed: 2.7,
    radius: 0.45,
    damage: 1,
    aggroRadius: 6.0,
    leashRadius: 16.0,
    pursuitDuration: 5.0,
    knockbackForce: 6.5,
  },
  boss_gorgoth: {
    hp: 10,
    speed: 3.1,
    radius: 1.1,
    damage: 2, // 1 full heart contact damage
    aggroRadius: 16.0,
    leashRadius: 24.0,
    pursuitDuration: 99.0, // Relentless in boss sanctum
    knockbackForce: 0.4, // Heavy boss - minimal flinch, no stunlock
    poiseDuration: 0.9, // Seconds of hyper-armor where attacks cannot interrupt or push boss
    projectileSpeed: 6.0, // Units per second for bramble thorn
    projectileDamage: 1, // 1/2 heart damage (fair & dodgeable for first boss)
    projectileRadius: 0.28,
    projectileCooldown: 3.8,
    projectileWindup: 0.4,
  },
};

// Fixed simulation timestep (60 Hz)
export const FIXED_TIMESTEP = 1 / 60; // ~0.016667 seconds
export const MAX_SIMULATION_SUBSTEPS = 5; // prevent spiral of death on lag spikes

// Magnet radius for rupees and hearts
export const PICKUP_MAGNET_RADIUS = 3.2;
export const PICKUP_COLLECT_RADIUS = 1.25;
export const PICKUP_MAGNET_SPEED = 9.0;

// Camera configuration
export const CAMERA_OFFSET = {
  y: 13.5, // height above player
  z: -9.5, // distance behind player (towards -Z)
};
export const CAMERA_LERP_SPEED = 0.12;
export const CAMERA_TILT_RAD = 0.98; // ~56 degrees downward tilt
