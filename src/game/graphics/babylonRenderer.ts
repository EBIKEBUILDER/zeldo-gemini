import {
  Engine,
  Scene,
  SceneInstrumentation,
  UniversalCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  TransformNode,
  Matrix,
  AbstractMesh,
  ShadowGenerator,
} from '@babylonjs/core';
import { Vector2D } from '@/types/game';

export interface RenderStats {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  totalMeshes: number;
  triangles: number;
  vertices: number;
  frameTimeMs: number;
  memoryMB?: number;
}
import { useGameStore } from '../state/gameStore';
import {
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  DUNGEON_GATE_POS,
  DUNGEON_CHEST_POS,
  DUNGEON_BOSS_SPAWN_POS,
} from '../constants';
import {
  createHeroMesh,
  HeroMeshes,
  createEnemyMesh,
  EnemyMeshes,
  createGrassMesh,
  createPotMesh,
  createRupeeMesh,
  createHeartMesh,
  createKeyMesh,
  createBrambleProjectileMesh,
  createSporeBombProjectileMesh,
  createToxicPoolMesh,
  createGroundRuneMesh,
  createBriarSpikesMesh,
  createBossArenaRuneMesh,
  createFacetedTree,
  createRoundFacetedTree,
  createRockMesh,
  createCottageMesh,
  createStonePillar,
  createWallTorch,
  createDungeonGate,
  createPedestal,
  createTreasureChest,
  ChestMeshes,
  palette,
} from './meshBuilders';

export class BabylonRenderer {
  public engine: Engine;
  public scene: Scene;
  public camera: UniversalCamera;

  // Root transform nodes for map switching
  private overworldRoot: TransformNode;
  private dungeonRoot: TransformNode;

  // Lights & Shadows
  private sunLight: DirectionalLight;
  private hemiLight: HemisphericLight;
  private dungeonLights: PointLight[] = [];

  // Hero meshes
  private hero: HeroMeshes;

  // Dynamic entity tracking maps
  private enemyMeshes: Map<string, EnemyMeshes> = new Map();
  private breakableMeshes: Map<string, TransformNode> = new Map();
  private pickupMeshes: Map<string, TransformNode> = new Map();
  private projectileMeshes: Map<string, TransformNode> = new Map();
  private hazardMeshes: Map<string, { rune?: TransformNode; spikes?: TransformNode; pool?: TransformNode }> = new Map();
  private particleMeshes: Map<string, Mesh> = new Map();

  // Props & Merged Terrain
  private gateMesh: TransformNode | null = null;
  private chest: ChestMeshes | null = null;
  private mergedWaterMesh: Mesh | null = null;
  private shadowGenerator: ShadowGenerator | null = null;

  // Flash materials
  private whiteFlashMat: StandardMaterial;

  private isDisposed: boolean = false;
  private instrumentation: SceneInstrumentation | null = null;

  // Performance telemetry
  public getFps(): number {
    return Math.round(this.engine.getFps() || 60);
  }

  public getDrawCalls(): number {
    if (this.instrumentation && this.instrumentation.drawCallsCounter.current > 0) {
      return this.instrumentation.drawCallsCounter.current;
    }
    return this.scene ? this.scene.getActiveMeshes().length : 0;
  }

  public getStats(): RenderStats {
    const fps = Math.round(this.engine.getFps() || 60);
    const activeMeshes = this.scene ? this.scene.getActiveMeshes().length : 0;
    const drawCalls =
      this.instrumentation && this.instrumentation.drawCallsCounter.current > 0
        ? this.instrumentation.drawCallsCounter.current
        : activeMeshes;
    const totalMeshes = this.scene ? this.scene.meshes.length : 0;
    const indices = this.scene ? this.scene.getActiveIndices() : 0;
    const vertices = this.scene ? this.scene.getTotalVertices() : 0;
    const triangles = Math.round(indices / 3);
    const frameTimeMs =
      this.instrumentation && this.instrumentation.frameTimeCounter.current > 0
        ? Math.round(this.instrumentation.frameTimeCounter.current * 10) / 10
        : Math.round(this.engine.getDeltaTime() * 10) / 10;

    let memoryMB: number | undefined;
    if (
      typeof window !== 'undefined' &&
      (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
    ) {
      memoryMB = Math.round(
        (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize /
          (1024 * 1024)
      );
    }

    return {
      fps,
      drawCalls,
      activeMeshes,
      totalMeshes,
      triangles,
      vertices,
      frameTimeMs,
      memoryMB,
    };
  }

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance',
    });

