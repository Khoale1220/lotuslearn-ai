import * as THREE from "three";

const CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE = Object.freeze({
  id: "cw06-foreground-composition-v39",
  artDirection: "high-detail-1990s-vga-cinematic-foreground",
  strategy: "construction-time-camera-seeded-world-space-cutout-geometry",
  textureSize: 128,
  alphaTest: 0.5,
  cardCount: 4,
  addedMeshes: 4,
  addedGeometries: 1,
  addedMaterials: 4,
  addedTextures: 4,
  addedDrawCalls: 4,
  addedLights: 0,
  addedShadowMaps: 0,
  constructionCameraReads: true,
  cameraMutation: false,
  runtimeSceneTraversal: false,
  runtimeTickRequired: false,
  runtimeTexturePainting: false,
  interactionAuthorityMutations: 0,
  collisionAuthorityMutations: 0,
  locomotionAuthorityMutations: 0,
  lightingAuthorityMutations: 0
});

const V39_PALETTE = Object.freeze({
  ink: Object.freeze([20, 17, 29, 255]),
  plumDeep: Object.freeze([46, 29, 54, 255]),
  plum: Object.freeze([76, 44, 73, 255]),
  cyanDeep: Object.freeze([37, 88, 111, 255]),
  cyan: Object.freeze([55, 145, 170, 255]),
  cream: Object.freeze([232, 207, 170, 255]),
  orange: Object.freeze([226, 126, 64, 255]),
  orangeLight: Object.freeze([247, 178, 94, 255])
});

const CARD_DEFINITIONS_V39 = Object.freeze([
  Object.freeze({
    id: "left-shelf",
    role: "left-shelf",
    width: 2.35,
    height: 3.05,
    forwardDistance: 3.45,
    sideOffset: -3.55,
    centerY: 1.53
  }),
  Object.freeze({
    id: "right-plant",
    role: "right-plant",
    width: 2.2,
    height: 2.8,
    forwardDistance: 3.25,
    sideOffset: 3.5,
    centerY: 1.4
  }),
  Object.freeze({
    id: "low-desk-edge",
    role: "low-desk-edge",
    width: 3.55,
    height: 1.0,
    forwardDistance: 2.85,
    sideOffset: -0.95,
    centerY: 0.5
  }),
  Object.freeze({
    id: "right-chair-stack",
    role: "right-chair-stack",
    width: 1.65,
    height: 1.9,
    forwardDistance: 3.85,
    sideOffset: 2.55,
    centerY: 0.95
  })
]);

function setPixelV39(data, size, x, y, color) {
  const px = Math.floor(x);
  const py = Math.floor(y);

  if (px < 0 || py < 0 || px >= size || py >= size) {
    return;
  }

  const offset = (py * size + px) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
}

function fillRectV39({ data, size, x, y, width, height, color }) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(size, Math.ceil(x + width));
  const bottom = Math.min(size, Math.ceil(y + height));

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      setPixelV39(data, size, px, py, color);
    }
  }
}

function drawPixelLineV39({ data, size, x0, y0, x1, y1, thickness = 2, color }) {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))
  );

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;

    fillRectV39({
      data,
      size,
      x: x - thickness / 2,
      y: y - thickness / 2,
      width: thickness,
      height: thickness,
      color
    });
  }
}

function drawLeftShelfV39(data, size) {
  const p = V39_PALETTE;

  fillRectV39({ data, size, x: 5, y: 15, width: 54, height: 110, color: p.ink });
  fillRectV39({ data, size, x: 12, y: 22, width: 39, height: 95, color: p.plumDeep });

  for (const y of [35, 59, 83, 107]) {
    fillRectV39({ data, size, x: 8, y, width: 48, height: 4, color: p.ink });
  }

  const bookRows = [
    [17, 41, 8, 14, p.orange],
    [27, 39, 6, 16, p.cream],
    [36, 43, 10, 12, p.cyan],
    [15, 65, 10, 14, p.cyanDeep],
    [28, 63, 8, 16, p.orangeLight],
    [39, 68, 7, 11, p.cream],
    [17, 89, 7, 14, p.plum],
    [27, 87, 11, 16, p.cyan],
    [41, 92, 6, 11, p.orange]
  ];

  for (const [x, y, width, height, color] of bookRows) {
    fillRectV39({ data, size, x, y, width, height, color });
  }

  fillRectV39({ data, size, x: 51, y: 94, width: 27, height: 8, color: p.ink });
  fillRectV39({ data, size, x: 55, y: 101, width: 18, height: 19, color: p.plumDeep });

  for (const [x, y, width, height] of [
    [48, 74, 24, 16],
    [57, 61, 24, 18],
    [69, 72, 18, 16],
    [61, 49, 17, 15]
  ]) {
    fillRectV39({ data, size, x, y, width, height, color: p.ink });
    fillRectV39({ data, size, x: x + 4, y: y + 3, width: 7, height: 3, color: p.cyanDeep });
  }
}

