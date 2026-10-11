import { EnemyState } from '@/types/game';
import {
  ENEMY_SETTINGS,
  SPAWN_POSITION,
  SPAWN_SAFE_RADIUS,
  PLAYER_RADIUS,
} from '../../constants';
import {
  resolveWallSliding,
  hasLineOfSight,
  resolveSmartSteering,
  lerpAngle,
  isPositionBlocked,
} from '../physics';
import {
  defaultPathfindingSystem,
  defaultPortalRegistry,
} from '../pathfinding';
import { soundManager } from '@/audio/soundManager';
import { BossAIContext } from './types';

/**
 * Updates Boss Gorgoth the Bramble King's state, telegraphs, lunges, spore bombs,
 * multi-phase encounters, pathfinding, and contact damage.
 * Preserves 100% identical mechanics, physics, and gameplay feel.
 */
export function updateBossGorgoth(enemy: EnemyState, ctx: BossAIContext): void {
  const { dt, player } = ctx;

  // 1. Dead check (Boss Gorgoth never respawns)
  if (enemy.isDead) {
    return;
  }

  // 2. Decrement combat timers
  if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
  if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
  if (enemy.poiseTimer && enemy.poiseTimer > 0) enemy.poiseTimer = Math.max(0, enemy.poiseTimer - dt);
  if (enemy.rangedCooldown !== undefined && enemy.rangedCooldown > 0) enemy.rangedCooldown = Math.max(0, enemy.rangedCooldown - dt);

  // 3. Consume completed pathfinding results from budget queue
  const pathResult = defaultPathfindingSystem.consumeResult(enemy.id);
  if (pathResult) {
    enemy.pathPending = false;
    enemy.pathStatus = pathResult.status;
    if (pathResult.status === 'unreachable') {
      enemy.pathWaypoints = undefined;
      enemy.aStarPath = undefined;
      enemy.state = 'returning';
      enemy.chaseTimer = 0;
    } else {
      enemy.pathWaypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : undefined;
      enemy.aStarPath = enemy.pathWaypoints;
    }
  }

  const returnResult = defaultPathfindingSystem.consumeResult(`${enemy.id}_return`);
  if (returnResult) {
    enemy.pathPending = false;
    enemy.pathWaypoints = returnResult.waypoints.length > 0 ? returnResult.waypoints : undefined;
    enemy.aStarPath = enemy.pathWaypoints;
  }

  // 4. Hitstun & knockback slide (Boss has heavy resistance / flinch)
  if (enemy.hitstunTimer > 0) {
    enemy.hitstunTimer -= dt;
    const knockPos = resolveWallSliding(
      enemy.x,
      enemy.z,
      enemy.vx * dt,
      enemy.vz * dt,
      enemy.radius,
      ctx.currentMapData,
      ctx.quest.dungeonGateOpen,
      ctx.currentMap
    );
    enemy.x = knockPos.x;
    enemy.z = knockPos.z;
    enemy.vx *= 0.88;
    enemy.vz *= 0.88;
    return;
  }

  // 5. Distance to player & safe zone
  const dx = player.x - enemy.x;
  const dz = player.z - enemy.z;
  const distToPlayer = Math.sqrt(dx * dx + dz * dz);

  const playerDistToSpawn = Math.sqrt(
    (player.x - SPAWN_POSITION.x) ** 2 + (player.z - SPAWN_POSITION.z) ** 2
  );
  const isPlayerInSpawnSafeZone =
    ctx.currentMap === 'overworld' && playerDistToSpawn < SPAWN_SAFE_RADIUS;

  const enemySettings = ENEMY_SETTINGS.boss_gorgoth;
  const aggroRadius = enemySettings.aggroRadius;
  const leashRadius = enemySettings.leashRadius;
  const maxPursuitDuration = enemySettings.pursuitDuration;

  // Boss Gorgoth only aggros once gate is unlocked and player approaches/enters the sanctum
  const canBossAggro = ctx.quest.dungeonGateOpen && player.z >= 11.0;

  if (enemy.chaseTimer === undefined) {
    enemy.chaseTimer = 0;
  }

  // 6. Check if enemy in 'returning' state should re-engage
  if (enemy.state === 'returning') {
    if (
      (!isPlayerInSpawnSafeZone && canBossAggro && distToPlayer < 1.0) ||
      enemy.hitFlashTimer > 0 ||
      enemy.hitstunTimer > 0
    ) {
      enemy.state = 'chase';
      enemy.stuckTimer = 0;
      enemy.chaseTimer = maxPursuitDuration;
    } else {
      const distToSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.z - enemy.spawnZ);
      if (distToSpawn <= 0.6) {
        enemy.state = 'idle';
        enemy.stuckTimer = 0;
        enemy.chaseTimer = 0;
        enemy.pathWaypoints = undefined;
        enemy.x = enemy.spawnX;
        enemy.z = enemy.spawnZ;
      } else {
        enemy.hopCycle += dt * 3.0;
        const returnSpeed = enemy.speed * 0.75 * (0.8 + 0.4 * Math.max(0, Math.sin(enemy.hopCycle)));

        const targetMap = enemy.spawnMapId || enemy.mapId;
        const isCrossMapSpawn = enemy.mapId !== targetMap;

        const hasLoSToSpawn = !isCrossMapSpawn && hasLineOfSight(
          enemy.x,
          enemy.z,
          enemy.spawnX,
          enemy.spawnZ,
          enemy.radius,
          ctx.currentMapData,
          ctx.quest.dungeonGateOpen,
          ctx.currentMap,
          ctx.breakables
        );

        const hasClearDirectPath = distToSpawn <= 2.0 && hasLoSToSpawn;

        let navTargetX = enemy.spawnX;
        let navTargetZ = enemy.spawnZ;

        if (!hasClearDirectPath) {
          if (
            (!enemy.pathWaypoints || enemy.pathWaypoints.length === 0 || (enemy.pathUpdateTimer && enemy.pathUpdateTimer <= 0)) &&
            !enemy.pathPending
          ) {
            enemy.pathPending = true;
            enemy.pathUpdateTimer = 0.5 + Math.random() * 0.2;
            defaultPathfindingSystem.requestPath(
              `${enemy.id}_return`,
              {
                startX: enemy.x,
                startZ: enemy.z,
                startMap: enemy.mapId,
                targetX: enemy.spawnX,
                targetZ: enemy.spawnZ,
                targetMap: targetMap,
                radius: enemy.radius,
                isAI: true,
                overworldMap: ctx.overworldMap,
                dungeonMap: ctx.dungeonMap,
                isGateOpen: ctx.quest.dungeonGateOpen,
                breakables: ctx.breakables,
              },
              2,
              (res) => {
                enemy.pathPending = false;
                enemy.pathWaypoints = res.waypoints.length > 0 ? res.waypoints : undefined;
                enemy.aStarPath = res.waypoints.length > 0 ? res.waypoints : undefined;
              }
            );
          }
          if (enemy.pathUpdateTimer !== undefined) enemy.pathUpdateTimer -= dt;

          if (enemy.pathWaypoints && enemy.pathWaypoints.length > 0) {
            const distToFirst = Math.hypot(enemy.x - enemy.pathWaypoints[0].x, enemy.z - enemy.pathWaypoints[0].z);
            if (enemy.pathWaypoints.length > 1) {
              const hasLoSToNext = hasLineOfSight(
                enemy.x,
                enemy.z,
                enemy.pathWaypoints[1].x,
                enemy.pathWaypoints[1].z,
                enemy.radius,
                ctx.currentMapData,
                ctx.quest.dungeonGateOpen,
                ctx.currentMap,
                ctx.breakables
              );
              if (distToFirst < 0.55 || hasLoSToNext) {
                enemy.pathWaypoints.shift();
              }
            }
            navTargetX = enemy.pathWaypoints[0].x;
            navTargetZ = enemy.pathWaypoints[0].z;
          }
        } else {
          enemy.pathWaypoints = undefined;
          enemy.pathPending = false;
        }

        const steer = resolveSmartSteering(
          enemy.x,
          enemy.z,
          navTargetX,
          navTargetZ,
          returnSpeed,
          dt,
          enemy.radius,
          ctx.currentMapData,
          ctx.quest.dungeonGateOpen,
          ctx.currentMap,
          enemy.steeringBias || 1,
          ctx.breakables,
          enemy.facingAngle
        );

        const actualDx = steer.x - enemy.x;
        const actualDz = steer.z - enemy.z;
        const actualDist = Math.hypot(actualDx, actualDz);

        enemy.x = steer.x;
        enemy.z = steer.z;
        enemy.steeringBias = steer.chosenBias;

        if (actualDist > 0.001) {
          const moveHeading = Math.atan2(actualDx, actualDz);
          enemy.facingAngle = lerpAngle(enemy.facingAngle, moveHeading, 12.0 * dt);
        } else {
          const targetHeading = Math.atan2(navTargetX - enemy.x, navTargetZ - enemy.z);
          enemy.facingAngle = lerpAngle(enemy.facingAngle, targetHeading, 12.0 * dt);
        }
      }
      return;
    }
  }

  // 7. Determine active pursuit
  let shouldChase = false;
  const isCrossMap = enemy.mapId !== ctx.currentMap;

  if (!isPlayerInSpawnSafeZone && canBossAggro) {
    if (enemy.state === 'chase') {
      if (isCrossMap) {
        const portals = defaultPortalRegistry.getPortalsFrom(enemy.mapId);
        const canTraverse = portals.some((p) => p.toChunk === ctx.currentMap && p.traversableByAI);
        if (!canTraverse) {
          enemy.state = 'returning';
          enemy.chaseTimer = 0;
          enemy.pathWaypoints = undefined;
          enemy.pathPending = false;
          enemy.stuckTimer = 0;
          return;
        }
      }

      if (distToPlayer > aggroRadius) {
        enemy.chaseTimer = Math.max(0, (enemy.chaseTimer ?? 0) - dt);
      } else {
        enemy.chaseTimer = maxPursuitDuration;
      }

      // Relentless boss pursuit in sanctum
      if (distToPlayer < leashRadius && ((enemy.chaseTimer ?? 0) > 0 || true)) {
        shouldChase = true;
      }
    } else if (enemy.state === 'idle') {
      if (!isCrossMap && distToPlayer < aggroRadius) {
        shouldChase = true;
        enemy.chaseTimer = maxPursuitDuration;
      }
    }
  }

  // 8. Execute Chase or Idle Wander
  if (shouldChase) {
    enemy.state = 'chase';

    const hasClearLoS = !isCrossMap && hasLineOfSight(
      enemy.x,
      enemy.z,
      player.x,
      player.z,
      enemy.radius,
      ctx.currentMapData,
      ctx.quest.dungeonGateOpen,
      ctx.currentMap,
      ctx.breakables
    );

    if (!hasClearLoS) {
      if (
        (!enemy.pathWaypoints || enemy.pathWaypoints.length === 0 || (enemy.pathUpdateTimer && enemy.pathUpdateTimer <= 0)) &&
        !enemy.pathPending
      ) {
        enemy.pathPending = true;
        enemy.pathUpdateTimer = 0.35 + Math.random() * 0.25;

        defaultPathfindingSystem.requestPath(
          enemy.id,
          {
            startX: enemy.x,
            startZ: enemy.z,
            startMap: enemy.mapId,
            targetX: player.x,
            targetZ: player.z,
            targetMap: ctx.currentMap,
            radius: enemy.radius,
            isAI: true,
            overworldMap: ctx.overworldMap,
            dungeonMap: ctx.dungeonMap,
            isGateOpen: ctx.quest.dungeonGateOpen,
            breakables: ctx.breakables,
          },
          Math.max(1, 20 - distToPlayer),
          (result) => {
            enemy.pathPending = false;
            enemy.pathStatus = result.status;
            if (result.status === 'unreachable') {
              enemy.pathWaypoints = undefined;
              enemy.aStarPath = undefined;
              enemy.state = 'returning';
              enemy.chaseTimer = 0;
            } else {
              enemy.pathWaypoints = result.waypoints.length > 0 ? result.waypoints : undefined;
              enemy.aStarPath = result.waypoints.length > 0 ? result.waypoints : undefined;
            }
          }
        );
      }
    } else {
      enemy.pathWaypoints = undefined;
      enemy.aStarPath = undefined;
      enemy.pathPending = false;
      enemy.pathStatus = 'complete';
    }

    // Stuck sampling
    if (!enemy.lastSamplePos) {
      enemy.lastSamplePos = { x: enemy.x, z: enemy.z };
    }
    enemy.stuckSampleTimer = (enemy.stuckSampleTimer || 0) + dt;
    if (enemy.stuckSampleTimer >= 0.25) {
      const distMoved = Math.hypot(enemy.x - enemy.lastSamplePos.x, enemy.z - enemy.lastSamplePos.z);
      enemy.lastSamplePos = { x: enemy.x, z: enemy.z };
      enemy.stuckSampleTimer = 0;
      const isPhysicallyStuck = distMoved < 0.04;
      const isPathUnreachable = !hasClearLoS && (!enemy.pathWaypoints || enemy.pathWaypoints.length === 0);

      if (isPhysicallyStuck || isPathUnreachable) {
        enemy.stuckTimer = (enemy.stuckTimer || 0) + 0.25;
      } else {
        enemy.stuckTimer = Math.max(0, (enemy.stuckTimer || 0) - 0.25);
      }
    }

    if (enemy.stuckTimer && enemy.stuckTimer >= 3.5) {
      enemy.state = 'returning';
      enemy.pathWaypoints = undefined;
      enemy.pathPending = false;
      enemy.chaseTimer = 0;
      return;
    }

    // Hop cycle
    enemy.hopCycle += dt * 4.0;
    const moveSpeed = enemy.speed * (0.8 + 0.4 * Math.max(0, Math.sin(enemy.hopCycle)));

    // Check if boss is executing special action
    const isBossInSpecialAction = (
      (enemy.castTimer !== undefined && enemy.castTimer > 0) ||
      enemy.bossAction === 'telegraphing_lunge' ||
      enemy.bossAction === 'lunging' ||
      enemy.bossAction === 'lunge_recovery' ||
      enemy.bossAction === 'telegraphing_ranged'
    );

    if (!isBossInSpecialAction) {
      // Normal pathfinding & obstacle navigation
      let navTargetX = player.x;
      let navTargetZ = player.z;

      if (enemy.pathUpdateTimer !== undefined) {
        enemy.pathUpdateTimer -= dt;
      }

      if (enemy.pathWaypoints && enemy.pathWaypoints.length > 0) {
        const distToFirst = Math.hypot(enemy.x - enemy.pathWaypoints[0].x, enemy.z - enemy.pathWaypoints[0].z);
        if (enemy.pathWaypoints.length > 1) {
          const hasLoSToNext = hasLineOfSight(
            enemy.x,
            enemy.z,
            enemy.pathWaypoints[1].x,
            enemy.pathWaypoints[1].z,
            enemy.radius,
            ctx.currentMapData,
            ctx.quest.dungeonGateOpen,
            ctx.currentMap,
            ctx.breakables
          );
          if (distToFirst < 0.55 || hasLoSToNext) {
            enemy.pathWaypoints.shift();
          }
        }
        navTargetX = enemy.pathWaypoints[0].x;
        navTargetZ = enemy.pathWaypoints[0].z;
      } else if (enemy.pathStatus === 'partial') {
        enemy.facingAngle = Math.atan2(dx, dz);
        navTargetX = enemy.x;
        navTargetZ = enemy.z;
      }

      if (enemy.steeringBiasTimer !== undefined) {
        enemy.steeringBiasTimer -= dt;
      }

      const steer = resolveSmartSteering(
        enemy.x,
        enemy.z,
        navTargetX,
        navTargetZ,
        moveSpeed,
        dt,
        enemy.radius,
        ctx.currentMapData,
        ctx.quest.dungeonGateOpen,
        ctx.currentMap,
        enemy.steeringBias || 1,
        ctx.breakables,
        enemy.facingAngle
      );

      const actualDx = steer.x - enemy.x;
      const actualDz = steer.z - enemy.z;
      const actualDist = Math.hypot(actualDx, actualDz);
      enemy.x = steer.x;
      enemy.z = steer.z;

      if (enemy.pathStatus === 'partial') {
        enemy.facingAngle = Math.atan2(dx, dz);
      } else if (actualDist > 0.001) {
        enemy.facingAngle = steer.facingAngle;
      } else {
        enemy.facingAngle = Math.atan2(navTargetX - enemy.x, navTargetZ - enemy.z);
      }

      if (!enemy.steeringBiasTimer || enemy.steeringBiasTimer <= 0) {
        enemy.steeringBias = steer.chosenBias;
        enemy.steeringBiasTimer = 0.35;
      }
    }

    // Boss Dynamic Multi-Phase Ranged, Area & Lunge Attacks (Mario RPG Style Encounter)
    if (!ctx.quest.bossDefeated) {
      if (enemy.lungeCooldown === undefined) {
        enemy.lungeCooldown = 4.0; // initial grace period upon entering boss room
      }
      if (enemy.rangedCooldown === undefined) {
        enemy.rangedCooldown = 3.5;
      }

      // Decrement cooldowns when boss is in neutral chase
      if (enemy.bossAction === 'none' || !enemy.bossAction) {
        if (enemy.lungeCooldown > 0) enemy.lungeCooldown -= dt;
        if (enemy.rangedCooldown > 0) enemy.rangedCooldown -= dt;
      }

      // State 1: Telegraphing Lunge (Red danger path on ground)
      if (enemy.bossAction === 'telegraphing_lunge') {
        enemy.bossTelegraphTimer = (enemy.bossTelegraphTimer ?? ENEMY_SETTINGS.boss_gorgoth.lungeWindup) - dt;
        if (enemy.lungeDirection) {
          enemy.facingAngle = Math.atan2(enemy.lungeDirection.x, enemy.lungeDirection.z);
        }
        // Anticipation sparks along boss path
        if (Math.random() < 0.4) {
          ctx.activeParticles.push({
            id: `lunge_prep_${Date.now()}_${Math.random()}`,
            type: 'spark',
            x: enemy.x + (Math.random() - 0.5) * 1.2,
            y: 0.15,
            z: enemy.z + (Math.random() - 0.5) * 1.2,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0.8 + Math.random() * 1.2,
            vz: (Math.random() - 0.5) * 1.5,
            size: 0.12,
            color: '#ef4444',
            life: 0.3,
            maxLife: 0.3,
          });
        }

        if (enemy.bossTelegraphTimer <= 0) {
          enemy.bossAction = 'lunging';
          enemy.lungeTimer = ENEMY_SETTINGS.boss_gorgoth.lungeDuration;
          soundManager.playBossCharge();
          ctx.triggerScreenShake(0.25);
        }
      }
      // State 2: Active Lunge Dash (Fast, uninterruptible, invulnerable surge)
      else if (enemy.bossAction === 'lunging') {
        enemy.lungeTimer = (enemy.lungeTimer ?? ENEMY_SETTINGS.boss_gorgoth.lungeDuration) - dt;
        const lDirX = enemy.lungeDirection?.x || Math.sin(enemy.facingAngle);
        const lDirZ = enemy.lungeDirection?.z || Math.cos(enemy.facingAngle);
        const stepDist = ENEMY_SETTINGS.boss_gorgoth.lungeSpeed * dt;
        const nextX = enemy.x + lDirX * stepDist;
        const nextZ = enemy.z + lDirZ * stepDist;

        const isBlocked = isPositionBlocked(
          nextX,
          nextZ,
          enemy.radius,
          ctx.currentMapData,
          ctx.quest.dungeonGateOpen,
          ctx.currentMap,
          ctx.breakables
        );

        if (isBlocked) {
          // Slammed into solid pillar or perimeter wall!
          ctx.triggerScreenShake(0.42);
          soundManager.playPotSmash();
          for (let p = 0; p < 8; p++) {
            ctx.activeParticles.push({
              id: `wall_slam_${Date.now()}_${Math.random()}`,
              type: 'poof',
              x: enemy.x + lDirX * enemy.radius,
              y: 0.6,
              z: enemy.z + lDirZ * enemy.radius,
              vx: (Math.random() - 0.5) * 3.5,
              vy: 1.0 + Math.random() * 2.0,
              vz: (Math.random() - 0.5) * 3.5,
              size: 0.2,
              color: '#e2e8f0',
              life: 0.35,
              maxLife: 0.35,
            });
          }
          enemy.bossAction = 'lunge_recovery';
          enemy.lungeRecoveryTimer = ENEMY_SETTINGS.boss_gorgoth.lungeRecovery;
        } else {
          enemy.x = nextX;
          enemy.z = nextZ;

          // Speed trail particles behind charging boss
          ctx.activeParticles.push({
            id: `lunge_trail_${Date.now()}_${Math.random()}`,
            type: 'poof',
            x: enemy.x - lDirX * 0.9 + (Math.random() - 0.5) * 0.4,
            y: 0.2,
            z: enemy.z - lDirZ * 0.9 + (Math.random() - 0.5) * 0.4,
            vx: -lDirX * 2.0,
            vy: 0.5 + Math.random() * 0.8,
            vz: -lDirZ * 2.0,
            size: 0.22,
            color: '#f87171',
            life: 0.28,
            maxLife: 0.28,
          });
        }

        // Contact hit with player during lunge
        if (distToPlayer < enemy.radius + PLAYER_RADIUS && player.iFrames <= 0) {
          ctx.triggerScreenShake(0.5);
          ctx.triggerDamageFlash(0.9);
          ctx.applyPlayerDamage(
            ENEMY_SETTINGS.boss_gorgoth.lungeDamage,
            lDirX * 9.5,
            lDirZ * 9.5
          );
        }

        if (enemy.lungeTimer !== undefined && enemy.lungeTimer <= 0) {
          enemy.bossAction = 'lunge_recovery';
          enemy.lungeRecoveryTimer = ENEMY_SETTINGS.boss_gorgoth.lungeRecovery;
        }
      }
      // State 3: Lunge Recovery (Vulnerable opening for player)
      else if (enemy.bossAction === 'lunge_recovery') {
        enemy.lungeRecoveryTimer = (enemy.lungeRecoveryTimer ?? ENEMY_SETTINGS.boss_gorgoth.lungeRecovery) - dt;
        if (enemy.lungeRecoveryTimer <= 0) {
          enemy.bossAction = 'none';
          enemy.lungeCooldown = ENEMY_SETTINGS.boss_gorgoth.lungeCooldown + (Math.random() * 0.8 - 0.4);
        }
      }
      // State 4: Telegraphing Ranged Attack (Aiming reticle at player)
      else if (enemy.bossAction === 'telegraphing_ranged') {
        enemy.bossTelegraphTimer = (enemy.bossTelegraphTimer ?? ENEMY_SETTINGS.boss_gorgoth.projectileWindup) - dt;
        if (enemy.bossTelegraphTarget) {
          enemy.facingAngle = Math.atan2(
            enemy.bossTelegraphTarget.x - enemy.x,
            enemy.bossTelegraphTarget.z - enemy.z
          );
        }
        if (Math.random() < 0.4) {
          ctx.activeParticles.push({
            id: `bomb_charge_${Date.now()}_${Math.random()}`,
            type: 'spark',
            x: enemy.x + (Math.random() - 0.5) * 1.5,
            y: 0.6 + Math.random() * 0.8,
            z: enemy.z + (Math.random() - 0.5) * 1.5,
            vx: (enemy.x - (enemy.x + (Math.random() - 0.5) * 1.5)) * 1.5,
            vy: 0.5,
            vz: (enemy.z - (enemy.z + (Math.random() - 0.5) * 1.5)) * 1.5,
            size: 0.12,
            color: '#eab308',
            life: 0.3,
            maxLife: 0.3,
          });
        }

        if (enemy.bossTelegraphTimer <= 0) {
          const targetX = enemy.bossTelegraphTarget ? enemy.bossTelegraphTarget.x : player.x;
          const targetZ = enemy.bossTelegraphTarget ? enemy.bossTelegraphTarget.z : player.z;
          const tDx = targetX - enemy.x;
          const tDz = targetZ - enemy.z;
          const tDist = Math.hypot(tDx, tDz) || 0.001;
          const pSpeed = ENEMY_SETTINGS.boss_gorgoth.sporeBombSpeed;
          const dirX = tDx / tDist;
          const dirZ = tDz / tDist;

          ctx.projectiles.push({
            id: `proj_boss_bomb_${Date.now()}_${Math.random()}`,
            type: 'spore_bomb',
            x: enemy.x + dirX * 1.2,
            z: enemy.z + dirZ * 1.2,
            vx: dirX * pSpeed,
            vz: dirZ * pSpeed,
            targetX,
            targetZ,
            radius: ENEMY_SETTINGS.boss_gorgoth.sporeBombRadius,
            damage: ENEMY_SETTINGS.boss_gorgoth.projectileDamage,
            life: 3.5,
            maxLife: 3.5,
            source: 'boss',
            color: '#eab308',
            mapId: 'dungeon',
          });

          soundManager.playBossShoot();
          enemy.bossAction = 'none';
          enemy.bossTelegraphTimer = 0;
          enemy.bossTelegraphTarget = undefined;
          enemy.rangedCooldown = ENEMY_SETTINGS.boss_gorgoth.projectileCooldown + (Math.random() * 0.8 - 0.4);
        }
      }
      // State 5: Legacy Briar Eruption / Ricochet Casting (if active)
      else if (enemy.castTimer && enemy.castTimer > 0) {
        enemy.castTimer -= dt;
        enemy.bossTelegraphTimer = enemy.castTimer;
        if (enemy.castTimer <= 0) {
          enemy.bossAction = 'none';
          enemy.bossTelegraphTimer = 0;
          soundManager.playBossShoot();
          enemy.rangedCooldown = ENEMY_SETTINGS.boss_gorgoth.projectileCooldown + (Math.random() * 0.8 - 0.4);
        }
      }
      // State 6: Neutral Chase - Choose Next Attack
      else {
        const hasClearLoS = hasLineOfSight(
          enemy.x,
          enemy.z,
          player.x,
          player.z,
          0.4,
          ctx.currentMapData,
          ctx.quest.dungeonGateOpen,
          ctx.currentMap,
          ctx.breakables
        );

        // Check if player is hiding in room corner
        const isPlayerInCorner =
          (player.x <= 5.5 && player.z >= 19.0) ||
          (player.x >= 13.5 && player.z >= 19.0) ||
          (player.x <= 5.5 && player.z <= 14.5) ||
          (player.x >= 13.5 && player.z <= 14.5);

        const isPlayerAtRange = distToPlayer > 4.2;
        const isBossStuck = (enemy.stuckTimer || 0) > 0.4;
        const isPlayerUnreachable = !hasClearLoS || enemy.pathStatus === 'partial' || isBossStuck || isPlayerInCorner;

        // Decision: Ranged Attack (when boss is at range and/or player is somewhere boss cannot reach)
        if ((isPlayerAtRange || isPlayerUnreachable) && (enemy.rangedCooldown ?? 0) <= 0) {
          enemy.bossAction = 'telegraphing_ranged';
          enemy.bossAttackType = 'spore_bomb';
          enemy.bossTelegraphTimer = ENEMY_SETTINGS.boss_gorgoth.projectileWindup;
          enemy.bossTelegraphMax = ENEMY_SETTINGS.boss_gorgoth.projectileWindup;
          enemy.bossTelegraphTarget = { x: player.x, z: player.z };
          soundManager.playBossCharge();
        }
        // Decision: Lunge Attack (at mid-range with clear line of sight)
        else if (distToPlayer >= 1.8 && distToPlayer <= 5.5 && hasClearLoS && (enemy.lungeCooldown ?? 0) <= 0) {
          enemy.bossAction = 'telegraphing_lunge';
          enemy.bossAttackType = 'lunge';
          enemy.bossTelegraphTimer = ENEMY_SETTINGS.boss_gorgoth.lungeWindup;
          enemy.bossTelegraphMax = ENEMY_SETTINGS.boss_gorgoth.lungeWindup;

          const lungeDirX = dx / (distToPlayer || 0.001);
          const lungeDirZ = dz / (distToPlayer || 0.001);
          enemy.lungeDirection = { x: lungeDirX, z: lungeDirZ };
          const lungeDist = Math.min(ENEMY_SETTINGS.boss_gorgoth.lungeDistance, Math.max(3.2, distToPlayer + 1.2));
          enemy.lungeDistance = lungeDist;
          enemy.lungeTarget = {
            x: enemy.x + lungeDirX * lungeDist,
            z: enemy.z + lungeDirZ * lungeDist,
          };
          enemy.bossTelegraphTarget = enemy.lungeTarget;
          enemy.facingAngle = Math.atan2(lungeDirX, lungeDirZ);
          soundManager.playBossCharge();
        }
      }
    }

    // Contact damage against player (when not in special lunge attack, which handles its own collision)
    if (enemy.bossAction !== 'lunging') {
      const touchDist = enemy.radius + PLAYER_RADIUS;
      if (distToPlayer < touchDist && player.iFrames <= 0 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 1.3;
        const pKnockX = (dx / distToPlayer) * 7.5;
        const pKnockZ = (dz / distToPlayer) * 7.5;

        ctx.triggerScreenShake(0.4);
        ctx.triggerDamageFlash(0.85);
        ctx.applyPlayerDamage(enemy.damage, pKnockX, pKnockZ);
      }
    }
  } else {
    // Pursuit dropped or idle
    const distToSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.z - enemy.spawnZ);
    if (enemy.state === 'chase' && distToSpawn > 0.6) {
      enemy.state = 'returning';
      enemy.chaseTimer = 0;
      enemy.stuckTimer = 0;
      enemy.pathWaypoints = undefined;
      enemy.pathPending = false;
      enemy.pathUpdateTimer = 0;
      enemy.aStarPath = undefined;
    } else {
      enemy.state = 'idle';
      enemy.chaseTimer = 0;
      enemy.stuckTimer = 0;
      enemy.pathWaypoints = undefined;
      enemy.pathPending = false;
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
          ctx.currentMapData,
          ctx.quest.dungeonGateOpen,
          ctx.currentMap
        );
        if (Math.hypot(resolved.x - enemy.x, resolved.z - enemy.z) < 0.0005) {
          enemy.facingAngle = Math.random() * Math.PI * 2;
        }
        enemy.x = resolved.x;
        enemy.z = resolved.z;
      } else if (Math.random() < 0.02) {
        enemy.facingAngle = Math.random() * Math.PI * 2;
      }
    }
  }
}
