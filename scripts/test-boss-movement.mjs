process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- TESTING BOSS GORGOTH MOVEMENT & AI ---');

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
  await new Promise((r) => setTimeout(r, 1000));

  // Enter Dungeon & Unlock Gate
  console.log('Entering Dungeon and setting player in Boss Chamber...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 14.0); // Enter at z = 14.0
    store.setState((prev) => ({
      quest: {
        ...prev.quest,
        hasDungeonKey: true,
        dungeonGateOpen: true,
      },
    }));
  });

  // Wait 300ms for loop
  await new Promise((r) => setTimeout(r, 300));

  // Check Gorgoth initial position
  const initialBoss = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const boss = store.enemies.find((e) => e.type === 'boss_gorgoth');
    return {
      x: boss.x,
      z: boss.z,
      state: boss.state,
      speed: boss.speed,
    };
  });
  console.log('Boss initial state:', initialBoss);

  // Now let the simulation run for 1 second while Gorgoth chases player (player is at z = 14.0, Gorgoth is at z = 18.0)
  console.log('Waiting 1.2s for Gorgoth to chase player down towards z = 14.0...');
  await new Promise((r) => setTimeout(r, 1200));

  const bossAfterChase = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const boss = store.enemies.find((e) => e.type === 'boss_gorgoth');
    return {
      x: boss.x,
      z: boss.z,
      state: boss.state,
      movedDistance: Math.sqrt((boss.x - 10.0) ** 2 + (boss.z - 18.0) ** 2),
    };
  });
  console.log('Boss state after chase:', bossAfterChase);

  if (bossAfterChase.state !== 'chase') {
    throw new Error(`FAIL: Boss is not in chase state! State: ${bossAfterChase.state}`);
  }

  if (bossAfterChase.movedDistance < 0.5) {
    throw new Error(`FAIL: Boss did not move! Moved distance: ${bossAfterChase.movedDistance}`);
  }

  console.log(`PASS: Boss Gorgoth moved ${bossAfterChase.movedDistance.toFixed(2)} units towards player in chase state!`);

  await browser.close();
  console.log('--- ALL BOSS TESTS PASSED! ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
