import { Vector2D, BreakableState, MapId, NavPortal, PathWaypoint, PathStatus, PathResult } from '@/types/game';
import { MapData } from '../worldData';
import {
  DUNGEON_ENTRANCE_POS,
  DUNGEON_SPAWN_POS,
  DUNGEON_EXIT_POS,
  DUNGEON_GATE_POS,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  SCREEN_WIDTH_TILES,
  SCREEN_HEIGHT_TILES,
  OVERWORLD_WIDTH_TILES,
  OVERWORLD_HEIGHT_TILES,
  DUNGEON_WIDTH_TILES,
  DUNGEON_HEIGHT_TILES,
} from '../constants';
import { isPositionBlocked, hasLineOfSight } from './physics';

export const CELL_SIZE = 0.5;

// ============================================================================
// 1. CHUNK COORDINATE & IDENTITY MAPPING
// ============================================================================

export interface ChunkInfo {
  chunkId: string;
  mapId: MapId;
  col: number;
  row: number;
}

/**
 * Returns chunk info for any world coordinate.
 * In the 3x2 overworld: col in [0..2], row in [0..1]
 * Adjacent chunks in overworld are stitched into one unified nav grid.
 */
export function getChunkInfo(mapId: MapId | string, worldX: number, worldZ: number): ChunkInfo {
  if (mapId === 'dungeon') {
    return { chunkId: 'dungeon:0,0', mapId: 'dungeon', col: 0, row: 0 };
  }
  const col = Math.max(0, Math.min(OVERWORLD_COLS - 1, Math.floor(worldX / SCREEN_WIDTH_TILES)));
  const row = Math.max(0, Math.min(OVERWORLD_ROWS - 1, Math.floor(worldZ / SCREEN_HEIGHT_TILES)));
  return {
    chunkId: `overworld:${col},${row}`,
    mapId: 'overworld',
    col,
    row,
  };
}

// ============================================================================
// 2. PORTAL SPECIFICATIONS & REGISTRY (Non-adjacent connections)
// ============================================================================

/**
 * Default portals connecting non-adjacent areas (e.g. overworld to dungeon entrance).
 * NOTE: monsters don't follow through dungeon entrances by default (traversableByAI: false)
 * for classic Zelda leashing. This can be toggled per-portal via setPortalTraversableByAI.
 */
export const DEFAULT_PORTALS: NavPortal[] = [
  {
    id: 'overworld_to_dungeon',
    name: 'Mountain Crypt Entrance',
    fromChunk: 'overworld', // chunk 'overworld:2,1'
    fromTile: { x: DUNGEON_ENTRANCE_POS.x, z: 19.0 }, // doorway archway at (41.5, 19.0)
    toChunk: 'dungeon',
    toTile: { x: DUNGEON_SPAWN_POS.x, z: DUNGEON_SPAWN_POS.z }, // (10.0, 3.5)
    cost: 1.5,
    traversableByAI: false, // Classic Zelda leashing: monsters give up at entrance
  },
  {
    id: 'dungeon_to_overworld',
    name: 'Dungeon Exit Doorway',
    fromChunk: 'dungeon',
    fromTile: { x: DUNGEON_EXIT_POS.x, z: DUNGEON_EXIT_POS.z }, // (10.0, 1.5)
    toChunk: 'overworld',
    toTile: { x: DUNGEON_ENTRANCE_POS.x, z: DUNGEON_ENTRANCE_POS.z - 2.0 }, // (41.5, 18.0)
    cost: 1.5,
    traversableByAI: false,
  },
];

export class NavPortalRegistry {
  private portals: Map<string, NavPortal> = new Map();

  constructor(initialPortals: NavPortal[] = DEFAULT_PORTALS) {
    for (const p of initialPortals) {
      this.portals.set(p.id, { ...p });
    }
  }

  public registerPortal(portal: NavPortal): void {
    this.portals.set(portal.id, { ...portal });
  }

  public unregisterPortal(id: string): void {
    this.portals.delete(id);
  }

  public getPortal(id: string): NavPortal | undefined {
    return this.portals.get(id);
  }

