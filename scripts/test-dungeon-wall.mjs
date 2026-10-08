process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- TESTING DUNGEON DIVIDING WALL & LOCKED GATE ---');

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

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('button');

  // Start Adventure
  await page.click('button');
  await new Promise((r) => setTimeout(r, 1500));

  // Switch to Dungeon
  console.log('Entering Dungeon...');
  await page.evaluate(() => {
    window.__gameStore.getState().switchMap('dungeon', 10.0, 3.5);
  });
  await new Promise((r) => setTimeout(r, 1000));

  // --- TEST 1: VERIFY WALL BLOCKS ACCESS ON LEFT OF GATE ---
  console.log('Testing Test 1: Trying to walk through dividing wall on left (x = 6.0)...');
  const leftWallTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    // Position player at x = 6.0, z = 10.0 (in front of left dividing wall)
    store.getState().updateFromLoop({
      player: { ...store.getState().player, x: 6.0, z: 10.0, vx: 0, vz: 5.0 }, // pushing +Z into wall
    });

    // Let simulation run for 300ms (18 frames) trying to move into wall
    await new Promise((r) => setTimeout(r, 300));

    const finalZ = store.getState().player.z;
    return {
      finalZ,
      blocked: finalZ < 11.0,
    };
  });
  console.log('Left wall test result:', leftWallTest);
  if (!leftWallTest.blocked) {
    throw new Error(`FAIL: Player walked through the left dividing wall! finalZ=${leftWallTest.finalZ}`);
  }
  console.log('PASS: Left dividing wall solid and blocked player!');

  // --- TEST 2: VERIFY WALL BLOCKS ACCESS ON RIGHT OF GATE ---
  console.log('Testing Test 2: Trying to walk through dividing wall on right (x = 14.0)...');
  const rightWallTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    // Position player at x = 14.0, z = 10.0 (in front of right dividing wall)
    store.getState().updateFromLoop({
      player: { ...store.getState().player, x: 14.0, z: 10.0, vx: 0, vz: 5.0 }, // pushing +Z into wall
    });

    await new Promise((r) => setTimeout(r, 300));

    const finalZ = store.getState().player.z;
    return {
      finalZ,
      blocked: finalZ < 11.0,
    };
  });
  console.log('Right wall test result:', rightWallTest);
  if (!rightWallTest.blocked) {
    throw new Error(`FAIL: Player walked through the right dividing wall! finalZ=${rightWallTest.finalZ}`);
  }
  console.log('PASS: Right dividing wall solid and blocked player!');

  // --- TEST 3: VERIFY CLOSED GATE BLOCKS PASSAGE AT CENTER ---
  console.log('Testing Test 3: Trying to walk through closed gate at center (x = 10.0)...');
  const closedGateTest = await page.evaluate(async () => {
    const store = window.__gameStore;
    // Ensure player does NOT have key
    store.setState((prev) => ({
      quest: { ...prev.quest, hasDungeonKey: false, dungeonGateOpen: false },
    }));

    // Position player at x = 10.0, z = 10.0 (in front of closed gate) pushing north
    store.getState().updateFromLoop({
      player: { ...store.getState().player, x: 10.0, z: 10.0, vx: 0, vz: 5.0 },
    });

    await new Promise((r) => setTimeout(r, 300));

    const state = store.getState();
    const finalZ = state.player.z;
    const boss = state.enemies.find((e) => e.type === 'boss_gorgoth');
    return {
      finalZ,
      blockedByGate: finalZ < 11.2,
      gateStillClosed: !state.quest.dungeonGateOpen,
      bossDidNotAggro: boss ? boss.state === 'idle' : false,
    };
  });
  console.log('Closed gate test result:', closedGateTest);
  if (!closedGateTest.blockedByGate || !closedGateTest.gateStillClosed) {
    throw new Error(`FAIL: Player walked through closed gate or gate opened without key!`);
  }
  if (!closedGateTest.bossDidNotAggro) {
    throw new Error(`FAIL: Boss aggroed while gate was still closed!`);
  }
  console.log('PASS: Closed gate blocked center passage and boss did not aggro!');

  // --- TEST 4: PICK UP KEY, UNLOCK GATE, AND ENTER BOSS CHAMBER ---
  console.log('Testing Test 4: Picking up key and unlocking gate...');
  const unlockAndEnterTest = await page.evaluate(async () => {
    const store = window.__gameStore;

    // A. Move to key pedestal at x = 10.0, z = 6.5
    store.setState((prev) => ({
      player: { ...prev.player, x: 10.0, z: 6.5, vx: 0, vz: 0 },
    }));
    await new Promise((r) => setTimeout(r, 400));

    const hasKey = store.getState().quest.hasDungeonKey;

    // B. Approach gate to unlock at x = 10.0, z = 10.5
    store.setState((prev) => ({
      player: { ...prev.player, x: 10.0, z: 10.5, vx: 0, vz: 2.0 },
    }));
    await new Promise((r) => setTimeout(r, 500));

    const gateOpened = store.getState().quest.dungeonGateOpen;

    // C. Walk through open gate into Boss Chamber (z = 14.0)
    store.setState((prev) => ({
      player: { ...prev.player, x: 10.0, z: 14.0, vx: 0, vz: 0 },
    }));
    await new Promise((r) => setTimeout(r, 500));

    const stateInBossRoom = store.getState();
    const playerInBossRoom = stateInBossRoom.player.z >= 13.0;
    const boss = stateInBossRoom.enemies.find((e) => e.type === 'boss_gorgoth');

    return {
      hasKey,
      gateOpened,
      playerInBossRoom,
      bossState: boss ? boss.state : 'unknown',
    };
  });
  console.log('Unlock and enter test result:', unlockAndEnterTest);
  if (!unlockAndEnterTest.hasKey) {
    throw new Error('FAIL: Key was not collected from pedestal!');
  }
  if (!unlockAndEnterTest.gateOpened) {
    throw new Error('FAIL: Gate did not unlock after approaching with key!');
  }
  if (!unlockAndEnterTest.playerInBossRoom) {
    throw new Error('FAIL: Player could not enter boss room through open gate!');
  }
  console.log('PASS: Key successfully collected, gate unlocked, and player entered boss room!');

  await browser.close();
  console.log('--- ALL DUNGEON WALL & GATE TESTS PASSED! ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
