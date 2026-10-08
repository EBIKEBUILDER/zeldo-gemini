import {
  FIXED_TIMESTEP,
  MAX_SIMULATION_SUBSTEPS,
  PLAYER_SPEED,
  PLAYER_ACCEL,
  PLAYER_FRICTION,
  PLAYER_RADIUS,
  PLAYER_IFRAMES_DURATION,
  PLAYER_ATTACK_DURATION,
  PLAYER_ATTACK_COOLDOWN,
  SPAWN_POSITION,
  SPAWN_SAFE_RADIUS,
  DUNGEON_ENTRANCE_POS,
  DUNGEON_SPAWN_POS,
  DUNGEON_EXIT_POS,
  DUNGEON_GATE_POS,
  DUNGEON_CHEST_POS,
  PICKUP_MAGNET_RADIUS,
  PICKUP_COLLECT_RADIUS,
  PICKUP_MAGNET_SPEED,
  ENEMY_SETTINGS,
} from '../constants';
import {
  resolveWallSliding,
  resolveCircleRepulsion,
  isInsideSwordSweep,
  depenetrateFromObstacles,
  isPositionBlocked,
  hasLineOfSight,
  resolveSmartSteering,
} from './physics';
import { useGameStore } from '../state/gameStore';
import { soundManager } from '@/audio/soundManager';
import { ParticleState, Vector2D, ProjectileState } from '@/types/game';

