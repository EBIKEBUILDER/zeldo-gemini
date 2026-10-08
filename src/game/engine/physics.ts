import { MapData, WorldProp } from '../worldData';
import { Vector2D } from '@/types/game';
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

// Full obstacle test (tile + props + gate)
export function isPositionBlocked(
  x: number,
  z: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string
): boolean {
  if (checkTileCollision(x, z, radius, map)) return true;
  if (checkPropCollision(x, z, radius, map.props)) return true;
  if (checkGateCollision(x, z, radius, isGateOpen, mapId)) return true;
  return false;
}

// Smooth wall sliding movement resolution
export function resolveWallSliding(
  currentX: number,
  currentZ: number,
  desiredDx: number,
  desiredDz: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string
): Vector2D {
  let newX = currentX;
  let newZ = currentZ;

  // Try moving in both axes simultaneously
  const targetX = currentX + desiredDx;
  const targetZ = currentZ + desiredDz;

  if (!isPositionBlocked(targetX, targetZ, radius, map, isGateOpen, mapId)) {
    return { x: targetX, z: targetZ };
  }

  // If blocked, attempt independent X axis slide
  if (desiredDx !== 0 && !isPositionBlocked(targetX, newZ, radius, map, isGateOpen, mapId)) {
    newX = targetX;
  }

  // Attempt independent Z axis slide
  if (desiredDz !== 0 && !isPositionBlocked(newX, targetZ, radius, map, isGateOpen, mapId)) {
    newZ = targetZ;
  }

  return { x: newX, z: newZ };
}

// Safely depenetrate/eject an entity overlapping with any solid props, tiles, or gate
export function depenetrateFromObstacles(
  pos: Vector2D,
  radius: number,
  map: MapData,
  isGateOpen: boolean = false,
  mapId: string = 'overworld'
): Vector2D {
  let x = pos.x;
  let z = pos.z;

  // 1. Depenetrate against solid world props (trees, rocks, pillars, cottage)
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
        const overlap = minDist - dist;
        x += (dx / dist) * overlap;
        z += (dz / dist) * overlap;
      } else {
        // If exact center overlap, eject along +X
        x += minDist;
      }
    }
  }

  // 2. Depenetrate against solid tiles
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
            const overlap = radius - dist;
            x += (distX / dist) * overlap;
            z += (distZ / dist) * overlap;
          } else {
            // Inside the tile: find closest edge
            const dLeft = Math.abs(x - tx);
            const dRight = Math.abs(tx + 1 - x);
            const dBottom = Math.abs(z - tz);
            const dTop = Math.abs(tz + 1 - z);
            const minEdge = Math.min(dLeft, dRight, dBottom, dTop);
            if (minEdge === dLeft) x = tx - radius;
            else if (minEdge === dRight) x = tx + 1 + radius;
            else if (minEdge === dBottom) z = tz - radius;
            else z = tz + 1 + radius;
          }
        }
      }
    }
  }

  // 3. Depenetrate against closed dungeon gate
  if (mapId === 'dungeon' && !isGateOpen) {
    const gateZ = DUNGEON_GATE_POS.z;
    const gateMinX = 8.5;
    const gateMaxX = 11.5;
    if (x >= gateMinX - radius && x <= gateMaxX + radius) {
      const minGateDist = radius + 0.45;
      const distGateZ = Math.abs(z - gateZ);
      if (distGateZ < minGateDist) {
        if (z < gateZ) {
          z = gateZ - minGateDist;
        } else {
          z = gateZ + minGateDist;
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
  mapId: string
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
    if (isPositionBlocked(testX, testZ, checkRadius, map, isGateOpen, mapId)) {
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
  preferredBias: number = 1
): SteeringResult {
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.05) {
    return { x: currentX, z: currentZ, facingAngle: 0, chosenBias: preferredBias };
  }

  const directAngle = Math.atan2(dx, dz);
  const stepDist = moveSpeed * dt;
  const lookahead = Math.max(stepDist * 1.5, radius * 0.85);

  // 1. Test direct path first
  const directLookX = currentX + Math.sin(directAngle) * lookahead;
  const directLookZ = currentZ + Math.cos(directAngle) * lookahead;

  if (!isPositionBlocked(directLookX, directLookZ, radius, map, isGateOpen, mapId)) {
    const directResolved = resolveWallSliding(
      currentX,
      currentZ,
      Math.sin(directAngle) * stepDist,
      Math.cos(directAngle) * stepDist,
      radius,
      map,
      isGateOpen,
      mapId
    );
    const moved = Math.hypot(directResolved.x - currentX, directResolved.z - currentZ);
    if (moved > stepDist * 0.45) {
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
    biasSign * 0.45,   // ~25 deg
    -biasSign * 0.45,
    biasSign * 0.9,    // ~50 deg
    -biasSign * 0.9,
    biasSign * 1.35,   // ~77 deg
    -biasSign * 1.35,
    biasSign * 1.8,    // ~103 deg
    -biasSign * 1.8,
  ];

  for (let i = 0; i < angleOffsets.length; i++) {
    const offset = angleOffsets[i];
    const candidateAngle = directAngle + offset;
    const candLookX = currentX + Math.sin(candidateAngle) * lookahead;
    const candLookZ = currentZ + Math.cos(candidateAngle) * lookahead;

    if (!isPositionBlocked(candLookX, candLookZ, radius, map, isGateOpen, mapId)) {
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
        mapId
      );

      const moved = Math.hypot(candResolved.x - currentX, candResolved.z - currentZ);
      if (moved > stepDist * 0.35) {
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
    mapId
  );

  return {
    x: fallback.x,
    z: fallback.z,
    facingAngle: directAngle,
    chosenBias: preferredBias,
  };
}