function drawRightPlantV39(data, size) {
  const p = V39_PALETTE;

  fillRectV39({ data, size, x: 53, y: 90, width: 37, height: 32, color: p.ink });
  fillRectV39({ data, size, x: 58, y: 96, width: 27, height: 20, color: p.plumDeep });
  fillRectV39({ data, size, x: 64, y: 88, width: 4, height: 18, color: p.orange });

  const leaves = [
    [29, 28, 38, 18],
    [52, 19, 36, 20],
    [72, 34, 36, 18],
    [38, 46, 40, 20],
    [65, 53, 35, 20],
    [48, 66, 34, 18]
  ];

  for (let index = 0; index < leaves.length; index += 1) {
    const [x, y, width, height] = leaves[index];
    fillRectV39({
      data,
      size,
      x,
      y,
      width,
      height,
      color: index % 2 === 0 ? p.ink : p.plumDeep
    });
    fillRectV39({
      data,
      size,
      x: x + 5,
      y: y + 4,
      width: Math.max(5, Math.floor(width * 0.3)),
      height: 3,
      color: p.cyanDeep
    });
  }

  drawPixelLineV39({ data, size, x0: 67, y0: 91, x1: 52, y1: 45, thickness: 4, color: p.ink });
  drawPixelLineV39({ data, size, x0: 68, y0: 91, x1: 82, y1: 50, thickness: 4, color: p.ink });
}

function drawLowDeskEdgeV39(data, size) {
  const p = V39_PALETTE;

  fillRectV39({ data, size, x: 0, y: 79, width: 128, height: 42, color: p.ink });
  fillRectV39({ data, size, x: 0, y: 79, width: 128, height: 5, color: p.orange });
  fillRectV39({ data, size, x: 9, y: 87, width: 110, height: 24, color: p.plumDeep });
  fillRectV39({ data, size, x: 17, y: 84, width: 29, height: 7, color: p.cream });
  fillRectV39({ data, size, x: 49, y: 82, width: 23, height: 9, color: p.cyan });
  fillRectV39({ data, size, x: 76, y: 85, width: 18, height: 6, color: p.orangeLight });

  for (let x = 10; x < 120; x += 17) {
    fillRectV39({ data, size, x, y: 112, width: 8, height: 5, color: p.cyanDeep });
  }
}

function drawRightChairStackV39(data, size) {
  const p = V39_PALETTE;

  fillRectV39({ data, size, x: 34, y: 39, width: 58, height: 24, color: p.ink });
  fillRectV39({ data, size, x: 40, y: 44, width: 46, height: 14, color: p.plumDeep });
  fillRectV39({ data, size, x: 27, y: 68, width: 70, height: 17, color: p.ink });
  fillRectV39({ data, size, x: 34, y: 71, width: 56, height: 10, color: p.cyanDeep });

  drawPixelLineV39({ data, size, x0: 37, y0: 82, x1: 28, y1: 121, thickness: 5, color: p.ink });
  drawPixelLineV39({ data, size, x0: 86, y0: 82, x1: 99, y1: 121, thickness: 5, color: p.ink });

  fillRectV39({ data, size, x: 75, y: 21, width: 31, height: 24, color: p.ink });
  fillRectV39({ data, size, x: 80, y: 26, width: 21, height: 13, color: p.plum });
  fillRectV39({ data, size, x: 84, y: 28, width: 9, height: 3, color: p.orange });
}

function createForegroundTextureV39(role) {
  const size = CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE.textureSize;
  const data = new Uint8Array(size * size * 4);

  if (role === "left-shelf") {
    drawLeftShelfV39(data, size);
  } else if (role === "right-plant") {
    drawRightPlantV39(data, size);
  } else if (role === "low-desk-edge") {
    drawLowDeskEdgeV39(data, size);
  } else if (role === "right-chair-stack") {
    drawRightChairStackV39(data, size);
  } else {
    throw new Error(`unknown V39 role: ${role}`);
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  texture.name = `cw06-v39-${role}-texture`;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;

  return texture;
}

function computeForegroundFrameV39(camera) {
  if (!camera || camera.isCamera !== true) {
    throw new TypeError("V39 requires THREE.Camera");
  }

  camera.updateMatrixWorld(true);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;

  if (forward.lengthSq() < 1e-8) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }

  const right = new THREE.Vector3().crossVectors(forward, camera.up);
  right.y = 0;

  if (right.lengthSq() < 1e-8) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }

  return Object.freeze({
    origin: Object.freeze({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    }),
    forward: Object.freeze({ x: forward.x, y: 0, z: forward.z }),
    right: Object.freeze({ x: right.x, y: 0, z: right.z })
  });
}

