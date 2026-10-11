import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  AbstractMesh,
  VertexData,
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
  telegraphRing?: Mesh;
  defaultMat: StandardMaterial;
  coreGem?: Mesh;
  exclamationBubble?: TransformNode;
  eyebrows?: Mesh[];
  antenna?: TransformNode;
  pauldrons?: TransformNode[];
  lungePath?: TransformNode;
  rangedReticle?: TransformNode;
}

export function createEnemyMesh(
  scene: Scene,
  type: 'slime_green' | 'slime_red' | 'boss_gorgoth'
): EnemyMeshes {
  const root = new TransformNode(`enemy_root_${Date.now()}_${Math.random()}`, scene);

  // Mario RPG Palette: rich, glossy, toy-like materials
  const greenMat = palette.get(
    scene,
    'slime_green',
    new Color3(0.24, 0.82, 0.38),
    new Color3(0.55, 0.85, 0.55)
  );
  const redMat = palette.get(
    scene,
    'slime_red',
    new Color3(0.88, 0.24, 0.24),
    new Color3(0.85, 0.55, 0.55)
  );
  const bossMat = palette.get(
    scene,
    'boss_body',
    new Color3(0.25, 0.12, 0.38),
    new Color3(0.5, 0.35, 0.6)
  );
  const eyeMat = palette.get(scene, 'enemy_eye_dark', new Color3(0.06, 0.06, 0.06));
  const eyeWhiteMat = palette.get(scene, 'enemy_eye_white', new Color3(0.98, 0.98, 0.98), new Color3(0.8, 0.8, 0.8));
  const eyeGlintMat = palette.get(scene, 'enemy_eye_glint', new Color3(1.0, 1.0, 1.0), new Color3(1.0, 1.0, 1.0), new Color3(1.0, 1.0, 1.0));
  const amberEyeMat = palette.get(
    scene,
    'boss_eye_amber',
    new Color3(1.0, 0.82, 0.1),
    new Color3(0.8, 0.7, 0.3),
    new Color3(0.9, 0.6, 0.1)
  );
  const woodBrowMat = palette.get(scene, 'boss_brow_wood', new Color3(0.32, 0.18, 0.1));
  const woodPauldronMat = palette.get(scene, 'boss_pauldron_wood', new Color3(0.38, 0.22, 0.12), new Color3(0.15, 0.1, 0.05));
  const coreGemMat = palette.get(
    scene,
    'boss_core_gem',
    new Color3(0.25, 0.95, 0.45),
    new Color3(0.8, 1.0, 0.8),
    new Color3(0.4, 0.9, 0.3)
  );
  const goldMat = palette.get(scene, 'gold_metal', new Color3(0.98, 0.82, 0.22), new Color3(0.6, 0.5, 0.2));
  const rubyMat = palette.get(
    scene,
    'boss_crown_ruby',
    new Color3(0.95, 0.15, 0.25),
    new Color3(1.0, 0.6, 0.6),
    new Color3(0.7, 0.1, 0.15)
  );
  const exclamationMat = palette.get(
    scene,
    'exclamation_bubble_mat',
    new Color3(1.0, 0.75, 0.1),
    new Color3(1.0, 0.95, 0.4),
    new Color3(1.0, 0.7, 0.1)
  );
  const telegraphMat = palette.get(
    scene,
    'boss_telegraph_ring_mat',
    new Color3(0.3, 0.95, 0.25),
    new Color3(0.6, 1.0, 0.4),
    new Color3(0.4, 0.95, 0.3)
  );

  let body: Mesh;
  let eyes: Mesh[] = [];
  let crown: Mesh | undefined;
  let telegraphRing: Mesh | undefined;
  let coreGem: Mesh | undefined;
  let exclamationBubble: TransformNode | undefined;
  let eyebrows: Mesh[] = [];
  let antenna: TransformNode | undefined;
  let pauldrons: TransformNode[] = [];
  let lungePath: TransformNode | undefined;
  let rangedReticle: TransformNode | undefined;
  let defaultMat: StandardMaterial;

  if (type === 'boss_gorgoth') {
    defaultMat = bossMat;

    // 1. Smooth rounded body (Mario RPG Boss presence)
    body = MeshBuilder.CreateSphere('boss_body', {
      diameter: 2.3,
      segments: 24,
    }, scene);
    body.material = bossMat;
    body.scaling.set(1.15, 0.88, 1.15);
    body.position.y = 0.95;
    body.parent = root;

    // 2. Gnarled Wooden Shoulder Pauldrons
    const pauldronL = new TransformNode('boss_pauldron_l', scene);
    pauldronL.position.set(-1.15, 1.1, 0.1);
    pauldronL.parent = root;
    const pauldronMeshL = MeshBuilder.CreateCylinder('p_mesh_l', {
      diameterTop: 0.55,
      diameterBottom: 0.2,
      height: 0.5,
      tessellation: 16,
    }, scene);
    pauldronMeshL.material = woodPauldronMat;
    pauldronMeshL.rotation.z = -0.55;
    pauldronMeshL.parent = pauldronL;
    pauldrons.push(pauldronL);

    const pauldronR = new TransformNode('boss_pauldron_r', scene);
    pauldronR.position.set(1.15, 1.1, 0.1);
    pauldronR.parent = root;
    const pauldronMeshR = MeshBuilder.CreateCylinder('p_mesh_r', {
      diameterTop: 0.55,
      diameterBottom: 0.2,
      height: 0.5,
      tessellation: 16,
    }, scene);
    pauldronMeshR.material = woodPauldronMat;
    pauldronMeshR.rotation.z = 0.55;
    pauldronMeshR.parent = pauldronR;
    pauldrons.push(pauldronR);

    // 3. Glowing Bramble Core Gem in chest (smooth glowing gem)
    coreGem = MeshBuilder.CreateSphere('boss_core_gem', {
      diameter: 0.52,
      segments: 16,
    }, scene);
    coreGem.material = coreGemMat;
    coreGem.scaling.set(1.0, 1.3, 0.7);
    coreGem.position.set(0, 0.85, 1.05);
    coreGem.parent = root;

    // 4. Expressive Mario RPG Eyes (Glowing amber with menacing slit pupils and wooden brow arches)
    const eyeL = MeshBuilder.CreateBox('boss_eye_l', { width: 0.22, height: 0.24, depth: 0.12 }, scene);
    eyeL.material = amberEyeMat;
    eyeL.position.set(-0.38, 1.12, 0.96);
    eyeL.parent = root;
    eyes.push(eyeL);

    const pupilL = MeshBuilder.CreateBox('boss_pupil_l', { width: 0.08, height: 0.2, depth: 0.05 }, scene);
    pupilL.material = eyeMat;
    pupilL.position.set(-0.38, 1.12, 1.03);
    pupilL.parent = root;

    const eyeR = MeshBuilder.CreateBox('boss_eye_r', { width: 0.22, height: 0.24, depth: 0.12 }, scene);
    eyeR.material = amberEyeMat;
    eyeR.position.set(0.38, 1.12, 0.96);
    eyeR.parent = root;
    eyes.push(eyeR);

    const pupilR = MeshBuilder.CreateBox('boss_pupil_r', { width: 0.08, height: 0.2, depth: 0.05 }, scene);
    pupilR.material = eyeMat;
    pupilR.position.set(0.38, 1.12, 1.03);
    pupilR.parent = root;

    // Angled wooden brow arches
    const browL = MeshBuilder.CreateBox('boss_brow_l', { width: 0.32, height: 0.09, depth: 0.14 }, scene);
    browL.material = woodBrowMat;
    browL.position.set(-0.38, 1.28, 0.98);
    browL.rotation.z = -0.22;
    browL.parent = root;
    eyebrows.push(browL);

    const browR = MeshBuilder.CreateBox('boss_brow_r', { width: 0.32, height: 0.09, depth: 0.14 }, scene);
    browR.material = woodBrowMat;
    browR.position.set(0.38, 1.28, 0.98);
    browR.rotation.z = 0.22;
    browR.parent = root;
    eyebrows.push(browR);

    // 5. Ornate Golden Briar Crown with center Ruby Gem
    crown = MeshBuilder.CreateCylinder('boss_crown', {
      diameterTop: 0.85,
      diameterBottom: 0.65,
      height: 0.38,
      tessellation: 20,
    }, scene);
    crown.material = goldMat;
    crown.position.set(0, 1.88, 0);
    crown.parent = root;

    const crownRuby = MeshBuilder.CreateSphere('crown_ruby', { diameter: 0.24, segments: 16 }, scene);
    crownRuby.material = rubyMat;
    crownRuby.position.set(0, 1.88, 0.42);
    crownRuby.parent = root;

    // 6. Mario RPG Floating '!' Telegraph Exclamation Glyph
    exclamationBubble = new TransformNode('boss_exclamation_bubble', scene);
    exclamationBubble.position.set(0, 2.55, 0);
    exclamationBubble.parent = root;

    const exclamBar = MeshBuilder.CreateCylinder('exclam_bar', {
      diameterTop: 0.22,
      diameterBottom: 0.1,
      height: 0.48,
      tessellation: 16,
    }, scene);
    exclamBar.material = exclamationMat;
    exclamBar.position.y = 0.18;
    exclamBar.parent = exclamationBubble;

    const exclamDot = MeshBuilder.CreateSphere('exclam_dot', { diameter: 0.14, segments: 12 }, scene);
    exclamDot.material = exclamationMat;
    exclamDot.position.y = -0.16;
    exclamDot.parent = exclamationBubble;

    exclamationBubble.setEnabled(false); // only enabled when telegraphing attacks

    // 7. Ground Telegraph Ring
    telegraphRing = MeshBuilder.CreateTorus('boss_telegraph_ring', {
      diameter: 3.2,
      thickness: 0.14,
      tessellation: 28,
    }, scene);
    telegraphRing.material = telegraphMat;
    telegraphRing.position.set(0, 0.08, 0);
    telegraphRing.parent = root;
    telegraphRing.setEnabled(false);

    // 8. Ground Lunge Attack Telegraph Path
    lungePath = createLungeTelegraphMesh(scene);
    lungePath.setEnabled(false);

    // 9. Ground Ranged Bomb Landing Reticle
    rangedReticle = createRangedReticleMesh(scene);
    rangedReticle.setEnabled(false);
  } else {
    // Slimes (Green / Red) - Mario RPG Toy Aesthetics: Smooth rounded jelly blob
    defaultMat = type === 'slime_red' ? redMat : greenMat;
    body = MeshBuilder.CreateSphere('slime_body', {
      diameter: 0.92,
      segments: 24,
    }, scene);
    body.material = defaultMat;
    body.scaling.set(1.05, 0.82, 1.05);
    body.position.y = 0.35;
    body.parent = root;

    // Mario RPG Style Cartoon Eyes: White Cornea + Black Pupil + Specular Highlight Dot
    // Left Eye
    const corneaL = MeshBuilder.CreateSphere('slime_cornea_l', { diameter: 0.18, segments: 16 }, scene);
    corneaL.material = eyeWhiteMat;
    corneaL.scaling.set(0.7, 1.0, 0.5);
    corneaL.position.set(-0.16, 0.42, 0.38);
    corneaL.parent = root;

    const pupilL = MeshBuilder.CreateSphere('slime_pupil_l', { diameter: 0.1, segments: 16 }, scene);
    pupilL.material = eyeMat;
    pupilL.scaling.set(0.65, 0.9, 0.35);
    pupilL.position.set(-0.16, 0.42, 0.42);
    pupilL.parent = root;
    eyes.push(pupilL);

    const glintL = MeshBuilder.CreateSphere('slime_glint_l', { diameter: 0.04, segments: 12 }, scene);
    glintL.material = eyeGlintMat;
    glintL.position.set(-0.14, 0.45, 0.44);
    glintL.parent = root;

    // Right Eye
    const corneaR = MeshBuilder.CreateSphere('slime_cornea_r', { diameter: 0.18, segments: 16 }, scene);
    corneaR.material = eyeWhiteMat;
    corneaR.scaling.set(0.7, 1.0, 0.5);
    corneaR.position.set(0.16, 0.42, 0.38);
    corneaR.parent = root;

    const pupilR = MeshBuilder.CreateSphere('slime_pupil_r', { diameter: 0.1, segments: 16 }, scene);
    pupilR.material = eyeMat;
    pupilR.scaling.set(0.65, 0.9, 0.35);
    pupilR.position.set(0.16, 0.42, 0.42);
    pupilR.parent = root;
    eyes.push(pupilR);

    const glintR = MeshBuilder.CreateSphere('slime_glint_r', { diameter: 0.04, segments: 12 }, scene);
    glintR.material = eyeGlintMat;
    glintR.position.set(0.18, 0.45, 0.44);
    glintR.parent = root;

    // Quivering Antenna / Sprout
    antenna = new TransformNode('slime_antenna', scene);
    antenna.position.set(0, 0.72, 0);
    antenna.parent = root;

    if (type === 'slime_red') {
      // Fierce dual mini horns
      const hornL = MeshBuilder.CreateCylinder('horn_l', { diameterTop: 0.02, diameterBottom: 0.1, height: 0.22, tessellation: 16 }, scene);
      hornL.material = palette.get(scene, 'slime_horn_mat', new Color3(1.0, 0.85, 0.2));
      hornL.position.set(-0.12, 0.08, 0);
      hornL.rotation.z = -0.3;
      hornL.parent = antenna;

      const hornR = MeshBuilder.CreateCylinder('horn_r', { diameterTop: 0.02, diameterBottom: 0.1, height: 0.22, tessellation: 16 }, scene);
      hornR.material = palette.get(scene, 'slime_horn_mat', new Color3(1.0, 0.85, 0.2));
      hornR.position.set(0.12, 0.08, 0);
      hornR.rotation.z = 0.3;
      hornR.parent = antenna;
    } else {
      // Cute teardrop leaf sprout
      const sprout = MeshBuilder.CreateSphere('sprout_bulb', { diameter: 0.14, segments: 16 }, scene);
      sprout.material = palette.get(scene, 'sprout_mat', new Color3(0.35, 0.95, 0.45));
      sprout.scaling.set(0.8, 1.4, 0.8);
      sprout.position.y = 0.08;
      sprout.parent = antenna;
    }
  }

  return {
    root,
    body,
    eyes,
    crown,
    telegraphRing,
    defaultMat,
    coreGem,
    exclamationBubble,
    eyebrows,
    antenna,
    pauldrons,
    lungePath,
    rangedReticle,
  };
}

