import { gameLoop } from '../src/game/engine/gameLoop';
import { useGameStore } from '../src/game/state/gameStore';
import { defaultNavGrid } from '../src/game/engine/pathfinding';
import { ENEMY_SETTINGS, SPAWN_POSITION, SPAWN_SAFE_RADIUS } from '../src/game/constants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function verifyGreenSlime() {
  console.log('============================================================');
  console.log('VERIFYING GREEN SLIME EXTRACTION (IDENTICAL BEHAVIOR SUITE)');
  console.log('============================================================\n');

  const store = useGameStore.getState();
  store.startGame();
  defaultNavGrid.build(
    useGameStore.getState().overworldMap,
    useGameStore.getState().dungeonMap,
    false,
    useGameStore.getState().breakables
  );

  const DT = 1 / 60; // 60Hz tick

  // --------------------------------------------------------------------------
  // TEST 1: SAFE ZONE AGGRO SUPPRESSION
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Safe Zone Aggro Suppression ---');
  // Place player right at SPAWN_POSITION inside Whispering Glade
  // Place green slime at distance 3.0 (inside aggroRadius 5.2)
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: SPAWN_POSITION.x,
      z: SPAWN_POSITION.z,
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_green',
            mapId: 'overworld',
            x: SPAWN_POSITION.x + 3.0,
            z: SPAWN_POSITION.z,
            spawnX: SPAWN_POSITION.x + 3.0,
            spawnZ: SPAWN_POSITION.z,
            state: 'idle',
            chaseTimer: 0,
            isDead: false,
          }
        : e
    ),
  }));

  // Run 10 ticks
  for (let i = 0; i < 10; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const slimeTest1 = useGameStore.getState().enemies[0];
  assert(slimeTest1.state === 'idle', 'Green slime remains IDLE when player is in spawn safe zone');

  // --------------------------------------------------------------------------
  // TEST 2: AGGRO & PURSUIT IN OPEN WORLD
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Aggro & Pursuit Outside Safe Zone ---');
  // Move player outside safe zone: Sunlit Meadow (20.0, 6.0)
  // Slime at (20.0, 9.5) -> distance 3.5 (inside aggroRadius 5.2)
  const slimeSpawnX = 20.0;
  const slimeSpawnZ = 9.5;
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 20.0,
      z: 6.0,
      health: 6,
      iFrames: 0,
      vx: 0,
      vz: 0,
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_green',
            mapId: 'overworld',
            x: slimeSpawnX,
            z: slimeSpawnZ,
            spawnX: slimeSpawnX,
            spawnZ: slimeSpawnZ,
            state: 'idle',
            chaseTimer: 0,
            isDead: false,
          }
        : e
    ),
  }));

  // Tick 5 frames
  for (let i = 0; i < 5; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const slimeTest2 = useGameStore.getState().enemies[0];
  assert(slimeTest2.state === 'chase', `Green slime enters 'chase' state on player proximity (got ${slimeTest2.state})`);
  assert(slimeTest2.chaseTimer! > 4.0, `Chase timer initialized to persistence duration (got ${slimeTest2.chaseTimer})`);

  // --------------------------------------------------------------------------
  // TEST 3: CONTACT DAMAGE, KNOCKBACK & ATTACK RECOIL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Contact Damage, Knockback & Recoil ---');
  // Place green slime touching player: player at (20.0, 6.0), slime at (20.0, 6.5)
  // dist = 0.5 < radius(0.42) + player_radius(0.36) = 0.78
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 20.0,
      z: 6.0,
      health: 6,
      iFrames: 0,
      vx: 0,
      vz: 0,
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_green',
            mapId: 'overworld',
            x: 20.0,
            z: 6.5,
            state: 'chase',
            attackCooldown: 0,
            isDead: false,
          }
        : e
    ),
  }));

  // Tick 1 frame
  gameLoop.fixedUpdate(DT);

  const stateAfterHit = useGameStore.getState();
  const playerAfterHit = stateAfterHit.player;
  const slimeAfterHit = stateAfterHit.enemies[0];

  assert(playerAfterHit.health === 5, `Player took exactly 1 damage (health 6 -> ${playerAfterHit.health})`);
  assert(playerAfterHit.iFrames > 1.0, `Player granted invulnerability frames (iFrames: ${playerAfterHit.iFrames})`);
  assert(playerAfterHit.vz < -1.0, `Player knocked away from slime (player vz: ${playerAfterHit.vz})`);
  assert(slimeAfterHit.attackCooldown > 0.6, `Slime attack cooldown set to 0.8s (got ${slimeAfterHit.attackCooldown})`);
  assert(slimeAfterHit.hitstunTimer > 0.1, `Slime recoiled after hit (hitstunTimer: ${slimeAfterHit.hitstunTimer})`);
  assert(slimeAfterHit.vz > 0.5, `Slime pushed backward in recoil (slime vz: ${slimeAfterHit.vz})`);

  // --------------------------------------------------------------------------
  // TEST 4: LEASHING & RETURN TO SPAWN ON RETREAT
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Leashing & Return to Spawn ---');
  // Player teleports far away (> leashRadius 14.0)
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 20.0,
      z: 35.0, // 25+ units away
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_green',
            mapId: 'overworld',
            x: 20.0,
            z: 10.0,
            spawnX: 20.0,
            spawnZ: 5.0,
            state: 'chase',
            chaseTimer: 0.01,
            hitstunTimer: 0,
            hitFlashTimer: 0,
          }
        : e
    ),
  }));

  // Tick 2 frames to drop pursuit
  gameLoop.fixedUpdate(DT);
  gameLoop.fixedUpdate(DT);

  const slimeTest4 = useGameStore.getState().enemies[0];
  assert(slimeTest4.state === 'returning', `Slime drops pursuit and enters 'returning' state (got ${slimeTest4.state})`);

  // Teleport slime right next to spawn (dist 0.3 <= 0.6)
  useGameStore.setState((prev) => ({
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            x: 20.0,
            z: 5.3,
            spawnX: 20.0,
            spawnZ: 5.0,
            state: 'returning',
          }
        : e
    ),
  }));

  gameLoop.fixedUpdate(DT);
  const slimeAtSpawn = useGameStore.getState().enemies[0];
  assert(slimeAtSpawn.state === 'idle', `Slime at spawn transitions back to 'idle' (got ${slimeAtSpawn.state})`);
  assert(slimeAtSpawn.x === 20.0 && slimeAtSpawn.z === 5.0, `Slime resets position precisely to spawn coordinates`);

  // --------------------------------------------------------------------------
  // TEST 5: DEAD STATE & RESPAWN TIMING
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Respawn Timer & Resurrection ---');
  useGameStore.setState((prev) => ({
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_green',
            mapId: 'overworld',
            isDead: true,
            respawnTimer: 0.1, // 0.1 seconds remaining
            hp: 0,
            maxHp: 2,
            spawnX: 12.0,
            spawnZ: 14.0,
            x: 50.0,
            z: 50.0,
          }
        : e
    ),
  }));

  // Tick for 0.15 seconds (10 ticks)
  for (let i = 0; i < 10; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const respawnedSlime = useGameStore.getState().enemies[0];
  assert(!respawnedSlime.isDead, `Dead slime resurrected when respawn timer expired`);
  assert(Math.hypot(respawnedSlime.x - 12.0, respawnedSlime.z - 14.0) < 0.1, `Resurrected slime restored to spawn coordinates (at ${respawnedSlime.x.toFixed(2)}, ${respawnedSlime.z.toFixed(2)})`);

  console.log('\n============================================================');
  console.log('🎉 ALL GREEN SLIME EXTRACTION VERIFICATION TESTS PASSED!');
  console.log('============================================================');
}

verifyGreenSlime().catch((err) => {
  console.error(err);
  process.exit(1);
});
