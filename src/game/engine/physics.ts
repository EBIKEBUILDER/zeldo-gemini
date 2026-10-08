import { MapData, WorldProp } from '../worldData';
import { Vector2D, BreakableState } from '@/types/game';
import { DUNGEON_GATE_POS } from '../constants';

// Test if circle at (x, z) with radius collides with any solid tile in map
export function checkTileCollision(
  x: number,
  z: number,
  radius: number,
  map: MapData
): boolean {
  const minTileX = Math.max(0, Math.floor(x - radius));
  const maxTileX = Math.min(map.width - 1, Math.floor(x + radius));
  const minTileZ = Math.max(0, Math.floor(z - radius));
  const maxTileZ = Math.min(map.height - 1, Math.floor(z + radius));

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let tz = minTileZ; tz <= maxTileZ; tz++) {
      const tile = map.tiles[tx]?.[tz];
      if (tile && tile.solid) {
        // Tile AABB: [tx, tx + 1] x [tz, tz + 1]
        const closestX = Math.max(tx, Math.min(x, tx + 1));
        const closestZ = Math.max(tz, Math.min(z, tz + 1));

        const distX = x - closestX;
        const distZ = z - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < radius * radius) {
          return true;
        }
      }
    }
  }

  return false;
}

// Test collision against solid world props (trees, rocks, pillars, cottage)
export function checkPropCollision(
  x: number,
  z: number,
  radius: number,
  props: WorldProp[]
): boolean {
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (prop.radius <= 0) continue;

    const dx = x - prop.x;
    const dz = z - prop.z;
    const minDist = radius + prop.radius;

    if (dx * dx + dz * dz < minDist * minDist) {
      return true;
    }
  }

  return false;
}

// Check dungeon gate collision if gate is closed
export function checkGateCollision(
  x: number,
  z: number,
  radius: number,
  isGateOpen: boolean,
  mapId: string
): boolean {
  if (mapId !== 'dungeon' || isGateOpen) return false;

  // Gate bounds at z = 11.5, x from 8.8 to 11.2
  const gateZ = DUNGEON_GATE_POS.z;
  const gateMinX = 8.5;
  const gateMaxX = 11.5;

  if (x >= gateMinX - radius && x <= gateMaxX + radius) {
    if (Math.abs(z - gateZ) < radius + 0.45) {
      return true;
    }
  }

  return false;
}

// Test collision against solid unbroken breakables (clay pots)
export function checkBreakableCollision(
  x: number,
  z: number,
  radius: number,
  breakables?: BreakableState[],
  mapId: string = 'overworld'
): boolean {
  if (!breakables) return false;
  for (let i = 0; i < breakables.length; i++) {
    const item = breakables[i];
    if (item.mapId !== mapId || item.isBroken || item.type !== 'pot') continue;

    const dx = x - item.x;
    const dz = z - item.z;
    const minDist = radius + item.radius;

    if (dx * dx + dz * dz < minDist * minDist) {
      return true;
    }
  }

  return false;
}

// Full obstacle test (tile + props + breakable pots + gate)
export function isPositionBlocked(
  x: number,
  z: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string,
  breakables?: BreakableState[]
): boolean {
  if (checkTileCollision(x, z, radius, map)) return true;
  if (checkPropCollision(x, z, radius, map.props)) return true;
  if (checkBreakableCollision(x, z, radius, breakables, mapId)) return true;
  if (checkGateCollision(x, z, radius, isGateOpen, mapId)) return true;
  return false;
}