// 3. BREAKABLE MESH BUILDERS
export function createGrassMesh(scene: Scene): TransformNode {
  const root = new TransformNode('grass_tuft_root', scene);
  const grassMat = palette.get(scene, 'grass_tuft', new Color3(0.24, 0.72, 0.28), new Color3(0.05, 0.05, 0.05));

  // Randomize between 2, 3, and 4 billboard planes for varied bushiness
  const planeCount = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4
  const baseAngle = Math.random() * Math.PI;

  const blades: Mesh[] = [];
  for (let i = 0; i < planeCount; i++) {
    const angle = baseAngle + (Math.PI / planeCount) * i;
    const width = 0.48 + (Math.random() - 0.5) * 0.08;
    const height = 0.44 + (Math.random() - 0.5) * 0.06;

    const blade = MeshBuilder.CreatePlane(`blade_${i}`, { width, height }, scene);
    blade.rotation.y = angle;
    blade.position.y = height * 0.5;
    blades.push(blade);
  }

  const merged = Mesh.MergeMeshes(blades, true, true, undefined, false, false);
  if (merged) {
    merged.material = grassMat;
    merged.parent = root;
    merged.freezeWorldMatrix();
    merged.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  }

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
  belly.position.y = 0.22;

  const rim = MeshBuilder.CreateTorus('pot_rim', {
    diameter: 0.46,
    thickness: 0.08,
    tessellation: 8,
  }, scene);
  rim.position.y = 0.44;

  const merged = Mesh.MergeMeshes([belly, rim], true, true, undefined, false, false);
  if (merged) {
    merged.material = potMat;
    merged.parent = root;
    merged.freezeWorldMatrix();
    merged.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  }

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
    new Color3(1.0, 0.85, 0.2),
    new Color3(0.95, 0.9, 0.5),
    new Color3(0.65, 0.5, 0.1)
  );

  // Key bow (circular loop) standing upright in XY plane aligned with stem and teeth
  const loop = MeshBuilder.CreateTorus('key_loop', {
    diameter: 0.38,
    thickness: 0.09,
    tessellation: 16,
  }, scene);
  loop.material = keyMat;
  loop.rotation.x = Math.PI / 2; // Rotate 90 degrees so loop stands upright and lines up with key body
  loop.position.y = 0.20;
  loop.parent = root;

  // Decorative collar ring joining the bow seamlessly to the shaft
  const collar = MeshBuilder.CreateCylinder('key_collar', {
    diameter: 0.13,
    height: 0.06,
    tessellation: 8,
  }, scene);
  collar.material = keyMat;
  collar.position.y = 0.02;
  collar.parent = root;

  // Stem (shaft) running downward through center
  const stem = MeshBuilder.CreateCylinder('key_stem', {
    diameter: 0.085,
    height: 0.50,
    tessellation: 8,
  }, scene);
  stem.material = keyMat;
  stem.position.y = -0.12;
  stem.parent = root;

  // Teeth at bottom of stem
  const teeth = MeshBuilder.CreateBox('key_teeth', {
    width: 0.18,
    height: 0.16,
    depth: 0.07,
  }, scene);
  teeth.material = keyMat;
  teeth.position.set(0.11, -0.27, 0);
  teeth.parent = root;

  // Additional bit notch for ornate antique key look
  const bit2 = MeshBuilder.CreateBox('key_teeth_notch', {
    width: 0.12,
    height: 0.08,
    depth: 0.07,
  }, scene);
  bit2.material = keyMat;
  bit2.position.set(0.08, -0.16, 0);
  bit2.parent = root;

  root.scaling.set(1.15, 1.15, 1.15);
  return root;
}

