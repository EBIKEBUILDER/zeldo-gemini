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

async function verifyRedSlime() {
  console.log('============================================================');
  console.log('VERIFYING RED SLIME EXTRACTION (IDENTICAL BEHAVIOR SUITE)');
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
  // Place player at SPAWN_POSITION in Whispering Glade
  // Place red slime at distance 3.5 (inside aggroRadius 6.0)
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
            type: 'slime_red',
            mapId: 'overworld',
            x: SPAWN_POSITION.x + 3.5,
            z: SPAWN_POSITION.z,
            spawnX: SPAWN_POSITION.x + 3.5,
            spawnZ: SPAWN_POSITION.z,
            state: 'idle',
            chaseTimer: 0,
            isDead: false,
          }
        : e
    ),
  }));

  for (let i = 0; i < 10; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const slimeTest1 = useGameStore.getState().enemies[0];
  assert(slimeTest1.state === 'idle', 'Red slime remains IDLE when player is in spawn safe zone');

  // --------------------------------------------------------------------------
  // TEST 2: AGGRO RANGE & SPEED (RED SLIME SPECIFIC: aggroRadius 6.0, speed 2.7)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Aggro Range & Speed Verification ---');
  // Place player in Sunlit Meadow (20.0, 6.0)
  // Place Red Slime at distance 5.6 (beyond green slime 5.2 aggro, but within red slime 6.0 aggro)
  const slimeSpawnX = 20.0;
  const slimeSpawnZ = 11.6; // distance is 5.6
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
            type: 'slime_red',
            mapId: 'overworld',
            speed: ENEMY_SETTINGS.slime_red.speed,
            radius: ENEMY_SETTINGS.slime_red.radius,
            hp: ENEMY_SETTINGS.slime_red.hp,
            maxHp: ENEMY_SETTINGS.slime_red.hp,
            damage: ENEMY_SETTINGS.slime_red.damage,
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
  assert(slimeTest2.state === 'chase', `Red slime aggros at distance 5.6 (within 6.0 aggro radius)`);
  assert(slimeTest2.chaseTimer! > 4.5, `Chase timer initialized to red slime pursuit duration (got ${slimeTest2.chaseTimer})`);

  // --------------------------------------------------------------------------
  // TEST 3: CONTACT DAMAGE, KNOCKBACK & RECOIL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Contact Damage, Knockback & Recoil ---');
  // Place red slime touching player: player at (20.0, 6.0), slime at (20.0, 6.5)
  // dist = 0.5 < radius(0.45) + player_radius(0.36) = 0.81
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
            type: 'slime_red',
            mapId: 'overworld',
            x: 20.0,
            z: 6.5,
            state: 'chase',
            attackCooldown: 0,
            hitstunTimer: 0,
            isDead: false,
          }
        : e
    ),
  }));

  gameLoop.fixedUpdate(DT);

  const stateAfterHit = useGameStore.getState();
  const playerAfterHit = stateAfterHit.player;
  const slimeAfterHit = stateAfterHit.enemies[0];

  assert(playerAfterHit.health === 5, `Player took exactly 1 damage (health 6 -> ${playerAfterHit.health})`);
  assert(playerAfterHit.iFrames > 1.0, `Player granted invulnerability frames (iFrames: ${playerAfterHit.iFrames})`);
  assert(playerAfterHit.vz < -1.0, `Player knocked away from red slime (player vz: ${playerAfterHit.vz})`);
  assert(slimeAfterHit.attackCooldown > 0.6, `Red slime attack cooldown set to 0.8s (got ${slimeAfterHit.attackCooldown})`);
  assert(slimeAfterHit.hitstunTimer > 0.1, `Red slime recoiled after hit (hitstunTimer: ${slimeAfterHit.hitstunTimer})`);
  assert(slimeAfterHit.vz > 0.5, `Red slime pushed backward in recoil (slime vz: ${slimeAfterHit.vz})`);

  // --------------------------------------------------------------------------
  // TEST 4: LEASHING & RETURN TO SPAWN (RED SLIME SPECIFIC: leashRadius 16.0)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Leashing & Return to Spawn ---');
  // Red slime leash radius is 16.0. Place player at distance 18.0 (beyond leash radius)
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 20.0,
      z: 38.0, // 18 units away from mob at z=20.0
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_red',
            mapId: 'overworld',
            x: 20.0,
            z: 20.0,
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
  assert(slimeTest4.state === 'returning', `Red slime drops pursuit and enters 'returning' state (got ${slimeTest4.state})`);

  // Move red slime within 0.5 distance of spawn
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
            hitstunTimer: 0,
          }
        : e
    ),
  }));

  gameLoop.fixedUpdate(DT);
  const slimeAtSpawn = useGameStore.getState().enemies[0];
  assert(slimeAtSpawn.state === 'idle', `Red slime at spawn transitions back to 'idle' (got ${slimeAtSpawn.state})`);
  assert(slimeAtSpawn.x === 20.0 && slimeAtSpawn.z === 5.0, `Red slime resets position precisely to spawn coordinates`);

  // --------------------------------------------------------------------------
  // TEST 5: DEAD STATE & RESPAWN TIMING WITH 3 HP
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Respawn Timer & 3 HP Restoration ---');
  useGameStore.setState((prev) => ({
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            type: 'slime_red',
            mapId: 'overworld',
            isDead: true,
            respawnTimer: 0.1,
            hp: 0,
            maxHp: 3, // Red slime has 3 HP
            spawnX: 15.0,
            spawnZ: 10.0,
            x: 50.0,
            z: 50.0,
          }
        : e
    ),
  }));

  for (let i = 0; i < 10; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const respawnedSlime = useGameStore.getState().enemies[0];
  assert(!respawnedSlime.isDead, `Dead red slime resurrected when respawn timer expired`);
  assert(respawnedSlime.hp === 3, `Resurrected red slime restored to max HP of 3 (got ${respawnedSlime.hp})`);
  assert(Math.hypot(respawnedSlime.x - 15.0, respawnedSlime.z - 10.0) < 0.1, `Resurrected red slime restored to spawn coordinates`);

  console.log('\n============================================================');
  console.log('🎉 ALL RED SLIME EXTRACTION VERIFICATION TESTS PASSED!');
  console.log('============================================================');
}

verifyRedSlime().catch((err) => {
  console.error(err);
  process.exit(1);
});
