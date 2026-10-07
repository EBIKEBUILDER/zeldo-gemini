import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
} from '@babylonjs/core';

// Cache materials to avoid redundant shader compilation
class MaterialPalette {
  private materials: Map<string, StandardMaterial> = new Map();

  public clear() {
    this.materials.clear();
  }

  public get(
    scene: Scene,
    key: string,
    diffuse: Color3,
    specular: Color3 = new Color3(0.05, 0.05, 0.05),
    emissive: Color3 = Color3.Black(),
    alpha: number = 1.0
  ): StandardMaterial {
    const cached = this.materials.get(key);
    if (cached && cached.getScene() === scene && scene.materials.indexOf(cached) !== -1) {
      return cached;
    }

    const mat = new StandardMaterial(`mat_${key}_${scene.uid}`, scene);
    mat.diffuseColor = diffuse;
    mat.specularColor = specular;
    mat.emissiveColor = emissive;
    mat.alpha = alpha;
    this.materials.set(key, mat);
    return mat;
  }
}

export const palette = new MaterialPalette();

// 1. HERO MESH BUILDER
export interface HeroMeshes {
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  hat: Mesh;
  shield: Mesh;
  swordRoot: TransformNode;
  swordBlade: Mesh;
  slashArc: Mesh;
}

export function createHeroMesh(scene: Scene): HeroMeshes {
  const root = new TransformNode('hero_root', scene);

  // Materials
  const tunicMat = palette.get(scene, 'hero_tunic', new Color3(0.18, 0.62, 0.26));
  const skinMat = palette.get(scene, 'hero_skin', new Color3(0.98, 0.82, 0.68));
  const hatMat = palette.get(scene, 'hero_hat', new Color3(0.14, 0.52, 0.22));
  const eyeMat = palette.get(scene, 'hero_eye', new Color3(0.1, 0.1, 0.1));
  const shieldFaceMat = palette.get(scene, 'hero_shield', new Color3(0.55, 0.22, 0.15));
  const goldMat = palette.get(scene, 'gold_metal', new Color3(0.95, 0.78, 0.2), new Color3(0.4, 0.4, 0.4));
  const silverMat = palette.get(scene, 'silver_metal', new Color3(0.85, 0.9, 0.95), new Color3(0.6, 0.6, 0.6));
  const slashMat = palette.get(
    scene,
    'slash_arc',
    new Color3(0.6, 0.95, 1.0),
    new Color3(0.9, 1.0, 1.0),
    new Color3(0.4, 0.8, 1.0),
    0.8
  );

  // Body: low-poly cylinder tunic
  const body = MeshBuilder.CreateCylinder('hero_body', {
    diameterTop: 0.45,
    diameterBottom: 0.52,
    height: 0.65,
    tessellation: 8,
  }, scene);
  body.material = tunicMat;
  body.position.y = 0.42;
  body.parent = root;

  // Head: stylized faceted sphere
  const head = MeshBuilder.CreateSphere('hero_head', {
    diameter: 0.46,
    segments: 6,
  }, scene);
  head.material = skinMat;
  head.position.y = 0.86;
  head.parent = root;

  // Eyes
  const leftEye = MeshBuilder.CreateBox('hero_eye_l', { width: 0.06, height: 0.08, depth: 0.04 }, scene);
  leftEye.material = eyeMat;
  leftEye.position.set(-0.1, 0.87, 0.22);
  leftEye.parent = root;

  const rightEye = MeshBuilder.CreateBox('hero_eye_r', { width: 0.06, height: 0.08, depth: 0.04 }, scene);
  rightEye.material = eyeMat;
  rightEye.position.set(0.1, 0.87, 0.22);
  rightEye.parent = root;

  // Pointed green elf hat
  const hat = MeshBuilder.CreateCylinder('hero_hat', {
    diameterTop: 0.02,
    diameterBottom: 0.48,
    height: 0.55,
    tessellation: 7,
  }, scene);
  hat.material = hatMat;
  hat.position.set(0, 1.15, -0.08);
  hat.rotation.x = -0.35;
  hat.parent = root;

  // Shield on left arm
  const shield = MeshBuilder.CreateBox('hero_shield', {
    width: 0.28,
    height: 0.38,
    depth: 0.06,
  }, scene);
  shield.material = shieldFaceMat;
  shield.position.set(-0.32, 0.48, 0.06);
  shield.rotation.y = -0.4;
  shield.parent = root;

  // Sword root on right hand
  const swordRoot = new TransformNode('hero_sword_root', scene);
  swordRoot.position.set(0.32, 0.45, 0.1);
  swordRoot.parent = root;

  const swordHilt = MeshBuilder.CreateBox('sword_hilt', {
    width: 0.18,
    height: 0.04,
    depth: 0.05,
  }, scene);
  swordHilt.material = goldMat;
  swordHilt.parent = swordRoot;

  const swordBlade = MeshBuilder.CreateBox('sword_blade', {
    width: 0.07,
    height: 0.65,
    depth: 0.02,
  }, scene);
  swordBlade.material = silverMat;
  swordBlade.position.y = 0.35;
  swordBlade.parent = swordRoot;

  // Sword Slash Arc Mesh
  const slashArc = MeshBuilder.CreateDisc('hero_slash_arc', {
    radius: 1.15,
    tessellation: 12,
    arc: 0.45,
    sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  slashArc.material = slashMat;
  slashArc.rotation.x = Math.PI / 2;
  slashArc.position.set(0, 0.45, 0.2);
  slashArc.parent = root;
  slashArc.isVisible = false;

  return { root, body, head, hat, shield, swordRoot, swordBlade, slashArc };
}

// 2. ENEMY MESH BUILDER
export interface EnemyMeshes {
  root: TransformNode;
  body: Mesh;
  eyes: Mesh[];
  crown?: Mesh;
  defaultMat: StandardMaterial;
}

export function createEnemyMesh(
  scene: Scene,
  type: 'slime_green' | 'slime_red' | 'boss_gorgoth'
): EnemyMeshes {
  const root = new TransformNode(`enemy_root_${Date.now()}_${Math.random()}`, scene);

  const greenMat = palette.get(scene, 'slime_green', new Color3(0.2, 0.78, 0.35), new Color3(0.3, 0.3, 0.3));
  const redMat = palette.get(scene, 'slime_red', new Color3(0.85, 0.22, 0.22), new Color3(0.3, 0.3, 0.3));
  const bossMat = palette.get(scene, 'boss_body', new Color3(0.22, 0.12, 0.35), new Color3(0.4, 0.3, 0.5));
  const eyeMat = palette.get(scene, 'enemy_eye_dark', new Color3(0.08, 0.08, 0.08));
  const yellowEyeMat = palette.get(
    scene,
    'boss_eye_yellow',
    new Color3(1.0, 0.85, 0.1),
    new Color3(0.5, 0.5, 0.2),
    new Color3(0.8, 0.6, 0.1)
  );
  const goldMat = palette.get(scene, 'gold_metal', new Color3(0.95, 0.78, 0.2));

  let body: Mesh;
  let eyes: Mesh[] = [];
  let crown: Mesh | undefined;
  let defaultMat: StandardMaterial;

  if (type === 'boss_gorgoth') {
    defaultMat = bossMat;
    body = MeshBuilder.CreateIcoSphere('boss_body', {
      radius: 1.15,
      subdivisions: 2,
      flat: true,
    }, scene);
    body.material = bossMat;
    body.scaling.set(1.15, 0.85, 1.15);
    body.position.y = 0.95;
    body.parent = root;

    const eyeL = MeshBuilder.CreateBox('boss_eye_l', { width: 0.18, height: 0.22, depth: 0.1 }, scene);
    eyeL.material = yellowEyeMat;
    eyeL.position.set(-0.4, 1.1, 0.95);
    eyeL.parent = root;
    eyes.push(eyeL);

    const eyeR = MeshBuilder.CreateBox('boss_eye_r', { width: 0.18, height: 0.22, depth: 0.1 }, scene);
    eyeR.material = yellowEyeMat;
    eyeR.position.set(0.4, 1.1, 0.95);
    eyeR.parent = root;
    eyes.push(eyeR);

    crown = MeshBuilder.CreateCylinder('boss_crown', {
      diameterTop: 0.8,
      diameterBottom: 0.6,
      height: 0.35,
      tessellation: 6,
    }, scene);
    crown.material = goldMat;
    crown.position.set(0, 1.85, 0);
    crown.parent = root;
  } else {
    defaultMat = type === 'slime_red' ? redMat : greenMat;
    body = MeshBuilder.CreateIcoSphere('slime_body', {
      radius: 0.44,
      subdivisions: 1,
      flat: true,
    }, scene);
    body.material = defaultMat;
    body.scaling.set(1.0, 0.8, 1.0);
    body.position.y = 0.35;
    body.parent = root;

    const eyeL = MeshBuilder.CreateBox('slime_eye_l', { width: 0.07, height: 0.09, depth: 0.05 }, scene);
    eyeL.material = eyeMat;
    eyeL.position.set(-0.15, 0.4, 0.36);
    eyeL.parent = root;
    eyes.push(eyeL);

    const eyeR = MeshBuilder.CreateBox('slime_eye_r', { width: 0.07, height: 0.09, depth: 0.05 }, scene);
    eyeR.material = eyeMat;
    eyeR.position.set(0.15, 0.4, 0.36);
    eyeR.parent = root;
    eyes.push(eyeR);
  }

  return { root, body, eyes, crown, defaultMat };
}

// 3. BREAKABLE MESH BUILDERS
export function createGrassMesh(scene: Scene): TransformNode {
  const root = new TransformNode('grass_tuft_root', scene);
  const grassMat = palette.get(scene, 'grass_tuft', new Color3(0.24, 0.72, 0.28), new Color3(0.05, 0.05, 0.05));

  const blade1 = MeshBuilder.CreatePlane('blade1', { width: 0.5, height: 0.45 }, scene);
  blade1.material = grassMat;
  blade1.position.y = 0.22;
  blade1.parent = root;

  const blade2 = MeshBuilder.CreatePlane('blade2', { width: 0.5, height: 0.45 }, scene);
  blade2.material = grassMat;
  blade2.rotation.y = Math.PI / 2;
  blade2.position.y = 0.22;
  blade2.parent = root;

  return root;
}

export function createPotMesh(scene: Scene): TransformNode {
  const root = new TransformNode('pot_root', scene);
  const potMat = palette.get(scene, 'terracotta_pot', new Color3(0.82, 0.42, 0.22));

  const belly = MeshBuilder.CreateCylinder('pot_belly', {
    diameterTop: 0.45,
    diameterBottom: 0.32,
    height: 0.45,
    tessellation: 8,
  }, scene);
  belly.material = potMat;
  belly.position.y = 0.22;
  belly.parent = root;

  const rim = MeshBuilder.CreateTorus('pot_rim', {
    diameter: 0.46,
    thickness: 0.08,
    tessellation: 8,
  }, scene);
  rim.material = potMat;
  rim.position.y = 0.44;
  rim.parent = root;

  return root;
}

// 4. PICKUP MESH BUILDERS
export function createRupeeMesh(scene: Scene): TransformNode {
  const root = new TransformNode('rupee_root', scene);
  const rupeeMat = palette.get(
    scene,
    'rupee_gem',
    new Color3(0.2, 0.9, 0.4),
    new Color3(0.8, 1.0, 0.8),
    new Color3(0.1, 0.4, 0.15)
  );

  const topCone = MeshBuilder.CreateCylinder('rupee_top', {
    diameterTop: 0.02,
    diameterBottom: 0.36,
    height: 0.48,
    tessellation: 6,
  }, scene);
  topCone.material = rupeeMat;
  topCone.position.y = 0.24;
  topCone.parent = root;

  const bottomCone = MeshBuilder.CreateCylinder('rupee_bottom', {
    diameterTop: 0.36,
    diameterBottom: 0.02,
    height: 0.48,
    tessellation: 6,
  }, scene);
  bottomCone.material = rupeeMat;
  bottomCone.position.y = -0.24;
  bottomCone.parent = root;

  root.scaling.set(0.65, 0.65, 0.65);
  return root;
}

export function createHeartMesh(scene: Scene): TransformNode {
  const root = new TransformNode('heart_root', scene);
  const heartMat = palette.get(
    scene,
    'heart_pickup',
    new Color3(0.95, 0.18, 0.22),
    new Color3(0.9, 0.6, 0.6),
    new Color3(0.4, 0.05, 0.05)
  );

  const sphereL = MeshBuilder.CreateSphere('h_l', { diameter: 0.28, segments: 4 }, scene);
  sphereL.material = heartMat;
  sphereL.position.set(-0.11, 0.1, 0);
  sphereL.parent = root;

  const sphereR = MeshBuilder.CreateSphere('h_r', { diameter: 0.28, segments: 4 }, scene);
  sphereR.material = heartMat;
  sphereR.position.set(0.11, 0.1, 0);
  sphereR.parent = root;

  const cone = MeshBuilder.CreateCylinder('h_c', {
    diameterTop: 0.36,
    diameterBottom: 0.02,
    height: 0.32,
    tessellation: 6,
  }, scene);
  cone.material = heartMat;
  cone.position.set(0, -0.06, 0);
  cone.parent = root;

  root.scaling.set(0.8, 0.8, 0.8);
  return root;
}

export function createKeyMesh(scene: Scene): TransformNode {
  const root = new TransformNode('key_root', scene);
  const keyMat = palette.get(
    scene,
    'dungeon_key_gold',
    new Color3(1.0, 0.82, 0.15),
    new Color3(0.8, 0.8, 0.4),
    new Color3(0.4, 0.3, 0.05)
  );

  const loop = MeshBuilder.CreateTorus('key_loop', {
    diameter: 0.32,
    thickness: 0.08,
    tessellation: 8,
  }, scene);
  loop.material = keyMat;
  loop.parent = root;

  const stem = MeshBuilder.CreateCylinder('key_stem', {
    diameter: 0.08,
    height: 0.55,
    tessellation: 6,
  }, scene);
  stem.material = keyMat;
  stem.position.y = -0.35;
  stem.parent = root;

  const teeth = MeshBuilder.CreateBox('key_teeth', {
    width: 0.16,
    height: 0.14,
    depth: 0.06,
  }, scene);
  teeth.material = keyMat;
  teeth.position.set(0.1, -0.5, 0);
  teeth.parent = root;

  root.scaling.set(0.85, 0.85, 0.85);
  return root;
}

// 5. WORLD PROPS (Pines, Rocks, Cottage, Well, Gate, Pedestal, Chest)
export function createFacetedTree(scene: Scene): TransformNode {
  const root = new TransformNode('tree_root', scene);
  const trunkMat = palette.get(scene, 'tree_trunk', new Color3(0.42, 0.26, 0.15));
  const foliageMat = palette.get(scene, 'tree_foliage', new Color3(0.15, 0.48, 0.22));

  const trunk = MeshBuilder.CreateCylinder('trunk', {
    diameterTop: 0.35,
    diameterBottom: 0.5,
    height: 1.0,
    tessellation: 6,
  }, scene);
  trunk.material = trunkMat;
  trunk.position.y = 0.5;
  trunk.parent = root;

  const cone1 = MeshBuilder.CreateCylinder('cone1', {
    diameterTop: 0.1,
    diameterBottom: 1.8,
    height: 1.2,
    tessellation: 7,
  }, scene);
  cone1.material = foliageMat;
  cone1.position.y = 1.3;
  cone1.parent = root;

  const cone2 = MeshBuilder.CreateCylinder('cone2', {
    diameterTop: 0.05,
    diameterBottom: 1.4,
    height: 1.0,
    tessellation: 7,
  }, scene);
  cone2.material = foliageMat;
  cone2.position.y = 2.0;
  cone2.parent = root;

  const cone3 = MeshBuilder.CreateCylinder('cone3', {
    diameterTop: 0.01,
    diameterBottom: 0.9,
    height: 0.85,
    tessellation: 6,
  }, scene);
  cone3.material = foliageMat;
  cone3.position.y = 2.6;
  cone3.parent = root;

  return root;
}

export function createRockMesh(scene: Scene, id: string): Mesh {
  const rockMat = palette.get(scene, 'stone_rock', new Color3(0.48, 0.52, 0.56));
  const rock = MeshBuilder.CreateIcoSphere(`rock_${id}`, {
    radius: 0.65,
    subdivisions: 1,
    flat: true,
  }, scene);
  rock.material = rockMat;
  rock.position.y = 0.45;
  return rock;
}

export function createCottageMesh(scene: Scene): TransformNode {
  const root = new TransformNode('cottage_root', scene);
  const wallMat = palette.get(scene, 'cottage_wall', new Color3(0.9, 0.85, 0.75));
  const roofMat = palette.get(scene, 'cottage_roof', new Color3(0.72, 0.35, 0.2));
  const woodMat = palette.get(scene, 'cottage_wood', new Color3(0.38, 0.22, 0.12));

  const houseBody = MeshBuilder.CreateBox('c_body', { width: 2.2, height: 1.4, depth: 2.0 }, scene);
  houseBody.material = wallMat;
  houseBody.position.y = 0.7;
  houseBody.parent = root;

  const roof = MeshBuilder.CreateCylinder('c_roof', {
    diameter: 2.5,
    height: 2.4,
    tessellation: 3,
  }, scene);
  roof.material = roofMat;
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 1.9;
  roof.parent = root;

  const door = MeshBuilder.CreateBox('c_door', { width: 0.55, height: 0.85, depth: 0.1 }, scene);
  door.material = woodMat;
  door.position.set(0, 0.45, 1.02);
  door.parent = root;

  return root;
}

export function createStonePillar(scene: Scene): Mesh {
  const stoneMat = palette.get(scene, 'pillar_stone', new Color3(0.55, 0.58, 0.62));
  const pillar = MeshBuilder.CreateCylinder('pillar', {
    diameterTop: 0.7,
    diameterBottom: 0.8,
    height: 2.4,
    tessellation: 8,
  }, scene);
  pillar.material = stoneMat;
  pillar.position.y = 1.2;
  return pillar;
}

export function createWallTorch(scene: Scene): TransformNode {
  const root = new TransformNode('torch_root', scene);
  const woodMat = palette.get(scene, 'torch_wood', new Color3(0.4, 0.25, 0.15));
  const flameMat = palette.get(
    scene,
    'torch_flame',
    new Color3(1.0, 0.6, 0.1),
    new Color3(1.0, 0.9, 0.3),
    new Color3(0.9, 0.4, 0.05)
  );

  const bracket = MeshBuilder.CreateBox('t_bracket', { width: 0.12, height: 0.4, depth: 0.2 }, scene);
  bracket.material = woodMat;
  bracket.position.y = 1.6;
  bracket.parent = root;

  const flame = MeshBuilder.CreateSphere('t_flame', { diameter: 0.24, segments: 4 }, scene);
  flame.material = flameMat;
  flame.position.set(0, 1.85, 0.1);
  flame.parent = root;

  return root;
}

export function createDungeonGate(scene: Scene): TransformNode {
  const root = new TransformNode('gate_root', scene);
  const ironMat = palette.get(scene, 'gate_iron', new Color3(0.25, 0.28, 0.32), new Color3(0.3, 0.3, 0.3));

  for (let i = -1.2; i <= 1.2; i += 0.4) {
    const bar = MeshBuilder.CreateCylinder(`gate_bar_${i}`, {
      diameter: 0.09,
      height: 2.4,
      tessellation: 6,
    }, scene);
    bar.material = ironMat;
    bar.position.set(i, 1.2, 0);
    bar.parent = root;
  }

  const crossbarTop = MeshBuilder.CreateBox('crossbar_top', { width: 2.6, height: 0.14, depth: 0.12 }, scene);
  crossbarTop.material = ironMat;
  crossbarTop.position.set(0, 2.1, 0);
  crossbarTop.parent = root;

  const crossbarMid = MeshBuilder.CreateBox('crossbar_mid', { width: 2.6, height: 0.14, depth: 0.12 }, scene);
  crossbarMid.material = ironMat;
  crossbarMid.position.set(0, 1.1, 0);
  crossbarMid.parent = root;

  return root;
}

export function createPedestal(scene: Scene): Mesh {
  const stoneMat = palette.get(scene, 'pedestal_stone', new Color3(0.48, 0.52, 0.58));
  const pedestal = MeshBuilder.CreateCylinder('pedestal', {
    diameterTop: 0.9,
    diameterBottom: 1.1,
    height: 0.65,
    tessellation: 6,
  }, scene);
  pedestal.material = stoneMat;
  pedestal.position.y = 0.32;
  return pedestal;
}

export interface ChestMeshes {
  root: TransformNode;
  body: Mesh;
  lid: TransformNode;
  lidMesh: Mesh;
}

export function createTreasureChest(scene: Scene): ChestMeshes {
  const root = new TransformNode('chest_root', scene);
  const woodMat = palette.get(scene, 'chest_wood', new Color3(0.48, 0.28, 0.15));
  const goldMat = palette.get(scene, 'chest_gold', new Color3(0.95, 0.8, 0.2));

  const body = MeshBuilder.CreateBox('chest_body', {
    width: 0.85,
    height: 0.45,
    depth: 0.6,
  }, scene);
  body.material = woodMat;
  body.position.y = 0.22;
  body.parent = root;

  const lid = new TransformNode('chest_lid_hinge', scene);
  lid.position.set(0, 0.45, -0.28);
  lid.parent = root;

  const lidMesh = MeshBuilder.CreateCylinder('chest_lid_mesh', {
    diameter: 0.6,
    height: 0.86,
    tessellation: 8,
  }, scene);
  lidMesh.material = woodMat;
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.set(0, 0.08, 0.28);
  lidMesh.parent = lid;

  const lock = MeshBuilder.CreateBox('chest_lock', { width: 0.14, height: 0.14, depth: 0.05 }, scene);
  lock.material = goldMat;
  lock.position.set(0, 0.28, 0.32);
  lock.parent = root;

  return { root, body, lid, lidMesh };
}