export function createBrambleProjectileMesh(scene: Scene): TransformNode {
  const root = new TransformNode('bramble_proj_root', scene);

  const coreMat = palette.get(
    scene,
    'bramble_proj_core',
    new Color3(0.35, 0.85, 0.25),
    new Color3(0.8, 1.0, 0.6),
    new Color3(0.4, 0.75, 0.2)
  );
  const thornMat = palette.get(
    scene,
    'bramble_proj_thorns',
    new Color3(0.18, 0.45, 0.15),
    new Color3(0.4, 0.7, 0.3),
    new Color3(0.15, 0.35, 0.1)
  );

  // Glowing toxic bramble core orb
  const core = MeshBuilder.CreateSphere('proj_core', {
    diameter: 0.36,
    segments: 16,
  }, scene);
  core.material = coreMat;
  core.parent = root;

  // 4 Cardinal briar thorns
  const thornOffsets: [number, number, number, number, number, number][] = [
    [0.22, 0, 0, 0, 0, -Math.PI / 2],
    [-0.22, 0, 0, 0, 0, Math.PI / 2],
    [0, 0.22, 0, 0, 0, 0],
    [0, -0.22, 0, Math.PI, 0, 0],
    [0, 0, 0.22, Math.PI / 2, 0, 0],
    [0, 0, -0.22, -Math.PI / 2, 0, 0],
  ];

  thornOffsets.forEach(([px, py, pz, rx, ry, rz], idx) => {
    const thorn = MeshBuilder.CreateCylinder(`proj_thorn_${idx}`, {
      diameterTop: 0.0,
      diameterBottom: 0.12,
      height: 0.22,
      tessellation: 12,
    }, scene);
    thorn.material = thornMat;
    thorn.position.set(px, py, pz);
    thorn.rotation.set(rx, ry, rz);
    thorn.parent = root;
  });

  return root;
}

