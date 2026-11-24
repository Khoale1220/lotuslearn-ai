import * as THREE from "three";

const CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE = Object.freeze({
  version: 40,
  visualLayer: 30,
  textureSize: 8,
  warmDustCount: 18,
  cyanGlintCount: 6,
  orangeGlintCount: 5,
  depthNear: 2.25,
  depthFar: 6.75,
  horizontalSpread: 5.2,
  verticalMin: 0.55,
  verticalMax: 3.05,
  driftAmplitude: 0.085,
  liftAmplitude: 0.12,
  driftSpeed: 0.00034,
  liftSpeed: 0.00047,
  alphaTest: 0.5
});

const UP = Object.freeze({
  x: 0,
  y: 1,
  z: 0
});

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function hash01(index, salt) {
  const value =
    Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453123;

  return fract(value);
}

function disableRaycast(object) {
  object.raycast = function noAmbientPixelPolishRaycast() {};
}

function createPixelCrossTexture({
  color,
  accent,
  textureSize = CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.textureSize
}) {
  const size = Math.max(4, Math.floor(textureSize));
  const data = new Uint8Array(size * size * 4);

  const primary = new THREE.Color(color);
  const secondary = new THREE.Color(accent);

  const writePixel = (x, y, source, alpha = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }

    const offset = (y * size + x) * 4;

    data[offset] = Math.round(clamp01(source.r) * 255);
    data[offset + 1] = Math.round(clamp01(source.g) * 255);
    data[offset + 2] = Math.round(clamp01(source.b) * 255);
    data[offset + 3] = alpha;
  };

  const center = Math.floor(size / 2);

  writePixel(center, center, primary);
  writePixel(center - 1, center, primary);
  writePixel(center + 1, center, primary);
  writePixel(center, center - 1, primary);
  writePixel(center, center + 1, primary);

  writePixel(center - 1, center - 1, secondary);
  writePixel(center + 1, center + 1, secondary);

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  texture.name = "classroom-v40-pixel-cross";
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;

  return texture;
}

function createCameraSeedFrame(camera) {
  if (!camera?.isCamera) {
    throw new TypeError("V40 requires a Three.js camera");
  }

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;

  if (forward.lengthSq() < 1e-8) {
    forward.set(0, 0, -1);
  }

  forward.normalize();

  const right = new THREE.Vector3(
    forward.z,
    0,
    -forward.x
  ).normalize();

  const origin = camera.position.clone();

  return Object.freeze({
    origin: Object.freeze({
      x: origin.x,
      y: origin.y,
      z: origin.z
    }),
    forward: Object.freeze({
      x: forward.x,
      y: forward.y,
      z: forward.z
    }),
    right: Object.freeze({
      x: right.x,
      y: right.y,
      z: right.z
    })
  });
}

function computeAmbientPointBaseV40({
  index,
  count,
  seedFrame,
  lane = 0
}) {
  const profile = CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE;
  const safeCount = Math.max(1, count);

  const depthT =
    (index + 0.5) / safeCount;

  const depth =
    THREE.MathUtils.lerp(
      profile.depthNear,
      profile.depthFar,
      depthT
    ) +
    (hash01(index, 17 + lane) - 0.5) * 0.65;

  const horizontal =
    (hash01(index, 29 + lane) - 0.5) *
    profile.horizontalSpread;

  const vertical =
    THREE.MathUtils.lerp(
      profile.verticalMin,
      profile.verticalMax,
      hash01(index, 43 + lane)
    );

  const origin = seedFrame.origin;
  const forward = seedFrame.forward;
  const right = seedFrame.right;

  return Object.freeze({
    x:
      origin.x +
      forward.x * depth +
      right.x * horizontal,
    y: vertical,
    z:
      origin.z +
      forward.z * depth +
      right.z * horizontal,
    phase:
      hash01(index, 59 + lane) *
      Math.PI *
      2,
    driftPhase:
      hash01(index, 71 + lane) *
      Math.PI *
      2
  });
}

function computeAmbientPointStateV40({
  base,
  timestamp = 0,
  lane = 0
}) {
  const profile = CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE;
  const time = Number.isFinite(timestamp) ? timestamp : 0;

  const drift =
    Math.sin(
      time *
        profile.driftSpeed *
        (1 + lane * 0.08) +
        base.driftPhase
    ) *
    profile.driftAmplitude;

  const lift =
    Math.sin(
      time *
        profile.liftSpeed *
        (1 + lane * 0.06) +
        base.phase
    ) *
    profile.liftAmplitude;

  return Object.freeze({
    x: base.x + drift,
    y: base.y + lift,
    z: base.z
  });
}