class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private rafId: number | null = null;

  // Active inputs
  public keys: Record<string, boolean> = {};
  public mouseAttackRequested: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.tick = this.tick.bind(this);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('pointerdown', this.handlePointerDown, { capture: true });
      window.addEventListener('mousedown', this.handlePointerDown, { capture: true });
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('pointerdown', this.handlePointerDown, { capture: true });
      window.removeEventListener('mousedown', this.handlePointerDown, { capture: true });
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    this.keys[key] = true;

    // Toggle mute with 'm'
    if (key === 'm') {
      useGameStore.getState().toggleMute();
      return;
    }

    // Start or Retry on Enter
    const state = useGameStore.getState();
    if (key === 'enter') {
      if (state.gameState === 'title' || state.gameState === 'game_over' || state.gameState === 'victory') {
        state.startGame();
        return;
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
  }

  private handlePointerDown(e: PointerEvent | MouseEvent) {
    if (e.button === 0) {
      // Do not trigger sword swing if clicking an interactive UI button (e.g. Mute, Retry)
      if ((e.target as HTMLElement)?.closest('button')) {
        return;
      }

      this.mouseAttackRequested = true;
      const state = useGameStore.getState();
      if (state.gameState === 'title' || state.gameState === 'game_over' || state.gameState === 'victory') {
        state.startGame();
      }
    }
  }

  private handleMouseDown(e: MouseEvent) {
    this.handlePointerDown(e);
  }

  private tick(now: number) {
    if (!this.isRunning) return;

    let deltaSeconds = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp huge lag spikes (e.g. tab switched away)
    if (deltaSeconds > 0.25) deltaSeconds = 0.25;

    this.accumulator += deltaSeconds;

    let substeps = 0;
    while (this.accumulator >= FIXED_TIMESTEP && substeps < MAX_SIMULATION_SUBSTEPS) {
      this.fixedUpdate(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
      substeps++;
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  // --- FIXED TIMESTEP SIMULATION TICK (60 Hz) ---
  private fixedUpdate(dt: number) {
    const store = useGameStore.getState();

    // Only simulate gameplay while in 'playing' state
    if (store.gameState !== 'playing') return;

    const currentMapData = store.currentMap === 'dungeon' ? store.dungeonMap : store.overworldMap;
    const player = { ...store.player };
    const enemies = store.enemies.map((e) => ({ ...e }));
    const breakables = store.breakables.map((b) => ({ ...b }));
    const pickups = store.pickups.map((p) => ({ ...p }));
    const projectiles = (store.projectiles || []).map((p) => ({ ...p }));
    let activeParticles = [...store.activeParticles];
    const quest = { ...store.quest };
    const stats = { ...store.stats };

    let screenShake = Math.max(0, store.screenShake - dt * 1.5);
    let damageFlash = Math.max(0, store.damageFlash - dt * 2.2);

    let banner = store.banner ? { ...store.banner } : null;
    if (banner) {
      banner.duration -= dt;
      if (banner.duration <= 0) banner = null;
    }

    // --- 1. PLAYER INPUT & ACCELERATION ---
    // Critical: D moves right (+X), A moves left (-X), W moves up (+Z), S moves down (-Z)
    let inputX = 0;
    let inputZ = 0;

    if (this.keys['d'] || this.keys['arrowright']) inputX += 1;
    if (this.keys['a'] || this.keys['arrowleft']) inputX -= 1;
    if (this.keys['w'] || this.keys['arrowup']) inputZ += 1;
    if (this.keys['s'] || this.keys['arrowdown']) inputZ -= 1;

    // Attack input (Space, Enter, Z, J, or mouse click)
    const attackRequested =
      this.keys[' '] || this.keys['z'] || this.keys['j'] || this.mouseAttackRequested;
    this.mouseAttackRequested = false;

    // Normalize diagonal input
    if (inputX !== 0 && inputZ !== 0) {
      const invLen = 1 / Math.SQRT2;
      inputX *= invLen;
      inputZ *= invLen;
    }

    const isMoving = inputX !== 0 || inputZ !== 0;
    player.isMoving = isMoving;

    // Smooth acceleration & friction
    if (isMoving) {
      const targetVx = inputX * PLAYER_SPEED;
      const targetVz = inputZ * PLAYER_SPEED;

      player.vx += (targetVx - player.vx) * Math.min(1, PLAYER_ACCEL * dt);
      player.vz += (targetVz - player.vz) * Math.min(1, PLAYER_ACCEL * dt);

      // Update 8-way facing angle (in radians: 0 = +Z, PI/2 = +X, PI = -Z, -PI/2 = -X)
      player.facingAngle = Math.atan2(inputX, inputZ);

      // Walk cycle animation
      player.walkCycle += dt * 12.0;
    } else {
      // Friction / deceleration to standstill
      const frictionStep = PLAYER_FRICTION * dt;
      const speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
      if (speed > 0.001) {
        const newSpeed = Math.max(0, speed - frictionStep);
        player.vx = (player.vx / speed) * newSpeed;
        player.vz = (player.vz / speed) * newSpeed;
      } else {
        player.vx = 0;
        player.vz = 0;
      }
    }

    // --- 2. PLAYER WALL-SLIDING MOVEMENT ---
    const desiredDx = player.vx * dt;
    const desiredDz = player.vz * dt;

    const resolvedPos = resolveWallSliding(
      player.x,
      player.z,
      desiredDx,
      desiredDz,
      PLAYER_RADIUS,
      currentMapData,
      quest.dungeonGateOpen,
      store.currentMap
    );
    player.x = resolvedPos.x;
    player.z = resolvedPos.z;

    const depenPlayer = depenetrateFromObstacles(
      { x: player.x, z: player.z },
      PLAYER_RADIUS,
      currentMapData,
      quest.dungeonGateOpen,
      store.currentMap
    );
    player.x = depenPlayer.x;
    player.z = depenPlayer.z;

    // --- 3. PLAYER ATTACK & SWORD HITBOX ---
    if (player.attackCooldown > 0) {
      player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    }

    if (player.isAttacking) {
      player.attackTimer -= dt;
      if (player.attackTimer <= 0) {
        player.isAttacking = false;
      }
    } else if (attackRequested && player.attackCooldown <= 0) {
      player.isAttacking = true;
      player.attackTimer = PLAYER_ATTACK_DURATION;
      player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
      soundManager.playSwordSwing();

      // Check hits against breakables
      breakables.forEach((item) => {
        if (item.mapId === store.currentMap && !item.isBroken) {
          if (
            isInsideSwordSweep(
              player.x,
              player.z,
              player.facingAngle,
              item.x,
              item.z,
              item.radius
            )
          ) {
            item.isBroken = true;

            if (item.type === 'grass') {
              soundManager.playGrassCut();
              stats.grassCut++;
              // Spawn leaf particles
              for (let i = 0; i < 5; i++) {
                activeParticles.push({
                  id: `leaf_${Date.now()}_${Math.random()}`,
                  type: 'leaf',
                  x: item.x + (Math.random() - 0.5) * 0.4,
                  y: 0.35,
                  z: item.z + (Math.random() - 0.5) * 0.4,
                  vx: (Math.random() - 0.5) * 2.5,
                  vy: 2.0 + Math.random() * 2.0,
                  vz: (Math.random() - 0.5) * 2.5,
                  size: 0.12,
                  color: '#49b83b',
                  life: 0.4,
                  maxLife: 0.4,
                });
              }
              // Drop chance: 45% rupee, 20% heart
              const roll = Math.random();
              if (roll < 0.45) {
                pickups.push({
                  id: `rupee_${Date.now()}_${Math.random()}`,
                  type: 'rupee',
                  x: item.x,
                  z: item.z,
                  value: 1,
                  bobOffset: Math.random() * Math.PI,
                  collected: false,
                  magnetActive: false,
                  mapId: store.currentMap,
                });
              } else if (roll < 0.65) {
                pickups.push({
                  id: `heart_${Date.now()}_${Math.random()}`,
                  type: 'heart',
                  x: item.x,
                  z: item.z,
                  value: 2,
                  bobOffset: Math.random() * Math.PI,
                  collected: false,
                  magnetActive: false,
                  mapId: store.currentMap,
                });
              }
            } else if (item.type === 'pot') {
              soundManager.playPotSmash();
              stats.potsBroken++;
              // Spawn shard particles
              for (let i = 0; i < 7; i++) {
                activeParticles.push({
                  id: `shard_${Date.now()}_${Math.random()}`,
                  type: 'shard',
                  x: item.x + (Math.random() - 0.5) * 0.3,
                  y: 0.4,
                  z: item.z + (Math.random() - 0.5) * 0.3,
                  vx: (Math.random() - 0.5) * 3.5,
                  vy: 2.8 + Math.random() * 2.5,
                  vz: (Math.random() - 0.5) * 3.5,
                  size: 0.14,
                  color: '#d66e3b',
                  life: 0.5,
                  maxLife: 0.5,
                });
              }
              // Drop chance: 60% rupee, 30% heart
              const roll = Math.random();
              if (roll < 0.6) {
                pickups.push({
                  id: `rupee_${Date.now()}_${Math.random()}`,
                  type: 'rupee',
                  x: item.x,
                  z: item.z,
                  value: 1,
                  bobOffset: Math.random() * Math.PI,
                  collected: false,
                  magnetActive: false,
                  mapId: store.currentMap,
                });
              } else if (roll < 0.9) {
                pickups.push({
                  id: `heart_${Date.now()}_${Math.random()}`,
                  type: 'heart',
                  x: item.x,
                  z: item.z,
                  value: 2,
                  bobOffset: Math.random() * Math.PI,
                  collected: false,
                  magnetActive: false,
                  mapId: store.currentMap,
                });
              }
            }
          }
        }
      });

      // Check hits against enemies
      enemies.forEach((enemy) => {
        if (enemy.mapId === store.currentMap && !enemy.isDead && enemy.hitstunTimer <= 0) {
          if (
            isInsideSwordSweep(
              player.x,
              player.z,
              player.facingAngle,
              enemy.x,
              enemy.z,
              enemy.radius
            )
          ) {
            enemy.hp -= 1;
            enemy.hitFlashTimer = 0.16;

            // Knockback calculation
            let kx = enemy.x - player.x;
            let kz = enemy.z - player.z;
            const dist = Math.sqrt(kx * kx + kz * kz) || 0.001;
            kx /= dist;
            kz /= dist;

            if (enemy.type === 'boss_gorgoth') {
              if (enemy.poiseTimer && enemy.poiseTimer > 0) {
                // Boss Hyper-Armor Poise: Attacks cannot interrupt or knock Gorgoth back!
                // Prevents infinite sword-spam stunlock cheese.
                enemy.hitstunTimer = 0;
                enemy.vx = 0;
                enemy.vz = 0;
              } else {
                // Flinch briefly, then activate hyper-armor poise window
                enemy.hitstunTimer = 0.08;
                enemy.poiseTimer = ENEMY_SETTINGS.boss_gorgoth.poiseDuration;
                const force = ENEMY_SETTINGS.boss_gorgoth.knockbackForce;
                enemy.vx = kx * force;
                enemy.vz = kz * force;
              }
            } else {
              enemy.hitstunTimer = 0.28;
              const force = 8.0;
              enemy.vx = kx * force;
              enemy.vz = kz * force;
            }

            soundManager.playSwordHit();
            soundManager.playEnemyHurt();

            // Spawn bright impact sparks
            for (let i = 0; i < 6; i++) {
              activeParticles.push({
                id: `spark_${Date.now()}_${Math.random()}`,
                type: 'spark',
                x: enemy.x + (Math.random() - 0.5) * 0.4,
                y: 0.6,
                z: enemy.z + (Math.random() - 0.5) * 0.4,
                vx: (Math.random() - 0.5) * 5.0,
                vy: 2.0 + Math.random() * 3.0,
                vz: (Math.random() - 0.5) * 5.0,
                size: 0.1,
                color: '#fff375',
                life: 0.35,
                maxLife: 0.35,
              });
            }

            // Check if enemy died
            if (enemy.hp <= 0) {
              enemy.isDead = true;
              enemy.respawnTimer = 20.0;
              stats.enemiesDefeated++;
              soundManager.playEnemyDeath();

              // Spawn death poof smoke particles
              for (let i = 0; i < 10; i++) {
                activeParticles.push({
                  id: `poof_${Date.now()}_${Math.random()}`,
                  type: 'poof',
                  x: enemy.x + (Math.random() - 0.5) * 0.6,
                  y: 0.5 + Math.random() * 0.5,
                  z: enemy.z + (Math.random() - 0.5) * 0.6,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: 1.0 + Math.random() * 1.5,
                  vz: (Math.random() - 0.5) * 1.5,
                  size: 0.35,
                  color: '#e2e8f0',
                  life: 0.45,
                  maxLife: 0.45,
                });
              }

              // Boss death handling
              if (enemy.type === 'boss_gorgoth') {
                quest.bossDefeated = true;
                quest.chestSpawned = true;
                const chestProp = currentMapData.props.find((p) => p.id === 'treasure_chest');
                if (chestProp) {
                  chestProp.radius = 0.65;
                }
                soundManager.stopMusic();
                soundManager.playVictory();

                banner = {
                  title: 'Gorgoth Defeated!',
                  message: 'The Bramble King is slain! The Sunstone Chest is unlocked.',
                  icon: 'chest',
                  duration: 6.0,
                };

                // Boss drops a circle of 5 rupees
                for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 5) {
                  pickups.push({
                    id: `boss_rupee_${Date.now()}_${a}`,
                    type: 'rupee',
                    x: enemy.x + Math.sin(a) * 1.4,
                    z: enemy.z + Math.cos(a) * 1.4,
                    value: 1,
                    bobOffset: a,
                    collected: false,
                    magnetActive: false,
                    mapId: 'dungeon',
                  });
                }
              } else {
                // Normal enemy drop
                pickups.push({
                  id: `enemy_drop_${Date.now()}`,
                  type: Math.random() < 0.75 ? 'rupee' : 'heart',
                  x: enemy.x,
                  z: enemy.z,
                  value: 1,
                  bobOffset: Math.random() * Math.PI,
                  collected: false,
                  magnetActive: false,
                  mapId: store.currentMap,
                });
              }
            }
          }
        }
      });

      // Check hits against projectiles (Deflect/slice bramble thorns!)
      projectiles.forEach((proj) => {
        if (proj.mapId === store.currentMap && proj.life > 0) {
          if (
            isInsideSwordSweep(
              player.x,
              player.z,
              player.facingAngle,
              proj.x,
              proj.z,
              proj.radius,
              1.2
            )
          ) {
            proj.life = 0;
            soundManager.playSwordHit();
            for (let i = 0; i < 5; i++) {
              activeParticles.push({
                id: `proj_slice_${Date.now()}_${Math.random()}`,
                type: 'leaf',
                x: proj.x,
                y: 0.6,
                z: proj.z,
                vx: (Math.random() - 0.5) * 4.0,
                vy: 1.5 + Math.random() * 2.5,
                vz: (Math.random() - 0.5) * 4.0,
                size: 0.12,
                color: '#7bc637',
                life: 0.35,
                maxLife: 0.35,
              });
            }
          }
        }
      });
    }

    // --- 4. PLAYER INVULNERABILITY & BLINKING ---
    if (player.iFrames > 0) {
      player.iFrames = Math.max(0, player.iFrames - dt);
      player.isBlinking = Math.floor(player.iFrames * 12) % 2 === 0;
    } else {
      player.isBlinking = false;
    }

    // --- 5. ENEMY AI & CONTACT DAMAGE ---
    enemies.forEach((enemy) => {
      if (enemy.mapId !== store.currentMap) return;

      if (enemy.isDead) {
        // Boss never respawns; overworld enemies respawn after 20s
        if (enemy.type !== 'boss_gorgoth') {
          enemy.respawnTimer -= dt;
          if (enemy.respawnTimer <= 0) {
            enemy.isDead = false;
            enemy.hp = enemy.maxHp;
            enemy.x = enemy.spawnX;
            enemy.z = enemy.spawnZ;
            enemy.vx = 0;
            enemy.vz = 0;
            enemy.hitstunTimer = 0;
            enemy.hitFlashTimer = 0;
          }
        }
        return;
      }

      // Decrement timers
      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      if (enemy.poiseTimer && enemy.poiseTimer > 0) enemy.poiseTimer = Math.max(0, enemy.poiseTimer - dt);
      if (enemy.rangedCooldown !== undefined && enemy.rangedCooldown > 0) enemy.rangedCooldown = Math.max(0, enemy.rangedCooldown - dt);

      if (enemy.hitstunTimer > 0) {
        enemy.hitstunTimer -= dt;
        // Apply knockback slide
        const knockPos = resolveWallSliding(
          enemy.x,
          enemy.z,
          enemy.vx * dt,
          enemy.vz * dt,
          enemy.radius,
          currentMapData,
          quest.dungeonGateOpen,
          store.currentMap
        );
        enemy.x = knockPos.x;
        enemy.z = knockPos.z;
        enemy.vx *= 0.88;
        enemy.vz *= 0.88;
        return;
      }

      // Check distance to player
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      // FAIRNESS: If in overworld and player is near spawn, suppress aggro!
      const playerDistToSpawn = Math.sqrt(
        (player.x - SPAWN_POSITION.x) ** 2 + (player.z - SPAWN_POSITION.z) ** 2
      );
      const isPlayerInSpawnSafeZone =
        store.currentMap === 'overworld' && playerDistToSpawn < SPAWN_SAFE_RADIUS;

      const aggroRadius = enemy.type === 'boss_gorgoth' ? 16.0 : 5.5;

      // Boss Gorgoth only aggros once gate is unlocked and player approaches/enters the sanctum
      const canBossAggro =
        enemy.type !== 'boss_gorgoth' || (quest.dungeonGateOpen && player.z >= 11.0);

      if (!isPlayerInSpawnSafeZone && canBossAggro && distToPlayer < aggroRadius) {
        // Aggro & Chase!
        enemy.state = 'chase';

        const isBoss = enemy.type === 'boss_gorgoth';

        // Hop cycle
        enemy.hopCycle += dt * (isBoss ? 4.0 : 6.0);
        const moveSpeed = enemy.speed * (0.8 + 0.4 * Math.max(0, Math.sin(enemy.hopCycle)));

        if (isBoss) {
          // If boss is winding up a ranged bramble shot, pause movement to telegraph
          if (enemy.castTimer && enemy.castTimer > 0) {
            enemy.facingAngle = Math.atan2(dx, dz);
            // Spawn swirling toxic briar particles
            if (Math.random() < 0.4) {
              activeParticles.push({
                id: `briar_${Date.now()}_${Math.random()}`,
                type: 'leaf',
                x: enemy.x + (Math.random() - 0.5) * 1.3,
                y: 0.5 + Math.random() * 0.7,
                z: enemy.z + (Math.random() - 0.5) * 1.3,
                vx: (Math.random() - 0.5) * 1.6,
                vy: 1.2 + Math.random() * 1.8,
                vz: (Math.random() - 0.5) * 1.6,
                size: 0.12,
                color: '#52b724',
                life: 0.35,
                maxLife: 0.35,
              });
            }
          } else {
            // Smart steering navigation around pillars, walls, and obstacles
            const steer = resolveSmartSteering(
              enemy.x,
              enemy.z,
              player.x,
              player.z,
              moveSpeed,
              dt,
              enemy.radius,
              currentMapData,
              quest.dungeonGateOpen,
              store.currentMap,
              enemy.steeringBias || 1
            );
            enemy.x = steer.x;
            enemy.z = steer.z;
            enemy.facingAngle = steer.facingAngle;
            enemy.steeringBias = steer.chosenBias;
          }

          // Boss Ranged Bramble Attack
          if (!quest.bossDefeated) {
            if (enemy.rangedCooldown === undefined) {
              enemy.rangedCooldown = 2.0; // initial grace period upon entering boss room
            }

            if (enemy.castTimer && enemy.castTimer > 0) {
              enemy.castTimer -= dt;
              if (enemy.castTimer <= 0) {
                // Launch bramble thorn projectile towards player
                const pDist = Math.sqrt(dx * dx + dz * dz) || 0.001;
                const pSpeed = ENEMY_SETTINGS.boss_gorgoth.projectileSpeed;
                projectiles.push({
                  id: `proj_boss_${Date.now()}_${Math.random()}`,
                  x: enemy.x + (dx / pDist) * 1.1,
                  z: enemy.z + (dz / pDist) * 1.1,
                  vx: (dx / pDist) * pSpeed,
                  vz: (dz / pDist) * pSpeed,
                  radius: ENEMY_SETTINGS.boss_gorgoth.projectileRadius,
                  damage: ENEMY_SETTINGS.boss_gorgoth.projectileDamage,
                  life: 3.5,
                  maxLife: 3.5,
                  source: 'boss',
                  color: '#7bc637',
                  mapId: 'dungeon',
                });
                soundManager.playBossShoot();
                enemy.rangedCooldown = ENEMY_SETTINGS.boss_gorgoth.projectileCooldown + (Math.random() * 0.8 - 0.4);
              }
            } else if (enemy.rangedCooldown <= 0) {
              const hasClearLoS = hasLineOfSight(
                enemy.x,
                enemy.z,
                player.x,
                player.z,
                0.4,
                currentMapData,
                quest.dungeonGateOpen,
                store.currentMap
              );
              // Trigger ranged attack if player is keeping distance, hiding behind a pillar, or periodically
              if (distToPlayer > 3.0 || !hasClearLoS || distToPlayer > 2.2) {
                enemy.castTimer = ENEMY_SETTINGS.boss_gorgoth.projectileWindup;
              } else {
                enemy.rangedCooldown = 1.0;
              }
            }
          }
        } else {
          // Standard slime chase
          enemy.facingAngle = Math.atan2(dx, dz);
          const moveDx = (dx / distToPlayer) * moveSpeed * dt;
          const moveDz = (dz / distToPlayer) * moveSpeed * dt;

          const resolved = resolveWallSliding(
            enemy.x,
            enemy.z,
            moveDx,
            moveDz,
            enemy.radius,
            currentMapData,
            quest.dungeonGateOpen,
            store.currentMap
          );
          enemy.x = resolved.x;
          enemy.z = resolved.z;
        }

        // Contact damage against player
        const touchDist = enemy.radius + PLAYER_RADIUS;
        if (distToPlayer < touchDist && player.iFrames <= 0 && enemy.attackCooldown <= 0) {
          player.health = Math.max(0, player.health - enemy.damage);
          player.iFrames = 1.1;
          enemy.attackCooldown = 0.8;
          screenShake = 0.4;
          damageFlash = 0.85;

          soundManager.playPlayerHurt();

          // Knock player back away from enemy
          const pKnockX = (dx / distToPlayer) * 7.5;
          const pKnockZ = (dz / distToPlayer) * 7.5;
          player.vx = pKnockX;
          player.vz = pKnockZ;

          // Check for Game Over
          if (player.health <= 0) {
            soundManager.stopMusic();
            soundManager.playGameOver();
            useGameStore.setState({
              gameState: 'game_over',
              player,
              stats,
            });
            return;
          }
        }
      } else {
        // Idle wander
        enemy.state = 'idle';
        enemy.hopCycle += dt * 2.0;
        if (Math.sin(enemy.hopCycle) > 0.8) {
          const wanderDx = Math.sin(enemy.facingAngle) * enemy.speed * 0.4 * dt;
          const wanderDz = Math.cos(enemy.facingAngle) * enemy.speed * 0.4 * dt;
          const resolved = resolveWallSliding(
            enemy.x,
            enemy.z,
            wanderDx,
            wanderDz,
            enemy.radius,
            currentMapData,
            quest.dungeonGateOpen,
            store.currentMap
          );
          enemy.x = resolved.x;
          enemy.z = resolved.z;
        } else if (Math.random() < 0.02) {
          enemy.facingAngle = Math.random() * Math.PI * 2;
        }
      }
    });

    // --- 6. ENTITY SOLIDITY REPULSION (No Overlapping!) ---
    // Push player & enemies apart
    enemies.forEach((enemy) => {
      if (enemy.mapId !== store.currentMap || enemy.isDead) return;

      const repulsion = resolveCircleRepulsion(
        { x: player.x, z: player.z, radius: PLAYER_RADIUS },
        { x: enemy.x, z: enemy.z, radius: enemy.radius },
        enemy.type === 'boss_gorgoth' ? 0.8 : 0.4
      );

      if (repulsion) {
        // Constrain player movement against props and walls
        const resolvedPlayer = resolveWallSliding(
          player.x,
          player.z,
          repulsion.deltaA.x,
          repulsion.deltaA.z,
          PLAYER_RADIUS,
          currentMapData,
          quest.dungeonGateOpen,
          store.currentMap
        );

        const moveX = resolvedPlayer.x - player.x;
        const moveZ = resolvedPlayer.z - player.z;
        player.x = resolvedPlayer.x;
        player.z = resolvedPlayer.z;

        // If player was blocked by a wall or tree, transfer remainder to enemy
        const extraEnemyX = repulsion.deltaA.x - moveX;
        const extraEnemyZ = repulsion.deltaA.z - moveZ;

        const resolvedEnemy = resolveWallSliding(
          enemy.x,
          enemy.z,
          repulsion.deltaB.x - extraEnemyX,
          repulsion.deltaB.z - extraEnemyZ,
          enemy.radius,
          currentMapData,
          quest.dungeonGateOpen,
          store.currentMap
        );
        enemy.x = resolvedEnemy.x;
        enemy.z = resolvedEnemy.z;
      }
    });

    // Safety depenetration pass after all repulsions
    const postRepulsionDepen = depenetrateFromObstacles(
      { x: player.x, z: player.z },
      PLAYER_RADIUS,
      currentMapData,
      quest.dungeonGateOpen,
      store.currentMap
    );
    player.x = postRepulsionDepen.x;
    player.z = postRepulsionDepen.z;

    // Push enemies away from each other
    for (let i = 0; i < enemies.length; i++) {
      const e1 = enemies[i];
      if (e1.mapId !== store.currentMap || e1.isDead) continue;

      for (let j = i + 1; j < enemies.length; j++) {
        const e2 = enemies[j];
        if (e2.mapId !== store.currentMap || e2.isDead) continue;

        const repulsion = resolveCircleRepulsion(
          { x: e1.x, z: e1.z, radius: e1.radius },
          { x: e2.x, z: e2.z, radius: e2.radius },
          0.5
        );

        if (repulsion) {
          const r1 = resolveWallSliding(
            e1.x,
            e1.z,
            repulsion.deltaA.x,
            repulsion.deltaA.z,
            e1.radius,
            currentMapData,
            quest.dungeonGateOpen,
            store.currentMap
          );
          e1.x = r1.x;
          e1.z = r1.z;
          const r2 = resolveWallSliding(
            e2.x,
            e2.z,
            repulsion.deltaB.x,
            repulsion.deltaB.z,
            e2.radius,
            currentMapData,
            quest.dungeonGateOpen,
            store.currentMap
          );
          e2.x = r2.x;
          e2.z = r2.z;
        }
      }
    }

    // --- 7. PICKUPS MAGNET & COLLECTION ---
    pickups.forEach((pickup) => {
      if (pickup.mapId !== store.currentMap || pickup.collected) return;

      pickup.bobOffset += dt * 3.5;

      const dx = player.x - pickup.x;
      const dz = player.z - pickup.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Key is picked up on contact or when touching pedestal
      if (pickup.type === 'key') {
        if (dist < 1.2) {
          pickup.collected = true;
          quest.hasDungeonKey = true;
          soundManager.playKeyPickup();
          banner = {
            title: 'Dungeon Key Found!',
            message: 'You retrieved the ancient brass key! The sealed gate can now be unlocked.',
            icon: 'key',
            duration: 5.0,
          };
        }
        return;
      }

      // Full hearts protection:
      // If pickup is a heart and player's health is already full, leave it on the ground!
      const isHeart = pickup.type === 'heart';
      const isHealthFull = player.health >= player.maxHealth;

      if (isHeart && isHealthFull) {
        pickup.magnetActive = false;
        return;
      }

      // Magnet pull for rupees and hearts (when health is below max)
      if (dist < PICKUP_MAGNET_RADIUS) {
        pickup.magnetActive = true;
        const pullSpeed = PICKUP_MAGNET_SPEED * dt;
        pickup.x += (dx / dist) * pullSpeed;
        pickup.z += (dz / dist) * pullSpeed;
      }

      // Touch collect
      if (dist < PICKUP_COLLECT_RADIUS) {
        pickup.collected = true;

        if (pickup.type === 'rupee') {
          stats.rupees += pickup.value;
          soundManager.playRupeePickup();
          for (let i = 0; i < 4; i++) {
            activeParticles.push({
              id: `rupee_spark_${Date.now()}_${i}`,
              type: 'spark',
              x: pickup.x,
              y: 0.5,
              z: pickup.z,
              vx: (Math.random() - 0.5) * 2.0,
              vy: 1.5 + Math.random(),
              vz: (Math.random() - 0.5) * 2.0,
              size: 0.08,
              color: '#4ade80',
              life: 0.3,
              maxLife: 0.3,
            });
          }
        } else if (pickup.type === 'heart') {
          player.health = Math.min(player.maxHealth, player.health + pickup.value);
          soundManager.playHeartPickup();
          // Healing ring particle
          activeParticles.push({
            id: `heart_ring_${Date.now()}`,
            type: 'heart_heal',
            x: player.x,
            y: 0.8,
            z: player.z,
            vx: 0,
            vy: 0.8,
            vz: 0,
            size: 0.6,
            color: '#ef4444',
            life: 0.5,
            maxLife: 0.5,
          });
        }
      }
    });

    // Clean up collected pickups
    const activePickups = pickups.filter((p) => !p.collected);

    // --- 7B. PROJECTILES SIMULATION & COLLISION ---
    const activeProjectiles: ProjectileState[] = [];

    projectiles.forEach((proj) => {
      if (proj.mapId !== store.currentMap) return;

      proj.life -= dt;
      if (proj.life <= 0) return;

      const nextX = proj.x + proj.vx * dt;
      const nextZ = proj.z + proj.vz * dt;

      // Obstacle collision test (walls, pillars, gate)
      if (
        isPositionBlocked(
          nextX,
          nextZ,
          proj.radius,
          currentMapData,
          quest.dungeonGateOpen,
          store.currentMap
        )
      ) {
        // Impact particles against obstacle
        for (let i = 0; i < 4; i++) {
          activeParticles.push({
            id: `proj_splat_${Date.now()}_${Math.random()}`,
            type: 'leaf',
            x: nextX,
            y: 0.5,
            z: nextZ,
            vx: (Math.random() - 0.5) * 3.5,
            vy: 1.0 + Math.random() * 2.0,
            vz: (Math.random() - 0.5) * 3.5,
            size: 0.1,
            color: '#7bc637',
            life: 0.3,
            maxLife: 0.3,
          });
        }
        return; // projectile destroyed on obstacle impact
      }

      proj.x = nextX;
      proj.z = nextZ;

      // Check collision with Player
      const pDx = player.x - proj.x;
      const pDz = player.z - proj.z;
      const pDist = Math.sqrt(pDx * pDx + pDz * pDz);

      if (pDist < proj.radius + PLAYER_RADIUS && player.iFrames <= 0) {
        player.health = Math.max(0, player.health - proj.damage);
        player.iFrames = PLAYER_IFRAMES_DURATION;
        screenShake = 0.28;
        damageFlash = 0.75;
        soundManager.playPlayerHurt();

        // Player impact sparks
        for (let i = 0; i < 6; i++) {
          activeParticles.push({
            id: `proj_hit_${Date.now()}_${Math.random()}`,
            type: 'spark',
            x: player.x,
            y: 0.6,
            z: player.z,
            vx: (Math.random() - 0.5) * 4.0,
            vy: 1.5 + Math.random() * 2.5,
            vz: (Math.random() - 0.5) * 4.0,
            size: 0.1,
            color: '#ffdd44',
            life: 0.3,
            maxLife: 0.3,
          });
        }

        if (player.health <= 0) {
          soundManager.stopMusic();
          soundManager.playGameOver();
          useGameStore.setState({
            gameState: 'game_over',
            player,
            stats,
          });
          return;
        }

        return; // Consumed on player hit
      }

      activeProjectiles.push(proj);
    });

    // --- 8. QUEST PROGRESSION & TRANSITIONS ---
    // A. Overworld -> Dungeon Entrance
    if (store.currentMap === 'overworld') {
      const distToEntrance = Math.sqrt(
        (player.x - DUNGEON_ENTRANCE_POS.x) ** 2 + (player.z - DUNGEON_ENTRANCE_POS.z) ** 2
      );
      if (distToEntrance < 1.4) {
        store.switchMap('dungeon', DUNGEON_SPAWN_POS.x, DUNGEON_SPAWN_POS.z);
        banner = {
          title: 'Sanctum Antechamber',
          message: 'The air is cold and ancient. Find the key to unseal the chamber beyond.',
          icon: 'sword',
          duration: 4.5,
        };
        return;
      }
    }

    // B. Dungeon Exit -> Overworld
    if (store.currentMap === 'dungeon') {
      const distToExit = Math.sqrt(
        (player.x - DUNGEON_EXIT_POS.x) ** 2 + (player.z - DUNGEON_EXIT_POS.z) ** 2
      );
      if (distToExit < 1.3) {
        store.switchMap('overworld', DUNGEON_ENTRANCE_POS.x, DUNGEON_ENTRANCE_POS.z - 2.0);
        return;
      }

      // C. Unlock Gate when approaching with key
      const distToGate = Math.sqrt(
        (player.x - DUNGEON_GATE_POS.x) ** 2 + (player.z - DUNGEON_GATE_POS.z) ** 2
      );
      if (distToGate < 2.0 && quest.hasDungeonKey && !quest.dungeonGateOpen) {
        quest.dungeonGateOpen = true;
        soundManager.playGateUnlock();
        banner = {
          title: 'Gate Unlocked!',
          message: 'The heavy iron portcullis grinds open! Prepare yourself for battle.',
          icon: 'key',
          duration: 4.0,
        };
      }

      // Smooth gate lifting animation progress
      if (quest.dungeonGateOpen && quest.gateOpenProgress < 1.0) {
        quest.gateOpenProgress = Math.min(1.0, quest.gateOpenProgress + dt * 1.2);
      }

      // Switch music to Boss theme when entering Boss Chamber
      if (player.z > 13.0 && !quest.bossDefeated) {
        soundManager.startMusic('boss');
      }

      // D. Opening Golden Chest
      if (quest.chestSpawned && !quest.chestOpened) {
        const distToChest = Math.sqrt(
          (player.x - DUNGEON_CHEST_POS.x) ** 2 + (player.z - DUNGEON_CHEST_POS.z) ** 2
        );
        if (distToChest < 1.25 && (attackRequested || this.keys['e'] || this.keys['enter'])) {
          quest.chestOpened = true;
          soundManager.playChestOpen();

          banner = {
            title: 'Sunstone Recovered!',
            message: 'You opened the Ancient Chest and claimed the legendary Sunstone!',
            icon: 'chest',
            duration: 4.0,
          };

          // Trigger victory screen after chest fanfare
          setTimeout(() => {
            soundManager.playVictory();
            const completionSeconds = Math.round((Date.now() - stats.startTime) / 1000);
            stats.completionTime = completionSeconds;
            useGameStore.setState({
              gameState: 'victory',
              stats,
            });
          }, 1800);
        }
      }

      // Smooth chest lid opening progress
      if (quest.chestOpened && quest.chestOpenProgress < 1.0) {
        quest.chestOpenProgress = Math.min(1.0, quest.chestOpenProgress + dt * 2.0);
      }
    }

    // --- 9. PARTICLES SIMULATION ---
    activeParticles = activeParticles
      .map((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 9.8 * dt; // gravity
        if (p.y < 0.05) {
          p.y = 0.05;
          p.vx *= 0.7;
          p.vz *= 0.7;
        }
        return p;
      })
      .filter((p) => p.life > 0);

    // Compute updated area name based on player's current coordinate
    let currentAreaName = store.currentAreaName;
    if (store.currentMap === 'overworld') {
      const col = Math.min(2, Math.max(0, Math.floor(player.x / 16)));
      const row = Math.min(1, Math.max(0, Math.floor(player.z / 12)));
      const areaKey = `${col},${row}`;
      const name = {
        '0,0': 'Whispering Glade',
        '1,0': 'Sunlit Meadow',
        '2,0': 'River Crossing',
        '0,1': 'Skull Crag',
        '1,1': 'Briar Hollow',
        '2,1': 'Mountain Arch',
      }[areaKey];
      if (name) currentAreaName = name;
    } else {
      currentAreaName = player.z >= 12 ? 'Sanctum of the Bramble King' : 'Sanctum Antechamber';
    }

    // Write back updated state to Zustand store atomically
    store.updateFromLoop({
      player,
      enemies,
      breakables,
      pickups: activePickups,
      projectiles: activeProjectiles,
      activeParticles,
      quest,
      stats,
      screenShake,
      damageFlash,
      banner,
      currentAreaName,
    });
  }
}

export const gameLoop = new GameLoop();
