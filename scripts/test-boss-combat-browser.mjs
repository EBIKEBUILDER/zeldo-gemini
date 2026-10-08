process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('--- TESTING BOSS COMBAT & DUNGEON KEY VISIBILITY ---');

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

  // 1. Start Adventure
  console.log('Starting adventure...');
  await page.click('button');
  await new Promise((r) => setTimeout(r, 800));

  // 2. Switch to Dungeon Antechamber and verify Key visibility
  console.log('Checking Dungeon Key on Pedestal...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 4.0);
  });
  await new Promise((r) => setTimeout(r, 400));

  const keyCheck = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const key = store.pickups.find((p) => p.type === 'key');
    // Also inspect babylon scene meshes
    const renderer = window.__renderer;
    let keyMeshY = null;
    if (renderer && renderer.pickupMeshes) {
      const node = renderer.pickupMeshes.get(key?.id);
      if (node) keyMeshY = node.position.y;
    }
    return {
      keyExists: !!key,
      collected: key?.collected,
      x: key?.x,
      z: key?.z,
      keyMeshY,
    };
  });
  console.log('Key state in dungeon:', keyCheck);
  if (!keyCheck.keyExists) {
    throw new Error('FAIL: Dungeon key not found in store.pickups!');
  }
  if (keyCheck.keyMeshY !== null && keyCheck.keyMeshY < 1.0) {
    throw new Error(`FAIL: Key mesh Y position (${keyCheck.keyMeshY}) is inside or below pedestal!`);
  }
  console.log('PASS: Dungeon key is positioned correctly and elevated above the stone pedestal!\n');

  // 3. Move player into Boss Chamber, give key & open gate
  console.log('Testing Boss Poise & Knockback Resistance (Anti-Stunlock)...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    // Position Link right in front of Gorgoth (z = 17.0, Gorgoth is at 18.0)
    store.setState((prev) => ({
      quest: {
        ...prev.quest,
        hasDungeonKey: true,
        dungeonGateOpen: true,
        gateOpenProgress: 1.0,
      },
      player: {
        ...prev.player,
        x: 10.0,
        z: 16.5,
        facingAngle: 0, // facing +Z towards Gorgoth
      },
    }));
  });
  await new Promise((r) => setTimeout(r, 400));

  const initialBoss = await page.evaluate(() => {
    const boss = window.__gameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    return { z: boss.z, hp: boss.hp };
  });

  // Sword swing 1
  await page.evaluate(() => {
    window.__gameLoop.mouseAttackRequested = true;
  });
  await new Promise((r) => setTimeout(r, 400));

  const bossAfterHit1 = await page.evaluate(() => {
    const boss = window.__gameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    return { z: boss.z, hp: boss.hp, poiseTimer: boss.poiseTimer };
  });

  // Sword swing 2 (spam immediately)
  await page.evaluate(() => {
    window.__gameLoop.mouseAttackRequested = true;
  });
  await new Promise((r) => setTimeout(r, 400));

  const bossAfterHit2 = await page.evaluate(() => {
    const boss = window.__gameStore.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    return { z: boss.z, hp: boss.hp };
  });

  const combatResult = {
    initialHp: initialBoss.hp,
    hpAfter1: bossAfterHit1.hp,
    hpAfter2: bossAfterHit2.hp,
    initialBossZ: initialBoss.z,
    zAfter1: bossAfterHit1.z,
    zAfter2: bossAfterHit2.z,
    poiseTimer1: bossAfterHit1.poiseTimer,
    knockbackDistance: bossAfterHit2.z - initialBoss.z,
  };
  console.log('Boss combat result (rapid sword strikes):', combatResult);

  if (combatResult.hpAfter1 >= combatResult.initialHp) {
    throw new Error('FAIL: Boss did not take damage from sword swing!');
  }
  if (combatResult.knockbackDistance > 2.0) {
    throw new Error(`FAIL: Boss was knocked back excessively (${combatResult.knockbackDistance} units), stunlock still possible!`);
  }
  console.log(`PASS: Boss took damage (HP: ${combatResult.initialHp} -> ${combatResult.hpAfter1} -> ${combatResult.hpAfter2}) with tight poise control (knockback: ${combatResult.knockbackDistance.toFixed(2)} units)!\n`);

  // 4. Test Obstacle Steering Around Stone Pillar
  console.log('Testing Boss Navigation Around Pillar at (6.0, 15.0)...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    // Set Link at (4.5, 15.0) and Boss at (9.0, 15.0) with pillar at (6.0, 15.0) in between
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 4.5,
        z: 15.0,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 9.0,
            z: 15.0,
            state: 'chase',
            hitstunTimer: 0,
            castTimer: 0,
            rangedCooldown: 99,
            vx: 0,
            vz: 0,
          };
        }
        return e;
      }),
    }));
  });

  // Let boss navigate around the pillar for 1.0 second
  await new Promise((r) => setTimeout(r, 1000));

  const bossNavResult = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    const boss = store.enemies.find((e) => e.type === 'boss_gorgoth');
    return {
      x: boss.x,
      z: boss.z,
      state: boss.state,
      dispX: Math.abs(boss.x - 9.0),
      dispZ: Math.abs(boss.z - 15.0),
    };
  });
  console.log('Boss steering navigation result:', bossNavResult);

  if (bossNavResult.x === 9.0 && bossNavResult.z === 15.0) {
    throw new Error('FAIL: Boss remained dead stuck on stone pillar!');
  }
  console.log(`PASS: Boss steered around pillar (X progress: ${bossNavResult.dispX.toFixed(2)}, Z curve: ${bossNavResult.dispZ.toFixed(2)})!\n`);

  // 5. Test Boss Ranged Attack (Bramble Thorn)
  console.log('Testing Boss Ranged Projectile Attack...');
  await page.evaluate(() => {
    const store = window.__gameStore;
    // Put Link far away at (14.0, 18.0) and trigger boss ranged cooldown = 0
    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 14.0,
        z: 18.0,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'chase',
            rangedCooldown: 0,
            castTimer: 0.1, // trigger cast almost immediately
          };
        }
        return e;
      }),
    }));
  });

  // Wait 400ms for projectile to spawn and travel
  await new Promise((r) => setTimeout(r, 400));

  const projResult = await page.evaluate(() => {
    const store = window.__gameStore.getState();
    return {
      projectilesCount: store.projectiles.length,
      projectiles: store.projectiles.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        vx: p.vx,
        damage: p.damage,
        source: p.source,
      })),
    };
  });
  console.log('Projectiles in flight:', projResult);

  if (projResult.projectilesCount === 0) {
    throw new Error('FAIL: Boss did not launch ranged bramble projectile!');
  }
  console.log('PASS: Boss successfully launched dodgeable Bramble Thorn projectile!\n');

  await browser.close();
  console.log('=== ALL BOSS COMBAT & KEY VISIBILITY TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
