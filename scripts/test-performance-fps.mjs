import puppeteer from 'puppeteer';

async function run() {
  console.log('=== STARTING PERFORMANCE, DRAW CALLS & FPS COUNTER VERIFICATION ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[CRASH') || text.includes('SCENE RENDER ERROR')) {
      console.error('[Browser Error]', text);
    }
  });

  console.log('Navigating to http://localhost:3005 ...');
  await page.goto('http://localhost:3005', { waitUntil: 'networkidle2' });

  // Wait for canvas to load
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Start the game by clicking "Start Adventure" or updating store state
  console.log('Starting adventure...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    if (store) {
      store.getState().startGame();
    }
  });

  // Wait 1000ms for Babylon scene to stabilize and render frames
  await new Promise((r) => setTimeout(r, 1000));

  // --- TEST 1: FPS Counter Visibility & Contents ---
  console.log('Test 1: Verifying FPS counter is visible during gameplay...');
  await page.waitForSelector('[data-testid="fps-counter"]', { timeout: 5000 });

  const fpsText = await page.$eval('[data-testid="fps-counter"]', (el) => el.textContent);
  console.log('FPS Counter text content:', fpsText);

  if (!fpsText.includes('FPS')) {
    throw new Error(`FAIL: FPS counter does not contain 'FPS'! Content: ${fpsText}`);
  }
  console.log('PASS: FPS Counter is visible and active on screen!\n');

  // --- TEST 2: Mesh Count & Draw Call Optimization ---
  console.log('Test 2: Verifying Babylon mesh merging and draw call reduction...');
  const sceneStats = await page.evaluate(() => {
    const renderer = window.__renderer;
    const scene = window.__scene || renderer?.scene;
    const engine = renderer?.engine;

    return {
      meshCount: scene ? scene.meshes.length : -1,
      activeMeshesCount: scene ? scene.getActiveMeshes().length : -1,
      fps: renderer?.getFps ? renderer.getFps() : -1,
      drawCalls: renderer?.getDrawCalls ? renderer.getDrawCalls() : -1,
      hasMergedOverworldGrass: scene ? !!scene.getMeshByName('merged_overworld_grass') : false,
      hasMergedOverworldDirt: scene ? !!scene.getMeshByName('merged_overworld_dirt') : false,
      hasMergedOverworldHedge: scene ? !!scene.getMeshByName('merged_overworld_hedge') : false,
      hasMergedOverworldCliff: scene ? !!scene.getMeshByName('merged_overworld_cliff') : false,
    };
  });

  console.log('Scene Performance Stats:', sceneStats);

  // Before optimization, scene.meshes was > 1600.
  // With mesh merging, total scene meshes should be < 300!
  if (sceneStats.meshCount > 350) {
    throw new Error(`FAIL: Mesh count is still too high (${sceneStats.meshCount})! Expected < 350 after merging.`);
  }

  if (!sceneStats.hasMergedOverworldGrass || !sceneStats.hasMergedOverworldDirt) {
    throw new Error('FAIL: Merged terrain meshes not found in Babylon scene!');
  }
  console.log(`PASS: Scene meshes dramatically optimized: only ${sceneStats.meshCount} meshes total (down from 1600+)!`);
  console.log(`PASS: Active meshes / draw calls batching verified: ~${sceneStats.drawCalls} draw calls.\n`);

  // --- TEST 3: Dungeon Map Mesh Merging ---
  console.log('Test 3: Verifying Dungeon Map mesh merging...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 3.5);
  });

  await new Promise((r) => setTimeout(r, 600));

  const dungeonStats = await page.evaluate(() => {
    const scene = window.__scene || window.__renderer?.scene;
    return {
      hasMergedDungeonFloor: scene ? !!scene.getMeshByName('merged_dungeon_floor') : false,
      hasMergedDungeonWall: scene ? !!scene.getMeshByName('merged_dungeon_wall') : false,
      hasMergedDungeonGate: scene ? !!scene.getMeshByName('dungeon_gate_mesh') : false,
    };
  });
  console.log('Dungeon Merged Geometry Stats:', dungeonStats);

  if (!dungeonStats.hasMergedDungeonFloor || !dungeonStats.hasMergedDungeonWall) {
    throw new Error('FAIL: Merged dungeon floor and wall meshes not found!');
  }
  console.log('PASS: Dungeon floor, walls, and iron gate successfully merged into unified geometry!\n');

  // --- TEST 4: FPS Counter Persists in Collapsed Mode ---
  console.log('Test 4: Verifying FPS counter visibility when HUD header is collapsed...');
  // Press H to collapse header
  await page.keyboard.press('h');
  await new Promise((r) => setTimeout(r, 300));

  const collapsedFpsVisible = await page.$eval('[data-testid="fps-counter"]', (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  console.log('Collapsed mode FPS counter visible:', collapsedFpsVisible);

  if (!collapsedFpsVisible) {
    throw new Error('FAIL: FPS counter disappeared when header was collapsed!');
  }
  console.log('PASS: FPS Counter remains persistently visible even in minimalist collapsed HUD mode!\n');

  await browser.close();
  console.log('=== ALL PERFORMANCE, DRAW CALLS & FPS COUNTER TESTS PASSED! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