// 4b. GROUND HAZARD & BOSS ARENA MESHES (Mario RPG Encounter Polish)
export function createGroundRuneMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`ground_rune_${Date.now()}_${Math.random()}`, scene);
  const runeMat = palette.get(
    scene,
    'briar_ground_rune',
    new Color3(0.9, 0.18, 0.35),
    new Color3(1.0, 0.5, 0.6),
    new Color3(0.85, 0.15, 0.3)
  );

  // Outer warning ring
  const ring = MeshBuilder.CreateTorus('rune_ring', {
    diameter: 1.8,
    thickness: 0.08,
    tessellation: 28,
  }, scene);
  ring.material = runeMat;
  ring.position.y = 0.04;
  ring.parent = root;

  // Cross briar lines
  const bar1 = MeshBuilder.CreateBox('rune_bar1', { width: 1.5, height: 0.02, depth: 0.07 }, scene);
  bar1.material = runeMat;
  bar1.position.y = 0.04;
  bar1.parent = root;

  const bar2 = MeshBuilder.CreateBox('rune_bar2', { width: 0.07, height: 0.02, depth: 1.5 }, scene);
  bar2.material = runeMat;
  bar2.position.y = 0.04;
  bar2.parent = root;

  return root;
}

export function createBriarSpikesMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`briar_spikes_${Date.now()}_${Math.random()}`, scene);
  const woodMat = palette.get(
    scene,
    'briar_spike_wood',
    new Color3(0.38, 0.22, 0.12),
    new Color3(0.2, 0.15, 0.1)
  );
  const tipMat = palette.get(
    scene,
    'briar_spike_tip',
    new Color3(0.92, 0.18, 0.28),
    new Color3(1.0, 0.5, 0.5),
    new Color3(0.65, 0.1, 0.15)
  );

  const spikeConfigs = [
    { x: -0.22, z: -0.22, h: 1.35, rx: -0.15, rz: 0.15 },
    { x: 0.24, z: -0.18, h: 1.55, rx: -0.12, rz: -0.18 },
    { x: -0.16, z: 0.26, h: 1.45, rx: 0.18, rz: 0.12 },
    { x: 0.2, z: 0.22, h: 1.65, rx: 0.14, rz: -0.14 },
  ];

  spikeConfigs.forEach((cfg, idx) => {
    const spike = MeshBuilder.CreateCylinder(`b_spike_${idx}`, {
      diameterTop: 0.02,
      diameterBottom: 0.24,
      height: cfg.h,
      tessellation: 5,
    }, scene);
    spike.material = idx === 3 ? tipMat : woodMat;
    spike.position.set(cfg.x, cfg.h * 0.5, cfg.z);
    spike.rotation.x = cfg.rx;
    spike.rotation.z = cfg.rz;
    spike.parent = root;
  });

  return root;
}

