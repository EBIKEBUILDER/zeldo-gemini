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