// Calculate maximum penetration depth into any solid obstacle (0 if completely free)
export function getObstaclePenetration(
  x: number,
  z: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean = false,
  mapId: string = 'overworld',
  breakables?: BreakableState[]
): number {
  let maxPen = 0;

  // 1. Props (trees, rocks, pillars, cottage, pedestal)
  for (let i = 0; i < map.props.length; i++) {
    const prop = map.props[i];
    if (prop.radius <= 0) continue;
    const dx = x - prop.x;
    const dz = z - prop.z;
    const minDist = radius + prop.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const pen = minDist - Math.sqrt(distSq);
      if (pen > maxPen) maxPen = pen;
    }
  }

  // 2. Unbroken Pots
  if (breakables) {
    for (let i = 0; i < breakables.length; i++) {
      const item = breakables[i];
      if (item.mapId !== mapId || item.isBroken || item.type !== 'pot') continue;
      const dx = x - item.x;
      const dz = z - item.z;
      const minDist = radius + item.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        const pen = minDist - Math.sqrt(distSq);
        if (pen > maxPen) maxPen = pen;
      }
    }
  }

  // 3. Solid Tiles
  const minTileX = Math.max(0, Math.floor(x - radius));
  const maxTileX = Math.min(map.width - 1, Math.floor(x + radius));
  const minTileZ = Math.max(0, Math.floor(z - radius));
  const maxTileZ = Math.min(map.height - 1, Math.floor(z + radius));

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let tz = minTileZ; tz <= maxTileZ; tz++) {
      const tile = map.tiles[tx]?.[tz];
      if (tile && tile.solid) {
        const closestX = Math.max(tx, Math.min(x, tx + 1));
        const closestZ = Math.max(tz, Math.min(z, tz + 1));
        const distX = x - closestX;
        const distZ = z - closestZ;
        const distSq = distX * distX + distZ * distZ;
        if (distSq < radius * radius) {
          const pen = radius - Math.sqrt(distSq);
          if (pen > maxPen) maxPen = pen;
        }
      }
    }
  }

  // 4. Closed Gate
  if (mapId === 'dungeon' && !isGateOpen) {
    const gateZ = DUNGEON_GATE_POS.z;
    const gateMinX = 8.5;
    const gateMaxX = 11.5;
    if (x >= gateMinX - radius && x <= gateMaxX + radius) {
      const distGateZ = Math.abs(z - gateZ);
      const minGateDist = radius + 0.45;
      if (distGateZ < minGateDist) {
        const pen = minGateDist - distGateZ;
        if (pen > maxPen) maxPen = pen;
      }
    }
  }

  return maxPen;
}

// Smooth wall sliding movement resolution with obstacle escape capability
export function resolveWallSliding(
  currentX: number,
  currentZ: number,
  desiredDx: number,
  desiredDz: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string,
  breakables?: BreakableState[]
): Vector2D {
  let newX = currentX;
  let newZ = currentZ;

  // Try moving in both axes simultaneously
  const targetX = currentX + desiredDx;
  const targetZ = currentZ + desiredDz;

  if (!isPositionBlocked(targetX, targetZ, radius, map, isGateOpen, mapId, breakables)) {
    return { x: targetX, z: targetZ };
  }

  // If blocked, evaluate current penetration depth:
  // If the entity is currently intersecting an obstacle (e.g. pushed by enemy knockback),
  // ALLOW movement if target penetration is lower (actively escaping/moving away from obstacle).
  const currentPen = getObstaclePenetration(currentX, currentZ, radius, map, isGateOpen, mapId, breakables);
  if (currentPen > 0) {
    const targetPen = getObstaclePenetration(targetX, targetZ, radius, map, isGateOpen, mapId, breakables);
    if (targetPen < currentPen - 0.0005) {
      return { x: targetX, z: targetZ };
    }
  }

  // If blocked, attempt independent X axis slide
  if (desiredDx !== 0) {
    if (!isPositionBlocked(targetX, newZ, radius, map, isGateOpen, mapId, breakables)) {
      newX = targetX;
    } else if (currentPen > 0) {
      const xPen = getObstaclePenetration(targetX, newZ, radius, map, isGateOpen, mapId, breakables);
      if (xPen < currentPen - 0.0005) {
        newX = targetX;
      }
    }
  }

  // Attempt independent Z axis slide
  if (desiredDz !== 0) {
    if (!isPositionBlocked(newX, targetZ, radius, map, isGateOpen, mapId, breakables)) {
      newZ = targetZ;
    } else if (currentPen > 0) {
      const zPen = getObstaclePenetration(newX, targetZ, radius, map, isGateOpen, mapId, breakables);
      if (zPen < currentPen - 0.0005) {
        newZ = targetZ;
      }
    }
  }

  return { x: newX, z: newZ };
}