export function createBossArenaRuneMesh(scene: Scene): TransformNode {
  const root = new TransformNode('boss_arena_rune_root', scene);
  const runeMat = palette.get(
    scene,
    'boss_arena_rune_mat',
    new Color3(0.45, 0.25, 0.65),
    new Color3(0.6, 0.4, 0.8),
    new Color3(0.25, 0.12, 0.35)
  );

  const mainRing = MeshBuilder.CreateTorus('arena_ring', {
    diameter: 10.5,
    thickness: 0.12,
    tessellation: 36,
  }, scene);
  mainRing.material = runeMat;
  mainRing.position.y = 0.03;
  mainRing.parent = root;

  const innerRing = MeshBuilder.CreateTorus('arena_inner_ring', {
    diameter: 6.2,
    thickness: 0.08,
    tessellation: 32,
  }, scene);
  innerRing.material = runeMat;
  innerRing.position.y = 0.03;
  innerRing.parent = root;

  return root;
}

// Helper to build a spiky star-cone foliage tier with faceted needle branches
function createSpikyFoliageTier(
  name: string,
  points: number,
  rOuter: number,
  rInner: number,
  height: number,
  yOffset: number,
  droop: number,
  rotY: number,
  scene: Scene
): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];

  // Top apex point
  const apexIdx = 0;
  positions.push(0, height, 0);

  // Bottom center point (recessed inside so underside is concave)
  const bottomCenterIdx = 1;
  positions.push(0, droop * 0.45, 0);

  // Base perimeter vertices (alternating outer sharp tips and inner valleys)
  const numPerim = points * 2;
  const perimStartIdx = 2;

  for (let i = 0; i < numPerim; i++) {
    const angle = (i * Math.PI * 2) / numPerim;
    const isTip = i % 2 === 0;
    const r = isTip ? rOuter : rInner;
    const y = isTip ? 0 : droop;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    positions.push(x, y, z);
  }

  // Side faces: apex to base perimeter
  for (let i = 0; i < numPerim; i++) {
    const next = (i + 1) % numPerim;
    indices.push(apexIdx, perimStartIdx + i, perimStartIdx + next);
  }

  // Underside faces: base perimeter to bottom center
  for (let i = 0; i < numPerim; i++) {
    const next = (i + 1) % numPerim;
    indices.push(bottomCenterIdx, perimStartIdx + next, perimStartIdx + i);
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;

  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  mesh.position.y = yOffset;
  mesh.rotation.y = rotY;
  return mesh;
}

// 5. WORLD PROPS (Spiky Low-Poly Pine Trees, Rocks, Cottage, Well, Gate, Pedestal, Chest)
export function createFacetedTree(scene: Scene): TransformNode {
  const root = new TransformNode('tree_root', scene);
  const trunkMat = palette.get(scene, 'tree_trunk', new Color3(0.42, 0.26, 0.15), new Color3(0.05, 0.05, 0.05));
  const foliageMat1 = palette.get(scene, 'tree_foliage_1', new Color3(0.16, 0.52, 0.22), new Color3(0.08, 0.12, 0.08));
  const foliageMat2 = palette.get(scene, 'tree_foliage_2', new Color3(0.24, 0.66, 0.30), new Color3(0.08, 0.12, 0.08));

  // Sturdy low-poly faceted hexagonal trunk
  const trunk = MeshBuilder.CreateCylinder('trunk', {
    diameterTop: 0.38,
    diameterBottom: 0.54,
    height: 1.1,
    tessellation: 6,
  }, scene);
  trunk.material = trunkMat;
  trunk.position.y = 0.55;
  trunk.convertToFlatShadedMesh();
  trunk.parent = root;

  // Tier 1 (bottom wide skirt with 7 sharp drooping needle tips)
  const tier1 = createSpikyFoliageTier('tier1', 7, 1.25, 0.72, 1.25, 0.92, 0.28, 0, scene);

  // Tier 2 (lower-mid tier rotated to interleave needle spikes between tier 1)
  const tier2 = createSpikyFoliageTier('tier2', 7, 1.02, 0.60, 1.15, 1.55, 0.24, Math.PI / 7, scene);

  // Lower foliage merged for optimal draw call batching with flat low-poly shading
  const lowerFoliage = Mesh.MergeMeshes([tier1, tier2], true, true, undefined, false, false);
  if (lowerFoliage) {
    lowerFoliage.material = foliageMat1;
    lowerFoliage.convertToFlatShadedMesh();
    lowerFoliage.parent = root;
  }

  // Tier 3 (upper-mid tier)
  const tier3 = createSpikyFoliageTier('tier3', 6, 0.78, 0.46, 1.05, 2.15, 0.20, Math.PI / 4, scene);

  // Tier 4 (sharp crowning needle spire tapering to a pointed needle tip)
  const tier4 = createSpikyFoliageTier('tier4', 5, 0.52, 0.28, 1.10, 2.70, 0.16, 0.35, scene);

  // Upper foliage merged with vibrant pine green gradient
  const upperFoliage = Mesh.MergeMeshes([tier3, tier4], true, true, undefined, false, false);
  if (upperFoliage) {
    upperFoliage.material = foliageMat2;
    upperFoliage.convertToFlatShadedMesh();
    upperFoliage.parent = root;
  }

  return root;
}