  public getAllPortals(): NavPortal[] {
    return Array.from(this.portals.values());
  }

  public setPortalTraversableByAI(portalId: string, traversable: boolean): boolean {
    const portal = this.portals.get(portalId);
    if (!portal) return false;
    portal.traversableByAI = traversable;
    return true;
  }

  public getPortalsFrom(mapOrChunkId: string): NavPortal[] {
    const isExact = mapOrChunkId.includes(':');
    return Array.from(this.portals.values()).filter((p) => {
      if (isExact) {
        return p.fromChunk === mapOrChunkId || p.fromChunk === mapOrChunkId.split(':')[0];
      }
      return p.fromChunk === mapOrChunkId || p.fromChunk.startsWith(`${mapOrChunkId}:`);
    });
  }
}

export const defaultPortalRegistry = new NavPortalRegistry();

// ============================================================================
// 3. UNIFIED NAV GRID & DYNAMIC REBUILDS
// ============================================================================

export interface MapGridDimensions {
  width: number;
  height: number;
  gridW: number;
  gridH: number;
}

export const OVERWORLD_GRID_DIMS: MapGridDimensions = {
  width: OVERWORLD_WIDTH_TILES,
  height: OVERWORLD_HEIGHT_TILES,
  gridW: Math.round(OVERWORLD_WIDTH_TILES / CELL_SIZE), // 96
  gridH: Math.round(OVERWORLD_HEIGHT_TILES / CELL_SIZE), // 48
};

export const DUNGEON_GRID_DIMS: MapGridDimensions = {
  width: DUNGEON_WIDTH_TILES,
  height: DUNGEON_HEIGHT_TILES,
  gridW: Math.round(DUNGEON_WIDTH_TILES / CELL_SIZE), // 40
  gridH: Math.round(DUNGEON_HEIGHT_TILES / CELL_SIZE), // 48
};

export const TOTAL_OVERWORLD_CELLS = OVERWORLD_GRID_DIMS.gridW * OVERWORLD_GRID_DIMS.gridH; // 4608
export const TOTAL_DUNGEON_CELLS = DUNGEON_GRID_DIMS.gridW * DUNGEON_GRID_DIMS.gridH; // 1920
export const TOTAL_GRAPH_CELLS = TOTAL_OVERWORLD_CELLS + TOTAL_DUNGEON_CELLS; // 6528

/**
 * Fast flat integer node index for O(1) typed array indexing across maps.
 */
export function getFlatNodeIndex(mapId: MapId | string, gx: number, gz: number): number {
  if (mapId === 'overworld') {
    return gz * OVERWORLD_GRID_DIMS.gridW + gx;
  }
  return TOTAL_OVERWORLD_CELLS + gz * DUNGEON_GRID_DIMS.gridW + gx;
}

export function getMapAndCoordsFromIndex(index: number): { mapId: MapId; gx: number; gz: number } {
  if (index < TOTAL_OVERWORLD_CELLS) {
    const gridW = OVERWORLD_GRID_DIMS.gridW;
    return {
      mapId: 'overworld',
      gx: index % gridW,
      gz: Math.floor(index / gridW),
    };
  }
  const dIndex = index - TOTAL_OVERWORLD_CELLS;
  const gridW = DUNGEON_GRID_DIMS.gridW;
  return {
    mapId: 'dungeon',
    gx: dIndex % gridW,
    gz: Math.floor(dIndex / gridW),
  };
}

/**
 * NavGrid: Fast precomputed navigation grid.
 * Adjacent chunks in overworld are stitched seamlessly without walls.
 * Dynamically rebuilds cells when tiles, breakables, or gates change.
 */
export class NavGrid {
  // 1 = walkable, 0 = blocked
  public overworldWalkable: Uint8Array = new Uint8Array(TOTAL_OVERWORLD_CELLS);
  public dungeonWalkable: Uint8Array = new Uint8Array(TOTAL_DUNGEON_CELLS);
  public version: number = 1;

  public isBuilt: boolean = false;