// Safely depenetrate/eject an entity overlapping with any solid props, tiles, pots, or gate
// Uses multi-pass relaxation and a micro-safety margin (+0.006) to strictly clear colliders.
export function depenetrateFromObstacles(
  pos: Vector2D,
  radius: number,
  map: MapData,
  isGateOpen: boolean = false,
  mapId: string = 'overworld',
  breakables?: BreakableState[]
): Vector2D {
  let x = pos.x;
  let z = pos.z;

  // 3 relaxation passes to resolve corners, overlapping props, and walls cleanly
  for (let pass = 0; pass < 3; pass++) {
    // 1. Depenetrate against solid world props (trees, rocks, pillars, cottage, pedestal)
    for (let i = 0; i < map.props.length; i++) {
      const prop = map.props[i];
      if (prop.radius <= 0) continue;

      const dx = x - prop.x;
      const dz = z - prop.z;
      const minDist = radius + prop.radius;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = minDist - dist + 0.006;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        } else {
          x += minDist + 0.006;
        }
      }
    }

    // 2. Depenetrate against unbroken pots
    if (breakables) {
      for (let i = 0; i < breakables.length; i++) {
        const item = breakables[i];
        if (item.mapId !== mapId || item.isBroken || item.type !== 'pot') continue;

        const dx = x - item.x;
        const dz = z - item.z;
        const minDist = radius + item.radius;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = minDist - dist + 0.006;
            x += (dx / dist) * overlap;
            z += (dz / dist) * overlap;
          } else {
            x += minDist + 0.006;
          }
        }
      }
    }

    // 3. Depenetrate against solid tiles
    const minTileX = Math.max(0, Math.floor(x - radius - 1));
    const maxTileX = Math.min(map.width - 1, Math.floor(x + radius + 1));
    const minTileZ = Math.max(0, Math.floor(z - radius - 1));
    const maxTileZ = Math.min(map.height - 1, Math.floor(z + radius + 1));

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let tz = minTileZ; tz <= maxTileZ; tz++) {
        const tile = map.tiles[tx]?.[tz];
        if (tile && tile.solid) {
          const closestX = Math.max(tx, Math.min(x, tx + 1));
          const closestZ = Math.max(tz, Math.min(z, tz + 1));

          const distX = x - closestX;
          const distZ = z - closestZ;
          const distSq = distX * distX + distZ * distZ;

          if (distSq < radius * radius) {
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const overlap = radius - dist + 0.006;
              x += (distX / dist) * overlap;
              z += (distZ / dist) * overlap;
            } else {
              const dLeft = Math.abs(x - tx);
              const dRight = Math.abs(tx + 1 - x);
              const dBottom = Math.abs(z - tz);
              const dTop = Math.abs(tz + 1 - z);
              const minEdge = Math.min(dLeft, dRight, dBottom, dTop);
              if (minEdge === dLeft) x = tx - radius - 0.006;
              else if (minEdge === dRight) x = tx + 1 + radius + 0.006;
              else if (minEdge === dBottom) z = tz - radius - 0.006;
              else z = tz + 1 + radius + 0.006;
            }
          }
        }
      }
    }

    // 4. Depenetrate against closed dungeon gate
    if (mapId === 'dungeon' && !isGateOpen) {
      const gateZ = DUNGEON_GATE_POS.z;
      const gateMinX = 8.5;
      const gateMaxX = 11.5;
      if (x >= gateMinX - radius && x <= gateMaxX + radius) {
        const minGateDist = radius + 0.45;
        const distGateZ = Math.abs(z - gateZ);
        if (distGateZ < minGateDist) {
          if (z < gateZ) {
            z = gateZ - minGateDist - 0.006;
          } else {
            z = gateZ + minGateDist + 0.006;
          }
        }
      }
    }
  }

  return { x, z };
}