// Low-poly round deciduous tree with faceted icosphere foliage lobes and subtle leaf spikes
export function createRoundFacetedTree(scene: Scene): TransformNode {
  const root = new TransformNode('tree_round_root', scene);
  const trunkMat = palette.get(scene, 'tree_trunk', new Color3(0.42, 0.26, 0.15), new Color3(0.05, 0.05, 0.05));
  const foliageMat1 = palette.get(scene, 'tree_round_foliage_1', new Color3(0.20, 0.58, 0.26), new Color3(0.06, 0.10, 0.06));
  const foliageMat2 = palette.get(scene, 'tree_round_foliage_2', new Color3(0.28, 0.68, 0.32), new Color3(0.06, 0.10, 0.06));

  // Sturdy low-poly trunk
  const trunk = MeshBuilder.CreateCylinder('r_trunk', {
    diameterTop: 0.38,
    diameterBottom: 0.56,
    height: 1.35,
    tessellation: 6,
  }, scene);
  trunk.position.y = 0.67;

  // Left & right supporting branch knuckles
  const b1 = MeshBuilder.CreateCylinder('r_b1', { diameterTop: 0.18, diameterBottom: 0.26, height: 0.62, tessellation: 5 }, scene);
  b1.position.set(-0.26, 1.25, 0.12);
  b1.rotation.set(0.12, 0, 0.52);

  const b2 = MeshBuilder.CreateCylinder('r_b2', { diameterTop: 0.18, diameterBottom: 0.26, height: 0.58, tessellation: 5 }, scene);
  b2.position.set(0.26, 1.22, -0.10);
  b2.rotation.set(-0.12, 0, -0.48);

  const fullTrunk = Mesh.MergeMeshes([trunk, b1, b2], true, true, undefined, false, false);
  if (fullTrunk) {
    fullTrunk.material = trunkMat;
    fullTrunk.convertToFlatShadedMesh();
    fullTrunk.parent = root;
  }

  // Low-poly faceted icosphere foliage lobes (subdivisions: 1 gives 20 crisp triangular facets)
  const p1 = MeshBuilder.CreateIcoSphere('r_p1', { radius: 1.12, subdivisions: 1, flat: true }, scene);
  p1.position.set(0, 2.05, 0);
  p1.scaling.set(1.05, 0.94, 1.05);

  const p2 = MeshBuilder.CreateIcoSphere('r_p2', { radius: 0.88, subdivisions: 1, flat: true }, scene);
  p2.position.set(-0.64, 1.85, 0.26);
  p2.rotation.y = 0.45;

  const p3 = MeshBuilder.CreateIcoSphere('r_p3', { radius: 0.84, subdivisions: 1, flat: true }, scene);
  p3.position.set(0.62, 1.80, -0.24);
  p3.rotation.y = 1.15;

  const p4 = MeshBuilder.CreateIcoSphere('r_p4', { radius: 0.78, subdivisions: 1, flat: true }, scene);
  p4.position.set(-0.25, 1.95, -0.58);
  p4.rotation.y = 2.1;

  // Subtle leafy branch tuft spikes projecting softly from the lobes
  const leafTufts: Mesh[] = [];
  const tuftCoords = [
    [-1.25, 1.82, 0.35, 0, 0, Math.PI / 3],
    [1.22, 1.78, -0.32, 0, 0, -Math.PI / 3],
    [-0.32, 1.95, -1.15, -Math.PI / 3, 0, 0],
    [0.15, 3.25, 0.08, 0, 0, 0],
  ];
  tuftCoords.forEach(([tx, ty, tz, rx, ry, rz], i) => {
    const tuft = MeshBuilder.CreateCylinder(`r_tuft_${i}`, { diameterTop: 0.02, diameterBottom: 0.38, height: 0.42, tessellation: 4 }, scene);
    tuft.position.set(tx, ty, tz);
    tuft.rotation.set(rx, ry, rz);
    leafTufts.push(tuft);
  });

  const p5 = MeshBuilder.CreateIcoSphere('r_p5', { radius: 0.76, subdivisions: 1, flat: true }, scene);
  p5.position.set(0.06, 2.72, 0.05);
  p5.rotation.y = 0.85;

  const lowerFoliage = Mesh.MergeMeshes([p1, p2, p3, p4, leafTufts[0], leafTufts[1], leafTufts[2]], true, true, undefined, false, false);
  if (lowerFoliage) {
    lowerFoliage.material = foliageMat1;
    lowerFoliage.convertToFlatShadedMesh();
    lowerFoliage.parent = root;
  }

  const upperFoliage = Mesh.MergeMeshes([p5, leafTufts[3]], true, true, undefined, false, false);
  if (upperFoliage) {
    upperFoliage.material = foliageMat2;
    upperFoliage.convertToFlatShadedMesh();
    upperFoliage.parent = root;
  }

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

export function createStonePillar(scene: Scene): TransformNode {
  const root = new TransformNode(`pillar_root_${Date.now()}_${Math.random()}`, scene);
  const stoneMat = palette.get(scene, 'pillar_stone', new Color3(0.55, 0.58, 0.62), new Color3(0.2, 0.2, 0.2));
  const trimMat = palette.get(scene, 'pillar_trim', new Color3(0.42, 0.45, 0.49), new Color3(0.3, 0.3, 0.3));

  // Stepped base
  const base = MeshBuilder.CreateBox('pillar_base', { width: 1.15, height: 0.3, depth: 1.15 }, scene);
  base.position.y = 0.15;

  // Main fluted shaft
  const shaft = MeshBuilder.CreateCylinder('pillar_shaft', {
    diameterTop: 0.72,
    diameterBottom: 0.78,
    height: 2.1,
    tessellation: 8,
  }, scene);
  shaft.material = stoneMat;
  shaft.position.y = 1.35;
  shaft.parent = root;

  // Carved capital on top
  const capital = MeshBuilder.CreateBox('pillar_capital', { width: 1.1, height: 0.25, depth: 1.1 }, scene);
  capital.position.y = 2.45;

  const mergedTrim = Mesh.MergeMeshes([base, capital], true, true, undefined, false, false);
  if (mergedTrim) {
    mergedTrim.material = trimMat;
    mergedTrim.parent = root;
  }

  return root;
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

  const pieces: Mesh[] = [];
  for (let i = -1.2; i <= 1.2; i += 0.4) {
    const bar = MeshBuilder.CreateCylinder(`gate_bar_${i}`, {
      diameter: 0.09,
      height: 2.4,
      tessellation: 6,
    }, scene);
    bar.position.set(i, 1.2, 0);
    pieces.push(bar);
  }

  const crossbarTop = MeshBuilder.CreateBox('crossbar_top', { width: 2.6, height: 0.14, depth: 0.12 }, scene);
  crossbarTop.position.set(0, 2.1, 0);
  pieces.push(crossbarTop);

  const crossbarMid = MeshBuilder.CreateBox('crossbar_mid', { width: 2.6, height: 0.14, depth: 0.12 }, scene);
  crossbarMid.position.set(0, 1.1, 0);
  pieces.push(crossbarMid);

  const mergedGate = Mesh.MergeMeshes(pieces, true, true, undefined, false, false);
  if (mergedGate) {
    mergedGate.name = 'dungeon_gate_mesh';
    mergedGate.material = ironMat;
    mergedGate.parent = root;
    mergedGate.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  }

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

// 6. BOSS TELEGRAPHS & RANGED HAZARDS
export function createLungeTelegraphMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`lunge_telegraph_${Date.now()}_${Math.random()}`, scene);

  const pathMat = palette.get(
    scene,
    'boss_lunge_path_mat',
    new Color3(0.92, 0.15, 0.12),
    new Color3(1.0, 0.45, 0.3),
    new Color3(0.85, 0.1, 0.08)
  );
  pathMat.alpha = 0.52;

  const railMat = palette.get(
    scene,
    'boss_lunge_rail_mat',
    new Color3(1.0, 0.35, 0.15),
    new Color3(1.0, 0.85, 0.5),
    new Color3(1.0, 0.25, 0.1)
  );
  railMat.alpha = 0.88;

  // Main danger zone ground strip (width: 2.2 matches boss diameter; depth: 1.0 extends forward from root at z=0 to z=1)
  const corridor = MeshBuilder.CreateBox('lunge_corridor', {
    width: 2.2,
    height: 0.03,
    depth: 1.0,
  }, scene);
  corridor.material = pathMat;
  corridor.position.set(0, 0.035, 0.5);
  corridor.parent = root;

  // Left rail
  const railL = MeshBuilder.CreateBox('rail_l', {
    width: 0.1,
    height: 0.05,
    depth: 1.0,
  }, scene);
  railL.material = railMat;
  railL.position.set(-1.08, 0.045, 0.5);
  railL.parent = root;

  // Right rail
  const railR = MeshBuilder.CreateBox('rail_r', {
    width: 0.1,
    height: 0.05,
    depth: 1.0,
  }, scene);
  railR.material = railMat;
  railR.position.set(1.08, 0.045, 0.5);
  railR.parent = root;

  // Center dashed warning line
  for (let i = 0; i < 4; i++) {
    const dash = MeshBuilder.CreateBox(`rail_dash_${i}`, {
      width: 0.14,
      height: 0.04,
      depth: 0.12,
    }, scene);
    dash.material = railMat;
    dash.position.set(0, 0.042, 0.15 + i * 0.24);
    dash.parent = root;
  }

  // Terminal chevron arrow head pointing forward
  const arrowL = MeshBuilder.CreateBox('arrow_l', {
    width: 0.12,
    height: 0.05,
    depth: 0.45,
  }, scene);
  arrowL.material = railMat;
  arrowL.position.set(-0.35, 0.045, 0.88);
  arrowL.rotation.y = Math.PI / 4;
  arrowL.parent = root;

  const arrowR = MeshBuilder.CreateBox('arrow_r', {
    width: 0.12,
    height: 0.05,
    depth: 0.45,
  }, scene);
  arrowR.material = railMat;
  arrowR.position.set(0.35, 0.045, 0.88);
  arrowR.rotation.y = -Math.PI / 4;
  arrowR.parent = root;

  return root;
}

