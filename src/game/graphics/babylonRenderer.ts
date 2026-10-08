import {
  Engine,
  Scene,
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
} from '@babylonjs/core';
import { Vector2D } from '@/types/game';
import { useGameStore } from '../state/gameStore';
import {
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  DUNGEON_GATE_POS,
  DUNGEON_CHEST_POS,
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
  createFacetedTree,
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
  private particleMeshes: Map<string, Mesh> = new Map();

  // Props
  private gateMesh: TransformNode | null = null;
  private chest: ChestMeshes | null = null;
  private waterTiles: Mesh[] = [];

  // Flash materials
  private whiteFlashMat: StandardMaterial;

  private isDisposed: boolean = false;

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
    if (typeof window !== 'undefined') {
      (window as unknown as { __scene: Scene }).__scene = this.scene;
    }

    // Root nodes
    this.overworldRoot = new TransformNode('overworld_root', this.scene);
    this.dungeonRoot = new TransformNode('dungeon_root', this.scene);
    this.dungeonRoot.setEnabled(false);

    // Camera setup with classic Zeldo downward tilt
    this.camera = new UniversalCamera(
      'zeldo_cam',
      new Vector3(7.5, CAMERA_OFFSET.y, 6.0 + CAMERA_OFFSET.z),
      this.scene
    );
    this.camera.setTarget(new Vector3(7.5, 0.5, 6.0));
    this.camera.fov = 0.72;

    // Lighting: Overworld Sun + Ambient
    this.hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    this.hemiLight.diffuse = new Color3(1.0, 1.0, 0.95);
    this.hemiLight.groundColor = new Color3(0.35, 0.45, 0.32);
    this.hemiLight.intensity = 0.95;

    this.sunLight = new DirectionalLight('sun', new Vector3(0.4, -0.9, 0.3), this.scene);
    this.sunLight.position = new Vector3(-12, 28, -10);
    this.sunLight.diffuse = new Color3(1.0, 0.95, 0.85);
    this.sunLight.intensity = 1.0;

    // Hit flash material
    this.whiteFlashMat = palette.get(
      this.scene,
      'hit_flash_white',
      new Color3(1, 1, 1),
      new Color3(1, 1, 1),
      new Color3(1, 1, 1)
    );

    // Build World Geometry
    this.buildOverworldTerrain();
    this.buildDungeonTerrain();

    // Build Hero
    this.hero = createHeroMesh(this.scene);

    // Pre-instantiate all initial entities so shaders are compiled upfront
    this.prepopulateEntities();

    this.scene.onBeforeRenderObservable.add(() => {
      this.syncSceneWithState();
      for (const mesh of this.scene.meshes) {
        if (!mesh.material) {
          console.error('[MESH NO MATERIAL]', mesh.name, 'parent:', mesh.parent ? mesh.parent.name : 'none');
        }
      }
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

  // --- BUILD OVERWORLD GEOMETRY ---
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

    // Ground plane
    for (let x = 0; x < map.width; x++) {
      for (let z = 0; z < map.height; z++) {
        const tile = map.tiles[x][z];
        const isTall = tile.type === 'hedge' || tile.type === 'dungeon_wall';

        const tileMesh = MeshBuilder.CreateBox(
          `tile_${x}_${z}`,
          {
            width: 1.0,
            depth: 1.0,
            height: tile.type === 'hedge' ? 1.2 : tile.type === 'dungeon_wall' ? 2.5 : 0.2,
          },
          this.scene
        );

        tileMesh.position.set(
          x + 0.5,
          tile.type === 'hedge' ? 0.6 : tile.type === 'dungeon_wall' ? 1.25 : -0.1,
          z + 0.5
        );

        if (tile.type === 'grass') tileMesh.material = grassMat;
        else if (tile.type === 'dirt' || tile.type === 'doorway') tileMesh.material = dirtMat;
        else if (tile.type === 'flower') tileMesh.material = flowerMat;
        else if (tile.type === 'water') {
          tileMesh.material = waterMat;
          tileMesh.position.y = -0.15;
          this.waterTiles.push(tileMesh);
        } else if (tile.type === 'bridge') {
          tileMesh.material = bridgeMat;
          tileMesh.position.y = 0.02;
        } else if (tile.type === 'hedge') {
          tileMesh.material = hedgeMat;
        } else if (tile.type === 'dungeon_wall') {
          tileMesh.material = cliffMat;
        } else {
          tileMesh.material = grassMat;
        }

        tileMesh.parent = this.overworldRoot;
      }
    }

    // Overworld Props
    map.props.forEach((prop) => {
      let node: TransformNode | null = null;
      if (prop.type === 'tree') {
        node = createFacetedTree(this.scene);
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
        const archRoot = new TransformNode('arch_root', this.scene);
        const archStoneMat = palette.get(this.scene, 'arch_stone', new Color3(0.35, 0.38, 0.42));

        const archL = MeshBuilder.CreateBox('arch_l', { width: 0.8, height: 2.8, depth: 1.0 }, this.scene);
        archL.material = archStoneMat;
        archL.position.set(-1.2, 1.4, 0);
        archL.parent = archRoot;

        const archR = MeshBuilder.CreateBox('arch_r', { width: 0.8, height: 2.8, depth: 1.0 }, this.scene);
        archR.material = archStoneMat;
        archR.position.set(1.2, 1.4, 0);
        archR.parent = archRoot;

        const archTop = MeshBuilder.CreateBox('arch_top', { width: 3.2, height: 0.8, depth: 1.2 }, this.scene);
        archTop.material = archStoneMat;
        archTop.position.set(0, 3.2, 0);
        archTop.parent = archRoot;

        node = archRoot;
      }

      if (node) {
        node.position.x = prop.x;
        node.position.z = prop.z;
        node.parent = this.overworldRoot;
      }
    });
  }

  // --- BUILD DUNGEON GEOMETRY ---
  private buildDungeonTerrain() {
    const store = useGameStore.getState();
    const map = store.dungeonMap;

    const floorMat = palette.get(this.scene, 'dungeon_floor', new Color3(0.32, 0.35, 0.4));
    const wallMat = palette.get(this.scene, 'dungeon_wall', new Color3(0.2, 0.22, 0.26));

    for (let x = 0; x < map.width; x++) {
      for (let z = 0; z < map.height; z++) {
        const tile = map.tiles[x][z];
        const isWall = tile.type === 'dungeon_wall';
        // South facing walls (z <= 1) are low cutaway walls (height 1.0) so the player is never occluded near the doorway.
        // The dividing wall at z = 11 is 2.4 height, matching gate height while keeping visibility clear when entering boss chamber.
        const wallHeight = isWall ? (z <= 1 ? 1.0 : (z === 11 ? 2.4 : 3.0)) : 0.2;
        const wallPosY = isWall ? (z <= 1 ? 0.5 : (z === 11 ? 1.2 : 1.5)) : -0.1;

        const tileMesh = MeshBuilder.CreateBox(
          `d_tile_${x}_${z}`,
          {
            width: 1.0,
            depth: 1.0,
            height: wallHeight,
          },
          this.scene
        );

        tileMesh.position.set(x + 0.5, wallPosY, z + 0.5);
        tileMesh.material = isWall ? wallMat : floorMat;
        tileMesh.parent = this.dungeonRoot;
      }
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
      }
    });

    // The Dungeon Locked Gate at z = 11.5
    this.gateMesh = createDungeonGate(this.scene);
    this.gateMesh.position.set(DUNGEON_GATE_POS.x, 0, DUNGEON_GATE_POS.z);
    this.gateMesh.parent = this.dungeonRoot;
  }

  // --- VIEW LAYER SYNC: READ STATE EACH FRAME ---
  private syncSceneWithState() {
    const store = useGameStore.getState();

    // 1. Switch active map hierarchy
    const isDungeon = store.currentMap === 'dungeon';
    this.overworldRoot.setEnabled(!isDungeon);
    this.dungeonRoot.setEnabled(isDungeon);

    // Adjust lighting for current map
    if (isDungeon) {
      this.hemiLight.intensity = 0.35;
      this.sunLight.intensity = 0.2;
    } else {
      this.hemiLight.intensity = 0.85;
      this.sunLight.intensity = 1.1;
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

    // 4. Update Enemy Meshes
    store.enemies.forEach((enemy) => {
      let meshes = this.enemyMeshes.get(enemy.id);

      if (!meshes) {
        meshes = createEnemyMesh(this.scene, enemy.type);
        this.enemyMeshes.set(enemy.id, meshes);
      }

      const isVisible = enemy.mapId === store.currentMap && !enemy.isDead;
      meshes.root.setEnabled(isVisible);

      if (isVisible) {
        meshes.root.position.set(enemy.x, 0, enemy.z);
        meshes.root.rotation.y = enemy.facingAngle;

        // Hop animation
        const baseHeight = enemy.type === 'boss_gorgoth' ? 0.95 : 0.35;
        const hopHeight = Math.abs(Math.sin(enemy.hopCycle)) * (enemy.type === 'boss_gorgoth' ? 0.4 : 0.25);
        meshes.body.position.y = baseHeight + hopHeight;

        // Hit flash
        meshes.body.material = enemy.hitFlashTimer > 0 ? this.whiteFlashMat : meshes.defaultMat;

        // Boss telegraphed ranged attack ring
        if (meshes.telegraphRing) {
          const isTelegraphing = !!(enemy.castTimer && enemy.castTimer > 0);
          meshes.telegraphRing.setEnabled(isTelegraphing);
          if (isTelegraphing) {
            const pulse = 1.0 + Math.sin(performance.now() * 0.025) * 0.18;
            meshes.telegraphRing.scaling.set(pulse, 1.0, pulse);
            meshes.telegraphRing.rotation.y += 0.08;
          }
        }
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
      this.gateMesh.position.y = store.quest.gateOpenProgress * 2.8;
    }

    // 8. Update Golden Treasure Chest
    if (this.chest) {
      this.chest.root.setEnabled(store.quest.chestSpawned && isDungeon);
      if (store.quest.chestOpened) {
        this.chest.lid.rotation.x = -store.quest.chestOpenProgress * 1.9;
      }
    }

    // 9. Update Water ripples in Overworld
    const time = performance.now() * 0.002;
    for (let i = 0; i < this.waterTiles.length; i++) {
      this.waterTiles[i].position.y = -0.15 + Math.sin(time + i * 0.4) * 0.03;
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
        mesh = createBrambleProjectileMesh(this.scene);
        this.projectileMeshes.set(p.id, mesh);
      }

      const isVisible = p.mapId === store.currentMap;
      mesh.setEnabled(isVisible);
      if (isVisible) {
        mesh.position.set(p.x, 0.55, p.z);
        mesh.rotation.y += 0.12;
        mesh.rotation.x += 0.08;
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
    window.removeEventListener('resize', this.onResize);
    palette.clear();
    this.projectileMeshes.forEach((m) => m.dispose());
    this.projectileMeshes.clear();
    this.scene.dispose();
    this.engine.dispose();
  }
}