  public build(
    overworldMap: MapData,
    dungeonMap: MapData,
    isGateOpen: boolean = false,
    breakables?: BreakableState[]
  ): void {
    // 1. Build Overworld (all 3x2 chunks unified)
    const oW = OVERWORLD_GRID_DIMS.gridW;
    const oH = OVERWORLD_GRID_DIMS.gridH;
    for (let gz = 0; gz < oH; gz++) {
      for (let gx = 0; gx < oW; gx++) {
        const worldX = (gx + 0.5) * CELL_SIZE;
        const worldZ = (gz + 0.5) * CELL_SIZE;
        const blocked = isPositionBlocked(
          worldX,
          worldZ,
          0.32,
          overworldMap,
          false,
          'overworld',
          breakables
        );
        this.overworldWalkable[gz * oW + gx] = blocked ? 0 : 1;
      }
    }

    // 2. Build Dungeon
    const dW = DUNGEON_GRID_DIMS.gridW;
    const dH = DUNGEON_GRID_DIMS.gridH;
    for (let gz = 0; gz < dH; gz++) {
      for (let gx = 0; gx < dW; gx++) {
        const worldX = (gx + 0.5) * CELL_SIZE;
        const worldZ = (gz + 0.5) * CELL_SIZE;
        const blocked = isPositionBlocked(
          worldX,
          worldZ,
          0.32,
          dungeonMap,
          isGateOpen,
          'dungeon',
          breakables
        );
        this.dungeonWalkable[gz * dW + gx] = blocked ? 0 : 1;
      }
    }

    this.isBuilt = true;
    this.version++;
  }

  public isWalkable(mapId: MapId | string, gx: number, gz: number): boolean {
    if (mapId === 'overworld') {
      if (gx < 0 || gx >= OVERWORLD_GRID_DIMS.gridW || gz < 0 || gz >= OVERWORLD_GRID_DIMS.gridH) {
        return false;
      }
      return this.overworldWalkable[gz * OVERWORLD_GRID_DIMS.gridW + gx] === 1;
    } else {
      if (gx < 0 || gx >= DUNGEON_GRID_DIMS.gridW || gz < 0 || gz >= DUNGEON_GRID_DIMS.gridH) {
        return false;
      }
      return this.dungeonWalkable[gz * DUNGEON_GRID_DIMS.gridW + gx] === 1;
    }
  }

  public isWorldWalkable(mapId: MapId | string, worldX: number, worldZ: number): boolean {
    const gx = Math.floor(worldX / CELL_SIZE);
    const gz = Math.floor(worldZ / CELL_SIZE);
    return this.isWalkable(mapId, gx, gz);
  }

  /**
   * Rebuilds/invalidates a bounded world area when an obstacle changes state
   * (e.g. pot broken, bush cut, door opened).
   */
  public invalidateBounds(
    mapId: MapId,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    mapData: MapData,
    isGateOpen: boolean,
    breakables?: BreakableState[]
  ): void {
    const dims = mapId === 'overworld' ? OVERWORLD_GRID_DIMS : DUNGEON_GRID_DIMS;
    const targetArray = mapId === 'overworld' ? this.overworldWalkable : this.dungeonWalkable;

    const minGx = Math.max(0, Math.floor(minX / CELL_SIZE));
    const maxGx = Math.min(dims.gridW - 1, Math.floor(maxX / CELL_SIZE));
    const minGz = Math.max(0, Math.floor(minZ / CELL_SIZE));
    const maxGz = Math.min(dims.gridH - 1, Math.floor(maxZ / CELL_SIZE));

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const worldX = (gx + 0.5) * CELL_SIZE;
        const worldZ = (gz + 0.5) * CELL_SIZE;
        const blocked = isPositionBlocked(
          worldX,
          worldZ,
          0.32,
          mapData,
          isGateOpen,
          mapId,
          breakables
        );
        targetArray[gz * dims.gridW + gx] = blocked ? 0 : 1;
      }
    }
    this.version++;
  }

  /**
   * Rebuilds when a breakable pot or grass changes state
   */
  public onBreakableStateChanged(
    breakable: BreakableState,
    mapData: MapData,
    isGateOpen: boolean,
    allBreakables?: BreakableState[]
  ): void {
    const r = breakable.radius + 0.45;
    this.invalidateBounds(
      breakable.mapId,
      breakable.x - r,
      breakable.z - r,
      breakable.x + r,
      breakable.z + r,
      mapData,
      isGateOpen,
      allBreakables
    );
  }

  /**
   * Rebuilds when the dungeon gate opens/closes
   */
  public onGateStateChanged(
    isOpen: boolean,
    dungeonMap: MapData,
    breakables?: BreakableState[]
  ): void {
    // Gate spans x: 8.5..11.5, z: 11.5
    this.invalidateBounds(
      'dungeon',
      8.0,
      10.5,
      12.0,
      12.5,
      dungeonMap,
      isOpen,
      breakables
    );
  }

  /**
   * Rebuilds a specific tile when changed
   */
  public onTileChanged(
    mapId: MapId,
    tileX: number,
    tileZ: number,
    mapData: MapData,
    isGateOpen: boolean,
    breakables?: BreakableState[]
  ): void {
    this.invalidateBounds(
      mapId,
      tileX - 0.1,
      tileZ - 0.1,
      tileX + 1.1,
      tileZ + 1.1,
      mapData,
      isGateOpen,
      breakables
    );
  }
}