export function createRangedReticleMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`ranged_reticle_${Date.now()}_${Math.random()}`, scene);

  const reticleMat = palette.get(
    scene,
    'ranged_reticle_mat',
    new Color3(0.95, 0.45, 0.1),
    new Color3(1.0, 0.85, 0.4),
    new Color3(0.9, 0.35, 0.05)
  );
  reticleMat.alpha = 0.8;

  // Outer warning ring
  const ring = MeshBuilder.CreateTorus('reticle_ring', {
    diameter: 3.1,
    thickness: 0.12,
    tessellation: 32,
  }, scene);
  ring.material = reticleMat;
  ring.position.y = 0.04;
  ring.parent = root;

  // Inner pulse ring
  const innerRing = MeshBuilder.CreateTorus('reticle_inner_ring', {
    diameter: 1.4,
    thickness: 0.08,
    tessellation: 24,
  }, scene);
  innerRing.material = reticleMat;
  innerRing.position.y = 0.04;
  innerRing.parent = root;

  // Crosshair ticks
  const crossH = MeshBuilder.CreateBox('reticle_cross_h', {
    width: 2.8,
    height: 0.03,
    depth: 0.08,
  }, scene);
  crossH.material = reticleMat;
  crossH.position.y = 0.04;
  crossH.parent = root;

  const crossV = MeshBuilder.CreateBox('reticle_cross_v', {
    width: 0.08,
    height: 0.03,
    depth: 2.8,
  }, scene);
  crossV.material = reticleMat;
  crossV.position.y = 0.04;
  crossV.parent = root;

  return root;
}

