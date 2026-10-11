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
} from '../physics';
import {
  defaultPathfindingSystem,
  defaultPortalRegistry,
} from '../pathfinding';
import { EnemyAIContext } from './types';

/**
 * Updates a single red slime's state, timers, movement, pathfinding, and contact damage.
 * Preserves 100% identical mechanics, physics, and gameplay feel.
 */
export function updateRedSlime(enemy: EnemyState, ctx: EnemyAIContext): void {
  const { dt, player } = ctx;

  // 1. Dead mob respawn countdown (overworld red slimes respawn after 20s)
  if (enemy.isDead) {
    if (enemy.mapId === 'overworld') {
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

  // 2. Decrement combat timers
  if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
  if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

  // 3. Consume completed asynchronous pathfinding results from budget queue
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

  // 4. Hitstun & knockback slide
  if (enemy.hitstunTimer > 0) {
    enemy.hitstunTimer -= dt;
    const knockPos = resolveWallSliding(
      enemy.x,
      enemy.z,
      enemy.vx * dt,
      enemy.vz * dt,
      enemy.radius,
      ctx.currentMapData,
      ctx.isGateOpen,
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

  const settings = ENEMY_SETTINGS.slime_red;
  const aggroRadius = settings.aggroRadius;
  const leashRadius = settings.leashRadius;
  const maxPursuitDuration = settings.pursuitDuration;

  if (enemy.chaseTimer === undefined) {
    enemy.chaseTimer = 0;
  }

  // 6. Returning to spawn state
  if (enemy.state === 'returning') {
    if (
      (!isPlayerInSpawnSafeZone && distToPlayer < 1.0) ||
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
        enemy.hopCycle += dt * 4.5;
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
          ctx.isGateOpen,
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
                isGateOpen: ctx.isGateOpen,
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
                ctx.isGateOpen,
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
          ctx.isGateOpen,
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

  if (!isPlayerInSpawnSafeZone) {
    if (enemy.state === 'chase') {
      if (isCrossMap) {
        const portals = defaultPortalRegistry.getPortalsFrom(enemy.mapId);
        const canTraverse = portals.some((p) => p.toChunk === ctx.currentMap && p.traversableByAI);
        if (!canTraverse) {
          // Classic Zelda leashing: monsters give up at entrance by default
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

      if (distToPlayer < leashRadius && (enemy.chaseTimer ?? 0) > 0) {
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
      ctx.isGateOpen,
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
            isGateOpen: ctx.isGateOpen,
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

    // Stuck progress sampling
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

    // Hop cycle & movement
    enemy.hopCycle += dt * 6.0;
    const moveSpeed = enemy.speed * (0.8 + 0.4 * Math.max(0, Math.sin(enemy.hopCycle)));

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
          ctx.isGateOpen,
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
      ctx.isGateOpen,
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

    // Contact damage against player
    const touchDist = enemy.radius + PLAYER_RADIUS;
    if (distToPlayer < touchDist && player.iFrames <= 0 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = 0.8;
      const pKnockX = (dx / distToPlayer) * 7.5;
      const pKnockZ = (dz / distToPlayer) * 7.5;

      // Attack recoil
      enemy.hitstunTimer = 0.15;
      enemy.vx = -pKnockX * 0.45;
      enemy.vz = -pKnockZ * 0.45;

      ctx.applyPlayerDamage(enemy.damage, pKnockX, pKnockZ);
    }
  } else {
    // Idle wander or return to spawn
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
          ctx.isGateOpen,
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
