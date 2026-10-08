import { Vector2D, BreakableState } from '@/types/game';
import { MapData } from '../worldData';
import { isPositionBlocked, hasLineOfSight } from './physics';

const CELL_SIZE = 0.5;

interface Node {
  gx: number;
  gz: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

// Simple fast binary min-heap for A* open set
class FastMinHeap {
  private heap: Node[] = [];

  push(node: Node) {
    this.heap.push(node);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (this.heap[index].f < this.heap[parentIndex].f) {
        const tmp = this.heap[index];
        this.heap[index] = this.heap[parentIndex];
        this.heap[parentIndex] = tmp;
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  pop(): Node | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      let index = 0;
      const length = this.heap.length;
      while (true) {
        const left = (index << 1) + 1;
        const right = left + 1;
        let smallest = index;

        if (left < length && this.heap[left].f < this.heap[smallest].f) {
          smallest = left;
        }
        if (right < length && this.heap[right].f < this.heap[smallest].f) {
          smallest = right;
        }
        if (smallest !== index) {
          const tmp = this.heap[index];
          this.heap[index] = this.heap[smallest];
          this.heap[smallest] = tmp;
          index = smallest;
        } else {
          break;
        }
      }
    }
    return top;
  }

  size(): number {
    return this.heap.length;
  }
}

/**
 * Intelligent A* (A-Star) Grid Pathfinding with Raycast Line-of-Sight Path Smoothing (String-Pulling).
 *
 * Algorithm Breakdown:
 * 1. Line-of-Sight Fast Path: If direct raycast to target is unobstructed, returns single straight-line target.
 * 2. Spatial Discretisation: Maps continuous 3D world coordinates onto an optimal 0.5-unit spatial grid.
 * 3. Min-Heap Priority Queue: Uses FastMinHeap for O(log N) open-set exploration ordered by f(n) = g(n) + h(n).
 * 4. 8-Way Graph Traversal: Evaluates 4 orthogonal (cost 1.0) and 4 diagonal (cost 1.414) directions.
 * 5. Corner-Cutting Prevention: Strictly verifies both adjacent orthogonal cells before allowing diagonal movement.
 * 6. Line-of-Sight String-Pulling Smoothing: Raycasts along raw path to prune redundant zig-zag waypoints.
 */
export function findPathAStar(
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number,
  radius: number,
  map: MapData,
  isGateOpen: boolean,
  mapId: string,
  breakables?: BreakableState[]
): Vector2D[] | null {
  // If direct line of sight is already clear, direct path is optimal
  if (hasLineOfSight(startX, startZ, targetX, targetZ, radius, map, isGateOpen, mapId, breakables)) {
    return [{ x: targetX, z: targetZ }];
  }

  const gridW = Math.round(map.width / CELL_SIZE);
  const gridH = Math.round(map.height / CELL_SIZE);

  const startGx = Math.max(0, Math.min(gridW - 1, Math.floor(startX / CELL_SIZE)));
  const startGz = Math.max(0, Math.min(gridH - 1, Math.floor(startZ / CELL_SIZE)));

  let goalGx = Math.max(0, Math.min(gridW - 1, Math.floor(targetX / CELL_SIZE)));
  let goalGz = Math.max(0, Math.min(gridH - 1, Math.floor(targetZ / CELL_SIZE)));

  // If goal cell itself is blocked (e.g. target standing against a solid wall), find closest walkable adjacent cell
  const isGoalBlocked = isPositionBlocked(
    (goalGx + 0.5) * CELL_SIZE,
    (goalGz + 0.5) * CELL_SIZE,
    radius,
    map,
    isGateOpen,
    mapId,
    breakables
  );

  if (isGoalBlocked) {
    let bestDist = Infinity;
    let fallbackGx = goalGx;
    let fallbackGz = goalGz;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const testGx = goalGx + dx;
        const testGz = goalGz + dz;
        if (testGx >= 0 && testGx < gridW && testGz >= 0 && testGz < gridH) {
          const worldX = (testGx + 0.5) * CELL_SIZE;
          const worldZ = (testGz + 0.5) * CELL_SIZE;
          if (!isPositionBlocked(worldX, worldZ, radius, map, isGateOpen, mapId, breakables)) {
            const d = Math.hypot(worldX - targetX, worldZ - targetZ);
            if (d < bestDist) {
              bestDist = d;
              fallbackGx = testGx;
              fallbackGz = testGz;
            }
          }
        }
      }
    }
    goalGx = fallbackGx;
    goalGz = fallbackGz;
  }

  // A* Search
  const openHeap = new FastMinHeap();
  const closedSet = new Uint8Array(gridW * gridH);
  const gScores = new Float32Array(gridW * gridH).fill(Infinity);

  const startIndex = startGz * gridW + startGx;
  gScores[startIndex] = 0;

  const startH = Math.hypot(goalGx - startGx, goalGz - startGz);
  openHeap.push({
    gx: startGx,
    gz: startGz,
    g: 0,
    h: startH,
    f: startH,
    parent: null,
  });

  // 8 movement directions: 4 orthogonal (cost 1.0) and 4 diagonal (cost 1.414)
  const dirOffsets = [
    { dx: 1, dz: 0, cost: 1.0 },
    { dx: -1, dz: 0, cost: 1.0 },
    { dx: 0, dz: 1, cost: 1.0 },
    { dx: 0, dz: -1, cost: 1.0 },
    { dx: 1, dz: 1, cost: 1.414 },
    { dx: -1, dz: 1, cost: 1.414 },
    { dx: 1, dz: -1, cost: 1.414 },
    { dx: -1, dz: -1, cost: 1.414 },
  ];

  let goalNode: Node | null = null;
  let iterations = 0;
  const maxIterations = 800; // Safeguard against unbounded search

  while (openHeap.size() > 0 && iterations++ < maxIterations) {
    const current = openHeap.pop()!;
    const currentIndex = current.gz * gridW + current.gx;

    if (current.gx === goalGx && current.gz === goalGz) {
      goalNode = current;
      break;
    }

    if (closedSet[currentIndex]) continue;
    closedSet[currentIndex] = 1;

    for (let i = 0; i < dirOffsets.length; i++) {
      const { dx, dz, cost } = dirOffsets[i];
      const nextGx = current.gx + dx;
      const nextGz = current.gz + dz;

      if (nextGx < 0 || nextGx >= gridW || nextGz < 0 || nextGz >= gridH) continue;

      const nextIndex = nextGz * gridW + nextGx;
      if (closedSet[nextIndex]) continue;

      // Check diagonal corner-cutting
      if (dx !== 0 && dz !== 0) {
        const side1X = (current.gx + dx + 0.5) * CELL_SIZE;
        const side1Z = (current.gz + 0.5) * CELL_SIZE;
        const side2X = (current.gx + 0.5) * CELL_SIZE;
        const side2Z = (current.gz + dz + 0.5) * CELL_SIZE;
        if (
          isPositionBlocked(side1X, side1Z, radius, map, isGateOpen, mapId, breakables) ||
          isPositionBlocked(side2X, side2Z, radius, map, isGateOpen, mapId, breakables)
        ) {
          continue;
        }
      }

      // Check walkability of next cell
      const worldX = (nextGx + 0.5) * CELL_SIZE;
      const worldZ = (nextGz + 0.5) * CELL_SIZE;
      if (isPositionBlocked(worldX, worldZ, radius, map, isGateOpen, mapId, breakables)) {
        continue;
      }

      const tentativeG = current.g + cost;
      if (tentativeG < gScores[nextIndex]) {
        gScores[nextIndex] = tentativeG;
        const h = Math.hypot(goalGx - nextGx, goalGz - nextGz);
        openHeap.push({
          gx: nextGx,
          gz: nextGz,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  if (!goalNode) {
    return null; // Target is completely unnavigable or blocked
  }

  // Reconstruct raw waypoints (from start to goal)
  const rawWaypoints: Vector2D[] = [];
  let curr: Node | null = goalNode;
  while (curr) {
    rawWaypoints.push({
      x: (curr.gx + 0.5) * CELL_SIZE,
      z: (curr.gz + 0.5) * CELL_SIZE,
    });
    curr = curr.parent;
  }
  rawWaypoints.reverse();

  // Replace last waypoint with exact target position
  if (rawWaypoints.length > 0) {
    rawWaypoints[rawWaypoints.length - 1] = { x: targetX, z: targetZ };
  }

  // Raycast string-pulling smoothing: skip intermediate waypoints if direct LoS exists
  if (rawWaypoints.length <= 2) {
    return rawWaypoints;
  }

  const smoothed: Vector2D[] = [rawWaypoints[0]];
  let anchorIdx = 0;

  while (anchorIdx < rawWaypoints.length - 1) {
    let farthestLoS = anchorIdx + 1;
    for (let testIdx = rawWaypoints.length - 1; testIdx > anchorIdx + 1; testIdx--) {
      if (
        hasLineOfSight(
          rawWaypoints[anchorIdx].x,
          rawWaypoints[anchorIdx].z,
          rawWaypoints[testIdx].x,
          rawWaypoints[testIdx].z,
          radius,
          map,
          isGateOpen,
          mapId,
          breakables
        )
      ) {
        farthestLoS = testIdx;
        break;
      }
    }
    smoothed.push(rawWaypoints[farthestLoS]);
    anchorIdx = farthestLoS;
  }

  return smoothed;
}

// Backward compatibility alias
export const findPath = findPathAStar;