export function createSporeBombProjectileMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`spore_bomb_${Date.now()}_${Math.random()}`, scene);

  const coreMat = palette.get(
    scene,
    'spore_bomb_core',
    new Color3(0.95, 0.45, 0.1),
    new Color3(1.0, 0.8, 0.3),
    new Color3(0.9, 0.35, 0.05)
  );
  const crustMat = palette.get(
    scene,
    'spore_bomb_crust',
    new Color3(0.28, 0.18, 0.1),
    new Color3(0.3, 0.2, 0.1),
    new Color3(0.15, 0.08, 0.04)
  );
  const cystMat = palette.get(
    scene,
    'spore_bomb_cysts',
    new Color3(0.65, 0.95, 0.2),
    new Color3(0.85, 1.0, 0.4),
    new Color3(0.5, 0.85, 0.15)
  );

  // Heavy volcanic spore seed
  const core = MeshBuilder.CreateSphere('bomb_core', {
    diameter: 0.52,
    segments: 16,
  }, scene);
  core.material = coreMat;
  core.parent = root;

  // Spiky crust ribs
  const spikes = [
    [0.32, 0, 0, 0, 0, -Math.PI / 2],
    [-0.32, 0, 0, 0, 0, Math.PI / 2],
    [0, 0.32, 0, 0, 0, 0],
    [0, -0.32, 0, Math.PI, 0, 0],
    [0, 0, 0.32, Math.PI / 2, 0, 0],
    [0, 0, -0.32, -Math.PI / 2, 0, 0],
    [0.22, 0.22, 0, 0, 0, -Math.PI / 4],
    [-0.22, 0.22, 0, 0, 0, Math.PI / 4],
  ];

  spikes.forEach(([px, py, pz, rx, ry, rz], idx) => {
    const spike = MeshBuilder.CreateCylinder(`bomb_spike_${idx}`, {
      diameterTop: 0.02,
      diameterBottom: 0.18,
      height: 0.32,
      tessellation: 8,
    }, scene);
    spike.material = crustMat;
    spike.position.set(px, py, pz);
    spike.rotation.set(rx, ry, rz);
    spike.parent = root;
  });

  // Glowing toxic pustules
  const pustules = [
    [0.18, 0.18, 0.18],
    [-0.18, 0.18, -0.18],
    [0.18, -0.18, -0.18],
    [-0.18, -0.18, 0.18],
  ];
  pustules.forEach(([cx, cy, cz], idx) => {
    const cyst = MeshBuilder.CreateSphere(`bomb_cyst_${idx}`, {
      diameter: 0.18,
      segments: 10,
    }, scene);
    cyst.material = cystMat;
    cyst.position.set(cx, cy, cz);
    cyst.parent = root;
  });

  return root;
}

export function createToxicPoolMesh(scene: Scene): TransformNode {
  const root = new TransformNode(`toxic_pool_${Date.now()}_${Math.random()}`, scene);

  const poolMat = palette.get(
    scene,
    'toxic_pool_disc_mat',
    new Color3(0.24, 0.58, 0.12),
    new Color3(0.5, 0.9, 0.25),
    new Color3(0.2, 0.5, 0.1)
  );
  poolMat.alpha = 0.72;

  const rimMat = palette.get(
    scene,
    'toxic_pool_rim_mat',
    new Color3(0.48, 0.78, 0.16),
    new Color3(0.7, 1.0, 0.35),
    new Color3(0.38, 0.68, 0.12)
  );
  rimMat.alpha = 0.88;

  const cystMat = palette.get(
    scene,
    'toxic_pool_cyst_mat',
    new Color3(0.65, 0.92, 0.2),
    new Color3(0.85, 1.0, 0.4),
    new Color3(0.5, 0.8, 0.15)
  );

  // Flat toxic slime pool on ground
  const disc = MeshBuilder.CreateDisc('toxic_disc', {
    radius: 1.55,
    tessellation: 28,
  }, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 0.035;
  disc.material = poolMat;
  disc.parent = root;

  // Glowing bubbling outer rim
  const rim = MeshBuilder.CreateTorus('toxic_rim', {
    diameter: 3.1,
    thickness: 0.1,
    tessellation: 32,
  }, scene);
  rim.material = rimMat;
  rim.position.y = 0.04;
  rim.parent = root;

  // Bubbling toxic cysts on pool surface
  const cystCoords = [
    [-0.55, 0.06, -0.4, 0.32],
    [0.6, 0.06, 0.35, 0.28],
    [-0.2, 0.06, 0.65, 0.38],
    [0.45, 0.06, -0.55, 0.26],
  ];

  cystCoords.forEach(([cx, cy, cz, diam], idx) => {
    const cyst = MeshBuilder.CreateSphere(`pool_cyst_${idx}`, {
      diameter: diam,
      segments: 10,
    }, scene);
    cyst.scaling.y = 0.45;
    cyst.material = cystMat;
    cyst.position.set(cx, cy, cz);
    cyst.parent = root;
  });

  return root;
}