    const origRender = (Mesh.prototype as unknown as { render: Function }).render;
    (Mesh.prototype as unknown as { render: Function }).render = function (
      this: Mesh,
      subMesh: unknown,
      enableAlphaMode: unknown,
      effectiveMeshMaterial: unknown
    ) {
      try {
        return origRender.call(this, subMesh, enableAlphaMode, effectiveMeshMaterial);
      } catch (err) {
        console.error('[CRASH ON MESH]', this.name, 'mat:', this.material?.name);
        throw err;
      }
    };

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.08, 0.1, 0.14, 1.0);
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = true;
    this.scene.autoClearDepthAndStencil = true;

    this.instrumentation = new SceneInstrumentation(this.scene);
    this.instrumentation.captureFrameTime = true;

    if (typeof window !== 'undefined') {
      (window as unknown as { __scene: Scene }).__scene = this.scene;
    }

    // Root nodes
    this.overworldRoot = new TransformNode('overworld_root', this.scene);
    this.dungeonRoot = new TransformNode('dungeon_root', this.scene);
    this.dungeonRoot.setEnabled(false);

    // Camera setup with classic Zeldo downward tilt and optimized depth bounds
    this.camera = new UniversalCamera(
      'zeldo_cam',
      new Vector3(7.5, CAMERA_OFFSET.y, 6.0 + CAMERA_OFFSET.z),
      this.scene
    );
    this.camera.setTarget(new Vector3(7.5, 0.5, 6.0));
    this.camera.fov = 0.72;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 85.0;

    // Lighting: Overworld Sun + Ambient with improved two-tone sky/ground bounce and warm sunlight
    this.hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    this.hemiLight.diffuse = new Color3(0.72, 0.82, 0.96); // Cool sky ambient from above
    this.hemiLight.groundColor = new Color3(0.28, 0.40, 0.24); // Warm earthy ground bounce
    this.hemiLight.intensity = 0.85;

    this.sunLight = new DirectionalLight('sun', new Vector3(0.42, -0.88, 0.32), this.scene);
    this.sunLight.position = new Vector3(-10, 32, -8);
    this.sunLight.diffuse = new Color3(1.0, 0.96, 0.84); // Warm golden sunlight
    this.sunLight.specular = new Color3(0.22, 0.20, 0.16);
    this.sunLight.intensity = 1.08;
    this.sunLight.autoCalcShadowZBounds = true;

    // Real-time soft shadows for depth and grounding
    this.shadowGenerator = new ShadowGenerator(1024, this.sunLight);
    this.shadowGenerator.usePoissonSampling = true;
    this.shadowGenerator.bias = 0.002;
    this.shadowGenerator.darkness = 0.32;

    // Hit flash material
    this.whiteFlashMat = palette.get(
      this.scene,
      'hit_flash_white',
      new Color3(1, 1, 1),
      new Color3(1, 1, 1),
      new Color3(1, 1, 1)
    );

    // Build World Geometry with high-performance mesh merging
    this.buildOverworldTerrain();
    this.buildDungeonTerrain();

    // Build Hero
    this.hero = createHeroMesh(this.scene);
    if (this.shadowGenerator) {
      this.hero.root.getChildMeshes().forEach((m) => {
        this.shadowGenerator?.addShadowCaster(m, false);
      });
    }

    // Pre-instantiate all initial entities so shaders are compiled upfront
    this.prepopulateEntities();

    this.scene.onBeforeRenderObservable.add(() => {
      this.syncSceneWithState();
    });

    // Execute render loop only once shaders and scene are ready
    this.scene.executeWhenReady(() => {
      this.engine.runRenderLoop(() => {
        if (!this.isDisposed) {
          try {
            this.scene.render();
          } catch (err) {
            console.error('[SCENE RENDER ERROR]', (err as Error)?.stack || err);
          }
        }
      });
    });

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.engine.resize();
  };

  // Pre-create initial entities so there are zero allocations on frame 0
  private prepopulateEntities() {
    const store = useGameStore.getState();

    store.enemies.forEach((enemy) => {
      const meshes = createEnemyMesh(this.scene, enemy.type);
      meshes.root.position.set(enemy.x, 0, enemy.z);
      meshes.root.rotation.y = enemy.facingAngle;
      this.enemyMeshes.set(enemy.id, meshes);
    });

    store.breakables.forEach((item) => {
      const node = item.type === 'grass' ? createGrassMesh(this.scene) : createPotMesh(this.scene);
      node.position.set(item.x, 0, item.z);
      this.breakableMeshes.set(item.id, node);
    });

    store.pickups.forEach((pickup) => {
      let node: TransformNode | null = null;
      if (pickup.type === 'rupee') node = createRupeeMesh(this.scene);
      else if (pickup.type === 'heart') node = createHeartMesh(this.scene);
      else if (pickup.type === 'key') node = createKeyMesh(this.scene);

      if (node) {
        const initY = pickup.type === 'key' ? 1.15 : 0.45;
        node.position.set(pickup.x, initY, pickup.z);
        if (pickup.type === 'key') {
          node.rotation.x = 0.25;
        }
        this.pickupMeshes.set(pickup.id, node);
      }
    });
  }

  // --- BUILD OVERWORLD GEOMETRY (HIGH-PERFORMANCE BATCH MERGING) ---
  private buildOverworldTerrain() {
    const store = useGameStore.getState();
    const map = store.overworldMap;

    const grassMat = palette.get(this.scene, 'tile_grass', new Color3(0.28, 0.65, 0.28));
    const dirtMat = palette.get(this.scene, 'tile_dirt', new Color3(0.78, 0.62, 0.4));
    const flowerMat = palette.get(this.scene, 'tile_flower', new Color3(0.3, 0.7, 0.32));
    const waterMat = palette.get(
      this.scene,
      'tile_water',
      new Color3(0.22, 0.58, 0.88),
      new Color3(0.8, 0.9, 1.0),
      new Color3(0.05, 0.2, 0.4),
      0.82
    );
    const bridgeMat = palette.get(this.scene, 'tile_bridge', new Color3(0.55, 0.32, 0.16));
    const hedgeMat = palette.get(this.scene, 'tile_hedge', new Color3(0.12, 0.42, 0.18));
    const cliffMat = palette.get(this.scene, 'tile_cliff', new Color3(0.42, 0.45, 0.48));

    // Group tile boxes by material to merge into single GPU draw calls
    const tileGroups: Record<string, Mesh[]> = {
      grass: [],
      dirt: [],
      flower: [],
      bridge: [],
      hedge: [],
      cliff: [],
      water: [],
    };

    // Ground plane
    for (let x = 0; x < map.width; x++) {
      for (let z = 0; z < map.height; z++) {
        const tile = map.tiles[x][z];
        const isHedge = tile.type === 'hedge';
        const isCliff = tile.type === 'dungeon_wall';
        const isWater = tile.type === 'water';
        const isBridge = tile.type === 'bridge';

        const height = isHedge ? 1.2 : isCliff ? 2.5 : 0.2;
        const posY = isHedge ? 0.6 : isCliff ? 1.25 : isWater ? -0.15 : isBridge ? 0.02 : -0.1;

        const tileMesh = MeshBuilder.CreateBox(
          `tile_temp_${x}_${z}`,
          {
            width: 1.0,
            depth: 1.0,
            height,
          },
          this.scene
        );
        tileMesh.position.set(x + 0.5, posY, z + 0.5);

        if (tile.type === 'grass') tileGroups.grass.push(tileMesh);
        else if (tile.type === 'dirt' || tile.type === 'doorway') tileGroups.dirt.push(tileMesh);
        else if (tile.type === 'flower') tileGroups.flower.push(tileMesh);
        else if (isWater) tileGroups.water.push(tileMesh);
        else if (isBridge) tileGroups.bridge.push(tileMesh);
        else if (isHedge) tileGroups.hedge.push(tileMesh);
        else if (isCliff) tileGroups.cliff.push(tileMesh);
        else tileGroups.grass.push(tileMesh);
      }
    }

    const mergeBatch = (name: string, list: Mesh[], mat: StandardMaterial, isDynamicWater: boolean = false) => {
      if (list.length === 0) return null;
      const merged = Mesh.MergeMeshes(list, true, true, undefined, false, false);
      if (merged) {
        merged.name = `merged_overworld_${name}`;
        merged.material = mat;
        merged.parent = this.overworldRoot;
        merged.receiveShadows = true;
        if (!isDynamicWater) {
          merged.freezeWorldMatrix();
        }
        merged.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
        return merged;
      }
      return null;
    };

    mergeBatch('grass', tileGroups.grass, grassMat);
    mergeBatch('dirt', tileGroups.dirt, dirtMat);
    mergeBatch('flower', tileGroups.flower, flowerMat);
    mergeBatch('bridge', tileGroups.bridge, bridgeMat);
    mergeBatch('hedge', tileGroups.hedge, hedgeMat);
    mergeBatch('cliff', tileGroups.cliff, cliffMat);
    this.mergedWaterMesh = mergeBatch('water', tileGroups.water, waterMat, true);

    // High-frequency ground detail scatter: 3D fanned grass clumps, sparse pebbles, and wildflower blossoms
    const ambientGrassVibrant: Mesh[] = [];
    const ambientGrassDeep: Mesh[] = [];
    const ambientGrassGolden: Mesh[] = [];
    const pebbleMeshes: Mesh[] = [];
    const flowerScatterMeshes: Mesh[] = [];

    const pseudoRandom = (seed: number) => {
      const val = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return val - Math.floor(val);
    };

    for (let x = 1; x < map.width - 1; x++) {
      for (let z = 1; z < map.height - 1; z++) {
        const tile = map.tiles[x][z];
        const isGrass = tile.type === 'grass';
        const isFlower = tile.type === 'flower';
        const isDirt = tile.type === 'dirt';

        const rand1 = pseudoRandom(x * 37 + z * 91);
        const rand2 = pseudoRandom(x * 53 + z * 107);
        const rand3 = pseudoRandom(x * 79 + z * 131);

        // 1. 3D Fanned Grass Clumps (3 outward-leaning fanned blades with varied heights and colors)
        if (isGrass || isFlower) {
          const numClumps = isFlower ? 2 : rand1 > 0.45 ? 1 : 0;
          for (let t = 0; t < numClumps; t++) {
            const offsetX = (pseudoRandom(x * 13 + z * 47 + t * 29) - 0.5) * 0.72;
            const offsetZ = (pseudoRandom(x * 23 + z * 59 + t * 41) - 0.5) * 0.72;
            const clumpAngle = pseudoRandom(x * 31 + z * 67 + t * 53) * Math.PI * 2;
            const clumpScale = 0.85 + pseudoRandom(x * 43 + z * 71 + t * 37) * 0.35;
            const bladeW = 0.26 * clumpScale;
            const bladeH = 0.28 * clumpScale;

            const targetList =
              (x + z + t) % 3 === 0
                ? ambientGrassVibrant
                : (x + z + t) % 3 === 1
                ? ambientGrassDeep
                : ambientGrassGolden;

            // 3 outward-fanned blades forming a full 3D grass clump
            for (let b = 0; b < 3; b++) {
              const bAngle = clumpAngle + (b * Math.PI * 2) / 3;
              const blade = MeshBuilder.CreatePlane(
                `amb_g_${x}_${z}_${t}_${b}`,
                { width: bladeW, height: bladeH },
                this.scene
              );
              blade.position.set(
                x + 0.5 + offsetX + Math.cos(bAngle) * 0.05,
                bladeH * 0.48,
                z + 0.5 + offsetZ + Math.sin(bAngle) * 0.05
              );
              blade.rotation.y = bAngle;
              blade.rotation.x = Math.cos(bAngle) * 0.22;
              blade.rotation.z = Math.sin(bAngle) * 0.22;
              targetList.push(blade);
            }
          }
        }

        // 2. Tiny faceted low-poly pebbles (reduced to 1/4th frequency, concentrated along path edges)
        if (rand2 > 0.94 && (isDirt || (isGrass && rand1 > 0.75))) {
          const pX = x + 0.5 + (rand1 - 0.5) * 0.65;
          const pZ = z + 0.5 + (rand3 - 0.5) * 0.65;
          const pRadius = 0.07 + rand1 * 0.05;
          const pebble = MeshBuilder.CreateIcoSphere(`amb_peb_${x}_${z}`, {
            radius: pRadius,
            subdivisions: 1,
            flat: true,
          }, this.scene);
          pebble.position.set(pX, pRadius * 0.45, pZ);
          pebble.scaling.set(1.15, 0.55, 0.95);
          pebble.rotation.set(rand1 * 2, rand2 * 3, rand3 * 2);
          pebbleMeshes.push(pebble);
        }

        // 3. Tiny wildflower blossoms in meadows and flower clearings
        if (isFlower || (isGrass && rand3 > 0.86)) {
          const fX = x + 0.5 + (rand2 - 0.5) * 0.68;
          const fZ = z + 0.5 + (rand1 - 0.5) * 0.68;
          const flower = MeshBuilder.CreateDisc(`amb_fl_${x}_${z}`, {
            radius: 0.12,
            tessellation: 5,
          }, this.scene);
          flower.rotation.x = Math.PI / 2;
          flower.position.set(fX, 0.04, fZ);
          flowerScatterMeshes.push(flower);
        }
      }
    }

    const ambGrassMatVibrant = palette.get(this.scene, 'amb_grass_vibrant', new Color3(0.24, 0.70, 0.28), new Color3(0.02, 0.02, 0.02));
    const ambGrassMatDeep = palette.get(this.scene, 'amb_grass_deep', new Color3(0.16, 0.54, 0.20), new Color3(0.02, 0.02, 0.02));
    const ambGrassMatGolden = palette.get(this.scene, 'amb_grass_golden', new Color3(0.36, 0.74, 0.22), new Color3(0.02, 0.02, 0.02));

    const pebbleMat = palette.get(this.scene, 'amb_pebble_mat', new Color3(0.58, 0.55, 0.50), new Color3(0.05, 0.05, 0.05));
    const ambFlowerMat = palette.get(this.scene, 'amb_flower_mat', new Color3(0.96, 0.84, 0.22), new Color3(0.1, 0.1, 0.1));

    mergeBatch('ambient_grass_vibrant', ambientGrassVibrant, ambGrassMatVibrant);
    mergeBatch('ambient_grass_deep', ambientGrassDeep, ambGrassMatDeep);
    mergeBatch('ambient_grass_golden', ambientGrassGolden, ambGrassMatGolden);
    mergeBatch('ambient_pebbles', pebbleMeshes, pebbleMat);
    mergeBatch('ambient_flowers', flowerScatterMeshes, ambFlowerMat);

    // Overworld Props
    map.props.forEach((prop) => {
      let node: TransformNode | null = null;
      if (prop.type === 'tree') {
        node = prop.variant === 'round'
          ? createRoundFacetedTree(this.scene)
          : createFacetedTree(this.scene);
        if (prop.scaleX) node.scaling.set(prop.scaleX, prop.scaleY || 1, prop.scaleZ || 1);
        if (prop.rotationY) node.rotation.y = prop.rotationY;
      } else if (prop.type === 'rock') {
        const rock = createRockMesh(this.scene, prop.id);
        if (prop.scaleX) rock.scaling.set(prop.scaleX, prop.scaleY || 1, prop.scaleZ || 1);
        if (prop.rotationY) rock.rotation.y = prop.rotationY;
        node = rock;
      } else if (prop.type === 'house') {
        node = createCottageMesh(this.scene);
      } else if (prop.type === 'well') {
        const well = MeshBuilder.CreateCylinder('well', { diameter: 1.4, height: 0.8, tessellation: 8 }, this.scene);
        well.material = palette.get(this.scene, 'well_stone', new Color3(0.5, 0.52, 0.55));
        well.position.y = 0.4;
        node = well;
      } else if (prop.type === 'archway') {
        const archStoneMat = palette.get(this.scene, 'arch_stone', new Color3(0.35, 0.38, 0.42));

        const archL = MeshBuilder.CreateBox('arch_l', { width: 0.8, height: 2.8, depth: 1.0 }, this.scene);
        archL.position.set(-1.2, 1.4, 0);

        const archR = MeshBuilder.CreateBox('arch_r', { width: 0.8, height: 2.8, depth: 1.0 }, this.scene);
        archR.position.set(1.2, 1.4, 0);

        const archTop = MeshBuilder.CreateBox('arch_top', { width: 3.2, height: 0.8, depth: 1.2 }, this.scene);
        archTop.position.set(0, 3.2, 0);

        const archMesh = Mesh.MergeMeshes([archL, archR, archTop], true, true, undefined, false, false);
        if (archMesh) {
          archMesh.name = 'dungeon_archway_mesh';
          archMesh.material = archStoneMat;
          node = archMesh;
        }
      }

      if (node) {
        node.position.x = prop.x;
        node.position.z = prop.z;
        node.parent = this.overworldRoot;
        node.computeWorldMatrix(true);
        node.getChildMeshes().forEach((m) => {
          m.freezeWorldMatrix();
          m.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
          if (this.shadowGenerator && prop.type !== 'well') {
            const isFoliage = m.name.includes('foliage') || m.name.includes('upper') || m.name.includes('lower');
            const isRockOrBuilding = prop.type === 'rock' || prop.type === 'house' || prop.type === 'pillar';
            if (isFoliage || isRockOrBuilding) {
              this.shadowGenerator.addShadowCaster(m, false);
            }
          }
        });
        if (node instanceof Mesh && this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(node, false);
        }
      }
    });
  }

  // --- BUILD DUNGEON GEOMETRY (HIGH-PERFORMANCE BATCH MERGING) ---
  private buildDungeonTerrain() {
    const store = useGameStore.getState();
    const map = store.dungeonMap;

    const floorMat = palette.get(this.scene, 'dungeon_floor', new Color3(0.32, 0.35, 0.4));
    const wallMat = palette.get(this.scene, 'dungeon_wall', new Color3(0.2, 0.22, 0.26));

    const dungeonGroups: { floor: Mesh[]; wall: Mesh[] } = { floor: [], wall: [] };

    for (let x = 0; x < map.width; x++) {
      for (let z = 0; z < map.height; z++) {
        const tile = map.tiles[x][z];
        const isWall = tile.type === 'dungeon_wall';
        // South facing walls (z <= 1) are low cutaway walls (height 1.0) so the player is never occluded near the doorway.
        // The dividing wall at z = 11 is 2.4 height, matching gate height while keeping visibility clear when entering boss chamber.
        const wallHeight = isWall ? (z <= 1 ? 1.0 : (z === 11 ? 2.4 : 3.0)) : 0.2;
        const wallPosY = isWall ? (z <= 1 ? 0.5 : (z === 11 ? 1.2 : 1.5)) : -0.1;

        const tileMesh = MeshBuilder.CreateBox(
          `d_tile_temp_${x}_${z}`,
          {
            width: 1.0,
            depth: 1.0,
            height: wallHeight,
          },
          this.scene
        );

        tileMesh.position.set(x + 0.5, wallPosY, z + 0.5);

        if (isWall) {
          dungeonGroups.wall.push(tileMesh);
        } else {
          dungeonGroups.floor.push(tileMesh);
        }
      }
    }

    const mergedFloor = Mesh.MergeMeshes(dungeonGroups.floor, true, true, undefined, false, false);
    if (mergedFloor) {
      mergedFloor.name = 'merged_dungeon_floor';
      mergedFloor.material = floorMat;
      mergedFloor.parent = this.dungeonRoot;
      mergedFloor.freezeWorldMatrix();
      mergedFloor.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
    }

    const mergedWall = Mesh.MergeMeshes(dungeonGroups.wall, true, true, undefined, false, false);
    if (mergedWall) {
      mergedWall.name = 'merged_dungeon_wall';
      mergedWall.material = wallMat;
      mergedWall.parent = this.dungeonRoot;
      mergedWall.freezeWorldMatrix();
      mergedWall.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
    }

    // Dungeon Props
    map.props.forEach((prop) => {
      let node: TransformNode | null = null;

      if (prop.type === 'pedestal') {
        node = createPedestal(this.scene);
      } else if (prop.type === 'pillar') {
        node = createStonePillar(this.scene);
      } else if (prop.type === 'torch') {
        node = createWallTorch(this.scene);
      } else if (prop.type === 'chest') {
        this.chest = createTreasureChest(this.scene);
        this.chest.root.position.set(DUNGEON_CHEST_POS.x, 0, DUNGEON_CHEST_POS.z);
        this.chest.root.parent = this.dungeonRoot;
        this.chest.root.setEnabled(false);
      }

      if (node) {
        node.position.x = prop.x;
        node.position.z = prop.z;
        node.parent = this.dungeonRoot;
        node.computeWorldMatrix(true);
        node.getChildMeshes().forEach((m) => {
          m.freezeWorldMatrix();
          m.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
        });
      }
    });

    // The Dungeon Locked Gate at z = 11.5
    this.gateMesh = createDungeonGate(this.scene);
    this.gateMesh.position.set(DUNGEON_GATE_POS.x, 0, DUNGEON_GATE_POS.z);
    this.gateMesh.parent = this.dungeonRoot;

    // Boss Sanctum Grand Runic Arena Floor Circle (Mario RPG Stage Presence)
    const arenaRune = createBossArenaRuneMesh(this.scene);
    arenaRune.position.set(DUNGEON_BOSS_SPAWN_POS.x, 0, DUNGEON_BOSS_SPAWN_POS.z);
    arenaRune.parent = this.dungeonRoot;
    arenaRune.computeWorldMatrix(true);
    arenaRune.getChildMeshes().forEach((m) => {
      m.freezeWorldMatrix();
      m.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
    });
  }

  // --- VIEW LAYER SYNC: READ STATE EACH FRAME ---
  private syncSceneWithState() {
    const store = useGameStore.getState();

    // 1. Switch active map hierarchy
    const isDungeon = store.currentMap === 'dungeon';
    this.overworldRoot.setEnabled(!isDungeon);
    this.dungeonRoot.setEnabled(isDungeon);

    // Adjust lighting and shadows for current map
    if (isDungeon) {
      this.hemiLight.intensity = 0.35;
      this.sunLight.intensity = 0.2;
      if (this.shadowGenerator) this.shadowGenerator.darkness = 0.12;
    } else {
      this.hemiLight.intensity = 0.85;
      this.sunLight.intensity = 1.08;
      if (this.shadowGenerator) this.shadowGenerator.darkness = 0.32;
    }

    // Dynamic directional sun position follows active player for maximum shadow map resolution
    if (this.sunLight && !isDungeon) {
      this.sunLight.position.set(store.player.x - 12, 32, store.player.z - 10);
    }

    // 2. Camera follow player with lerp and screen shake
    const player = store.player;
    const targetCamX = player.x;
    const targetCamY = CAMERA_OFFSET.y;
    const targetCamZ = player.z + CAMERA_OFFSET.z;

    // Apply screen shake
    let shakeOffsetX = 0;
    let shakeOffsetZ = 0;
    if (store.screenShake > 0) {
      shakeOffsetX = (Math.random() - 0.5) * store.screenShake * 1.2;
      shakeOffsetZ = (Math.random() - 0.5) * store.screenShake * 1.2;
    }

    this.camera.position.x += (targetCamX + shakeOffsetX - this.camera.position.x) * CAMERA_LERP_SPEED;
    this.camera.position.y += (targetCamY - this.camera.position.y) * CAMERA_LERP_SPEED;
    this.camera.position.z += (targetCamZ + shakeOffsetZ - this.camera.position.z) * CAMERA_LERP_SPEED;

    this.camera.setTarget(new Vector3(player.x, 0.5, player.z));

    // 3. Update Hero Mesh
    this.hero.root.position.set(player.x, 0, player.z);
    this.hero.root.rotation.y = player.facingAngle;

    // Walk wobble & Dodge roll animation
    if (player.isRolling) {
      this.hero.body.rotation.x = Math.PI * 0.35;
      this.hero.body.rotation.z = 0;
      this.hero.body.position.y = 0.28;
      this.hero.head.position.y = 0.55;
    } else if (player.isMoving) {
      this.hero.body.rotation.x = 0;
      this.hero.body.rotation.z = Math.sin(player.walkCycle) * 0.12;
      this.hero.body.position.y = 0.42 + Math.abs(Math.sin(player.walkCycle)) * 0.06;
      this.hero.head.position.y = 0.86 + Math.abs(Math.sin(player.walkCycle)) * 0.05;
    } else {
      this.hero.body.rotation.x = 0;
      this.hero.body.rotation.z = 0;
      this.hero.body.position.y = 0.42;
      this.hero.head.position.y = 0.86;
    }

    // Attack Slash animation
    if (player.isAttacking) {
      this.hero.slashArc.isVisible = true;
      const progress = Math.max(0, Math.min(1, 1 - player.attackTimer / 0.22));
      this.hero.slashArc.rotation.x = Math.PI / 2;
      this.hero.slashArc.rotation.y = -Math.PI * 0.45 + progress * Math.PI * 0.9;
      this.hero.swordRoot.rotation.y = -Math.PI * 0.5 + progress * Math.PI * 1.0;
      this.hero.swordRoot.rotation.x = -0.3;
    } else {
      this.hero.slashArc.isVisible = false;
      this.hero.swordRoot.rotation.y = 0;
      this.hero.swordRoot.rotation.x = 0;
    }

    // Invulnerability Blink
    this.hero.root.setEnabled(!player.isBlinking);

    // 4. Update Enemy Meshes (Mario RPG Character Styling)
    const nowTime = performance.now();
    store.enemies.forEach((enemy) => {
      let meshes = this.enemyMeshes.get(enemy.id);

      if (!meshes) {
        meshes = createEnemyMesh(this.scene, enemy.type);
        this.enemyMeshes.set(enemy.id, meshes);
        if (this.shadowGenerator) {
          meshes.root.getChildMeshes().forEach((child) => {
            this.shadowGenerator?.addShadowCaster(child, false);
          });
        }
      }

      const isVisible = enemy.mapId === store.currentMap && !enemy.isDead;
      meshes.root.setEnabled(isVisible);

      if (isVisible) {
        meshes.root.position.set(enemy.x, 0, enemy.z);
        meshes.root.rotation.y = enemy.facingAngle;

        // Base hop height
        const isBoss = enemy.type === 'boss_gorgoth';
        const baseHeight = isBoss ? 0.95 : 0.35;
        const hopSin = Math.sin(enemy.hopCycle);
        const hopHeight = Math.abs(hopSin) * (isBoss ? 0.38 : 0.26);
        meshes.body.position.y = baseHeight + hopHeight;

        // Hit flash
        meshes.body.material = enemy.hitFlashTimer > 0 ? this.whiteFlashMat : meshes.defaultMat;

        if (isBoss) {
          // Boss Telegraphed Attack Animations
          const isTelegraphing =
            !!(enemy.castTimer && enemy.castTimer > 0) ||
            !!(enemy.bossTelegraphTimer && enemy.bossTelegraphTimer > 0) ||
            enemy.bossAction === 'telegraphing_lunge' ||
            enemy.bossAction === 'telegraphing_ranged';

          // 1. Mario RPG Floating '!' Telegraph Exclamation Bubble
          if (meshes.exclamationBubble) {
            meshes.exclamationBubble.setEnabled(isTelegraphing);
            if (isTelegraphing) {
              const exclamBounce = 2.55 + Math.sin(nowTime * 0.018) * 0.14;
              meshes.exclamationBubble.position.y = exclamBounce;
              meshes.exclamationBubble.rotation.y += 0.06;
            }
          }

          // 2. Glowing Bramble Core Gem: rapid pulse when charging or lunging
          if (meshes.coreGem) {
            const isChargingOrLunging = isTelegraphing || enemy.bossAction === 'lunging';
            const gemPulse = isChargingOrLunging
              ? 1.0 + Math.sin(nowTime * 0.04) * 0.38
              : 1.0 + Math.sin(nowTime * 0.005) * 0.12;
            meshes.coreGem.scaling.set(gemPulse, gemPulse * 1.3, gemPulse * 0.7);
          }

          // 3. Ground Telegraph Ring
          if (meshes.telegraphRing) {
            meshes.telegraphRing.setEnabled(isTelegraphing);
            if (isTelegraphing) {
              const pulse = 1.0 + Math.sin(nowTime * 0.025) * 0.18;
              meshes.telegraphRing.scaling.set(pulse, 1.0, pulse);
              meshes.telegraphRing.rotation.y += 0.08;
            }
          }

          // 3b. Ground Lunge Path Telegraph (Visual corridor for lunge attack)
          if (meshes.lungePath) {
            const isLungeTelegraph = enemy.bossAction === 'telegraphing_lunge';
            meshes.lungePath.setEnabled(isLungeTelegraph);
            if (isLungeTelegraph && enemy.lungeDirection) {
              const lungeDist = enemy.lungeDistance || 5.2;
              meshes.lungePath.position.set(enemy.x, 0.035, enemy.z);
              meshes.lungePath.rotation.y = Math.atan2(enemy.lungeDirection.x, enemy.lungeDirection.z);
              const pProgress = 1.0 - Math.max(0, (enemy.bossTelegraphTimer || 0) / (enemy.bossTelegraphMax || 0.75));
              const pulseX = 1.0 + Math.sin(pProgress * Math.PI * 6) * 0.08;
              meshes.lungePath.scaling.set(pulseX, 1.0, lungeDist);
            }
          }

          // 3c. Ground Ranged Bomb Landing Reticle (Visual telegraph for ranged attack)
          if (meshes.rangedReticle) {
            const isRangedTelegraph = enemy.bossAction === 'telegraphing_ranged';
            meshes.rangedReticle.setEnabled(isRangedTelegraph);
            if (isRangedTelegraph && enemy.bossTelegraphTarget) {
              meshes.rangedReticle.position.set(enemy.bossTelegraphTarget.x, 0.04, enemy.bossTelegraphTarget.z);
              const pProgress = 1.0 - Math.max(0, (enemy.bossTelegraphTimer || 0) / (enemy.bossTelegraphMax || 0.75));
              const pulse = 1.0 + Math.sin(pProgress * Math.PI * 6) * 0.12;
              meshes.rangedReticle.scaling.set(pulse, 1.0, pulse);
              meshes.rangedReticle.rotation.y += 0.05;
            }
          }

          // 4. Boss Body Squash-and-Stretch Anticipation & Motion
          if (enemy.bossAction === 'lunging') {
            // Aerodynamic forward thrust elongation
            meshes.body.scaling.set(0.9, 0.9, 1.45);
          } else if (enemy.bossAction === 'lunge_recovery') {
            // Heavy exhausted recovery breathing squash
            const recoverSin = Math.sin(nowTime * 0.015);
            meshes.body.scaling.set(1.25 + recoverSin * 0.08, 0.75 - recoverSin * 0.08, 1.25 + recoverSin * 0.08);
          } else if (isTelegraphing) {
            // Squashes down into the floor while charging up
            meshes.body.scaling.set(1.28, 0.72, 1.28);
          } else {
            // Dynamic hop cycle deformation
            meshes.body.scaling.set(
              1.15 - hopSin * 0.1,
              0.88 + hopSin * 0.2,
              1.15 - hopSin * 0.1
            );
          }
        } else {
          // Slime Bouncy Squash & Stretch + Antenna Wobble
          meshes.body.scaling.set(
            1.05 - hopSin * 0.16,
            0.82 + hopSin * 0.28,
            1.05 - hopSin * 0.16
          );
          if (meshes.antenna) {
            meshes.antenna.rotation.z = Math.sin(enemy.hopCycle * 0.8) * 0.22;
          }
        }
      } else {
        meshes.lungePath?.setEnabled(false);
        meshes.rangedReticle?.setEnabled(false);
      }
    });

    // 5. Update Breakables (Grass tufts & Pots)
    store.breakables.forEach((item) => {
      let node = this.breakableMeshes.get(item.id);

      if (!node) {
        node = item.type === 'grass' ? createGrassMesh(this.scene) : createPotMesh(this.scene);
        node.position.set(item.x, 0, item.z);
        this.breakableMeshes.set(item.id, node);
      }

      const isVisible = item.mapId === store.currentMap && !item.isBroken;
      node.setEnabled(isVisible);
    });

    // 6. Update Pickups (Rupees, Hearts, Key)
    const activePickupIds = new Set(store.pickups.map((p) => p.id));

    this.pickupMeshes.forEach((node, id) => {
      if (!activePickupIds.has(id)) {
        node.dispose();
        this.pickupMeshes.delete(id);
      }
    });

    store.pickups.forEach((pickup) => {
      let node = this.pickupMeshes.get(pickup.id);

      if (!node) {
        if (pickup.type === 'rupee') node = createRupeeMesh(this.scene);
        else if (pickup.type === 'heart') node = createHeartMesh(this.scene);
        else if (pickup.type === 'key') node = createKeyMesh(this.scene);

        if (node) {
          this.pickupMeshes.set(pickup.id, node);
        }
      }

      if (node) {
        const isVisible = pickup.mapId === store.currentMap && !pickup.collected;
        node.setEnabled(isVisible);

        if (isVisible) {
          if (pickup.type === 'key') {
            // Golden dungeon key hovers majestically above the pedestal (pedestal height is 0.65)
            node.position.set(pickup.x, 1.15 + Math.sin(pickup.bobOffset) * 0.08, pickup.z);
            node.rotation.y += 0.035;
            node.rotation.x = 0.25;
          } else {
            node.position.set(pickup.x, 0.45 + Math.sin(pickup.bobOffset) * 0.12, pickup.z);
            node.rotation.y += 0.04;
          }
        }
      }
    });

    // 7. Update Dungeon Gate Position
    if (this.gateMesh) {
      if (store.quest.gateOpenProgress >= 0.99) {
        this.gateMesh.setEnabled(false);
      } else {
        this.gateMesh.setEnabled(true);
        this.gateMesh.position.y = store.quest.gateOpenProgress * 5.5;
      }
    }

    // 8. Update Golden Treasure Chest
    if (this.chest) {
      this.chest.root.setEnabled(store.quest.chestSpawned && isDungeon);
      if (store.quest.chestOpened) {
        this.chest.lid.rotation.x = -store.quest.chestOpenProgress * 1.9;
      }
    }

    // 9. Update Water ripples in Overworld (single merged mesh bob)
    if (this.mergedWaterMesh && !isDungeon) {
      const time = performance.now() * 0.002;
      this.mergedWaterMesh.position.y = Math.sin(time) * 0.03;
    }

    // 10. Update Active Particles
    const activeIds = new Set(store.activeParticles.map((p) => p.id));

    this.particleMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        mesh.dispose();
        this.particleMeshes.delete(id);
      }
    });

    store.activeParticles.forEach((p) => {
      let mesh = this.particleMeshes.get(p.id);
      if (!mesh) {
        mesh = MeshBuilder.CreateBox(`part_${p.id}`, { size: p.size }, this.scene);
        const pMat = palette.get(this.scene, `p_${p.color}`, Color3.FromHexString(p.color));
        mesh.material = pMat;
        this.particleMeshes.set(p.id, mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.scaling.setAll(p.life / p.maxLife);
    });

    // 11. Update Boss Projectiles (Bramble Thorns)
    const activeProjIds = new Set(store.projectiles.map((p) => p.id));

    this.projectileMeshes.forEach((mesh, id) => {
      if (!activeProjIds.has(id)) {
        mesh.dispose();
        this.projectileMeshes.delete(id);
      }
    });

    store.projectiles.forEach((p) => {
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        mesh = p.type === 'spore_bomb'
          ? createSporeBombProjectileMesh(this.scene)
          : createBrambleProjectileMesh(this.scene);
        this.projectileMeshes.set(p.id, mesh);
      }

      const isVisible = p.mapId === store.currentMap;
      mesh.setEnabled(isVisible);
      if (isVisible) {
        mesh.position.set(p.x, 0.55, p.z);
        if (p.type === 'spore_bomb') {
          mesh.rotation.y += 0.18;
          mesh.rotation.x += 0.14;
          const pulse = 1.0 + Math.sin(nowTime * 0.02) * 0.12;
          mesh.scaling.set(pulse, pulse, pulse);
        } else {
          mesh.rotation.y += 0.12;
          mesh.rotation.x += 0.08;
        }
      }
    });

    // 12. Update Ground Hazards (Telegraphed Briar Eruptions & Lingering Toxic Pools)
    const activeHazardIds = new Set((store.groundHazards || []).map((h) => h.id));

    this.hazardMeshes.forEach((nodes, id) => {
      if (!activeHazardIds.has(id)) {
        nodes.rune?.dispose();
        nodes.spikes?.dispose();
        nodes.pool?.dispose();
        this.hazardMeshes.delete(id);
      }
    });

    (store.groundHazards || []).forEach((h) => {
      let nodes = this.hazardMeshes.get(h.id);
      if (!nodes) {
        if (h.type === 'toxic_patch') {
          const pool = createToxicPoolMesh(this.scene);
          nodes = { pool };
        } else {
          const rune = createGroundRuneMesh(this.scene);
          const spikes = createBriarSpikesMesh(this.scene);
          nodes = { rune, spikes };
        }
        this.hazardMeshes.set(h.id, nodes);
      }

      const isVisible = h.mapId === store.currentMap;
      if (nodes.pool) {
        nodes.pool.setEnabled(isVisible);
        if (isVisible) {
          nodes.pool.position.set(h.x, 0.035, h.z);
          const ripple = 1.0 + Math.sin(nowTime * 0.008) * 0.04;
          nodes.pool.scaling.set(ripple, 1.0, ripple);
          nodes.pool.rotation.y += 0.008;
        }
      } else if (nodes.rune && nodes.spikes) {
        nodes.rune.setEnabled(isVisible && !h.erupted);
        nodes.spikes.setEnabled(isVisible && h.erupted);

        if (isVisible) {
          if (!h.erupted) {
            nodes.rune.position.set(h.x, 0.04, h.z);
            const progress = 1.0 - Math.max(0, h.timer / (h.maxTimer || 0.9));
            const runeScale = 0.9 + Math.sin(progress * Math.PI * 4) * 0.12;
            nodes.rune.scaling.set(runeScale, 1.0, runeScale);
            nodes.rune.rotation.y += 0.04;
          } else {
            nodes.spikes.position.set(h.x, 0, h.z);
            const lifeProgress = 1.0 - Math.max(0, h.duration / 0.85);
            const spikeY = lifeProgress < 0.2 ? lifeProgress * 5.0 : Math.max(0, 1.0 - (lifeProgress - 0.2) * 1.25);
            nodes.spikes.scaling.set(1.0, spikeY, 1.0);
          }
        }
      }
    });
  }

  // --- MOBILE TAP-TO-MOVE GROUND PICKING ---
  public pickGroundPosition(clientX: number, clientY: number): Vector2D | null {
    if (!this.scene || !this.camera) return null;
    const ray = this.scene.createPickingRay(clientX, clientY, Matrix.Identity(), this.camera);
    if (Math.abs(ray.direction.y) > 0.0001) {
      const dist = -ray.origin.y / ray.direction.y;
      if (dist > 0) {
        return {
          x: ray.origin.x + ray.direction.x * dist,
          z: ray.origin.z + ray.direction.z * dist,
        };
      }
    }
    return null;
  }

  // --- TAP DESTINATION PULSE BEACON ---
  public showTapBeacon(x: number, z: number) {
    if (!this.scene) return;
    const beacon = MeshBuilder.CreateTorus(
      `beacon_${Date.now()}`,
      { diameter: 0.9, thickness: 0.09, tessellation: 24 },
      this.scene
    );
    beacon.position.set(x, 0.06, z);

    const beaconMat = new StandardMaterial(`beacon_mat_${Date.now()}`, this.scene);
    beaconMat.emissiveColor = new Color3(1.0, 0.85, 0.2);
    beaconMat.diffuseColor = new Color3(1.0, 0.85, 0.2);
    beaconMat.alpha = 0.9;
    beacon.material = beaconMat;

    let elapsed = 0;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += 0.016;
      const progress = elapsed / 0.55;
      if (progress >= 1.0) {
        this.scene.onBeforeRenderObservable.remove(observer);
        beacon.dispose();
        beaconMat.dispose();
      } else {
        beacon.scaling.set(1.0 + progress * 0.5, 1.0, 1.0 + progress * 0.5);
        beaconMat.alpha = (1.0 - progress) * 0.9;
      }
    });
  }

  public dispose() {
    this.isDisposed = true;
    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }
    if (this.instrumentation) {
      this.instrumentation.dispose();
      this.instrumentation = null;
    }
    window.removeEventListener('resize', this.onResize);
    palette.clear();
    this.projectileMeshes.forEach((m) => m.dispose());
    this.projectileMeshes.clear();
    this.enemyMeshes.forEach((m) => {
      m.lungePath?.dispose();
      m.rangedReticle?.dispose();
      m.root.dispose();
    });
    this.enemyMeshes.clear();
    this.hazardMeshes.forEach((nodes) => {
      nodes.rune?.dispose();
      nodes.spikes?.dispose();
      nodes.pool?.dispose();
    });
    this.hazardMeshes.clear();
    this.scene.dispose();
    this.engine.dispose();
  }
}
