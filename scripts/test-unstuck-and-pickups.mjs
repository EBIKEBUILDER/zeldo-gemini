process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- STARTING UNSTUCK, PICKUPS, & SOLID COLLIDERS VERIFICATION ---');

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
  await new Promise((r) => setTimeout(r, 1500));

  // --- TEST 1: KNOCKBACK AGAINST TREE & ESCAPE (NOT STUCK) ---
  console.log('\nTesting Test 1: Enemy knockback against tree & escape...');
  const knockbackTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 2.5, 2.3);

    // Tree at (2.5, 3.5), radius ~0.715
    // Place player at (2.5, 2.4)
    // Place enemy at (2.5, 1.8) charging player +Z directly into tree
    store.setState((prev) => ({
      player: { ...prev.player, x: 2.5, z: 2.4, vx: 0, vz: 0, health: 6, iFrames: 0 },
      enemies: prev.enemies.map((enemy, idx) =>
        idx === 0
          ? {
              ...enemy,
              x: 2.5,
              z: 1.8,
              mapId: 'overworld',
              isDead: false,
              state: 'chase',
              attackCooldown: 0,
            }
          : enemy
      ),
    }));

    await new Promise((r) => setTimeout(r, 350));

    const stateAfterHit = store.getState();
    const hpAfter = stateAfterHit.player.health;
    const playerAfterHitZ = stateAfterHit.player.z;

    return { hpAfter, playerAfterHitZ };
  });

  console.log('Player hit by enemy:', knockbackTest);
  if (knockbackTest.hpAfter >= 6) {
    throw new Error('FAIL: Player was not damaged by enemy!');
  }

  // Now press 's' (down/south) to walk away from tree
  console.log('Holding "s" to walk away from tree...');
  await page.keyboard.down('s');
  await new Promise((r) => setTimeout(r, 600));
  await page.keyboard.up('s');
  await new Promise((r) => setTimeout(r, 100));

  const escapeResult = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    return {
      finalZ: store.player.z,
      distMovedAway: 2.4 - store.player.z,
      canMoveFreely: store.player.z < 2.0,
    };
  });
  console.log('Escape result:', escapeResult);
  if (!escapeResult.canMoveFreely) {
    throw new Error('FAIL: Player remained stuck against the tree after knockback!');
  }
  console.log('PASS: Player took knockback and smoothly walked away without getting stuck!');

  // --- TEST 2: RUPEE & HEART WALKOVER PICKUP ---
  console.log('\nTesting Test 2: Rupee & Heart walkover pickup...');
  const pickupTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    const initialRupees = store.getState().stats.rupees;

    // A. Drop a rupee 1.5 units in front (+X) of player
    const p = store.getState().player;
    const rupeeId = 'walkover_rupee_' + Date.now();
    const rupeeX = p.x + 1.5;
    const rupeeZ = p.z;

    store.setState((prev) => ({
      pickups: [
        ...prev.pickups,
        {
          id: rupeeId,
          type: 'rupee',
          x: rupeeX,
          z: rupeeZ,
          value: 1,
          bobOffset: 0,
          collected: false,
          magnetActive: false,
          mapId: prev.currentMap,
        },
      ],
    }));

    return { initialRupees, rupeeId, rupeeX };
  });

  // Hold 'd' to run right over the rupee
  await page.keyboard.down('d');
  await new Promise((r) => setTimeout(r, 700));
  await page.keyboard.up('d');
  await new Promise((r) => setTimeout(r, 150));

  const rupeeCollectResult = await page.evaluate((rupeeId) => {
    const store = window.__gameStore.getState();
    const rupee = store.pickups.find((p) => p.id === rupeeId);
    return {
      rupeeCollected: !rupee,
      rupeeCount: store.stats.rupees,
    };
  }, pickupTest.rupeeId);

  console.log('Rupee walkover result:', rupeeCollectResult);
  if (!rupeeCollectResult.rupeeCollected || rupeeCollectResult.rupeeCount !== pickupTest.initialRupees + 1) {
    throw new Error('FAIL: Rupee was not collected when walked over!');
  }
  console.log('PASS: Rupee picked up cleanly on walkover!');

  // Heart retention at full HP and collection when hurt
  const heartTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    const p = store.getState().player;

    // Full HP test: drop heart right at player
    const heartId = 'test_heart_' + Date.now();
    store.setState((prev) => ({
      player: { ...prev.player, health: 6 },
      pickups: [
        ...prev.pickups,
        {
          id: heartId,
          type: 'heart',
          x: p.x,
          z: p.z,
          value: 2,
          bobOffset: 0,
          collected: false,
          magnetActive: false,
          mapId: prev.currentMap,
        },
      ],
    }));

    await new Promise((r) => setTimeout(r, 200));

    const heartAtFull = store.getState().pickups.find((it) => it.id === heartId);
    const retainedAtFullHp = !!heartAtFull && !heartAtFull.collected;

    // Hurt player to 4 HP
    store.setState((prev) => ({
      player: { ...prev.player, health: 4 },
    }));

    await new Promise((r) => setTimeout(r, 200));

    const heartAfterHurt = store.getState().pickups.find((it) => it.id === heartId);
    const collectedWhenHurt = !heartAfterHurt;
    const hpAfterHeal = store.getState().player.health;

    return {
      retainedAtFullHp,
      collectedWhenHurt,
      hpAfterHeal,
    };
  });

  console.log('Heart test result:', heartTest);
  if (!heartTest.retainedAtFullHp) {
    throw new Error('FAIL: Heart was collected at full health instead of being left on ground!');
  }
  if (!heartTest.collectedWhenHurt || heartTest.hpAfterHeal !== 6) {
    throw new Error('FAIL: Heart was not collected when damaged!');
  }
  console.log('PASS: Heart stays on ground at full HP and collects/heals when damaged!');

  // --- TEST 3: KEY PEDESTAL SOLIDITY IN DUNGEON ---
  console.log('\nTesting Test 3: Key pedestal solid obstacle...');
  const pedestalTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 4.5);
    // Remove enemies so we can test clean collider
    store.setState((prev) => ({
      enemies: prev.enemies.map((e) => ({ ...e, isDead: true })),
      player: { ...prev.player, x: 10.0, z: 4.5, vx: 0, vz: 0 },
    }));
    await new Promise((r) => setTimeout(r, 100));

    const p = store.getState().dungeonMap.props.find((prop) => prop.id === 'key_pedestal');
    return { pedestalRadius: p?.radius };
  });

  console.log('Pedestal info:', pedestalTest);
  if (pedestalTest.pedestalRadius < 0.7) {
    throw new Error('FAIL: Pedestal collider radius is too small or missing!');
  }

  // Walk straight into pedestal (+Z) for 800ms
  await page.keyboard.down('w');
  await new Promise((r) => setTimeout(r, 800));
  await page.keyboard.up('w');
  await new Promise((r) => setTimeout(r, 100));

  const pedestalFinal = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const distToPedestalCenter = Math.hypot(store.player.x - 10.0, store.player.z - 6.5);
    return {
      playerX: store.player.x,
      playerZ: store.player.z,
      distToPedestalCenter,
      blockedByPedestal: distToPedestalCenter >= 0.95,
      hasKey: store.quest.hasDungeonKey,
    };
  });

  console.log('Pedestal collision result:', pedestalFinal);
  if (!pedestalFinal.blockedByPedestal) {
    throw new Error('FAIL: Player walked through the stone pedestal!');
  }
  if (!pedestalFinal.hasKey) {
    throw new Error('FAIL: Player did not collect key while at pedestal!');
  }
  console.log('PASS: Pedestal is solid and blocked player, key collected reliably!');

  // --- TEST 4: SOLID POT COLLIDERS & MOB PATHFINDING AROUND POTS ---
  console.log('\nTesting Test 4: Solid pot collider and enemy steering around pot...');
  const potTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 5.0, 5.0);

    // Place unbroken pot at (5.0, 7.0)
    // Place player at (5.0, 9.0)
    // Place enemy at (5.0, 5.0) chasing player at (5.0, 9.0) with pot directly in between!
    const pot = store.getState().breakables.find((b) => b.type === 'pot' && b.mapId === 'dungeon');
    if (!pot) return { error: 'No dungeon pot found' };

    pot.x = 5.0;
    pot.z = 7.0;
    pot.isBroken = false;

    store.setState((prev) => ({
      player: { ...prev.player, x: 5.0, z: 9.0, vx: 0, vz: 0 },
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 5.0,
              z: 5.0,
              mapId: 'dungeon',
              isDead: false,
              state: 'chase',
              speed: 3.0,
              hopCycle: 0,
            }
          : e
      ),
    }));

    await new Promise((r) => setTimeout(r, 600));

    const enemyAfter = store.getState().enemies[0];
    const distToPot = Math.hypot(enemyAfter.x - 5.0, enemyAfter.z - 7.0);
    const didSteerAround = Math.abs(enemyAfter.x - 5.0) > 0.3;

    return {
      enemyX: enemyAfter.x,
      enemyZ: enemyAfter.z,
      distToPot,
      didSteerAround,
    };
  });

  console.log('Pot steering test result:', potTest);
  if (!potTest.didSteerAround) {
    throw new Error('FAIL: Enemy walked straight into pot instead of steering around it!');
  }
  console.log('PASS: Enemy steered around solid clay pot during pursuit!');

  await browser.close();
  console.log('\n=== ALL UNSTUCK, PICKUP, & SOLID COLLIDER TESTS PASSED! ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
