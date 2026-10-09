process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- TESTING OVERWORLD & DUNGEON MONSTER PATHFINDING ---');

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
  console.log('Starting adventure...');
  await page.click('button');
  await new Promise((r) => setTimeout(r, 600));

  // TEST 1: Overworld Slime pathfinding around a Tree
  // Tree in Sunlit Meadow is at (26.0, 3.5) with radius 0.65
  // Place Slime at (26.0, 1.5) and Player at (26.0, 5.5) with the tree directly between them
  console.log('Test 1: Overworld Slime pathfinding around Tree at (26.0, 3.5)...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 26.0, 5.5);
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 26.0,
        z: 5.5,
      },
      enemies: prev.enemies.map((e) => {
        if (e.mapId === 'overworld' && e.type === 'slime_green') {
          return {
            ...e,
            x: 26.0,
            z: 1.5,
            state: 'chase',
            chaseTimer: 4.5,
            hitstunTimer: 0,
            vx: 0,
            vz: 0,
          };
        }
        return e;
      }),
    }));
  });

  // Let slime steer around the tree for 1.75 seconds (sampling inside browser context to keep rAF active)
  const slimeResult = await page.evaluate(async () => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    for (let i = 0; i < 70; i++) {
      loop?.tick(performance.now());
      await new Promise((r) => setTimeout(r, 25));
    }
    const slime = store.getState().enemies.find((e) => e.mapId === 'overworld' && e.type === 'slime_green');
    return {
      x: slime.x,
      z: slime.z,
      state: slime.state,
      dispX: Math.abs(slime.x - 26.0),
      dispZ: slime.z - 1.5,
    };
  });
  console.log('Slime navigation result around tree:', slimeResult);

  if (slimeResult.x === 26.0 && Math.abs(slimeResult.z - 2.4) < 0.1) {
    throw new Error('FAIL: Slime ran straight into tree trunk and got stuck!');
  }
  if (slimeResult.dispX < 0.3) {
    throw new Error(`FAIL: Slime did not steer around tree! dispX = ${slimeResult.dispX}`);
  }
  console.log(`PASS: Overworld slime steered around tree (X deviation: ${slimeResult.dispX.toFixed(2)}, Z progress: ${slimeResult.dispZ.toFixed(2)})!\n`);

  // TEST 2: Overworld Red Slime pathfinding around Rock
  // Rock at (15.0, 6.8) with radius 0.65
  // Place Slime at (13.5, 6.8) and Player at (16.5, 6.8) with rock directly in between
  console.log('Test 2: Red Slime pathfinding around Rock at (15.0, 6.8)...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('overworld', 16.5, 6.8);
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 16.5,
        z: 6.8,
      },
      enemies: prev.enemies.map((e) => {
        if (e.mapId === 'overworld' && e.type === 'slime_red') {
          return {
            ...e,
            x: 13.5,
            z: 6.8,
            state: 'chase',
            hitstunTimer: 0,
            vx: 0,
            vz: 0,
          };
        }
        return e;
      }),
    }));
  });

  const redSlimeResult = await page.evaluate(async () => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    let maxDispZ = 0;
    let finalX = 0;
    let finalZ = 0;

    for (let i = 0; i < 50; i++) {
      loop?.tick(performance.now());
      await new Promise((r) => setTimeout(r, 25));
      const slime = store.getState().enemies.find((e) => e.mapId === 'overworld' && e.type === 'slime_red');
      if (slime) {
        const dZ = Math.abs(slime.z - 6.8);
        if (dZ > maxDispZ) maxDispZ = dZ;
        finalX = slime.x;
        finalZ = slime.z;
      }
    }

    return {
      x: finalX,
      z: finalZ,
      dispX: finalX - 13.5,
      maxDispZ,
    };
  });
  console.log('Red slime navigation result around rock:', redSlimeResult);

  if (redSlimeResult.maxDispZ < 0.25) {
    throw new Error(`FAIL: Red slime did not steer around rock! maxDispZ = ${redSlimeResult.maxDispZ}`);
  }
  console.log(`PASS: Red slime steered around rock (max Z deviation: ${redSlimeResult.maxDispZ.toFixed(2)}, X progress: ${redSlimeResult.dispX.toFixed(2)})!\n`);

  await browser.close();
  console.log('=== ALL MONSTER PATHFINDING TESTS PASSED! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
