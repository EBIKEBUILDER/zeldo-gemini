import { gameLoop } from '../src/game/engine/gameLoop';
import { useGameStore } from '../src/game/state/gameStore';
import { defaultNavGrid } from '../src/game/engine/pathfinding';
import { ENEMY_SETTINGS, DUNGEON_BOSS_SPAWN_POS } from '../src/game/constants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function verifyBossGorgoth() {
  console.log('============================================================');
  console.log('VERIFYING BOSS GORGOTH EXTRACTION (IDENTICAL BEHAVIOR SUITE)');
  console.log('============================================================\n');

  const store = useGameStore.getState();
  store.startGame();
  store.switchMap('dungeon', 10.0, 5.0); // Inside dungeon antechamber

  defaultNavGrid.build(
    useGameStore.getState().overworldMap,
    useGameStore.getState().dungeonMap,
    false,
    useGameStore.getState().breakables
  );

  const DT = 1 / 60; // 60Hz tick

  // --------------------------------------------------------------------------
  // TEST 1: GATE LOCKED AGGRO SUPPRESSION
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Gate Locked Aggro Suppression ---');
  // Gate is closed, player at (10.0, 8.0)
  // Boss at DUNGEON_BOSS_SPAWN_POS (10.0, 18.0)
  useGameStore.setState((prev) => ({
    currentMap: 'dungeon',
    quest: {
      ...prev.quest,
      dungeonGateOpen: false,
    },
    player: {
      ...prev.player,
      x: 10.0,
      z: 8.0,
    },
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            x: DUNGEON_BOSS_SPAWN_POS.x,
            z: DUNGEON_BOSS_SPAWN_POS.z,
            state: 'idle',
            chaseTimer: 0,
            isDead: false,
            bossAction: 'none',
          }
        : e
    ),
  }));

  for (let i = 0; i < 10; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const bossTest1 = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  assert(bossTest1.state === 'idle', 'Boss Gorgoth remains IDLE while dungeon gate is locked');

  // --------------------------------------------------------------------------
  // TEST 2: SANCTUM APPROACH INITIATES CHASE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Sanctum Approach Aggro ---');
  // Gate is open, player steps through gate to z = 12.5
  useGameStore.setState((prev) => ({
    currentMap: 'dungeon',
    quest: {
      ...prev.quest,
      dungeonGateOpen: true,
    },
    player: {
      ...prev.player,
      x: 10.0,
      z: 12.5,
    },
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'idle',
            chaseTimer: 0,
            isDead: false,
            bossAction: 'none',
          }
        : e
    ),
  }));

  for (let i = 0; i < 5; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const bossTest2 = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  assert(bossTest2.state === 'chase', `Boss enters 'chase' state upon player sanctum entry (got ${bossTest2.state})`);

  // --------------------------------------------------------------------------
  // TEST 3: TELEGRAPHED LUNGE ATTACK, DASH & RECOVERY
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Telegraphed Lunge, Surge & Recovery ---');
  // Player at (10.0, 14.5), boss at (10.0, 18.0) -> distance is 3.5 (clear LoS mid-range)
  // lungeCooldown: 0 to trigger immediate lunge attack
  useGameStore.setState((prev) => ({
    currentMap: 'dungeon',
    quest: {
      ...prev.quest,
      dungeonGateOpen: true,
      bossDefeated: false,
    },
    player: {
      ...prev.player,
      x: 10.0,
      z: 14.5,
      health: 6,
      iFrames: 0,
    },
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'chase',
            bossAction: 'none',
            lungeCooldown: 0,
            rangedCooldown: 5.0, // suppress ranged to trigger lunge
            isDead: false,
          }
        : e
    ),
  }));

  // Step 1: Decision tick -> Should select telegraphing_lunge
  gameLoop.fixedUpdate(DT);
  const bossLungeTelegraph = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  assert(
    bossLungeTelegraph.bossAction === 'telegraphing_lunge',
    `Boss enters 'telegraphing_lunge' state (got ${bossLungeTelegraph.bossAction})`
  );
  assert(
    bossLungeTelegraph.bossTelegraphTimer! > 0,
    `Lunge telegraph timer initialized to windup (${bossLungeTelegraph.bossTelegraphTimer}s)`
  );

  // Step 2: Advance through windup (1.05s = ~65 frames)
  for (let i = 0; i < 70; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const bossLunging = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  // Either currently lunging or hit player / wall and entered recovery
  const validPostTelegraphState =
    bossLunging.bossAction === 'lunging' || bossLunging.bossAction === 'lunge_recovery';
  assert(
    validPostTelegraphState,
    `Boss transitioned from telegraph to active lunge or recovery (got ${bossLunging.bossAction})`
  );

  // --------------------------------------------------------------------------
  // TEST 4: TELEGRAPHED RANGED SPORE BOMB ATTACK
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Telegraphed Ranged Spore Bomb Attack ---');
  // Player at long range: player at (10.0, 12.0), boss at (10.0, 20.0) -> dist = 8.0 (> 4.2)
  // rangedCooldown: 0 to trigger projectile
  useGameStore.setState((prev) => ({
    currentMap: 'dungeon',
    projectiles: [],
    quest: {
      ...prev.quest,
      dungeonGateOpen: true,
      bossDefeated: false,
    },
    player: {
      ...prev.player,
      x: 10.0,
      z: 13.0,
      vx: 0,
      vz: 0,
      health: 6,
      iFrames: 0,
    },
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            x: 10.0,
            z: 19.0,
            state: 'chase',
            bossAction: 'none',
            lungeCooldown: 10.0, // suppress lunge
            rangedCooldown: 0,   // ready to fire
            isDead: false,
          }
        : e
    ),
  }));

  // Step 1: Decision tick -> Should select telegraphing_ranged
  gameLoop.fixedUpdate(DT);
  const bossRangedTelegraph = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  assert(
    bossRangedTelegraph.bossAction === 'telegraphing_ranged',
    `Boss enters 'telegraphing_ranged' state at long range (got ${bossRangedTelegraph.bossAction})`
  );

  // Step 2: Advance through windup (1.05s = ~65 frames)
  for (let i = 0; i < 70; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const projectilesAfterBomb = useGameStore.getState().projectiles;
  const spawnedBomb = projectilesAfterBomb.find((p) => p.type === 'spore_bomb');
  assert(!!spawnedBomb, 'Boss successfully launched spore bomb projectile upon telegraph completion');
  assert(spawnedBomb!.damage === ENEMY_SETTINGS.boss_gorgoth.projectileDamage, 'Spore bomb has correct configured damage');

  // --------------------------------------------------------------------------
  // TEST 5: CONTACT DAMAGE & HYPER-ARMOR (NO FLINCH RECOIL)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Contact Damage & Poise / Hyper-Armor ---');
  // Place boss touching player in neutral chase
  useGameStore.setState((prev) => ({
    currentMap: 'dungeon',
    player: {
      ...prev.player,
      x: 10.0,
      z: 18.0,
      health: 6,
      iFrames: 0,
      vx: 0,
      vz: 0,
    },
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            x: 10.0,
            z: 19.2, // touching player: dist = 1.2 < boss_radius(1.1) + player_radius(0.36) = 1.46
            state: 'chase',
            bossAction: 'none',
            attackCooldown: 0,
            hitstunTimer: 0,
            isDead: false,
          }
        : e
    ),
  }));

  gameLoop.fixedUpdate(DT);

  const playerAfterHit = useGameStore.getState().player;
  const bossAfterHit = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;

  assert(playerAfterHit.health === 5, `Player took 1 contact damage (health 6 -> ${playerAfterHit.health})`);
  assert(playerAfterHit.iFrames > 1.0, 'Player received invulnerability frames');
  assert(bossAfterHit.attackCooldown > 1.0, `Boss attack cooldown set to 1.3s (got ${bossAfterHit.attackCooldown})`);
  // Critical boss property: unlike slimes, boss does NOT suffer hitstun recoil on contact damage
  assert(bossAfterHit.hitstunTimer === 0, 'Boss has poise/hyper-armor: zero hitstun recoil on hit');

  // --------------------------------------------------------------------------
  // TEST 6: BOSS DEAD STATE DOES NOT RESPAWN
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Boss Permanent Defeat (No Respawn) ---');
  useGameStore.setState((prev) => ({
    enemies: prev.enemies.map((e) =>
      e.type === 'boss_gorgoth'
        ? {
            ...e,
            isDead: true,
            respawnTimer: 0.1,
            hp: 0,
          }
        : e
    ),
  }));

  for (let i = 0; i < 20; i++) {
    gameLoop.fixedUpdate(DT);
  }

  const deadBoss = useGameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth')!;
  assert(deadBoss.isDead, 'Boss Gorgoth permanently remains dead (never respawns)');

  console.log('\n============================================================');
  console.log('🎉 ALL BOSS GORGOTH EXTRACTION VERIFICATION TESTS PASSED!');
  console.log('============================================================');
}

verifyBossGorgoth().catch((err) => {
  console.error(err);
  process.exit(1);
});
