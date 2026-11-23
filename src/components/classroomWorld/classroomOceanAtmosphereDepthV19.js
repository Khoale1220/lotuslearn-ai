import * as THREE from "three";

const TAU =
  Math.PI * 2;

const CLASSROOM_OCEAN_ATMOSPHERE_DEPTH_V19_PROFILE =
  Object.freeze({
    id: "cw06-ocean-atmosphere-depth-v19",

    hazePanelCount: 4,
    cloudCount: 9,
    whitecapCount: 36,
    horizonGlintCount: 12,

    visualOnly: true,
    deterministic: true,
    runtimeRandomness: 0,
    interactionAuthorityMutations: 0,
    globalFogMutations: 0
  });

const CLOUD_BLUEPRINTS =
  Object.freeze([
    [0.03, 19, 8.6, 0.032, 1.10],
    [0.14, 22, 9.7, 0.024, 0.82],
    [0.27, 17, 7.9, 0.041, 1.28],
    [0.39, 23, 10.4, 0.021, 0.75],
    [0.51, 20, 8.9, 0.028, 0.96],
    [0.63, 24, 11.1, 0.019, 0.68],
    [0.74, 18, 8.2, 0.036, 1.16],
    [0.86, 21, 9.3, 0.026, 0.88],
    [0.95, 23, 10.1, 0.022, 0.72]
  ]);

const WHITECAP_PHASES =
  Object.freeze([
    0.01, 0.04, 0.07, 0.10,
    0.13, 0.16, 0.19, 0.22,
    0.25, 0.28, 0.31, 0.34,
    0.37, 0.40, 0.43, 0.46,
    0.49, 0.52, 0.55, 0.58,
    0.61, 0.64, 0.67, 0.70,
    0.73, 0.76, 0.79, 0.82,
    0.85, 0.88, 0.91, 0.94,
    0.12, 0.38, 0.66, 0.93
  ]);

const GLINT_PHASES =
  Object.freeze([
    0.02,
    0.09,
    0.17,
    0.25,
    0.34,
    0.42,
    0.51,
    0.59,
    0.68,
    0.76,
    0.85,
    0.94
  ]);

function resolveOceanY(
  oceanWorld
) {
  if (
    !oceanWorld ||
    typeof oceanWorld.getSnapshot !==
      "function"
  ) {
    return -2.2;
  }

  let snapshot;

  try {
    snapshot =
      oceanWorld.getSnapshot();
  }
  catch {
    return -2.2;
  }

  if (
    !snapshot ||
    typeof snapshot !== "object"
  ) {
    return -2.2;
  }

  const values = [
    snapshot.oceanY,
    snapshot.surfaceY,
    snapshot.waterY,
    snapshot.seaLevel,
    snapshot.seaLevelY,
    snapshot.ocean?.y,
    snapshot.ocean?.surfaceY,
    snapshot.water?.y,
    snapshot.water?.surfaceY
  ];

  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return -2.2;
}

function configurePixelTexture(
  texture,
  name
) {
  texture.name = name;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy = 1;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate = true;

  return texture;
}

function createCanvasTexture(
  documentObject,
  width,
  height,
  name,
  draw
) {
  if (
    !documentObject ||
    typeof documentObject.createElement !==
      "function"
  ) {
    return null;
  }

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled =
    false;

  context.clearRect(
    0,
    0,
    width,
    height
  );

  draw(context);

  return configurePixelTexture(
    new THREE.CanvasTexture(
      canvas
    ),
    name
  );
}

function createCloudTexture(
  documentObject
) {
  return createCanvasTexture(
    documentObject,
    32,
    16,
    "cw06-v19-cloud",
    (context) => {
      context.fillStyle =
        "#788a9a";

      context.fillRect(
        5,
        9,
        22,
        3
      );

      context.fillRect(
        9,
        6,
        16,
        4
      );

      context.fillRect(
        13,
        4,
        8,
        3
      );

      context.fillStyle =
        "#b9c7cc";

      context.fillRect(
        7,
        8,
        18,
        2
      );

      context.fillRect(
        11,
        6,
        12,
        2
      );

      context.fillStyle =
        "#e0ded0";

      context.fillRect(
        12,
        5,
        8,
        2
      );

      context.fillRect(
        16,
        4,
        4,
        1
      );
    }
  );
}

