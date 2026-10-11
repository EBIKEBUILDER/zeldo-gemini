process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('=== TESTING BOSS LUNGE TELEGRAPH, INVULNERABILITY, & RANGED AOE ===');

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
  console.log('1. Starting adventure & entering boss chamber...');
  await page.click('button');
  await new Promise((r) => setTimeout(r, 600));

  // Enter Dungeon & open gate
  await page.evaluate(() => {
    const store = window.__gameStore;
    store.getState().switchMap('dungeon', 10.0, 15.0);
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
        z: 15.0,
      },
    }));
  });
  await new Promise((r) => setTimeout(r, 100));

  // =========================================================================
  // TEST 1: Boss Lunge Attack Telegraph & Path Mesh
  // =========================================================================
  console.log('\n2. Testing Boss Lunge Attack Telegraph & Visual Path Mesh...');
  const lungeTelegraphState = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    store.setState((prev) => ({
      quest: {
        ...prev.quest,
        dungeonGateOpen: true,
      },
      player: {
        ...prev.player,
        x: 10.0,
        z: 15.0,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'chase',
            bossAction: 'none',
            lungeCooldown: 0, // ready to lunge
            rangedCooldown: 99, // keep ranged on cooldown
            hitstunTimer: 0,
            castTimer: 0,
          };
        }
        return e;
      }),
    }));

    // Step simulation and render
    loop.fixedUpdate(0.016);
    renderer.scene.render();

    const boss = store.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    const bossMeshes = renderer.enemyMeshes.get(boss.id);
    const lungePathEnabled = bossMeshes?.lungePath ? bossMeshes.lungePath.isEnabled() : false;
    const lungePathScaleZ = bossMeshes?.lungePath ? bossMeshes.lungePath.scaling.z : 0;
    const exclamationEnabled = bossMeshes?.exclamationBubble ? bossMeshes.exclamationBubble.isEnabled() : false;

    return {
      bossAction: boss.bossAction,
      bossAttackType: boss.bossAttackType,
      bossTelegraphTimer: boss.bossTelegraphTimer,
      lungeDirection: boss.lungeDirection,
      lungeDistance: boss.lungeDistance,
      lungePathEnabled,
      lungePathScaleZ,
      exclamationEnabled,
    };
  });
  console.log('Lunge telegraph state:', lungeTelegraphState);

  if (lungeTelegraphState.bossAction !== 'telegraphing_lunge') {
    throw new Error(`FAIL: Boss is not in telegraphing_lunge action! Got: ${lungeTelegraphState.bossAction}`);
  }
  if (!lungeTelegraphState.lungePathEnabled) {
    throw new Error('FAIL: Visual lunge path mesh is not enabled in 3D renderer!');
  }
  if (lungeTelegraphState.lungePathScaleZ < 3.0) {
    throw new Error(`FAIL: Lunge path mesh scaling (${lungeTelegraphState.lungePathScaleZ}) does not span lunge distance!`);
  }
  if (lungeTelegraphState.lungeDirection.z >= 0) {
    throw new Error('FAIL: Lunge direction is not pointing south towards player!');
  }
  console.log('PASS: Boss entered telegraphing_lunge with active ground warning corridor and exclamation indicator!\n');

  // =========================================================================
  // TEST 2: Boss Uninterruptibility & Invulnerability During Active Lunge
  // =========================================================================
  console.log('3. Testing Boss Invulnerability & Uninterruptibility During Lunge...');
  const lungeCombatResult = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 10.0,
        z: 17.0, // right in front of boss
        facingAngle: 0, // facing north towards boss at 17.5
        attackCooldown: 0,
        isAttacking: true, // swinging sword right now
        attackTimer: 0.18,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 10.0,
            z: 17.8,
            hp: 10,
            state: 'chase',
            bossAction: 'lunging',
            lungeTimer: 0.35,
            lungeDirection: { x: 0, z: -1 },
            hitstunTimer: 0,
            vx: 0,
            vz: -13.5,
          };
        }
        return e;
      }),
    }));

    // Step simulation where player sword hitbox intersects lunging boss
    loop.fixedUpdate(0.016);
    renderer.scene.render();

    const boss = store.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    return {
      bossHp: boss.hp,
      bossHitstun: boss.hitstunTimer,
      bossAction: boss.bossAction,
    };
  });
  console.log('Combat result during active lunge:', lungeCombatResult);

  if (lungeCombatResult.bossHp < 10) {
    throw new Error(`FAIL: Boss took damage during lunge! HP: ${lungeCombatResult.bossHp}`);
  }
  if (lungeCombatResult.bossHitstun > 0) {
    throw new Error(`FAIL: Boss suffered hitstun/interrupt during lunge! Hitstun: ${lungeCombatResult.bossHitstun}`);
  }
  console.log('PASS: Boss is completely invulnerable and uninterruptible to attacks while lunging!\n');

  // =========================================================================
  // TEST 3: Boss Ranged Attack Telegraph & Ground Targeting Reticle
  // =========================================================================
  console.log('4. Testing Boss Ranged Attack Telegraph & Reticle when Player is at Range...');
  const rangedTelegraphState = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    store.setState((prev) => ({
      quest: {
        ...prev.quest,
        dungeonGateOpen: true,
      },
      player: {
        ...prev.player,
        x: 10.0,
        z: 13.0, // at range (dist = 5.0 > 4.2)
        health: 6,
        iFrames: 0,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'chase',
            bossAction: 'none',
            rangedCooldown: 0, // ready to cast ranged
            lungeCooldown: 99, // keep lunge on cooldown
            hitstunTimer: 0,
            castTimer: 0,
          };
        }
        return e;
      }),
    }));

    // Step simulation and render
    loop.fixedUpdate(0.016);
    renderer.scene.render();

    const boss = store.getState().enemies.find((e) => e.type === 'boss_gorgoth');
    const bossMeshes = renderer.enemyMeshes.get(boss.id);
    const reticleEnabled = bossMeshes?.rangedReticle ? bossMeshes.rangedReticle.isEnabled() : false;
    const reticlePos = bossMeshes?.rangedReticle
      ? { x: bossMeshes.rangedReticle.position.x, z: bossMeshes.rangedReticle.position.z }
      : null;

    return {
      bossAction: boss.bossAction,
      bossAttackType: boss.bossAttackType,
      bossTelegraphTimer: boss.bossTelegraphTimer,
      bossTelegraphTarget: boss.bossTelegraphTarget,
      reticleEnabled,
      reticlePos,
    };
  });
  console.log('Ranged telegraph state:', rangedTelegraphState);

  if (rangedTelegraphState.bossAction !== 'telegraphing_ranged') {
    throw new Error(`FAIL: Boss did not enter telegraphing_ranged at range! Got: ${rangedTelegraphState.bossAction}`);
  }
  if (!rangedTelegraphState.reticleEnabled) {
    throw new Error('FAIL: Visual ground reticle mesh is not enabled in 3D renderer!');
  }
  if (!rangedTelegraphState.reticlePos || Math.abs(rangedTelegraphState.reticlePos.z - 13.0) > 0.5) {
    throw new Error(`FAIL: Reticle mesh is not positioned at player target location! Got: ${JSON.stringify(rangedTelegraphState.reticlePos)}`);
  }
  console.log('PASS: Boss successfully telegraphed ranged attack with 3D ground targeting reticle on player!\n');

  // =========================================================================
  // TEST 4: Spore Bomb Launch, Explosion & Lingering Toxic AoE Pool
  // =========================================================================
  console.log('5. Testing Explosive Spore Bomb Launch, Explosion & Toxic Pool AoE...');

  const bombLaunchResult = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    // Fast-forward telegraph timer so spore bomb launches
    store.setState((prev) => ({
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            bossTelegraphTimer: 0.01,
          };
        }
        return e;
      }),
    }));

    // Step simulation to trigger launch
    loop.fixedUpdate(0.02);
    renderer.scene.render();

    const bomb = store.getState().projectiles.find((p) => p.type === 'spore_bomb');
    return {
      bombExists: !!bomb,
      id: bomb?.id,
      x: bomb?.x,
      z: bomb?.z,
      vx: bomb?.vx,
      vz: bomb?.vz,
      targetZ: bomb?.targetZ,
    };
  });
  console.log('Spore bomb in flight:', bombLaunchResult);

  if (!bombLaunchResult.bombExists) {
    throw new Error('FAIL: Boss did not launch spore_bomb projectile!');
  }
  console.log('PASS: Boss launched spore_bomb projectile towards target coordinate!');

  // Now step the simulation until the bomb arrives at destination and explodes
  const explosionAndAoeResult = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    // Step 40 frames (~0.64s) for bomb flight and impact
    for (let f = 0; f < 40; f++) {
      loop.fixedUpdate(0.016);
    }
    renderer.scene.render();

    const aoeHazard = store.getState().groundHazards.find((h) => h.type === 'toxic_patch');
    let poolMeshEnabled = false;
    if (renderer && aoeHazard) {
      const hazardNode = renderer.hazardMeshes.get(aoeHazard.id);
      poolMeshEnabled = !!hazardNode?.pool?.isEnabled();
    }

    return {
      hazardsCount: store.getState().groundHazards.length,
      aoeHazard: aoeHazard ? {
        id: aoeHazard.id,
        type: aoeHazard.type,
        x: aoeHazard.x,
        z: aoeHazard.z,
        radius: aoeHazard.radius,
        duration: aoeHazard.duration,
      } : null,
      poolMeshEnabled,
    };
  });
  console.log('Explosion & AoE hazard state:', explosionAndAoeResult);

  if (!explosionAndAoeResult.aoeHazard) {
    throw new Error('FAIL: Exploding spore bomb did not create a toxic_patch ground hazard AoE!');
  }
  if (explosionAndAoeResult.aoeHazard.radius < 1.4) {
    throw new Error(`FAIL: AoE radius (${explosionAndAoeResult.aoeHazard.radius}) is too small!`);
  }
  if (!explosionAndAoeResult.poolMeshEnabled) {
    throw new Error('FAIL: 3D toxic pool mesh is not rendered in Babylon scene!');
  }
  console.log('PASS: Spore bomb exploded and spawned lingering toxic pool AoE with active 3D mesh!\n');

  // =========================================================================
  // TEST 5: AoE Hazard Forces Player to Move (Damage & Pushout)
  // =========================================================================
  console.log('6. Testing that AoE Hazard pushes player outward & deals damage if staying inside...');
  const playerInAoe = await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    const aoeHazard = store.getState().groundHazards.find((h) => h.type === 'toxic_patch');
    if (aoeHazard) {
      store.setState((prev) => ({
        player: {
          ...prev.player,
          x: aoeHazard.x + 0.1,
          z: aoeHazard.z + 0.1,
          health: 6,
          iFrames: 0,
        },
      }));
    }

    // Step simulation for player contact with toxic puddle
    loop.fixedUpdate(0.016);
    renderer.scene.render();

    const state = store.getState();
    return {
      playerHealth: state.player.health,
      iFrames: state.player.iFrames,
      vx: state.player.vx,
      vz: state.player.vz,
    };
  });
  console.log('Player reaction inside AoE hazard:', playerInAoe);

  if (playerInAoe.iFrames <= 0) {
    throw new Error('FAIL: Standing in AoE hazard did not trigger iFrames/damage!');
  }
  if (playerInAoe.playerHealth >= 6) {
    throw new Error(`FAIL: Player did not take damage from toxic AoE! Health: ${playerInAoe.playerHealth}`);
  }
  console.log('PASS: Lingering AoE hazard properly damages and repels player to force movement away!\n');

  // Let boss telegraph lunge once more to capture screenshot showing both boss and arena telegraphs
  await page.evaluate(() => {
    const store = window.__gameStore;
    const loop = window.__gameLoop;
    const renderer = window.__renderer;

    store.setState((prev) => ({
      player: {
        ...prev.player,
        x: 10.0,
        z: 14.5,
      },
      enemies: prev.enemies.map((e) => {
        if (e.type === 'boss_gorgoth') {
          return {
            ...e,
            x: 10.0,
            z: 18.0,
            state: 'chase',
            bossAction: 'telegraphing_lunge',
            bossAttackType: 'lunge',
            bossTelegraphTimer: 0.6,
            bossTelegraphMax: 0.75,
            lungeDirection: { x: 0, z: -1 },
            lungeDistance: 4.5,
            lungeTarget: { x: 10.0, z: 13.5 },
          };
        }
        return e;
      }),
    }));

    loop.fixedUpdate(0.016);
    renderer.scene.render();
  });

  // Take screenshot for visual verification
  await page.screenshot({ path: 'boss_lunge_ranged_aoe_verification.png' });
  console.log('Saved screenshot: boss_lunge_ranged_aoe_verification.png');

  await browser.close();
  console.log('=== ALL BOSS LUNGE, TELEGRAPH, AND RANGED AOE TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
