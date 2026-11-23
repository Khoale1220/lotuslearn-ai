import * as THREE from "three";

const TAU =
  Math.PI * 2;

const CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE =
  Object.freeze({
    id: "cw06-seagull-flocks-v18",
    flockCount: 3,
    birdCount: 15,
    wingFrameCount: 3,
    textureWidth: 24,
    textureHeight: 16,
    visualOnly: true,
    deterministic: true,
    interactionAuthorityMutations: 0
  });

const FLOCKS =
  Object.freeze([
    Object.freeze({
      id: "near",
      count: 4,
      radiusX: 11,
      radiusZ: 8,
      centerX: 1,
      centerZ: -7,
      altitude: 5.8,
      speed: 0.110,
      scale: 0.82,
      verticalAmplitude: 0.65
    }),

    Object.freeze({
      id: "middle",
      count: 5,
      radiusX: 17,
      radiusZ: 11,
      centerX: -2,
      centerZ: -15,
      altitude: 7.4,
      speed: 0.074,
      scale: 0.57,
      verticalAmplitude: 0.48
    }),

    Object.freeze({
      id: "far",
      count: 6,
      radiusX: 25,
      radiusZ: 15,
      centerX: 2,
      centerZ: -23,
      altitude: 8.7,
      speed: 0.045,
      scale: 0.36,
      verticalAmplitude: 0.34
    })
  ]);

const BIRD_PHASES =
  Object.freeze([
    0.03,
    0.14,
    0.27,
    0.41,
    0.52,
    0.66,
    0.78,
    0.91,
    0.19,
    0.36,
    0.57,
    0.73,
    0.86,
    0.09,
    0.47
  ]);