function createWhitecapTexture(
  documentObject
) {
  return createCanvasTexture(
    documentObject,
    16,
    8,
    "cw06-v19-whitecap",
    (context) => {
      context.fillStyle =
        "#dbe4de";

      context.fillRect(
        2,
        4,
        5,
        1
      );

      context.fillRect(
        6,
        3,
        5,
        1
      );

      context.fillRect(
        10,
        4,
        4,
        1
      );

      context.fillStyle =
        "#91b5b8";

      context.fillRect(
        4,
        5,
        8,
        1
      );
    }
  );
}

function createGlintTexture(
  documentObject
) {
  return createCanvasTexture(
    documentObject,
    16,
    4,
    "cw06-v19-horizon-glint",
    (context) => {
      context.fillStyle =
        "#f0dca8";

      context.fillRect(
        2,
        1,
        4,
        1
      );

      context.fillRect(
        8,
        1,
        6,
        1
      );

      context.fillStyle =
        "#fff1bd";

      context.fillRect(
        5,
        0,
        4,
        1
      );
    }
  );
}

function disableRaycast(
  object
) {
  object.raycast =
    function noAtmosphereRaycast() {};
}

function createClassroomOceanAtmosphereDepthV19({
  scene,
  camera,
  oceanWorld,
  documentObject =
    typeof document !== "undefined"
      ? document
      : null
}) {
  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "V19 requires THREE.Scene"
    );
  }

  if (
    !camera ||
    !camera.isCamera
  ) {
    throw new TypeError(
      "V19 requires THREE.Camera"
    );
  }

  const oceanY =
    resolveOceanY(
      oceanWorld
    );

  const cloudTexture =
    createCloudTexture(
      documentObject
    );

  const whitecapTexture =
    createWhitecapTexture(
      documentObject
    );

  const glintTexture =
    createGlintTexture(
      documentObject
    );

  const textures = [
    cloudTexture,
    whitecapTexture,
    glintTexture
  ].filter(Boolean);

  const hazeGeometry =
    new THREE.PlaneGeometry(
      40,
      5
    );

  const hazeDefinitions = [
    [0, -25, 0],
    [0, 25, Math.PI],
    [-25, 0, Math.PI / 2],
    [25, 0, -Math.PI / 2]
  ];

  const hazePanels =
    hazeDefinitions.map(
      (
        definition,
        index
      ) => {
        const material =
          new THREE.MeshBasicMaterial({
            color:
              index % 2 === 0
                ? 0x7894a3
                : 0x6f8c9d,

            transparent: true,
            opacity: 0.105,

            depthTest: true,
            depthWrite: false,

            side:
              THREE.DoubleSide,

            /*
             * V19 intentionally owns its
             * atmospheric fade rather than
             * mutating global scene fog.
             */
            fog: false
          });

        const mesh =
          new THREE.Mesh(
            hazeGeometry,
            material
          );

        mesh.name =
          "cw06-v19-haze-" +
          index;

        mesh.position.set(
          definition[0],
          oceanY + 2.3,
          definition[1]
        );

        mesh.rotation.y =
          definition[2];

        mesh.renderOrder = 1;

        mesh.userData = {
          cw06OceanAtmosphereV19: true,
          type: "haze",
          visualOnly: true,
          interactionExcluded: true
        };

        disableRaycast(mesh);

        scene.add(mesh);

        return {
          mesh,
          material
        };
      }
    );

  const clouds =
    CLOUD_BLUEPRINTS.map(
      (
        blueprint,
        index
      ) => {
        const material =
          new THREE.SpriteMaterial({
            map:
              cloudTexture ||
              null,

            color:
              cloudTexture
                ? 0xffffff
                : 0xb2c0c5,

            transparent: true,

            opacity:
              index % 3 === 0
                ? 0.72
                : 0.58,

            alphaTest:
              cloudTexture
                ? 0.03
                : 0,

            depthTest: true,
            depthWrite: false,

            /*
             * Clouds are atmospheric
             * presentation themselves.
             */
            fog: false,

            sizeAttenuation: true
          });

        const sprite =
          new THREE.Sprite(
            material
          );

        sprite.name =
          "cw06-v19-cloud-" +
          index;

        const scale =
          blueprint[4];

        sprite.scale.set(
          7.2 * scale,
          3.2 * scale,
          1
        );

        sprite.renderOrder = 1;

        sprite.userData = {
          cw06OceanAtmosphereV19: true,
          type: "cloud",
          visualOnly: true,
          interactionExcluded: true,
          index
        };

        disableRaycast(sprite);

        scene.add(sprite);

        return {
          sprite,
          material,
          blueprint,
          index
        };
      }
    );

  const whitecaps =
    WHITECAP_PHASES.map(
      (
        phase,
        index
      ) => {
        const material =
          new THREE.SpriteMaterial({
            map:
              whitecapTexture ||
              null,

            color:
              whitecapTexture
                ? 0xffffff
                : 0xd4e1dc,

            transparent: true,
            opacity: 0.44,

            alphaTest:
              whitecapTexture
                ? 0.03
                : 0,

            depthTest: true,
            depthWrite: false,

            fog: true,
            sizeAttenuation: true
          });

        const sprite =
          new THREE.Sprite(
            material
          );

        sprite.name =
          "cw06-v19-whitecap-" +
          index;

        const size =
          0.42 +
          (index % 5) * 0.07;

        sprite.scale.set(
          size * 2.8,
          size,
          1
        );

        sprite.renderOrder = 2;

        sprite.userData = {
          cw06OceanAtmosphereV19: true,
          type: "whitecap",
          visualOnly: true,
          interactionExcluded: true,
          index
        };

        disableRaycast(sprite);

        scene.add(sprite);

        return {
          sprite,
          material,
          phase,
          index
        };
      }
    );

  const horizonGlints =
    GLINT_PHASES.map(
      (
        phase,
        index
      ) => {
        const material =
          new THREE.SpriteMaterial({
            map:
              glintTexture ||
              null,

            color:
              glintTexture
                ? 0xffffff
                : 0xf1dda5,

            transparent: true,
            opacity: 0.3,

            alphaTest:
              glintTexture
                ? 0.02
                : 0,

            depthTest: true,
            depthWrite: false,

            fog: false,
            sizeAttenuation: true
          });

        const sprite =
          new THREE.Sprite(
            material
          );

        sprite.name =
          "cw06-v19-glint-" +
          index;

        sprite.scale.set(
          1.5 +
            (index % 3) * 0.35,
          0.23,
          1
        );

        sprite.renderOrder = 2;

        sprite.userData = {
          cw06OceanAtmosphereV19: true,
          type: "glint",
          visualOnly: true,
          interactionExcluded: true,
          index
        };

        disableRaycast(sprite);

        scene.add(sprite);

        return {
          sprite,
          material,
          phase,
          index
        };
      }
    );

  let elapsedSeconds = 0;
  let disposed = false;

  function updateCloud(
    cloud
  ) {
    const [
      phase,
      radius,
      altitude,
      speed
    ] =
      cloud.blueprint;

    const angle =
      phase * TAU +
      elapsedSeconds *
        speed;

    cloud.sprite.position.set(
      Math.cos(angle) *
        radius,

      oceanY +
        altitude +
        Math.sin(
          angle * 2.0
        ) *
          0.28,

      Math.sin(angle) *
        radius
    );

    cloud.material.rotation =
      Math.sin(
        angle * 0.8
      ) * 0.025;
  }

  function updateWhitecap(
    whitecap
  ) {
    const ring =
      whitecap.index % 3;

    const radius =
      8 +
      ring * 5.1 +
      (
        whitecap.index %
        4
      ) *
        0.45;

    const speed =
      0.018 +
      ring * 0.005;

    const angle =
      whitecap.phase *
        TAU +
      elapsedSeconds *
        speed;

    whitecap.sprite.position.set(
      Math.cos(angle) *
        radius,

      oceanY +
        0.08 +
        Math.sin(
          elapsedSeconds *
            1.6 +
          whitecap.phase *
            TAU
        ) *
          0.035,

      Math.sin(angle) *
        radius
    );

    whitecap.material.opacity =
      0.24 +
      (
        Math.sin(
          elapsedSeconds *
            2.1 +
          whitecap.phase *
            TAU
        ) *
          0.5 +
        0.5
      ) *
        0.34;
  }

  function updateGlint(
    glint
  ) {
    const radius =
      20.5 +
      (
        glint.index %
        3
      ) *
        0.8;

    const angle =
      glint.phase *
        TAU +
      elapsedSeconds *
        0.008;

    glint.sprite.position.set(
      Math.cos(angle) *
        radius,

      oceanY +
        0.24,

      Math.sin(angle) *
        radius
    );

    glint.material.opacity =
      0.08 +
      (
        Math.sin(
          elapsedSeconds *
            1.25 +
          glint.phase *
            17
        ) *
          0.5 +
        0.5
      ) *
        0.42;
  }

  function tick(input = {}) {
    if (disposed) {
      return;
    }

    const deltaSeconds =
      Number.isFinite(
        input.deltaSeconds
      )
        ? THREE.MathUtils.clamp(
            input.deltaSeconds,
            0,
            0.1
          )
        : 0;

    elapsedSeconds +=
      deltaSeconds;

    for (const cloud of clouds) {
      updateCloud(cloud);
    }

    for (
      const whitecap
      of whitecaps
    ) {
      updateWhitecap(
        whitecap
      );
    }

    for (
      const glint
      of horizonGlints
    ) {
      updateGlint(glint);
    }
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_OCEAN_ATMOSPHERE_DEPTH_V19_PROFILE.id,

      oceanY,

      elapsedSeconds,

      hazePanelCount:
        hazePanels.length,

      cloudCount:
        clouds.length,

      whitecapCount:
        whitecaps.length,

      horizonGlintCount:
        horizonGlints.length,

      visualOnly: true,
      deterministic: true,
      globalFogMutations: 0,

      clouds:
        Object.freeze(
          clouds.map(
            (cloud) =>
              Object.freeze({
                index:
                  cloud.index,

                x:
                  cloud.sprite
                    .position.x,

                y:
                  cloud.sprite
                    .position.y,

                z:
                  cloud.sprite
                    .position.z
              })
          )
        ),

      whitecaps:
        Object.freeze(
          whitecaps.map(
            (whitecap) =>
              Object.freeze({
                index:
                  whitecap.index,

                x:
                  whitecap.sprite
                    .position.x,

                y:
                  whitecap.sprite
                    .position.y,

                z:
                  whitecap.sprite
                    .position.z,

                opacity:
                  whitecap.material
                    .opacity
              })
          )
        ),

      glints:
        Object.freeze(
          horizonGlints.map(
            (glint) =>
              Object.freeze({
                index:
                  glint.index,

                x:
                  glint.sprite
                    .position.x,

                y:
                  glint.sprite
                    .position.y,

                z:
                  glint.sprite
                    .position.z,

                opacity:
                  glint.material
                    .opacity
              })
          )
        )
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    for (
      const haze
      of hazePanels
    ) {
      scene.remove(
        haze.mesh
      );

      haze.material.dispose();
    }

    for (const cloud of clouds) {
      scene.remove(
        cloud.sprite
      );

      cloud.material.dispose();
    }

    for (
      const whitecap
      of whitecaps
    ) {
      scene.remove(
        whitecap.sprite
      );

      whitecap.material.dispose();
    }

    for (
      const glint
      of horizonGlints
    ) {
      scene.remove(
        glint.sprite
      );

      glint.material.dispose();
    }

    hazeGeometry.dispose();

    for (const texture of textures) {
      texture.dispose();
    }
  }

  for (const cloud of clouds) {
    updateCloud(cloud);
  }

  for (
    const whitecap
    of whitecaps
  ) {
    updateWhitecap(
      whitecap
    );
  }

  for (
    const glint
    of horizonGlints
  ) {
    updateGlint(glint);
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_OCEAN_ATMOSPHERE_DEPTH_V19_PROFILE,
  createClassroomOceanAtmosphereDepthV19
};