// Push separation between two circular entities (prevent overlap / stacking)
export function resolveCircleRepulsion(
  posA: { x: number; z: number; radius: number },
  posB: { x: number; z: number; radius: number },
  weightA: number = 0.5 // weight for entity A (0 = immovable B, 1 = immovable A)
): { deltaA: Vector2D; deltaB: Vector2D } | null {
  const dx = posA.x - posB.x;
  const dz = posA.z - posB.z;
  const minDist = posA.radius + posB.radius;
  const distSq = dx * dx + dz * dz;

  if (distSq >= minDist * minDist) {
    return null;
  }

  const dist = Math.sqrt(distSq) || 0.0001;
  const overlap = minDist - dist;
  const normalX = dx / dist;
  const normalZ = dz / dist;

  const pushA = overlap * (1 - weightA);
  const pushB = overlap * weightA;

  return {
    deltaA: { x: normalX * pushA, z: normalZ * pushA },
    deltaB: { x: -normalX * pushB, z: -normalZ * pushB },
  };
}

// Sword hitbox query: checks if target (tx, tz) is inside the forward attack sweep
export function isInsideSwordSweep(
  playerX: number,
  playerZ: number,
  facingAngle: number,
  targetX: number,
  targetZ: number,
  targetRadius: number,
  maxReach: number = 1.25,
  arcSpreadRad: number = Math.PI * 0.75
): boolean {
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Too far away
  if (dist > maxReach + targetRadius) {
    return false;
  }

  // If extremely close, always hit
  if (dist < 0.45) {
    return true;
  }

  // Forward unit vector from player's facing angle
  const forwardX = Math.sin(facingAngle);
  const forwardZ = Math.cos(facingAngle);

  // Direction to target
  const dirX = dx / dist;
  const dirZ = dz / dist;

  // Dot product: cos(angle) between forward and target direction
  const dot = forwardX * dirX + forwardZ * dirZ;
  const minDot = Math.cos(arcSpreadRad * 0.5);

  return dot >= minDot;
}

// Ray-march test to check unobstructed line of sight between two positions
export function hasLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  checkRadius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string,
  breakables?: BreakableState[]
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.2) return true;

  const stepSize = 0.35;
  const steps = Math.floor(dist / stepSize);

  for (let i = 1; i <= steps; i++) {
    const t = (i * stepSize) / dist;
    const testX = x1 + dx * t;
    const testZ = z1 + dz * t;
    if (isPositionBlocked(testX, testZ, checkRadius, map, isGateOpen, mapId, breakables)) {
      return false;
    }
  }

  return true;
}

export interface SteeringResult {
  x: number;
  z: number;
  facingAngle: number;
  chosenBias: number;
}