function createBirdTexture(
  documentObject,
  frameIndex
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

  canvas.width =
    CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE
      .textureWidth;

  canvas.height =
    CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE
      .textureHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.imageSmoothingEnabled =
    false;

  /*
   * VGA seagull palette.
   */

  const outline =
    "#202738";

  const shadow =
    "#8091a3";

  const feather =
    "#e2e5df";

  const highlight =
    "#fff8df";

  const beak =
    "#d49a42";

  /*
   * Body.
   */

  context.fillStyle =
    outline;

  context.fillRect(
    10,
    7,
    6,
    3
  );

  context.fillRect(
    15,
    6,
    3,
    3
  );

  context.fillStyle =
    feather;

  context.fillRect(
    10,
    7,
    5,
    2
  );

  context.fillRect(
    15,
    6,
    2,
    2
  );

  context.fillStyle =
    highlight;

  context.fillRect(
    11,
    7,
    3,
    1
  );

  /*
   * Beak.
   */

  context.fillStyle =
    beak;

  context.fillRect(
    18,
    7,
    2,
    1
  );

  /*
   * Tail.
   */

  context.fillStyle =
    outline;

  context.fillRect(
    8,
    8,
    2,
    1
  );

  context.fillStyle =
    feather;

  context.fillRect(
    7,
    8,
    2,
    1
  );

  /*
   * Three explicit wing poses.
   */

  context.fillStyle =
    outline;

  if (frameIndex === 0) {
    /*
     * Wings raised.
     */

    context.fillRect(
      8,
      5,
      3,
      2
    );

    context.fillRect(
      6,
      3,
      3,
      2
    );

    context.fillRect(
      14,
      4,
      3,
      2
    );

    context.fillRect(
      16,
      2,
      3,
      2
    );

    context.fillStyle =
      shadow;

    context.fillRect(
      7,
      4,
      3,
      1
    );

    context.fillRect(
      15,
      3,
      3,
      1
    );
  }
  else if (frameIndex === 1) {
    /*
     * Wings level.
     */

    context.fillRect(
      3,
      6,
      7,
      2
    );

    context.fillRect(
      16,
      5,
      6,
      2
    );

    context.fillStyle =
      feather;

    context.fillRect(
      4,
      6,
      5,
      1
    );

    context.fillRect(
      17,
      5,
      4,
      1
    );
  }
  else {
    /*
     * Wings lowered.
     */

    context.fillRect(
      6,
      8,
      4,
      2
    );

    context.fillRect(
      4,
      10,
      3,
      2
    );

    context.fillRect(
      16,
      8,
      4,
      2
    );

    context.fillRect(
      19,
      10,
      3,
      2
    );

    context.fillStyle =
      shadow;

    context.fillRect(
      5,
      10,
      2,
      1
    );

    context.fillRect(
      19,
      10,
      2,
      1
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.name =
    "cw06-v18-seagull-frame-" +
    frameIndex;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy =
    1;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate =
    true;

  return texture;
}

function createClassroomSeagullFlocksV18({
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
      "V18 requires THREE.Scene"
    );
  }

  if (
    !camera ||
    !camera.isCamera
  ) {
    throw new TypeError(
      "V18 requires THREE.Camera"
    );
  }

  const textures = [
    createBirdTexture(
      documentObject,
      0
    ),

    createBirdTexture(
      documentObject,
      1
    ),

    createBirdTexture(
      documentObject,
      2
    )
  ];

  const birds = [];

  let globalBirdIndex = 0;

  FLOCKS.forEach(
    (
      flock,
      flockIndex
    ) => {
      for (
        let index = 0;
        index < flock.count;
        index += 1
      ) {
        const phase =
          BIRD_PHASES[
            globalBirdIndex
          ];

        const material =
          new THREE.SpriteMaterial({
            map:
              textures[1] ||
              null,

            color:
              textures[1]
                ? 0xffffff
                : 0xdfe4de,

            transparent: true,

            opacity: 0.92,

            alphaTest:
              textures[1]
                ? 0.05
                : 0,

            depthTest: true,

            depthWrite: false,

            fog: true,

            sizeAttenuation: true
          });

        material.name =
          "cw06-v18-seagull-material-" +
          globalBirdIndex;

        const sprite =
          new THREE.Sprite(
            material
          );

        sprite.name =
          "cw06-v18-seagull-" +
          globalBirdIndex;

        sprite.userData = {
          cw06SeagullV18: true,
          visualOnly: true,
          interactionExcluded: true,
          flockId:
            flock.id,
          flockIndex,
          birdIndex:
            globalBirdIndex
        };

        /*
         * Never participate in V11 interaction.
         */

        sprite.raycast =
          function noSeagullRaycast() {};

        const size =
          flock.scale *
          (
            0.88 +
            index * 0.035
          );

        sprite.scale.set(
          size * 1.5,
          size,
          1
        );

        sprite.renderOrder =
          3;

        scene.add(
          sprite
        );

        birds.push({
          sprite,
          material,
          flock,
          flockIndex,
          phase,
          birdIndex:
            globalBirdIndex,
          frameIndex: 1
        });

        globalBirdIndex += 1;
      }
    }
  );

  let elapsedSeconds = 0;
  let disposed = false;

  /*
   * Optional ocean snapshot is retained only
   * as contextual evidence.
   *
   * It does not own bird movement.
   */

  function readOceanSnapshot() {
    if (
      !oceanWorld ||
      typeof oceanWorld.getSnapshot !==
        "function"
    ) {
      return null;
    }

    try {
      return oceanWorld.getSnapshot();
    }
    catch {
      return null;
    }
  }

  function updateBird(
    bird
  ) {
    const flock =
      bird.flock;

    const phaseRadians =
      bird.phase *
      TAU;

    const time =
      elapsedSeconds *
      flock.speed *
      TAU;

    const angle =
      time +
      phaseRadians;

    /*
     * Elliptical flock route.
     */

    const x =
      flock.centerX +
      Math.cos(angle) *
        flock.radiusX;

    const z =
      flock.centerZ +
      Math.sin(angle) *
        flock.radiusZ;

    /*
     * Layered airborne motion.
     */

    const y =
      flock.altitude +
      Math.sin(
        angle * 2 +
        bird.birdIndex * 0.37
      ) *
        flock.verticalAmplitude +
      Math.sin(
        elapsedSeconds *
          0.85 +
        bird.phase *
          TAU
      ) *
        0.18;

    bird.sprite.position.set(
      x,
      y,
      z
    );

    /*
     * Wing cadence differs deterministically
     * between birds to avoid synchronized flock.
     */

    const wingPhase =
      elapsedSeconds *
        (
          5.2 +
          bird.flockIndex *
            0.55
        ) +
      bird.phase *
        5.7;

    const wingCycle =
      (
        Math.floor(
          wingPhase
        ) %
          4 +
        4
      ) %
      4;

    const nextFrame =
      wingCycle === 0
        ? 0
        : wingCycle === 2
          ? 2
          : 1;

    if (
      nextFrame !==
      bird.frameIndex
    ) {
      bird.frameIndex =
        nextFrame;

      if (
        textures[
          nextFrame
        ]
      ) {
        bird.material.map =
          textures[
            nextFrame
          ];

        bird.material.needsUpdate =
          true;
      }
    }

    /*
     * Small sprite rotation gives banking
     * impression around route turns.
     */

    const bank =
      Math.cos(angle) *
      0.13;

    bird.material.rotation =
      bank;

    /*
     * Distance-layer alpha.
     */

    const layerOpacity =
      bird.flockIndex === 0
        ? 0.96
        : bird.flockIndex === 1
          ? 0.83
          : 0.70;

    bird.material.opacity =
      layerOpacity;
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

    for (const bird of birds) {
      updateBird(bird);
    }
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE
          .id,

      flockCount:
        FLOCKS.length,

      birdCount:
        birds.length,

      elapsedSeconds,

      oceanLinked:
        Boolean(
          oceanWorld
        ),

      oceanSnapshot:
        readOceanSnapshot(),

      visualOnly: true,

      deterministic: true,

      birds:
        Object.freeze(
          birds.map(
            (bird) =>
              Object.freeze({
                birdIndex:
                  bird.birdIndex,

                flockId:
                  bird.flock.id,

                frameIndex:
                  bird.frameIndex,

                x:
                  bird.sprite
                    .position.x,

                y:
                  bird.sprite
                    .position.y,

                z:
                  bird.sprite
                    .position.z,

                rotation:
                  bird.material
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

    disposed = true;

    for (const bird of birds) {
      scene.remove(
        bird.sprite
      );

      bird.material.dispose();
    }

    for (const texture of textures) {
      if (texture) {
        texture.dispose();
      }
    }
  }

  /*
   * Deterministic initial frame.
   */

  for (const bird of birds) {
    updateBird(bird);
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE,
  createClassroomSeagullFlocksV18
};
