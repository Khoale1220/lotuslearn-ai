import * as THREE from "three";

const CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE =
  Object.freeze({
    version: 41,
    visualOnly: true,
    deterministic: true,
    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,
    secondAnimationLoopCount: 0,
    addedLights: 0,
    addedShadowMaps: 0,
    accentSpriteCount: 4,
    accentTextureSize: 16,
    palette: Object.freeze({
      deepPlum: 0x3f223f,
      cyan: 0x37c4ca,
      warmOrange: 0xff8b4c,
      cream: 0xffe0a2
    })
  });

const ACCENT_BLUEPRINTS = Object.freeze([
  Object.freeze({
    id: "paper-edge",
    u: -0.78,
    v: -0.54,
    depth: 4.15,
    width: 0.34,
    height: 0.22,
    phase: 0.35,
    speed: 0.72,
    bob: 0.028,
    sway: 0.045,
    scalePulse: 0.018,
    pattern: "paper"
  }),
  Object.freeze({
    id: "window-ribbon",
    u: 0.82,
    v: 0.34,
    depth: 4.8,
    width: 0.22,
    height: 0.54,
    phase: 1.3,
    speed: 0.56,
    bob: 0.032,
    sway: 0.055,
    scalePulse: 0.022,
    pattern: "ribbon"
  }),
  Object.freeze({
    id: "leaf-flicker",
    u: 0.72,
    v: -0.22,
    depth: 5.35,
    width: 0.28,
    height: 0.36,
    phase: 2.15,
    speed: 0.63,
    bob: 0.025,
    sway: 0.07,
    scalePulse: 0.025,
    pattern: "leaf"
  }),
  Object.freeze({
    id: "chalk-note",
    u: -0.62,
    v: 0.58,
    depth: 5.65,
    width: 0.20,
    height: 0.20,
    phase: 3.05,
    speed: 0.48,
    bob: 0.018,
    sway: 0.03,
    scalePulse: 0.015,
    pattern: "chalk"
  })
]);

function disableRaycast(object) {
  object.raycast =
    function noV41Raycast() {};
}

function writePixel(
  data,
  size,
  x,
  y,
  color,
  alpha = 255
) {
  if (
    x < 0 ||
    y < 0 ||
    x >= size ||
    y >= size
  ) {
    return;
  }

  const index =
    (y * size + x) * 4;

  data[index] =
    (color >> 16) & 0xff;

  data[index + 1] =
    (color >> 8) & 0xff;

  data[index + 2] =
    color & 0xff;

  data[index + 3] =
    alpha;
}

function fillRect(
  data,
  size,
  x,
  y,
  width,
  height,
  color,
  alpha = 255
) {
  for (
    let row = y;
    row < y + height;
    row += 1
  ) {
    for (
      let column = x;
      column < x + width;
      column += 1
    ) {
      writePixel(
        data,
        size,
        column,
        row,
        color,
        alpha
      );
    }
  }
}

function createAccentTexture(
  pattern
) {
  const size =
    CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
      .accentTextureSize;

  const palette =
    CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
      .palette;

  const data =
    new Uint8Array(
      size *
      size *
      4
    );

  if (pattern === "paper") {
    fillRect(
      data,
      size,
      2,
      4,
      12,
      8,
      palette.deepPlum,
      230
    );

    fillRect(
      data,
      size,
      3,
      3,
      10,
      8,
      palette.cream,
      255
    );

    fillRect(
      data,
      size,
      4,
      5,
      7,
      1,
      palette.warmOrange,
      255
    );

    fillRect(
      data,
      size,
      4,
      8,
      5,
      1,
      palette.cyan,
      255
    );
  } else if (
    pattern ===
    "ribbon"
  ) {
    fillRect(
      data,
      size,
      6,
      1,
      4,
      13,
      palette.deepPlum,
      255
    );

    fillRect(
      data,
      size,
      7,
      1,
      2,
      12,
      palette.warmOrange,
      255
    );

    fillRect(
      data,
      size,
      8,
      3,
      1,
      7,
      palette.cream,
      255
    );
  } else if (
    pattern ===
    "leaf"
  ) {
    fillRect(
      data,
      size,
      6,
      2,
      4,
      12,
      palette.deepPlum,
      230
    );

    fillRect(
      data,
      size,
      4,
      5,
      8,
      5,
      palette.cyan,
      255
    );

    fillRect(
      data,
      size,
      6,
      3,
      4,
      9,
      palette.cyan,
      255
    );

    fillRect(
      data,
      size,
      7,
      5,
      2,
      6,
      palette.cream,
      210
    );
  } else {
    const points = [
      [4, 4],
      [7, 3],
      [10, 5],
      [5, 8],
      [9, 9],
      [7, 12]
    ];

    for (
      let index = 0;
      index < points.length;
      index += 1
    ) {
      const [
        x,
        y
      ] =
        points[index];

      writePixel(
        data,
        size,
        x,
        y,
        index % 2 === 0
          ? palette.cream
          : palette.cyan,
        255
      );

      writePixel(
        data,
        size,
        x + 1,
        y,
        palette.warmOrange,
        210
      );
    }
  }

  const texture =
    new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

  texture.name =
    `cw06-v41-${pattern}-texture`;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.anisotropy =
    1;

  texture.needsUpdate =
    true;

  return texture;
}

