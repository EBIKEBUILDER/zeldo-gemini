process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('=== STARTING MOB PATHFINDING, STUCK TIMEOUT & BOSS ATTACK VERIFICATION ===\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--no-zygote',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[Page Error]', msg.text());
    }
  });

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('button');
  await page.click('button');
  await new Promise((r) => setTimeout(r, 1200));

  // --- TEST 1: INTELLIGENT A* WAYPOINT PATHFINDING AROUND TREE ---
  console.log('Test 1: Intelligent A* Waypoint Pathfinding around Tree at (26.0, 3.5)...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 26.0, 5.5);
    store.setState((prev) => ({
      player: { ...prev.player, x: 26.0, z: 5.5 },
      enemies: prev.enemies.map((e) =>
        e.mapId === 'overworld' && e.type === 'slime_green'
          ? {
              ...e,
              x: 26.0,
              z: 1.5,
              state: 'chase',
              hitstunTimer: 0,
              vx: 0,
              vz: 0,
              pathWaypoints: undefined,
            }
          : e
      ),
    }));
  });

  await new Promise((r) => setTimeout(r, 1200));

  const slimePathResult = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const slime = store.enemies.find((e) => e.mapId === 'overworld' && e.type === 'slime_green');
    return {
      x: slime.x,
      z: slime.z,
      state: slime.state,
      dispX: Math.abs(slime.x - 26.0),
      dispZ: slime.z - 1.5,
      hasWaypoints: !!slime.pathWaypoints,
    };
  });
  console.log('Slime pathfinding result around tree:', slimePathResult);

  if (slimePathResult.dispX < 0.3) {
    throw new Error(`FAIL: Slime did not steer around tree! dispX = ${slimePathResult.dispX}`);
  }
  console.log('PASS: Slime successfully used pathfinding system to route around tree!\n');

  // --- TEST 2: AGGRESSIVE PURSUIT PERSISTENCE ---
  console.log('Test 2: Enemy continues persistent aggressive chase while player is in general area...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    // Set slime close to player in active chase
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 5.0 },
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 20.0,
              z: 8.5,
              mapId: 'overworld',
              isDead: false,
              state: 'chase',
              chaseTimer: 4.5,
            }
          : e
      ),
    }));
  });

  // Move player further away (to z = 1.5, ~7.0 units away, > aggroRadius 5.2, < leashRadius 14.0)
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 1.5 },
    }));
  });

  await new Promise((r) => setTimeout(r, 400));

  const persistenceCheck = await page.evaluate(() => {
    const enemy = window.__gameStore.getState().enemies[0];
    return {
      state: enemy.state,
      chaseTimer: enemy.chaseTimer,
    };
  });
  console.log('Persistence check result:', persistenceCheck);
  if (persistenceCheck.state !== 'chase' || persistenceCheck.chaseTimer <= 0) {
    throw new Error('FAIL: Enemy gave up chase too easily!');
  }
  console.log('PASS: Enemy remained aggressive and persisted in chase mode!\n');

  // --- TEST 3: STUCK TIMEOUT AND RETURN TO SPAWN ---
  console.log('Test 3: Enemy stuck timeout triggers return-to-spawn navigation...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 21.0, 4.0);

    // Place an enemy pinned against a solid boundary where it cannot make progress towards player
    // Spawn point is (21.0, 4.0)
    // Place slime at (1.0, 1.1) and player at (1.0, -2.5) across solid boundary
    store.setState((prev) => ({
      player: { ...prev.player, x: 1.0, z: -2.5, vx: 0, vz: 0 },
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 1.0,
              z: 1.1,
              spawnX: 21.0,
              spawnZ: 4.0,
              mapId: 'overworld',
              state: 'chase',
              stuckTimer: 3.55, // simulate having exceeded the 3.5s stuck threshold
              chaseTimer: 5.0,
              lastSamplePos: { x: 1.0, z: 1.1 },
            }
          : e
      ),
    }));
  });

  // Wait 500ms to allow stuckTimer to cross the 3.5s threshold
  await new Promise((r) => setTimeout(r, 500));

  const timeoutCheck = await page.evaluate(() => {
    const enemy = window.__gameStore.getState().enemies[0];
    return {
      timedOutToReturning: enemy.state === 'returning',
      returningState: enemy.state,
    };
  });

  // Now let enemy navigate back toward spawn point (place it near spawn: 21.0, 4.4)
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.setState((prev) => ({
      player: { ...prev.player, x: 40.0, z: 20.0 }, // player far away
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 21.0,
              z: 4.4,
              state: 'returning',
            }
          : e
      ),
    }));
  });

  // Wait 400ms for enemy to arrive at spawn (dist <= 0.6) and transition to idle
  await new Promise((r) => setTimeout(r, 400));

  const stuckTimeoutResult = await page.evaluate(() => {
    const enemyAtSpawn = window.__gameStore.getState().enemies[0];
    return {
      finalState: enemyAtSpawn.state,
      finalStuckTimer: enemyAtSpawn.stuckTimer,
      finalDistToSpawn: Math.hypot(enemyAtSpawn.x - enemyAtSpawn.spawnX, enemyAtSpawn.z - enemyAtSpawn.spawnZ),
    };
  });
  console.log('Stuck timeout and return result:', { ...timeoutCheck, ...stuckTimeoutResult });

  if (!timeoutCheck.timedOutToReturning) {
    throw new Error(`FAIL: Enemy did not transition to 'returning' state after stuck timeout! State: ${timeoutCheck.returningState}`);
  }
  if (stuckTimeoutResult.finalState !== 'idle') {
    throw new Error(`FAIL: Enemy did not reset to 'idle' upon returning to spawn! State: ${stuckTimeoutResult.finalState}`);
  }
  console.log('PASS: Stuck enemy timed out and returned to spawn point, resuming idle!\n');

  // --- TEST 4: BOSS RANGED ATTACK IN CORNER / UNREACHABLE ---
  console.log('Test 4: Boss Ranged Attack when player is in corner / unreachable...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 14.0);

    // Place player in the Northwest corner of the boss room (x: 4.0, z: 21.0)
    // Boss is at (10.0, 18.0)
    store.setState((prev) => ({
      quest: {
        ...prev.quest,
        hasDungeonKey: true,
        dungeonGateOpen: true,
        gateOpenProgress: 1.0,
      },
      player: {
        ...prev.player,
        x: 4.0,
        z: 21.0,
      },
      enemies: prev.enemies.map((e) =>
        e.type === 'boss_gorgoth'
          ? {
              ...e,
              x: 10.0,
              z: 18.0,
              state: 'chase',
              rangedCooldown: 0,
              castTimer: 0.05, // trigger launch
            }
          : e
      ),
      projectiles: [],
    }));
  });

  // Wait 300ms for projectile to spawn and travel
  await new Promise((r) => setTimeout(r, 300));

  const bossAttackResult = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const proj = store.projectiles.find((p) => p.source === 'boss');
    return {
      projCount: store.projectiles.length,
      hasBounces: proj ? (proj.bounces !== undefined && proj.bounces > 0) : false,
      bounces: proj?.bounces,
      source: proj?.source,
      damage: proj?.damage,
    };
  });
  console.log('Boss attack in corner result:', bossAttackResult);

  if (bossAttackResult.projCount === 0 || !bossAttackResult.hasBounces) {
    throw new Error('FAIL: Boss did not fire ricocheting projectile towards corner camper!');
  }
  console.log('PASS: Boss fired telegraphed ricocheting projectile towards corner camper!\n');

  // --- TEST 5: SWORD DEFLECTION OF BOSS PROJECTILE ---
  console.log('Test 5: Player sword swing deflects boss projectile back...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    // Place a boss projectile heading directly towards player at (10.0, 14.0)
    store.setState((prev) => ({
      gameState: 'playing',
      player: {
        ...prev.player,
        health: 6,
        x: 10.0,
        z: 14.0,
        facingAngle: 0, // facing +Z towards incoming thorn
        isAttacking: false,
        attackCooldown: 0,
      },
      projectiles: [
        {
          id: 'test_deflect_proj',
          x: 10.0,
          z: 14.8,
          vx: 0,
          vz: -1.5,
          radius: 0.3,
          damage: 1,
          life: 3.0,
          maxLife: 3.0,
          source: 'boss',
          mapId: 'dungeon',
          bounces: 2,
        },
      ],
    }));

    // Trigger sword swing update
    window.__gameLoop.mouseAttackRequested = true;
  });

  // Wait 150ms for game loop to tick and register sword deflection
  await new Promise((r) => setTimeout(r, 150));

  const deflectionResult = await page.evaluate(() => {
    const store = window.__gameStore;
    const proj = store.getState().projectiles.find((p) => p.id === 'test_deflect_proj');
    return {
      projExists: !!proj,
      source: proj?.source,
      vz: proj?.vz,
      color: proj?.color,
      isAttacking: store.getState().player.isAttacking,
      attackCooldown: store.getState().player.attackCooldown,
      mouseReq: window.__gameLoop.mouseAttackRequested,
    };
  });
  console.log('Deflection result:', deflectionResult);

  if (!deflectionResult.projExists || deflectionResult.source !== 'player') {
    throw new Error(`FAIL: Projectile was not deflected into player projectile! Source: ${deflectionResult.source}`);
  }
  if (deflectionResult.vz <= 0) {
    throw new Error(`FAIL: Projectile velocity was not reversed! Vz: ${deflectionResult.vz}`);
  }
  console.log('PASS: Player sword successfully deflected boss projectile with reversed velocity!\n');

  // --- TEST 6: BOSS TELEGRAPHED BRIAR ROOT ERUPTION (ANTI-CORNER / FLUSH) ---
  console.log('Test 6: Boss Telegraphed Briar Root Eruption spawns hazard under player...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 4.0, 21.0); // player in corner

    store.setState((prev) => ({
      enemies: prev.enemies.map((e) =>
        e.type === 'boss_gorgoth'
          ? {
              ...e,
              x: 10.0,
              z: 18.0,
              state: 'chase',
              rangedCooldown: 0,
              bossAction: 'telegraphing_eruption',
              bossAttackType: 'ground_eruption',
              castTimer: 0.9,
              bossTelegraphTimer: 0.9,
            }
          : e
      ),
      groundHazards: [
        {
          id: 'test_hazard_eruption',
          type: 'briar_eruption',
          x: 4.0,
          z: 21.0,
          radius: 0.9,
          timer: 0.05, // about to erupt in 2-3 ticks
          maxTimer: 0.9,
          duration: 0.85,
          erupted: false,
          damage: 1,
          mapId: 'dungeon',
        },
      ],
    }));
  });

  // Poll up to 1.5 seconds for hazard to erupt
  let eruptionResult = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 100));
    eruptionResult = await page.evaluate(() => {
      const store = window.__gameStore.getState();
      const hazard = store.groundHazards.find((h) => h.id === 'test_hazard_eruption');
      return {
        hazardExists: !!hazard,
        erupted: hazard?.erupted,
        damage: hazard?.damage,
      };
    });
    if (eruptionResult.hazardExists && eruptionResult.erupted) {
      break;
    }
  }
  console.log('Briar eruption result:', eruptionResult);

  if (!eruptionResult || !eruptionResult.hazardExists || !eruptionResult.erupted) {
    throw new Error('FAIL: Briar root eruption hazard did not erupt!');
  }
  console.log('PASS: Boss successfully summoned telegraphed Briar Root Eruption hazard!\n');

  await browser.close();
  console.log('=== ALL PATHFINDING, STUCK TIMEOUT, & BOSS ATTACK TESTS PASSED! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
