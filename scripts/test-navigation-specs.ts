import { generateOverworld, generateDungeon } from '../src/game/worldData';
import {
  NavGrid,
  NavPortalRegistry,
  PathfindingSystem,
  findPathUnified,
  getChunkInfo,
  DEFAULT_PORTALS,
  CELL_SIZE,
} from '../src/game/engine/pathfinding';
import { DUNGEON_ENTRANCE_POS, DUNGEON_SPAWN_POS, DUNGEON_EXIT_POS } from '../src/game/constants';
import { BreakableState } from '../src/types/game';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('RUNNING NAVIGATION & CROSS-CHUNK PATHFINDING SPECS TESTS');
  console.log('============================================================\n');

  const overworld = generateOverworld();
  const dungeon = generateDungeon();
  const breakables: BreakableState[] = [
    ...overworld.initialBreakables,
    ...dungeon.initialBreakables,
  ];

  const navGrid = new NavGrid();
  navGrid.build(overworld, dungeon, false, breakables);
  const portalRegistry = new NavPortalRegistry(DEFAULT_PORTALS);
  const pathfindingSystem = new PathfindingSystem(3, 2.0, navGrid, portalRegistry);

  // --------------------------------------------------------------------------
  // SPEC 1: ADJACENT CHUNKS (3x2 OVERWORLD) STITCHED INTO ONE UNIFIED NAV GRID
  // "A* never knows chunks exist — tiles at edges just link to their neighbors. No invisible walls, ever."
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Adjacent Chunks Stitched into Unified Nav Grid ---');

  // Chunk (0,0) ends at x = 16.0, Chunk (1,0) begins at x = 16.0
  const chunkStart = getChunkInfo('overworld', 14.0, 5.5);
  const chunkTarget = getChunkInfo('overworld', 18.0, 5.5);
  assert(chunkStart.chunkId === 'overworld:0,0', 'Start (14.0, 5.5) is in Chunk 0,0');
  assert(chunkTarget.chunkId === 'overworld:1,0', 'Target (18.0, 5.5) is in Chunk 1,0');

  const crossChunkResult = findPathUnified({
    startX: 14.0,
    startZ: 5.5,
    startMap: 'overworld',
    targetX: 18.0,
    targetZ: 5.5,
    targetMap: 'overworld',
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false,
    breakables,
  });

  assert(crossChunkResult.status === 'complete', 'Pathfinding successfully routed across adjacent chunks');
  assert(crossChunkResult.targetReached === true, 'Target was reached without invisible walls');
  assert(crossChunkResult.waypoints.length >= 1, 'Valid waypoints generated across chunk boundary');

  // Test vertical chunk boundary: Chunk (0,0) (z < 12.0) to Chunk (0,1) (z >= 12.0)
  // Dirt path runs from Glade north to Skull Crag at x = 7.5, z from 6 to 18
  const chunkNorthStart = getChunkInfo('overworld', 7.5, 9.0);
  const chunkNorthTarget = getChunkInfo('overworld', 7.5, 15.0);
  assert(chunkNorthStart.chunkId === 'overworld:0,0', 'Start (7.5, 9.0) is in Chunk 0,0');
  assert(chunkNorthTarget.chunkId === 'overworld:0,1', 'Target (7.5, 15.0) is in Chunk 0,1');

  const northCrossResult = findPathUnified({
    startX: 7.5,
    startZ: 9.0,
    startMap: 'overworld',
    targetX: 7.5,
    targetZ: 15.0,
    targetMap: 'overworld',
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false,
    breakables,
  });

  assert(northCrossResult.status === 'complete', 'Pathfinding routed across north chunk boundary');
  assert(northCrossResult.targetReached === true, 'No invisible walls between south and north chunks');
  console.log('Adjacent chunks stitching passed!\n');

  // --------------------------------------------------------------------------
  // SPEC 2: NON-ADJACENT CONNECTIONS (PORTAL NODES)
  // "Each portal is data — from-chunk, from-tile, to-chunk, to-tile, traversal cost. A* treats them as edges it can cross."
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Portal Nodes (Non-Adjacent Connections) ---');

  const dungeonEntrancePortal = portalRegistry.getPortal('overworld_to_dungeon');
  assert(!!dungeonEntrancePortal, 'Dungeon entrance portal exists in registry');
  assert(dungeonEntrancePortal!.fromChunk === 'overworld', 'Portal fromChunk is overworld');
  assert(dungeonEntrancePortal!.toChunk === 'dungeon', 'Portal toChunk is dungeon');
  assert(typeof dungeonEntrancePortal!.cost === 'number', 'Portal has traversal cost');

  // Player pathfinding from outside dungeon in overworld (40.0, 18.0) to inside dungeon (10.0, 8.5)
  const playerDungeonPath = findPathUnified({
    startX: 40.0,
    startZ: 18.0,
    startMap: 'overworld',
    targetX: 10.0,
    targetZ: 8.5,
    targetMap: 'dungeon',
    isAI: false, // Player can traverse portals!
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false,
    breakables,
  });

  assert(playerDungeonPath.status === 'complete', 'Player path cross-portal status is complete');
  assert(playerDungeonPath.targetReached === true, 'Player path reaches destination inside dungeon');
  const hasPortalWaypoint = playerDungeonPath.waypoints.some((wp) => wp.isPortalTransition);
  assert(hasPortalWaypoint, 'Path includes portal transition edge crossing');
  console.log('Portal nodes cross-chunk pathfinding passed!\n');

  // --------------------------------------------------------------------------
  // SPEC 3: traversableByAI FLAG (ZELDA LEASHING AT ENTRANCE)
  // "One design decision I made for you: monsters don't follow through dungeon entrances by default.
  // Each portal has a traversableByAI flag — false for dungeon mouths (classic Zelda leashing),
  // true where a chase should continue. Flip it per-portal whenever you want."
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: traversableByAI Flag & Zelda Leashing ---');

  assert(dungeonEntrancePortal!.traversableByAI === false, 'Default traversableByAI is false for dungeon entrance');

  // Monster pathfinding from overworld to player in dungeon
  const monsterBlockedPath = findPathUnified({
    startX: 40.0,
    startZ: 18.0,
    startMap: 'overworld',
    targetX: 10.0,
    targetZ: 8.5,
    targetMap: 'dungeon',
    isAI: true, // Monster!
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false,
    breakables,
  });

  assert(monsterBlockedPath.status === 'unreachable' || monsterBlockedPath.targetReached === false,
    'Monster cannot cross dungeon entrance when traversableByAI is false (Zelda leashing)');

  // Now dynamically flip traversableByAI to true:
  console.log('Flipping portal traversableByAI to true...');
  portalRegistry.setPortalTraversableByAI('overworld_to_dungeon', true);
  assert(portalRegistry.getPortal('overworld_to_dungeon')!.traversableByAI === true, 'traversableByAI is now true');

  const monsterAllowedPath = findPathUnified({
    startX: 40.0,
    startZ: 18.0,
    startMap: 'overworld',
    targetX: 10.0,
    targetZ: 8.5,
    targetMap: 'dungeon',
    isAI: true,
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false,
    breakables,
  });

  assert(monsterAllowedPath.status === 'complete', 'Monster now successfully traverses portal into dungeon');
  assert(monsterAllowedPath.targetReached === true, 'Monster reaches player inside dungeon when permitted');

  // Reset flag back to default false
  portalRegistry.setPortalTraversableByAI('overworld_to_dungeon', false);
  console.log('traversableByAI per-portal gating passed!\n');

  // --------------------------------------------------------------------------
  // SPEC 4: GRACEFUL NO-PATH FALLBACK (NEVER FREEZE OR VIBRATE)
  // "graceful no-path fallback (never freeze or vibrate against walls)"
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Graceful No-Path Fallback ---');

  // In the dungeon, sanctum boss room is blocked by closed gate at z = 11.5
  // Place start in antechamber at (10.0, 5.0) and goal behind closed gate at (10.0, 18.0)
  const closedGatePath = findPathUnified({
    startX: 10.0,
    startZ: 5.0,
    startMap: 'dungeon',
    targetX: 10.0,
    targetZ: 18.0,
    targetMap: 'dungeon',
    isAI: true,
    navGrid,
    portalRegistry,
    overworldMap: overworld,
    dungeonMap: dungeon,
    isGateOpen: false, // Closed gate!
    breakables,
  });

  assert(closedGatePath.status === 'partial', 'Closed gate path returned graceful fallback status "partial"');
  assert(closedGatePath.targetReached === false, 'Target correctly marked as not reached');
  assert(closedGatePath.waypoints.length > 0, 'Graceful fallback returned best-effort waypoints to closest reachable point');
  const lastWp = closedGatePath.waypoints[closedGatePath.waypoints.length - 1];
  // Last waypoint should be near the gate in the antechamber (z ~ 10.5 to 11.0)
  assert(lastWp.z > 8.0 && lastWp.z < 11.5, `Fallback waypoint leads right to closed gate boundary (z = ${lastWp.z})`);
  console.log('Graceful no-path fallback passed!\n');

  // --------------------------------------------------------------------------
  // SPEC 5: PER-TICK PATHFINDING BUDGET
  // "a per-tick pathfinding budget so twelve monsters repathing doesn't hitch the frame"
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Per-Tick Pathfinding Budget System ---');

  // PathfindingSystem with budget = 3 searches per tick
  const budgetSystem = new PathfindingSystem(3, 5.0, navGrid, portalRegistry);
  const resolvedIds: string[] = [];

  // Enqueue 12 monsters requesting paths simultaneously
  for (let i = 0; i < 12; i++) {
    const id = `mob_${i}`;
    budgetSystem.requestPath(
      id,
      {
        startX: 10.0 + (i % 3),
        startZ: 5.0,
        startMap: 'overworld',
        targetX: 18.0,
        targetZ: 5.0,
        targetMap: 'overworld',
        isAI: true,
        overworldMap: overworld,
        dungeonMap: dungeon,
        isGateOpen: false,
        breakables,
      },
      12 - i, // priority
      (res) => {
        resolvedIds.push(id);
      }
    );
  }

  assert(budgetSystem.pendingCount === 12, '12 monster requests successfully queued');

  // Tick 1
  const processedTick1 = budgetSystem.processQueue(3);
  assert(processedTick1 === 3, 'Tick 1 processed exactly 3 searches (budget limit)');
  assert(budgetSystem.pendingCount === 9, '9 requests remain queued after tick 1');
  assert(resolvedIds.length === 3, '3 monster callbacks invoked in tick 1');

  // Tick 2
  const processedTick2 = budgetSystem.processQueue(3);
  assert(processedTick2 === 3, 'Tick 2 processed exactly 3 searches');
  assert(budgetSystem.pendingCount === 6, '6 requests remain queued after tick 2');
  assert(resolvedIds.length === 6, '6 total callbacks invoked');

  // Tick 3
  const processedTick3 = budgetSystem.processQueue(3);
  assert(processedTick3 === 3, 'Tick 3 processed exactly 3 searches');
  assert(budgetSystem.pendingCount === 3, '3 requests remain queued after tick 3');

  // Tick 4
  const processedTick4 = budgetSystem.processQueue(3);
  assert(processedTick4 === 3, 'Tick 4 processed final 3 searches');
  assert(budgetSystem.pendingCount === 0, 'All 12 requests resolved cleanly without hitching');
  assert(resolvedIds.length === 12, 'All 12 monsters received their path results');
  console.log('Per-tick pathfinding budget passed!\n');

  // --------------------------------------------------------------------------
  // SPEC 6: NAV-GRID REBUILDS WHEN TILES / OBSTACLES CHANGE STATE
  // "and nav-grid rebuilds when tiles change state."
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Dynamic Nav-Grid Rebuilds ---');

  // Find a clay pot in overworld
  const testPot = breakables.find((b) => b.type === 'pot' && b.mapId === 'overworld');
  assert(!!testPot, 'Test clay pot exists');

  const potGx = Math.floor(testPot!.x / CELL_SIZE);
  const potGz = Math.floor(testPot!.z / CELL_SIZE);

  // Before breaking: pot cell is blocked
  const beforeWalkable = navGrid.isWalkable('overworld', potGx, potGz);
  assert(!beforeWalkable, 'NavGrid cell under unbroken clay pot is solid/blocked');

  const versionBefore = navGrid.version;

  // Smash the pot!
  testPot!.isBroken = true;
  navGrid.onBreakableStateChanged(testPot!, overworld, false, breakables);

  assert(navGrid.version > versionBefore, 'NavGrid version incremented after dynamic obstacle state change');
  const afterWalkable = navGrid.isWalkable('overworld', potGx, potGz);
  assert(afterWalkable, 'NavGrid cell under smashed clay pot is now WALKABLE');

  // Test dungeon gate unlock
  const gateGx = Math.floor(10.0 / CELL_SIZE); // Gate x = 10.0
  const gateGz = Math.floor(11.5 / CELL_SIZE); // Gate z = 11.5
  assert(!navGrid.isWalkable('dungeon', gateGx, gateGz), 'Closed dungeon gate cell is blocked');

  // Open the gate!
  navGrid.onGateStateChanged(true, dungeon, breakables);
  assert(navGrid.isWalkable('dungeon', gateGx, gateGz), 'Dungeon gate cell is now WALKABLE after gate open event');

  console.log('Dynamic Nav-Grid rebuilds passed!\n');

  console.log('============================================================');
  console.log('🎉 ALL 6 NAVIGATION & CROSS-CHUNK PATHFINDING SPECS PASSED!');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