function computeCardPoseV39({ frame, definition }) {
  const x =
    frame.origin.x +
    frame.forward.x * definition.forwardDistance +
    frame.right.x * definition.sideOffset;

  const z =
    frame.origin.z +
    frame.forward.z * definition.forwardDistance +
    frame.right.z * definition.sideOffset;

  const rotationY = Math.atan2(
    frame.origin.x - x,
    frame.origin.z - z
  );

  return Object.freeze({
    x,
    y: definition.centerY,
    z,
    rotationY
  });
}

function disableForegroundRaycastV39() {}

function createClassroomForegroundCompositionV39({ scene, camera }) {
  if (!scene || scene.isScene !== true) {
    throw new TypeError("V39 requires THREE.Scene");
  }

  if (!camera || camera.isCamera !== true) {
    throw new TypeError("V39 requires THREE.Camera");
  }

  const profile = CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE;
  const frame = computeForegroundFrameV39(camera);

  const root = new THREE.Group();
  root.name = "cw06-v39-foreground-composition";
  root.userData = {
    cw06ForegroundCompositionV39: true,
    visualOnly: true,
    interactionExcluded: true,
    collisionExcluded: true
  };

  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.name = "cw06-v39-shared-cutout-plane";

  const textures = [];
  const materials = [];
  const cards = [];

  for (const definition of CARD_DEFINITIONS_V39) {
    const texture = createForegroundTextureV39(definition.role);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: false,
      alphaTest: profile.alphaTest,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
      fog: false
    });

    material.name = `cw06-v39-${definition.id}-material`;

    const mesh = new THREE.Mesh(geometry, material);
    const pose = computeCardPoseV39({ frame, definition });

    mesh.name = `cw06-v39-${definition.id}`;
    mesh.position.set(pose.x, pose.y, pose.z);
    mesh.rotation.y = pose.rotationY;
    mesh.scale.set(definition.width, definition.height, 1);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 0;
    mesh.raycast = disableForegroundRaycastV39;
    mesh.userData = {
      cw06ForegroundCompositionV39: true,
      visualOnly: true,
      interactionExcluded: true,
      collisionExcluded: true,
      role: definition.role,
      forwardDistance: definition.forwardDistance,
      sideOffset: definition.sideOffset
    };

    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;

    root.add(mesh);
    textures.push(texture);
    materials.push(material);
    cards.push(mesh);
  }

  root.updateMatrix();
  root.matrixAutoUpdate = false;
  scene.add(root);

  let disposed = false;

  function getSnapshot() {
    return Object.freeze({
      id: profile.id,
      cardCount: cards.length,
      cardNames: Object.freeze(cards.map((card) => card.name)),
      visualOnly: cards.every((card) => card.userData.visualOnly === true),
      interactionExcluded: cards.every(
        (card) => card.userData.interactionExcluded === true
      ),
      collisionExcluded: cards.every(
        (card) => card.userData.collisionExcluded === true
      ),
      raycastDisabled: cards.every(
        (card) => card.raycast === disableForegroundRaycastV39
      ),
      depthTest: materials.every((material) => material.depthTest === true),
      depthWrite: materials.every((material) => material.depthWrite === true),
      opaqueCutout: materials.every(
        (material) =>
          material.transparent === false &&
          material.alphaTest === profile.alphaTest
      ),
      toneMappingExcluded: materials.every(
        (material) => material.toneMapped === false
      ),
      nearestFiltering: textures.every(
        (texture) =>
          texture.magFilter === THREE.NearestFilter &&
          texture.minFilter === THREE.NearestFilter
      ),
      mipmapsDisabled: textures.every(
        (texture) => texture.generateMipmaps === false
      ),
      srgbColorSpace: textures.every(
        (texture) => texture.colorSpace === THREE.SRGBColorSpace
      ),
      staticMatrices: cards.every((card) => card.matrixAutoUpdate === false),
      cameraSeedOrigin: frame.origin,
      addedMeshes: profile.addedMeshes,
      addedGeometries: profile.addedGeometries,
      addedMaterials: profile.addedMaterials,
      addedTextures: profile.addedTextures,
      addedDrawCalls: profile.addedDrawCalls,
      addedLights: profile.addedLights,
      addedShadowMaps: profile.addedShadowMaps,
      runtimeSceneTraversal: profile.runtimeSceneTraversal,
      runtimeTickRequired: profile.runtimeTickRequired,
      runtimeTexturePainting: profile.runtimeTexturePainting,
      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    scene.remove(root);
    root.clear();
    geometry.dispose();

    for (const material of materials) {
      material.dispose();
    }

    for (const texture of textures) {
      texture.dispose();
    }
  }

  return Object.freeze({ root, getSnapshot, dispose });
}

export {
  CARD_DEFINITIONS_V39,
  CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE,
  computeCardPoseV39,
  computeForegroundFrameV39,
  createClassroomForegroundCompositionV39,
  createForegroundTextureV39
};