function createPointField({
  name,
  count,
  lane,
  seedFrame,
  texture,
  color,
  size
}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const bases = [];

  for (let index = 0; index < count; index += 1) {
    const base = computeAmbientPointBaseV40({
      index,
      count,
      seedFrame,
      lane
    });

    bases.push(base);

    const offset = index * 3;
    positions[offset] = base.x;
    positions[offset + 1] = base.y;
    positions[offset + 2] = base.z;
  }

  const positionAttribute =
    new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(
    THREE.DynamicDrawUsage
  );

  geometry.setAttribute(
    "position",
    positionAttribute
  );

  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    color,
    map: texture,
    size,
    sizeAttenuation: true,
    alphaTest:
      CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.alphaTest,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    fog: true
  });

  material.name =
    `${name}-material`;

  const points =
    new THREE.Points(
      geometry,
      material
    );

  points.name = name;
  points.renderOrder = 0;
  points.frustumCulled = true;
  points.layers.set(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.visualLayer
  );
  points.userData = {
    visualOnly: true,
    ambientPixelPolishV40: true,
    lane,
    pointCount: count
  };

  disableRaycast(points);

  return {
    points,
    geometry,
    material,
    texture,
    bases,
    positionAttribute
  };
}

function createClassroomAmbientPixelPolishV40({
  scene,
  camera
}) {
  if (!scene?.isScene) {
    throw new TypeError("V40 requires a Three.js scene");
  }

  if (!camera?.isCamera) {
    throw new TypeError("V40 requires a Three.js camera");
  }

  const profile =
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE;

  const seedFrame =
    createCameraSeedFrame(camera);

  const root =
    new THREE.Group();

  root.name =
    "classroom-ambient-pixel-polish-v40";

  root.userData = {
    visualOnly: true,
    ambientPixelPolishV40: true,
    constructionOnlySceneDiscovery: true,
    runtimeSceneTraversal: false
  };

  root.layers.set(profile.visualLayer);

  const warmTexture =
    createPixelCrossTexture({
      color: 0xffd9a0,
      accent: 0xff8a4c
    });

  const cyanTexture =
    createPixelCrossTexture({
      color: 0x7fd7df,
      accent: 0xd2fbff
    });

  const orangeTexture =
    createPixelCrossTexture({
      color: 0xff9b57,
      accent: 0xffe0af
    });

  const fields = [
    createPointField({
      name: "classroom-v40-warm-dust",
      count: profile.warmDustCount,
      lane: 0,
      seedFrame,
      texture: warmTexture,
      color: 0xffffff,
      size: 0.075
    }),
    createPointField({
      name: "classroom-v40-cyan-glints",
      count: profile.cyanGlintCount,
      lane: 1,
      seedFrame,
      texture: cyanTexture,
      color: 0xffffff,
      size: 0.055
    }),
    createPointField({
      name: "classroom-v40-orange-glints",
      count: profile.orangeGlintCount,
      lane: 2,
      seedFrame,
      texture: orangeTexture,
      color: 0xffffff,
      size: 0.06
    })
  ];

  for (const field of fields) {
    root.add(field.points);
  }

  scene.add(root);

  root.updateMatrix();
  root.matrixAutoUpdate = false;

  let disposed = false;
  let tickCount = 0;

  function tick({ timestamp = 0 } = {}) {
    if (disposed) {
      return;
    }

    tickCount += 1;

    for (
      let fieldIndex = 0;
      fieldIndex < fields.length;
      fieldIndex += 1
    ) {
      const field = fields[fieldIndex];
      const array =
        field.positionAttribute.array;

      for (
        let index = 0;
        index < field.bases.length;
        index += 1
      ) {
        const state =
          computeAmbientPointStateV40({
            base: field.bases[index],
            timestamp,
            lane: fieldIndex
          });

        const offset = index * 3;
        array[offset] = state.x;
        array[offset + 1] = state.y;
        array[offset + 2] = state.z;
      }

      field.positionAttribute.needsUpdate = true;
    }
  }

  function getSnapshot() {
    return Object.freeze({
      version: profile.version,
      visualLayer: profile.visualLayer,
      fieldCount: fields.length,
      drawCallCount: fields.length,
      warmDustCount: profile.warmDustCount,
      cyanGlintCount: profile.cyanGlintCount,
      orangeGlintCount: profile.orangeGlintCount,
      totalPointCount:
        profile.warmDustCount +
        profile.cyanGlintCount +
        profile.orangeGlintCount,
      textureCount: 3,
      runtimeSceneTraversal: false,
      cameraSeededConstruction: true,
      cameraMutation: false,
      raycastAuthority: false,
      collisionAuthority: false,
      lightingAuthority: false,
      tickCount,
      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    if (root.parent) {
      root.parent.remove(root);
    }

    const disposedTextures = new Set();

    for (const field of fields) {
      field.geometry.dispose();
      field.material.dispose();

      if (!disposedTextures.has(field.texture)) {
        field.texture.dispose();
        disposedTextures.add(field.texture);
      }
    }
  }

  return {
    root,
    tick,
    dispose,
    getSnapshot
  };
}

export {
  CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE,
  computeAmbientPointBaseV40,
  computeAmbientPointStateV40,
  createCameraSeedFrame,
  createClassroomAmbientPixelPolishV40,
  createPixelCrossTexture
};
