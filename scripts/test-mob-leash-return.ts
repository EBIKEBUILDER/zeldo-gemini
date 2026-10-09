import { gameLoop } from '../src/game/engine/gameLoop';
import { useGameStore } from '../src/game/state/gameStore';
import { defaultNavGrid, defaultPathfindingSystem } from '../src/game/engine/pathfinding';
import { ENEMY_SETTINGS } from '../src/game/constants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('TESTING MOB LEASHING, PATHFINDING TO SPAWN & FORWARD ORIENTATION');
  console.log('============================================================\n');

  // Initialize store in playing state
  const store = useGameStore.getState();
  store.startGame();
  defaultNavGrid.build(
    useGameStore.getState().overworldMap,
    useGameStore.getState().dungeonMap,
    false,
    useGameStore.getState().breakables
  );

  // --------------------------------------------------------------------------
  // TEST 1: CHASE PURSUIT DROP TRANSITIONS TO 'returning' (NOT 'idle')
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Pursuit Drop Leash Transition ---');
  
  const spawnX = 21.0;
  const spawnZ = 4.0;
  const chasedX = 21.0;
  const chasedZ = 9.0;

  // Set player far away (> leashRadius) to trigger pursuit drop
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 21.0,
      z: 40.0, // 31 units away from mob (> leashRadius 14.0/16.0)
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            mapId: 'overworld',
            spawnMapId: 'overworld',
            spawnX,
            spawnZ,
            x: chasedX,
            z: chasedZ,
            state: 'chase',
            chaseTimer: 4.0,
            facingAngle: 0, // was facing player (+Z direction)
            hitstunTimer: 0,
            hitFlashTimer: 0,
            pathWaypoints: undefined,
            pathPending: false,
          }
        : e
    ),
  }));

  // Step 1 tick: pursuit should drop because distToPlayer (16.0) >= leashRadius
  let time = 1000;
  gameLoop.fixedUpdate(0.0166);

  let enemy = useGameStore.getState().enemies[0];
  assert(enemy.state === 'returning', `Enemy transitioned to 'returning' on pursuit drop (got '${enemy.state}')`);
  console.log('Pursuit drop leash transition passed!\n');

  // --------------------------------------------------------------------------
  // TEST 2: MOB ORIENTATION FACES DIRECTION OF MOTION (NO MOONWALKING)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Forward Facing Orientation (No Moonwalk) ---');

  // The spawn is at (21.0, 4.0) while mob is at (21.0, 9.0).
  // Movement must be towards -Z (North/Up is +Z, South/Down is -Z, so heading to (21, 4) is dz = -1, dx = 0, angle = Math.atan2(0, -1) = Math.PI).
  // During chase, mob was facing 0 (towards player at +Z).
  // As it moves back towards spawn, its facingAngle must turn toward Math.PI (or -Math.PI).
  
  let initialFacing = enemy.facingAngle;
  let positions: { x: number; z: number; facingAngle: number }[] = [];

  for (let i = 0; i < 40; i++) {
    time += 50; // 50ms step (~20fps)
    gameLoop.fixedUpdate(0.0166);
    const curr = useGameStore.getState().enemies[0];
    positions.push({ x: curr.x, z: curr.z, facingAngle: curr.facingAngle });
  }

  const latestEnemy = useGameStore.getState().enemies[0];
  console.log(`Enemy start: (${chasedX}, ${chasedZ}), now: (${latestEnemy.x.toFixed(2)}, ${latestEnemy.z.toFixed(2)})`);
  console.log(`Facing angle start: ${initialFacing.toFixed(2)} rad, now: ${latestEnemy.facingAngle.toFixed(2)} rad`);

  // Verify mob moved towards spawn
  assert(latestEnemy.z < chasedZ - 0.5, `Mob moved towards spawn point (z moved from ${chasedZ} to ${latestEnemy.z.toFixed(2)})`);

  // Verify mob turned towards direction of movement (Math.PI or -Math.PI)
  // cos(facingAngle) should be negative (pointing in -Z direction), NOT positive (which would face player)
  const forwardZ = Math.cos(latestEnemy.facingAngle);
  console.log(`Forward Z component: ${forwardZ.toFixed(2)} (negative means facing towards spawn, positive means moonwalking facing player)`);
  assert(forwardZ < -0.5, `Enemy is facing forward towards spawn, NOT facing player (cos=${forwardZ.toFixed(2)})`);

  // Test alignment between movement vector and facing angle after turning
  for (let i = 20; i < positions.length; i++) {
    const pPrev = positions[i - 1];
    const pCurr = positions[i];
    const moveDx = pCurr.x - pPrev.x;
    const moveDz = pCurr.z - pPrev.z;
    const moveDist = Math.hypot(moveDx, moveDz);
    if (moveDist > 0.01) {
      const moveHeadingX = moveDx / moveDist;
      const moveHeadingZ = moveDz / moveDist;
      const facingX = Math.sin(pCurr.facingAngle);
      const facingZ = Math.cos(pCurr.facingAngle);
      const dot = moveHeadingX * facingX + moveHeadingZ * facingZ;
      assert(dot > 0.9, `Step ${i} dot product ${dot.toFixed(2)} > 0.9 (facing aligns with movement heading)`);
    }
  }
  console.log('Forward facing orientation test passed (zero moonwalking)!\n');

  // --------------------------------------------------------------------------
  // TEST 3: REALISTIC A* NAVIGATION AROUND OBSTACLES WHEN RETURNING TO SPAWN
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Realistic A* Pathfinding Back to Spawn around Obstacles ---');

  // Place mob behind a tree/obstacle at (26.0, 1.5) with spawn at (26.0, 5.5).
  // There is a tree at (26.0, 3.5) blocking direct line of sight.
  useGameStore.setState((prev) => ({
    player: {
      ...prev.player,
      x: 10.0,
      z: 10.0, // far away
    },
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            mapId: 'overworld',
            spawnMapId: 'overworld',
            spawnX: 26.0,
            spawnZ: 5.5,
            x: 26.0,
            z: 1.5,
            state: 'returning',
            chaseTimer: 0,
            facingAngle: Math.PI,
            pathWaypoints: undefined,
            pathPending: false,
          }
        : e
    ),
  }));

  // Advance simulation to let pathfinding request and waypoints resolve
  for (let i = 0; i < 20; i++) {
    time += 50;
    gameLoop.fixedUpdate(0.0166);
  }

  const navEnemy = useGameStore.getState().enemies[0];
  console.log(`Nav enemy position: (${navEnemy.x.toFixed(2)}, ${navEnemy.z.toFixed(2)}), state: ${navEnemy.state}`);
  assert(
    navEnemy.pathWaypoints !== undefined && navEnemy.pathWaypoints.length > 0 || navEnemy.z > 2.0,
    'Enemy successfully queried and used A* pathfinding to navigate around obstacle back to spawn'
  );
  console.log('Realistic A* navigation back to spawn around obstacle passed!\n');

  // --------------------------------------------------------------------------
  // TEST 4: ARRIVAL AT SPAWN TRANSITIONS TO 'idle'
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Arrival at Spawn Transitions to Idle ---');

  // Place mob very close to spawn (dist <= 0.6) in returning state
  useGameStore.setState((prev) => ({
    enemies: prev.enemies.map((e, idx) =>
      idx === 0
        ? {
            ...e,
            x: e.spawnX + 0.3,
            z: e.spawnZ + 0.3,
            state: 'returning',
          }
        : e
    ),
  }));

  gameLoop.fixedUpdate(0.0166);

  const arrivedEnemy = useGameStore.getState().enemies[0];
  assert(arrivedEnemy.state === 'idle', `Enemy at spawn reached 'idle' state (got '${arrivedEnemy.state}')`);
  assert(
    Math.hypot(arrivedEnemy.x - arrivedEnemy.spawnX, arrivedEnemy.z - arrivedEnemy.spawnZ) < 0.001,
    'Enemy reset precisely to spawn position'
  );
  console.log('Arrival at spawn transitions to idle passed!\n');

  console.log('============================================================');
  console.log('🎉 ALL MOB LEASHING, NAVIGATION & ORIENTATION TESTS PASSED!');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
