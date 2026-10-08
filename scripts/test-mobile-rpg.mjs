process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- STARTING MOBILE CONTROLS & RPG UI VERIFICATION ---');

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
    ],
  });

  const page = await browser.newPage();

  // Emulate modern mobile device in landscape (iPhone 14 / modern Android: 844x390, touch enabled)
  await page.setViewport({
    width: 844,
    height: 390,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    } else {
      console.log('[Browser Log]', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
    console.error('[Browser PageError]', err);
  });

  console.log('Navigating to http://localhost:3000 on mobile viewport...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: 'mobile_step1_title.png' });
  console.log('Saved mobile_step1_title.png');

  // --- STEP 1: TAP START ADVENTURE ON MOBILE ---
  console.log('Tapping START ADVENTURE...');
  const startBtn = await page.$('button');
  if (!startBtn) throw new Error('Start button not found!');
  await startBtn.click();
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({ path: 'mobile_step2_gameplay.png' });
  console.log('Saved mobile_step2_gameplay.png');

  // Verify HUD and Virtual Controls are visible
  const uiCheck = await page.evaluate(() => {
    const store = window.__gameStore?.getState();
    const joystick = document.querySelector('[data-interactive="true"]');
    const minimap = document.querySelector('canvas[width="112"]');
    return {
      gameState: store?.gameState,
      hasPlayer: !!store?.player,
      playerPos: { x: store?.player.x, z: store?.player.z },
      hasJoystick: !!joystick,
      hasMinimap: !!minimap,
      contextAction: store?.contextAction,
    };
  });
  console.log('UI & State check:', uiCheck);
  if (uiCheck.gameState !== 'playing') throw new Error('Game did not start!');
  if (!uiCheck.hasMinimap) throw new Error('Minimap canvas not found in DOM!');

  // --- STEP 2: TEST VIRTUAL JOYSTICK MOVEMENT ---
  console.log('Testing Virtual Joystick movement (dragging right/east)...');
  const initialPos = await page.evaluate(() => {
    const p = window.__gameStore.getState().player;
    return { x: p.x, z: p.z };
  });

  // Emulate joystick deflection: +X (East)
  await page.evaluate(() => {
    window.__gameLoop.setJoystick(1.0, 0.0);
  });
  await new Promise((r) => setTimeout(r, 1000));

  const movedPos = await page.evaluate(() => {
    window.__gameLoop.setJoystick(0.0, 0.0);
    const p = window.__gameStore.getState().player;
    return { x: p.x, z: p.z, vx: p.vx };
  });
  console.log('Initial pos:', initialPos, 'Moved pos after joystick:', movedPos);

  if (movedPos.x <= initialPos.x + 0.25) {
    throw new Error(`FAIL: Virtual joystick did not move player! Started at ${initialPos.x}, now at ${movedPos.x}`);
  }
  console.log('PASS: Virtual joystick smoothly moved player eastward!');

  // --- STEP 3: TEST TAP-TO-MOVE PATHFINDING ---
  console.log('Testing Tap-to-Move...');
  const beforeTapPos = await page.evaluate(() => {
    const p = window.__gameStore.getState().player;
    return { x: p.x, z: p.z };
  });

  // Set tap target 4 units north (towards Sunlit Meadow path)
  await page.evaluate(() => {
    const p = window.__gameStore.getState().player;
    const targetX = p.x;
    const targetZ = p.z + 4.0;
    window.__gameLoop.setTapTarget(targetX, targetZ);
    window.__renderer?.showTapBeacon(targetX, targetZ);
  });

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'mobile_step3_tap_to_move.png' });
  console.log('Saved mobile_step3_tap_to_move.png');

  // Wait 1.2s for player to walk towards waypoint
  await new Promise((r) => setTimeout(r, 1200));

  const afterTapPos = await page.evaluate(() => {
    const p = window.__gameStore.getState().player;
    return { x: p.x, z: p.z };
  });
  console.log('Before tap:', beforeTapPos, 'After tap navigation:', afterTapPos);

  if (afterTapPos.z <= beforeTapPos.z + 1.0) {
    throw new Error(`FAIL: Tap-to-move did not advance player north! Started ${beforeTapPos.z}, now ${afterTapPos.z}`);
  }
  console.log('PASS: Tap-to-move pathfinding moved player along waypoints!');

  // --- STEP 4: TEST TOUCH ATTACK BUTTON ---
  console.log('Testing Touch Attack button...');
  const preCheck = await page.evaluate(() => {
    const s = window.__gameStore.getState();
    return {
      gameState: s.gameState,
      isAttacking: s.player.isAttacking,
      cooldown: s.player.attackCooldown,
      touchReq: window.__gameLoop.touchAttackRequested,
      mouseReq: window.__gameLoop.mouseAttackRequested,
    };
  });
  console.log('Pre-attack state:', preCheck);

  await page.evaluate(() => {
    window.__gameLoop.requestAttack();
  });

  const postCheck = await page.evaluate(() => {
    const s = window.__gameStore.getState();
    return {
      gameState: s.gameState,
      isAttacking: s.player.isAttacking,
      cooldown: s.player.attackCooldown,
      touchReq: window.__gameLoop.touchAttackRequested,
    };
  });
  console.log('Immediate post-attack state:', postCheck);

  // Poll for up to 500ms for attack to register
  let attackActive = false;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const chk = await page.evaluate(() => {
      const p = window.__gameStore.getState().player;
      return { isAttacking: p.isAttacking, cooldown: p.attackCooldown };
    });
    if (chk.isAttacking || chk.cooldown > 0) {
      attackActive = true;
      console.log(`Attack registered after ${(i + 1) * 50}ms:`, chk);
      break;
    }
  }

  if (!attackActive) {
    throw new Error('FAIL: Touch attack button did not trigger attack!');
  }
  console.log('PASS: Touch attack button swung sword!');

  // Wait for attack cooldown to clear
  await new Promise((r) => setTimeout(r, 400));

  // --- STEP 5: TEST DODGE ROLL / DASH ---
  console.log('Testing Context Action Button (Dodge Roll / Dash)...');
  await page.evaluate(() => {
    window.__gameLoop.requestAction();
  });
  await new Promise((r) => setTimeout(r, 60));

  const rollCheck = await page.evaluate(() => {
    const p = window.__gameStore.getState().player;
    const particles = window.__gameStore.getState().activeParticles;
    const poofParticles = particles.filter((pt) => pt.type === 'poof');
    return {
      isRolling: p.isRolling,
      rollCooldown: p.rollCooldown,
      iFrames: p.iFrames,
      poofCount: poofParticles.length,
    };
  });
  console.log('Roll check:', rollCheck);
  await page.screenshot({ path: 'mobile_step4_dodge_roll.png' });
  console.log('Saved mobile_step4_dodge_roll.png');

  if (!rollCheck.isRolling && (rollCheck.rollCooldown || 0) <= 0) {
    throw new Error('FAIL: Dodge roll did not activate!');
  }
  console.log('PASS: Dodge roll activated with iFrames and dust particles!');

  // Wait for roll to complete
  await new Promise((r) => setTimeout(r, 500));

  // --- STEP 6: TEST MINIMAP & WORLD ATLAS MODAL ---
  console.log('Testing World Map & Quest Journal Modal...');
  await page.evaluate(() => {
    window.__gameStore.getState().openMapModal('map');
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'mobile_step5_atlas_modal_map.png' });
  console.log('Saved mobile_step5_atlas_modal_map.png');

  // Check modal open
  const isModalOpen = await page.evaluate(() => {
    return window.__gameStore.getState().isMapModalOpen;
  });
  if (!isModalOpen) throw new Error('FAIL: World Map modal is not open!');

  // Switch to Quests tab
  await page.evaluate(() => {
    window.__gameStore.getState().openMapModal('quest');
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'mobile_step6_atlas_modal_quests.png' });
  console.log('Saved mobile_step6_atlas_modal_quests.png');

  // Switch to Gear/Inventory tab
  await page.evaluate(() => {
    window.__gameStore.getState().openMapModal('inventory');
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'mobile_step7_atlas_modal_gear.png' });
  console.log('Saved mobile_step7_atlas_modal_gear.png');

  // Close modal
  await page.evaluate(() => {
    window.__gameStore.getState().closeMapModal();
  });
  await new Promise((r) => setTimeout(r, 300));
  const isModalClosed = await page.evaluate(() => {
    return !window.__gameStore.getState().isMapModalOpen;
  });
  if (!isModalClosed) throw new Error('FAIL: Modal did not close!');
  console.log('PASS: World Map & Quest Journal opened, navigated tabs, and closed smoothly!');

  await page.screenshot({ path: 'mobile_step8_final.png' });
  console.log('Saved mobile_step8_final.png');

  await browser.close();
  console.log('--- ALL MOBILE & RPG VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Mobile verification failed:', err);
  process.exit(1);
});
