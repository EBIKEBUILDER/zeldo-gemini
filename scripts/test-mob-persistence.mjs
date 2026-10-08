process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function testMobPersistence() {
  console.log('--- STARTING MOB PURSUIT PERSISTENCE VERIFICATION ---');

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
  await page.goto('http://localhost:3005', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button');
  await page.click('button');
  await new Promise((r) => setTimeout(r, 1000));

  // --- TEST 1: PERSISTENT PURSUIT BEYOND INITIAL AGGRO RADIUS ---
  console.log('Testing Test 1: Slime continues persistent chase beyond initial aggro radius...');
  const persistenceResult = await page.evaluate(async () => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 20.0, 5.0);

    // Green slime at (20.0, 8.5) -> initial distance is 3.5 (well inside aggroRadius 5.2)
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 5.0, vx: 0, vz: 0 },
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 20.0,
              z: 8.5,
              type: 'slime_green',
              mapId: 'overworld',
              isDead: false,
              state: 'idle',
            }
          : e
      ),
    }));

    // Wait 150ms for enemy to detect player and enter 'chase'
    await new Promise((r) => setTimeout(r, 150));
    const state1 = store.getState().enemies[0].state;

    // Now player moves away to distance 7.5 units (player at z = 1.0, slime around z = 8.5)
    // 7.5 units is greater than initial aggroRadius (5.2), but inside leashRadius (14.0)
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 1.0, vx: 0, vz: 0 },
    }));

    // Wait 600ms: in old code, slime dropped to 'idle' immediately.
    // In new code, slime remains in 'chase' and continues pursuing!
    await new Promise((r) => setTimeout(r, 600));
    const enemyAfterMove = store.getState().enemies[0];

    return {
      initialState: state1,
      chaseBeyondAggro: enemyAfterMove.state === 'chase',
      chaseTimer: enemyAfterMove.chaseTimer,
      slimeZ: enemyAfterMove.z,
    };
  });

  console.log('Persistence test result:', persistenceResult);
  if (persistenceResult.initialState !== 'chase') {
    throw new Error('FAIL: Slime did not aggro initially!');
  }
  if (!persistenceResult.chaseBeyondAggro) {
    throw new Error('FAIL: Slime gave up chase as soon as player moved beyond aggro radius!');
  }
  console.log('PASS: Slime persisted in chase mode well beyond initial aggro radius!\n');

  // --- TEST 2: LEASH DISTANCE BREAK ---
  console.log('Testing Test 2: Gaining significant distance (> 14 units) breaks pursuit...');
  const leashResult = await page.evaluate(async () => {
    const store = window.__gameStore;
    // Move player 16 units away (z = -8.0 relative to slime)
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: -8.0, vx: 0, vz: 0 },
    }));

    // Wait 250ms for leash check
    await new Promise((r) => setTimeout(r, 250));
    const enemy = store.getState().enemies[0];
    return {
      state: enemy.state,
      chaseTimer: enemy.chaseTimer,
    };
  });

  console.log('Leash result:', leashResult);
  if (leashResult.state !== 'idle') {
    throw new Error('FAIL: Slime did not give up chase after player gained significant distance (> leashRadius)!');
  }
  console.log('PASS: Slime broke chase after player gained significant distance!\n');

  // --- TEST 3: EXTENDED ELUSION TIMEOUT ---
  console.log('Testing Test 3: Eluding the slime for extended time (4.5s) exhausts pursuit timer...');
  const timeoutResult = await page.evaluate(async () => {
    const store = window.__gameStore;

    // Reset: re-aggro the slime
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 6.0, vx: 0, vz: 0 },
      enemies: prev.enemies.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              x: 20.0,
              z: 8.0,
              mapId: 'overworld',
              isDead: false,
              state: 'idle',
            }
          : e
      ),
    }));

    await new Promise((r) => setTimeout(r, 150));
    const aggroState = store.getState().enemies[0].state;

    // Move player to 7.5 units away (outside aggro radius, inside leash) and hold still for 4.8 seconds
    store.setState((prev) => ({
      player: { ...prev.player, x: 20.0, z: 0.5, vx: 0, vz: 0 },
    }));

    // Slime has speed 2.2 and starts around z = 8.0. Freeze slime position to simulate Link hiding / eluding
    // By keeping distance > 5.2 for 4.8s
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 240));
      store.setState((prev) => ({
        enemies: prev.enemies.map((e, idx) =>
          idx === 0 ? { ...e, z: 8.0 } : e
        ),
      }));
    }

    const finalEnemy = store.getState().enemies[0];
    return {
      aggroState,
      finalState: finalEnemy.state,
      finalTimer: finalEnemy.chaseTimer,
    };
  });

  console.log('Elusion timeout result:', timeoutResult);
  if (timeoutResult.finalState !== 'idle' && timeoutResult.finalState !== 'returning') {
    throw new Error('FAIL: Slime did not give up chase after being eluded for extended duration!');
  }
  console.log('PASS: Slime gave up chase after being completely eluded for extended duration!\n');

  await browser.close();
  console.log('=== ALL MOB PERSISTENCE TESTS PASSED SUCCESSFULLY! ===');
}

testMobPersistence().catch((err) => {
  console.error(err);
  process.exit(1);
});