// Smart obstacle steering for enemies and bosses
// When direct path toward target is blocked by pillars, props, or walls,
// Smart obstacle steering for all enemies (overworld slimes, dungeon mobs, and boss)
// When direct path toward target is blocked by trees, rocks, hedges, water, pillars, clay pots, or walls,
// sweeps radial whiskers to find the clearest bypass path around obstacles.
export function resolveSmartSteering(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  moveSpeed: number,
  dt: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string,
  preferredBias: number = 1,
  breakables?: BreakableState[]
): SteeringResult {
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.05) {
    return { x: currentX, z: currentZ, facingAngle: 0, chosenBias: preferredBias };
  }

  const directAngle = Math.atan2(dx, dz);
  const stepDist = moveSpeed * dt;
  // Adaptive lookahead: detect obstacles well in advance for both small slimes and large bosses
  const lookahead = Math.max(stepDist * 2.5, radius * 1.25, 0.6);

  // 1. Test direct path first
  const directLookX = currentX + Math.sin(directAngle) * lookahead;
  const directLookZ = currentZ + Math.cos(directAngle) * lookahead;

  if (!isPositionBlocked(directLookX, directLookZ, radius, map, isGateOpen, mapId, breakables)) {
    const directResolved = resolveWallSliding(
      currentX,
      currentZ,
      Math.sin(directAngle) * stepDist,
      Math.cos(directAngle) * stepDist,
      radius,
      map,
      isGateOpen,
      mapId,
      breakables
    );
    const moved = Math.hypot(directResolved.x - currentX, directResolved.z - currentZ);
    if (moved > stepDist * 0.4) {
      return {
        x: directResolved.x,
        z: directResolved.z,
        facingAngle: directAngle,
        chosenBias: preferredBias,
      };
    }
  }

  // 2. Direct path blocked: test whisker steering angles around obstacle
  // Bias controls whether we prefer steering clockwise or counter-clockwise
  const biasSign = preferredBias >= 0 ? 1 : -1;
  const angleOffsets = [
    biasSign * 0.52,   // ~30 deg
    -biasSign * 0.52,
    biasSign * 1.05,   // ~60 deg
    -biasSign * 1.05,
    biasSign * 1.57,   // 90 deg (exact tangent sideways bypass)
    -biasSign * 1.57,
    biasSign * 2.09,   // ~120 deg (flank around wide objects)
    -biasSign * 2.09,
    biasSign * 2.53,   // ~145 deg (wide corner escape)
    -biasSign * 2.53,
  ];

  // Pass A: lookahead scan
  for (let i = 0; i < angleOffsets.length; i++) {
    const offset = angleOffsets[i];
    const candidateAngle = directAngle + offset;
    const candLookX = currentX + Math.sin(candidateAngle) * lookahead;
    const candLookZ = currentZ + Math.cos(candidateAngle) * lookahead;

    if (!isPositionBlocked(candLookX, candLookZ, radius, map, isGateOpen, mapId, breakables)) {
      const stepX = Math.sin(candidateAngle) * stepDist;
      const stepZ = Math.cos(candidateAngle) * stepDist;
      const candResolved = resolveWallSliding(
        currentX,
        currentZ,
        stepX,
        stepZ,
        radius,
        map,
        isGateOpen,
        mapId,
        breakables
      );

      const moved = Math.hypot(candResolved.x - currentX, candResolved.z - currentZ);
      if (moved > stepDist * 0.25) {
        return {
          x: candResolved.x,
          z: candResolved.z,
          facingAngle: candidateAngle,
          chosenBias: offset >= 0 ? 1 : -1,
        };
      }
    }
  }

  // Pass B: immediate clearance scan (when right next to tight tree cluster or wall)
  const shortLook = Math.max(stepDist * 1.5, radius * 0.6);
  for (let i = 0; i < angleOffsets.length; i++) {
    const offset = angleOffsets[i];
    const candidateAngle = directAngle + offset;
    const shortX = currentX + Math.sin(candidateAngle) * shortLook;
    const shortZ = currentZ + Math.cos(candidateAngle) * shortLook;

    if (!isPositionBlocked(shortX, shortZ, radius, map, isGateOpen, mapId, breakables)) {
      const stepX = Math.sin(candidateAngle) * stepDist;
      const stepZ = Math.cos(candidateAngle) * stepDist;
      const candResolved = resolveWallSliding(
        currentX,
        currentZ,
        stepX,
        stepZ,
        radius,
        map,
        isGateOpen,
        mapId,
        breakables
      );

      const moved = Math.hypot(candResolved.x - currentX, candResolved.z - currentZ);
      if (moved > stepDist * 0.2) {
        return {
          x: candResolved.x,
          z: candResolved.z,
          facingAngle: candidateAngle,
          chosenBias: offset >= 0 ? 1 : -1,
        };
      }
    }
  }

  // Fallback: standard wall sliding
  const fallback = resolveWallSliding(
    currentX,
    currentZ,
    (dx / dist) * stepDist,
    (dz / dist) * stepDist,
    radius,
    map,
    isGateOpen,
    mapId,
    breakables
  );

  return {
    x: fallback.x,
    z: fallback.z,
    facingAngle: directAngle,
    chosenBias: preferredBias,
  };
}