function normalizeDescriptor(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function shouldPolishSprite(
  sprite
) {
  if (
    !sprite ||
    sprite.isSprite !== true ||
    !sprite.material ||
    !sprite.material.map
  ) {
    return false;
  }

  const userData =
    sprite.userData ?? {};

  if (
    userData.cw06CharacterSpriteV9 === true ||
    userData.cw06CharacterVisualV10 === true ||
    userData.cw06SeagullV18 === true ||
    userData.cw06CargoShipV17 === true
  ) {
    return true;
  }

  const descriptor =
    [
      sprite.name,
      userData.role,
      userData.kind,
      userData.type,
      userData.visualRole,
      userData.characterRole,
      userData.raycastRole
    ]
      .map(normalizeDescriptor)
      .join(" ");

  return (
    descriptor.includes(
      "character"
    ) ||
    descriptor.includes(
      "student"
    ) ||
    descriptor.includes(
      "seagull"
    ) ||
    descriptor.includes(
      "cargo"
    )
  );
}

function captureSpriteFidelityState(
  sprite
) {
  const material =
    sprite.material;

  const texture =
    material.map;

  return {
    sprite,
    material,
    texture,
    magFilter:
      texture.magFilter,
    minFilter:
      texture.minFilter,
    generateMipmaps:
      texture.generateMipmaps,
    colorSpace:
      texture.colorSpace,
    anisotropy:
      texture.anisotropy,
    alphaTest:
      material.alphaTest
  };
}

function applySpriteFidelityState(
  state
) {
  const {
    material,
    texture
  } =
    state;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.anisotropy =
    1;

  texture.needsUpdate =
    true;

  material.alphaTest =
    Math.max(
      Number.isFinite(
        material.alphaTest
      )
        ? material.alphaTest
        : 0,
      0.35
    );

  material.needsUpdate =
    true;
}

function restoreSpriteFidelityState(
  state
) {
  const {
    material,
    texture
  } =
    state;

  texture.magFilter =
    state.magFilter;

  texture.minFilter =
    state.minFilter;

  texture.generateMipmaps =
    state.generateMipmaps;

  texture.colorSpace =
    state.colorSpace;

  texture.anisotropy =
    state.anisotropy;

  texture.needsUpdate =
    true;

  material.alphaTest =
    state.alphaTest;

  material.needsUpdate =
    true;
}

function resolveCameraBasis(
  camera
) {
  const forward =
    new THREE.Vector3(
      0,
      0,
      -1
    );

  camera.getWorldDirection(
    forward
  );

  forward.y =
    0;

  if (
    forward.lengthSq() <
    1e-8
  ) {
    forward.set(
      0,
      0,
      -1
    );
  }

  forward.normalize();

  const up =
    new THREE.Vector3(
      0,
      1,
      0
    );

  const right =
    new THREE.Vector3()
      .crossVectors(
        forward,
        up
      )
      .normalize();

  return {
    forward,
    right,
    up
  };
}

function createClassroomEnvironmentalSpriteFidelityV41({
  scene,
  camera
}) {
  if (
    !scene ||
    typeof scene.add !==
      "function" ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V41 requires a Three.js scene"
    );
  }

  if (
    !camera ||
    !camera.position ||
    typeof camera.getWorldDirection !==
      "function"
  ) {
    throw new TypeError(
      "V41 requires a Three.js camera"
    );
  }

  const polishedStates =
    [];

  scene.traverse(
    (object) => {
      if (
        shouldPolishSprite(
          object
        )
      ) {
        const state =
          captureSpriteFidelityState(
            object
          );

        polishedStates.push(
          state
        );

        applySpriteFidelityState(
          state
        );
      }
    }
  );

  const root =
    new THREE.Group();

  root.name =
    "cw06-v41-environmental-sprite-fidelity";

  root.userData = {
    ...root.userData,
    cw06EnvironmentalSpriteFidelityV41: true,
    visualOnly: true,
    interactionExcluded: true
  };

  const {
    forward,
    right,
    up
  } =
    resolveCameraBasis(
      camera
    );

  const cameraOrigin =
    camera.position.clone();

  const accents =
    [];

  for (
    const blueprint
    of ACCENT_BLUEPRINTS
  ) {
    const texture =
      createAccentTexture(
        blueprint.pattern
      );

    const material =
      new THREE.SpriteMaterial({
        map:
          texture,
        color:
          0xffffff,
        transparent:
          false,
        alphaTest:
          0.45,
        depthTest:
          true,
        depthWrite:
          false,
        toneMapped:
          false,
        fog:
          true
      });

    material.name =
      `cw06-v41-${blueprint.id}-material`;

    const sprite =
      new THREE.Sprite(
        material
      );

    sprite.name =
      `cw06-v41-${blueprint.id}`;

    sprite.userData = {
      ...sprite.userData,
      cw06EnvironmentalSpriteFidelityV41: true,
      visualOnly: true,
      interactionExcluded: true,
      accentId:
        blueprint.id
    };

    disableRaycast(
      sprite
    );

    const horizontalOffset =
      blueprint.u *
      blueprint.depth *
      0.72;

    const verticalOffset =
      blueprint.v *
      1.28;

    const basePosition =
      cameraOrigin
        .clone()
        .addScaledVector(
          forward,
          blueprint.depth
        )
        .addScaledVector(
          right,
          horizontalOffset
        )
        .addScaledVector(
          up,
          verticalOffset
        );

    sprite.position.copy(
      basePosition
    );

    sprite.scale.set(
      blueprint.width,
      blueprint.height,
      1
    );

    sprite.renderOrder =
      0;

    root.add(
      sprite
    );

    accents.push({
      blueprint,
      sprite,
      texture,
      material,
      basePosition,
      baseScale:
        sprite.scale.clone()
    });
  }

  scene.add(
    root
  );

  let disposed =
    false;

  function tick({
    timestamp = 0
  } = {}) {
    if (disposed) {
      return;
    }

    const seconds =
      Math.max(
        0,
        Number.isFinite(
          timestamp
        )
          ? timestamp / 1000
          : 0
      );

    for (
      const accent
      of accents
    ) {
      const {
        blueprint,
        sprite,
        basePosition,
        baseScale
      } =
        accent;

      const phase =
        seconds *
          blueprint.speed *
          Math.PI *
          2 +
        blueprint.phase;

      const secondary =
        phase *
          0.57 +
        blueprint.phase *
          1.73;

      sprite.position.copy(
        basePosition
      );

      sprite.position.y +=
        Math.sin(
          phase
        ) *
        blueprint.bob;

      sprite.position.addScaledVector(
        right,
        Math.sin(
          secondary
        ) *
          blueprint.sway
      );

      sprite.material.rotation =
        Math.sin(
          phase * 0.71
        ) *
        0.045;

      const pulse =
        1 +
        Math.sin(
          phase * 0.83
        ) *
          blueprint.scalePulse;

      sprite.scale.set(
        baseScale.x *
          pulse,
        baseScale.y *
          (
            2 -
            pulse
          ),
        1
      );
    }
  }

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
          .version,
      polishedSpriteCount:
        polishedStates.length,
      accentSpriteCount:
        accents.length,
      runtimeSceneTraversalCount:
        0,
      addedLights:
        0,
      addedShadowMaps:
        0,
      disposed,
      accents:
        Object.freeze(
          accents.map(
            (accent) =>
              Object.freeze({
                id:
                  accent.blueprint.id,
                x:
                  accent.sprite
                    .position.x,
                y:
                  accent.sprite
                    .position.y,
                z:
                  accent.sprite
                    .position.z,
                rotation:
                  accent.material
                    .rotation
              })
          )
        )
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    for (
      const state
      of polishedStates
    ) {
      restoreSpriteFidelityState(
        state
      );
    }

    for (
      const accent
      of accents
    ) {
      root.remove(
        accent.sprite
      );

      accent.material.dispose();
      accent.texture.dispose();
    }

    scene.remove(
      root
    );
  }

  tick({
    timestamp: 0
  });

  return {
    tick,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE,
  createClassroomEnvironmentalSpriteFidelityV41
};