export const defaultNavGrid = new NavGrid();

// ============================================================================
// 4. FAST MIN HEAP FOR A*
// ============================================================================

interface AStarNode {
  mapId: MapId;
  gx: number;
  gz: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
  portalUsed?: NavPortal;
}

class FastMinHeap {
  private heap: AStarNode[] = [];

  push(node: AStarNode) {
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

  pop(): AStarNode | undefined {
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

// 8 neighbor directions: 4 orthogonal (1.0), 4 diagonal (1.414)
const DIR_OFFSETS = [
  { dx: 1, dz: 0, cost: 1.0 },
  { dx: -1, dz: 0, cost: 1.0 },
  { dx: 0, dz: 1, cost: 1.0 },
  { dx: 0, dz: -1, cost: 1.0 },
  { dx: 1, dz: 1, cost: 1.414 },
  { dx: -1, dz: 1, cost: 1.414 },
  { dx: 1, dz: -1, cost: 1.414 },
  { dx: -1, dz: -1, cost: 1.414 },
];

// ============================================================================
// 5. UNIFIED CROSS-CHUNK & PORTAL A* SEARCH
// ============================================================================

export interface FindPathOptions {
  startX: number;
  startZ: number;
  startMap?: MapId | string;
  targetX: number;
  targetZ: number;
  targetMap?: MapId | string;
  radius?: number;
  isAI?: boolean; // if true, respects portal.traversableByAI flag (defaults to false for dungeon mouth)
  navGrid?: NavGrid;
  portalRegistry?: NavPortalRegistry;
  overworldMap?: MapData;
  dungeonMap?: MapData;
  isGateOpen?: boolean;
  breakables?: BreakableState[];
  maxIterations?: number;
}

/**
 * Searches for an optimal path across adjacent chunks and non-adjacent portals.
 * Features:
 * - Seamless cross-chunk traversal for 3x2 adjacent overworld chunks
 * - Portal edges with traversal cost and traversableByAI gating
 * - Graceful no-path fallback: returns closest reachable node if exact target blocked
 * - O(1) NavGrid walkability lookups with line-of-sight path smoothing
 */
export function findPathUnified(options: FindPathOptions): PathResult {
  const {
    startX,
    startZ,
    targetX,
    targetZ,
    radius = 0.35,
    isAI = false,
    portalRegistry = defaultPortalRegistry,
    overworldMap,
    dungeonMap,
    isGateOpen = false,
    breakables,
    maxIterations = 900,
  } = options;

  const startMap: MapId = (options.startMap as MapId) || 'overworld';
  const targetMap: MapId = (options.targetMap as MapId) || startMap;

  // Use provided or default NavGrid
  const grid = options.navGrid || defaultNavGrid;

  // Ensure grid is built if maps provided
  if (!grid.isBuilt && overworldMap && dungeonMap) {
    grid.build(overworldMap, dungeonMap, isGateOpen, breakables);
  }

  const currentMapData = startMap === 'dungeon' ? dungeonMap : overworldMap;

  // 1. Trivial line-of-sight fast path if within the same map
  if (
    startMap === targetMap &&
    currentMapData &&
    hasLineOfSight(
      startX,
      startZ,
      targetX,
      targetZ,
      radius,
      currentMapData,
      isGateOpen,
      startMap,
      breakables
    )
  ) {
    return {
      waypoints: [{ x: targetX, z: targetZ, mapId: startMap }],
      status: 'complete',
      targetReached: true,
      totalCost: Math.hypot(targetX - startX, targetZ - startZ),
    };
  }

  const startDims = startMap === 'overworld' ? OVERWORLD_GRID_DIMS : DUNGEON_GRID_DIMS;
  const targetDims = targetMap === 'overworld' ? OVERWORLD_GRID_DIMS : DUNGEON_GRID_DIMS;

  const startGx = Math.max(0, Math.min(startDims.gridW - 1, Math.floor(startX / CELL_SIZE)));
  const startGz = Math.max(0, Math.min(startDims.gridH - 1, Math.floor(startZ / CELL_SIZE)));

  let goalGx = Math.max(0, Math.min(targetDims.gridW - 1, Math.floor(targetX / CELL_SIZE)));
  let goalGz = Math.max(0, Math.min(targetDims.gridH - 1, Math.floor(targetZ / CELL_SIZE)));

  // If goal cell itself is blocked (e.g. standing against a solid wall), find closest walkable adjacent cell
  if (!grid.isWalkable(targetMap, goalGx, goalGz)) {
    let bestDist = Infinity;
    let fallbackGx = goalGx;
    let fallbackGz = goalGz;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const testGx = goalGx + dx;
        const testGz = goalGz + dz;
        if (grid.isWalkable(targetMap, testGx, testGz)) {
          const worldX = (testGx + 0.5) * CELL_SIZE;
          const worldZ = (testGz + 0.5) * CELL_SIZE;
          const d = Math.hypot(worldX - targetX, worldZ - targetZ);
          if (d < bestDist) {
            bestDist = d;
            fallbackGx = testGx;
            fallbackGz = testGz;
          }
        }
      }
    }
    goalGx = fallbackGx;
    goalGz = fallbackGz;
  }

  // Cross-portal heuristic function
  const activePortals = portalRegistry.getAllPortals();
  const computeHeuristic = (mapId: MapId, gx: number, gz: number): number => {
    const wx = (gx + 0.5) * CELL_SIZE;
    const wz = (gz + 0.5) * CELL_SIZE;

    if (mapId === targetMap) {
      return Math.hypot(goalGx - gx, goalGz - gz) * CELL_SIZE;
    }

    // Must route across portals
    let minH = Infinity;
    for (let p = 0; p < activePortals.length; p++) {
      const portal = activePortals[p];
      // Skip if AI and portal is not traversable by AI (Zelda leashing)
      if (isAI && !portal.traversableByAI) continue;

      if (portal.fromChunk === mapId && portal.toChunk === targetMap) {
        const distToPortal = Math.hypot(wx - portal.fromTile.x, wz - portal.fromTile.z);
        const distFromPortalToGoal = Math.hypot(
          (goalGx + 0.5) * CELL_SIZE - portal.toTile.x,
          (goalGz + 0.5) * CELL_SIZE - portal.toTile.z
        );
        const cost = distToPortal + portal.cost + distFromPortalToGoal;
        if (cost < minH) minH = cost;
      }
    }

    return minH < Infinity ? minH : 999999;
  };

  // A* Data structures
  const openHeap = new FastMinHeap();
  const closedSet = new Uint8Array(TOTAL_GRAPH_CELLS);
  const gScores = new Float32Array(TOTAL_GRAPH_CELLS).fill(Infinity);

  const startIndex = getFlatNodeIndex(startMap, startGx, startGz);
  gScores[startIndex] = 0;

  const initialH = computeHeuristic(startMap, startGx, startGz);
  openHeap.push({
    mapId: startMap,
    gx: startGx,
    gz: startGz,
    g: 0,
    h: initialH,
    f: initialH,
    parent: null,
  });

  let goalNode: AStarNode | null = null;
  let iterations = 0;

  // Best-effort reachable node tracker for graceful fallback
  let bestReachableNode: AStarNode | null = null;
  let minHeuristicSeen = initialH;

  while (openHeap.size() > 0 && iterations++ < maxIterations) {
    const current = openHeap.pop()!;
    const currentIndex = getFlatNodeIndex(current.mapId, current.gx, current.gz);

    // Track best node for graceful no-path fallback
    if (current.h < minHeuristicSeen) {
      minHeuristicSeen = current.h;
      bestReachableNode = current;
    }

    // Goal reached?
    if (current.mapId === targetMap && current.gx === goalGx && current.gz === goalGz) {
      goalNode = current;
      break;
    }

    if (closedSet[currentIndex]) continue;
    closedSet[currentIndex] = 1;

    const currentDims = current.mapId === 'overworld' ? OVERWORLD_GRID_DIMS : DUNGEON_GRID_DIMS;
    const currentWx = (current.gx + 0.5) * CELL_SIZE;
    const currentWz = (current.gz + 0.5) * CELL_SIZE;

    // A. 8-Way Movement on Grid (Seamless cross-chunk in adjacent overworld chunks)
    for (let i = 0; i < DIR_OFFSETS.length; i++) {
      const { dx, dz, cost } = DIR_OFFSETS[i];
      const nextGx = current.gx + dx;
      const nextGz = current.gz + dz;

      if (nextGx < 0 || nextGx >= currentDims.gridW || nextGz < 0 || nextGz >= currentDims.gridH) {
        continue;
      }

      const nextIndex = getFlatNodeIndex(current.mapId, nextGx, nextGz);
      if (closedSet[nextIndex]) continue;

      // Diagonal corner-cutting check
      if (dx !== 0 && dz !== 0) {
        if (
          !grid.isWalkable(current.mapId, current.gx + dx, current.gz) ||
          !grid.isWalkable(current.mapId, current.gx, current.gz + dz)
        ) {
          continue;
        }
      }

      // Walkability check via prebuilt NavGrid (O(1))
      if (!grid.isWalkable(current.mapId, nextGx, nextGz)) {
        continue;
      }

      const tentativeG = current.g + cost * CELL_SIZE;
      if (tentativeG < gScores[nextIndex]) {
        gScores[nextIndex] = tentativeG;
        const h = computeHeuristic(current.mapId, nextGx, nextGz);
        openHeap.push({
          mapId: current.mapId,
          gx: nextGx,
          gz: nextGz,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }

    // B. Portal Traversal (Non-adjacent connections: dungeon entrance, door, warps)
    for (let p = 0; p < activePortals.length; p++) {
      const portal = activePortals[p];
      if (portal.fromChunk !== current.mapId) continue;
      // Monsters don't follow through dungeon entrances by default!
      if (isAI && !portal.traversableByAI) continue;

      // Check proximity to portal fromTile (within 1.1 units = ~2 cells)
      const distToPortal = Math.hypot(currentWx - portal.fromTile.x, currentWz - portal.fromTile.z);
      if (distToPortal <= 1.1) {
        const destMap = portal.toChunk as MapId;
        const destDims = destMap === 'overworld' ? OVERWORLD_GRID_DIMS : DUNGEON_GRID_DIMS;
        const destGx = Math.max(0, Math.min(destDims.gridW - 1, Math.floor(portal.toTile.x / CELL_SIZE)));
        const destGz = Math.max(0, Math.min(destDims.gridH - 1, Math.floor(portal.toTile.z / CELL_SIZE)));

        if (!grid.isWalkable(destMap, destGx, destGz)) continue;

        const destIndex = getFlatNodeIndex(destMap, destGx, destGz);
        if (closedSet[destIndex]) continue;

        const tentativeG = current.g + portal.cost;
        if (tentativeG < gScores[destIndex]) {
          gScores[destIndex] = tentativeG;
          const h = computeHeuristic(destMap, destGx, destGz);
          openHeap.push({
            mapId: destMap,
            gx: destGx,
            gz: destGz,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
            portalUsed: portal,
          });
        }
      }
    }
  }

  // Graceful no-path fallback determination
  let status: PathStatus = 'complete';
  let targetReached = true;
  let finalNode: AStarNode | null = goalNode;

  if (!finalNode) {
    targetReached = false;
    // Fallback to closest reachable node if progress was made
    if (bestReachableNode && (bestReachableNode.gx !== startGx || bestReachableNode.gz !== startGz)) {
      finalNode = bestReachableNode;
      status = 'partial';
    } else {
      return {
        waypoints: [],
        status: 'unreachable',
        targetReached: false,
        totalCost: 0,
      };
    }
  }

  // Reconstruct path
  const rawWaypoints: PathWaypoint[] = [];
  let curr: AStarNode | null = finalNode;
  while (curr) {
    const chunk = getChunkInfo(curr.mapId, (curr.gx + 0.5) * CELL_SIZE, (curr.gz + 0.5) * CELL_SIZE);
    rawWaypoints.push({
      x: (curr.gx + 0.5) * CELL_SIZE,
      z: (curr.gz + 0.5) * CELL_SIZE,
      mapId: curr.mapId,
      chunkId: chunk.chunkId,
      isPortalTransition: !!curr.portalUsed,
      portalId: curr.portalUsed?.id,
    });
    curr = curr.parent;
  }
  rawWaypoints.reverse();

  // If exact target was reached, snap last waypoint to exact target coordinates
  if (targetReached && rawWaypoints.length > 0) {
    rawWaypoints[rawWaypoints.length - 1].x = targetX;
    rawWaypoints[rawWaypoints.length - 1].z = targetZ;
  }

  // Segmented Raycast String-Pulling Smoothing (Preserving Portal Transitions)
  const smoothed: PathWaypoint[] = [];
  let segStart = 0;

  for (let i = 0; i <= rawWaypoints.length; i++) {
    const isEnd = i === rawWaypoints.length;
    const isPortalBoundary = !isEnd && rawWaypoints[i].isPortalTransition;

    if (isEnd || isPortalBoundary) {
      const segEnd = isEnd ? rawWaypoints.length : i;
      const segment = rawWaypoints.slice(segStart, segEnd);

      if (segment.length > 0) {
        const segMapId = segment[0].mapId;
        const mapData = segMapId === 'dungeon' ? dungeonMap : overworldMap;

        if (segment.length <= 2 || !mapData) {
          smoothed.push(...segment);
        } else {
          // Smooth within this contiguous segment
          smoothed.push(segment[0]);
          let anchor = 0;
          while (anchor < segment.length - 1) {
            let farthestLoS = anchor + 1;
            for (let test = segment.length - 1; test > anchor + 1; test--) {
              if (
                hasLineOfSight(
                  segment[anchor].x,
                  segment[anchor].z,
                  segment[test].x,
                  segment[test].z,
                  radius,
                  mapData,
                  isGateOpen,
                  segMapId || 'overworld',
                  breakables
                )
              ) {
                farthestLoS = test;
                break;
              }
            }
            smoothed.push(segment[farthestLoS]);
            anchor = farthestLoS;
          }
        }
      }

      if (isPortalBoundary) {
        segStart = i;
      }
    }
  }

  // Calculate total path traversal cost
  let totalCost = 0;
  for (let i = 1; i < smoothed.length; i++) {
    totalCost += Math.hypot(smoothed[i].x - smoothed[i - 1].x, smoothed[i].z - smoothed[i - 1].z);
  }

  return {
    waypoints: smoothed,
    status,
    targetReached,
    totalCost,
  };
}

// ============================================================================
// 6. PER-TICK PATHFINDING BUDGET SYSTEM
// ============================================================================

export interface QueuedPathRequest {
  id: string;
  requesterId: string;
  options: FindPathOptions;
  priority: number; // Higher number = higher priority
  timestamp: number;
  callback: (result: PathResult) => void;
}

/**
 * PathfindingSystem: Manages pathfinding budget across ticks.
 * Ensures 12+ monsters repathing doesn't hitch the frame by time-slicing
 * requests across 60Hz game loop ticks.
 */
export class PathfindingSystem {
  public budgetPerTick: number;
  public maxTimeMsPerTick: number;
  public navGrid: NavGrid;
  public portalRegistry: NavPortalRegistry;

  private queue: QueuedPathRequest[] = [];
  private activeRequestsByRequester: Map<string, QueuedPathRequest> = new Map();
  private completedResults: Map<string, PathResult> = new Map();

  constructor(
    budgetPerTick: number = 3,
    maxTimeMsPerTick: number = 1.5,
    navGrid: NavGrid = defaultNavGrid,
    portalRegistry: NavPortalRegistry = defaultPortalRegistry
  ) {
    this.budgetPerTick = budgetPerTick;
    this.maxTimeMsPerTick = maxTimeMsPerTick;
    this.navGrid = navGrid;
    this.portalRegistry = portalRegistry;
  }

  /**
   * Enqueues a pathfinding request with priority.
   * If the requester already has a pending request in the queue, updates it in-place.
   */
  public requestPath(
    requesterId: string,
    options: FindPathOptions,
    priority: number = 1,
    callback?: (result: PathResult) => void
  ): void {
    const existing = this.activeRequestsByRequester.get(requesterId);
    if (existing) {
      existing.options = options;
      existing.priority = priority;
      if (callback) existing.callback = callback;
      existing.timestamp = performance.now();
      return;
    }

    const request: QueuedPathRequest = {
      id: `${requesterId}_${Date.now()}`,
      requesterId,
      options,
      priority,
      timestamp: performance.now(),
      callback: callback || (() => {}),
    };

    this.activeRequestsByRequester.set(requesterId, request);
    this.queue.push(request);
  }

  /**
   * Retrieves and consumes the computed path result for a requester.
   */
  public consumeResult(requesterId: string): PathResult | undefined {
    const res = this.completedResults.get(requesterId);
    if (res) {
      this.completedResults.delete(requesterId);
    }
    return res;
  }

  public hasResult(requesterId: string): boolean {
    return this.completedResults.has(requesterId);
  }

  /**
   * Synchronous pathfinding bypass (e.g. for player tap-to-move where immediate response is required)
   */
  public findPathImmediate(options: FindPathOptions): PathResult {
    return findPathUnified({
      ...options,
      navGrid: this.navGrid,
      portalRegistry: this.portalRegistry,
    });
  }

  /**
   * Executes up to budget searches per tick within the time slice
   */
  public processQueue(budget: number = this.budgetPerTick): number {
    if (this.queue.length === 0) return 0;

    // Sort queue by priority descending, then timestamp ascending
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    const startTime = performance.now();
    let processed = 0;

    while (this.queue.length > 0 && processed < budget) {
      // Safeguard against frame hitches
      if (performance.now() - startTime > this.maxTimeMsPerTick) {
        break;
      }

      const request = this.queue.shift()!;
      this.activeRequestsByRequester.delete(request.requesterId);

      const result = findPathUnified({
        ...request.options,
        navGrid: this.navGrid,
        portalRegistry: this.portalRegistry,
      });

      this.completedResults.set(request.requesterId, result);

      try {
        if (request.callback) {
          request.callback(result);
        }
      } catch (err) {
        console.error('Error in pathfinding callback for requester', request.requesterId, err);
      }

      processed++;
    }

    return processed;
  }

  public clearQueue(): void {
    this.queue = [];
    this.activeRequestsByRequester.clear();
    this.completedResults.clear();
  }

  public get pendingCount(): number {
    return this.queue.length;
  }
}

export const defaultPathfindingSystem = new PathfindingSystem();

// ============================================================================
// 7. BACKWARD COMPATIBLE EXPORTS
// ============================================================================

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
  const result = findPathUnified({
    startX,
    startZ,
    startMap: mapId,
    targetX,
    targetZ,
    targetMap: mapId,
    radius,
    overworldMap: mapId === 'overworld' ? map : undefined,
    dungeonMap: mapId === 'dungeon' ? map : undefined,
    isGateOpen,
    breakables,
  });

  return result.waypoints.length > 0 ? result.waypoints : null;
}

export const findPath = findPathAStar;
