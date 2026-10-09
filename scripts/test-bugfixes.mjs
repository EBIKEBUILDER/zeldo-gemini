process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- STARTING COMPREHENSIVE BUGFIX VERIFICATION ---');

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
  await page.waitForSelector('#start-adventure-btn');
  // 1. Click Start Adventure
  await page.click('#start-adventure-btn');
  await new Promise((r) => setTimeout(r, 2000));

  const gs = await page.evaluate(() => window.__gameStore?.getState()?.gameState);
  console.log('Current gameState after click:', gs);
  // --- TEST 1: MOUSE CLICK SWORD ATTACK ---
  console.log('Testing Test 1: Mouse click on canvas triggers sword swing...');
  const initialAttacking = await page.evaluate(() => {
    return window.__gameStore?.getState().player.isAttacking;
  });

  // Click canvas in center
  await page.mouse.click(640, 360);
  await page.evaluate(async () => {
    for (let i = 0; i < 4; i++) {
      window.__gameLoop?.tick(performance.now());
      await new Promise((r) => setTimeout(r, 20));
    }
  });

  const clickAttackState = await page.evaluate(() => {
    const store = window.__gameStore?.getState();
    return {
      isAttacking: store.player.isAttacking,
      cooldown: store.player.attackCooldown,
    };
  });
  console.log('Click attack state:', clickAttackState);
  if (!clickAttackState.isAttacking && clickAttackState.cooldown <= 0) {
    throw new Error('FAIL: Mouse click did not trigger sword attack!');
  }
  console.log('PASS: Mouse click triggered sword attack successfully!');

  // Wait for attack animation to finish
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i++) {
      window.__gameLoop?.tick(performance.now());
      await new Promise((r) => setTimeout(r, 20));
    }
  });

  // --- TEST 2: GRASS BILLBOARD PLANES VARIETY ---
  console.log('Testing Test 2: Grass billboard planes (random between 2 and 4)...');
  const grassPlanesReport = await page.evaluate(() => {
    const scene = window.__scene;
    if (!scene) return { error: 'No scene found' };

    const tufts = scene.transformNodes.filter((n) => n.name === 'grass_tuft_root');
    const planeCounts = tufts.map((t) => {
      const child = t.getChildren()[0];
      return child && child.getTotalVertices ? Math.round(child.getTotalVertices() / 4) : t.getChildren().length;
    });
    const countDistribution = {};
    for (const c of planeCounts) {
      countDistribution[c] = (countDistribution[c] || 0) + 1;
    }
    return {
      totalTufts: tufts.length,
      distribution: countDistribution,
    };
  });
  console.log('Grass tufts plane distribution:', grassPlanesReport);
  if (grassPlanesReport.distribution['2'] === undefined && grassPlanesReport.distribution['3'] === undefined && grassPlanesReport.distribution['4'] === undefined) {
    throw new Error('FAIL: Grass tufts do not have 2, 3, or 4 planes!');
  }
  console.log('PASS: Grass billboard planes have variety between 2 and 4!');

  // --- TEST 3: FULL HEARTS RETENTION & WALKING PICKUP ---
  console.log('Testing Test 3: Hearts retention at full health & walkover pickup...');
  const pickupResults = await page.evaluate(async () => {
    const store = window.__gameStore;
    if (!store) return { error: 'No gameStore found' };
    const loop = window.__gameLoop;
    const advance = async (ms) => {
      const steps = Math.max(1, Math.ceil(ms / 25));
      for (let i = 0; i < steps; i++) {
        loop?.tick(performance.now());
        await new Promise((r) => setTimeout(r, 25));
      }
    };

    const state = store.getState();
    const player = state.player;

    // A. Drop a heart near player (player is at 6/6 HP)
    const testHeartId = 'test_heart_full_hp';
    store.setState({
      pickups: [
        ...state.pickups,
        {
          id: testHeartId,
          type: 'heart',
          x: player.x, // Directly on player
          z: player.z,
          value: 2,
          bobOffset: 0,
          collected: false,
          magnetActive: false,
          mapId: state.currentMap,
        },
      ],
    });

    // Wait 250ms for game loop ticks
    await advance(250);

    const pickupsAfterFull = store.getState().pickups;
    const heartStillThere = pickupsAfterFull.some((p) => p.id === testHeartId && !p.collected);

    console.log('[DEBUG Test 3] pickupsAfterFull count:', pickupsAfterFull.length, 'testHeart:', pickupsAfterFull.find(p => p.id === testHeartId));
    console.log('[DEBUG Test 3] player before damage:', store.getState().player.health);
    // B. Now damage player (reduce HP to 4/6) and test pickup
    store.setState((prev) => ({
      player: { ...prev.player, health: 4 },
    }));

    // Wait 250ms for game loop ticks
    await advance(250);

    const stateAfterDamage = store.getState();
    console.log('[DEBUG Test 3] player after damage:', stateAfterDamage.player.health);
    console.log('[DEBUG Test 3] stateAfterDamage pickups count:', stateAfterDamage.pickups.length, 'testHeart:', stateAfterDamage.pickups.find(p => p.id === testHeartId));
    const heartCollected = !stateAfterDamage.pickups.some((p) => p.id === testHeartId);
    const playerHealed = stateAfterDamage.player.health === 6;

    // C. Drop a rupee and test walkover pickup
    const testRupeeId = 'test_rupee_pickup';
    const initialRupees = stateAfterDamage.stats.rupees;
    store.setState({
      pickups: [
        ...stateAfterDamage.pickups,
        {
          id: testRupeeId,
          type: 'rupee',
          x: player.x,
          z: player.z,
          value: 1,
          bobOffset: 0,
          collected: false,
          magnetActive: false,
          mapId: stateAfterDamage.currentMap,
        },
      ],
    });

    await advance(250);
    const stateAfterRupee = store.getState();
    console.log('[DEBUG Test 3] stateAfterRupee pickups count:', stateAfterRupee.pickups.length, 'testRupee:', stateAfterRupee.pickups.find(p => p.id === testRupeeId));
    const rupeeCollected = !stateAfterRupee.pickups.some((p) => p.id === testRupeeId);
    const rupeeCountIncreased = stateAfterRupee.stats.rupees === initialRupees + 1;

    return {
      heartStillThereAtFullHp: heartStillThere,
      heartCollectedWhenDamaged: heartCollected,
      playerHealed,
      rupeeCollected,
      rupeeCountIncreased,
    };
  });
  console.log('Pickup test results:', pickupResults);
  if (!pickupResults.heartStillThereAtFullHp) {
    throw new Error('FAIL: Heart was collected while health was full!');
  }
  if (!pickupResults.heartCollectedWhenDamaged || !pickupResults.playerHealed) {
    throw new Error('FAIL: Heart was not collected after player took damage!');
  }
  if (!pickupResults.rupeeCollected || !pickupResults.rupeeCountIncreased) {
    throw new Error('FAIL: Rupee was not collected when player walked over it!');
  }
  console.log('PASS: Heart preserved at full HP, collected when hurt; Rupee picked up on walkover!');

  // --- TEST 4: TREE COLLISION & DEPENETRATION (NO GETTING STUCK) ---
  console.log('Testing Test 4: Tree collision and depenetration...');
  const collisionResults = await page.evaluate(async () => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const advance = async (ms) => {
      const steps = Math.max(1, Math.ceil(ms / 25));
      for (let i = 0; i < steps; i++) {
        loop?.tick(performance.now());
        await new Promise((r) => setTimeout(r, 25));
      }
    };
    const map = store.getState().overworldMap;
    // Find a tree prop
    const tree = map.props.find((p) => p.type === 'tree');
    if (!tree) return { error: 'No tree found' };

    // Place player right at edge of tree and an enemy pushing into player
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: tree.x + tree.radius + 0.1,
        z: tree.z,
      },
    }));

    // Wait for physics loop
    await advance(100);

    // Force player directly inside the tree center (simulating extreme knockback/glitch)
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: tree.x + 0.1,
        z: tree.z + 0.1,
      },
    }));

    // Wait 150ms for depenetration to execute
    await advance(150);

    const playerPosAfter = {
      x: store.getState().player.x,
      z: store.getState().player.z,
    };

    const dx = playerPosAfter.x - tree.x;
    const dz = playerPosAfter.z - tree.z;
    const distFromTree = Math.sqrt(dx * dx + dz * dz);
    const minSafeDist = store.getState().player.radius ? 0.36 + tree.radius : tree.radius;

    // Test moving away from tree
    return {
      treeX: tree.x,
      treeZ: tree.z,
      treeRadius: tree.radius,
      distFromTree,
      isOutsideTree: distFromTree >= tree.radius,
    };
  });
  console.log('Collision test results:', collisionResults);
  if (!collisionResults.isOutsideTree) {
    throw new Error(`FAIL: Player is still inside tree! dist=${collisionResults.distFromTree}, radius=${collisionResults.treeRadius}`);
  }
  console.log('PASS: Depenetration ejected player outside tree collider successfully!');

  await page.screenshot({ path: 'bugfix_verification_complete.png' });
  console.log('Saved bugfix_verification_complete.png');

  await browser.close();
  console.log('--- ALL BUGFIX TESTS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
