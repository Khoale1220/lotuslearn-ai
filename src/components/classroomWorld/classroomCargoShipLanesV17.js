import * as THREE from "three";

const TAU =
  Math.PI * 2;

const CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE =
  Object.freeze({
    id: "cw06-cargo-ship-lanes-v17",
    laneCount: 4,
    shipCount: 8,
    textureWidth: 96,
    textureHeight: 32,
    visualOnly: true,
    interactionAuthorityMutations: 0
  });

const LANE_BLUEPRINTS =
  Object.freeze([
    Object.freeze({
      id: "north-westbound",
      start: Object.freeze([
        24,
        -18
      ]),
      end: Object.freeze([
        -24,
        -18
      ]),
      speed: 0.010
    }),

    Object.freeze({
      id: "north-eastbound",
      start: Object.freeze([
        -23,
        -22
      ]),
      end: Object.freeze([
        23,
        -22
      ]),
      speed: 0.0075
    }),

    Object.freeze({
      id: "south-westbound",
      start: Object.freeze([
        22,
        18
      ]),
      end: Object.freeze([
        -22,
        18
      ]),
      speed: 0.0085
    }),

    Object.freeze({
      id: "south-eastbound",
      start: Object.freeze([
        -24,
        22
      ]),
      end: Object.freeze([
        24,
        22
      ]),
      speed: 0.0068
    })
  ]);

const SHIP_BLUEPRINTS =
  Object.freeze([
    Object.freeze({
      lane: 0,
      phase: 0.08,
      scale: 1.10,
      palette: 0
    }),

    Object.freeze({
      lane: 0,
      phase: 0.58,
      scale: 0.82,
      palette: 2
    }),

    Object.freeze({
      lane: 1,
      phase: 0.19,
      scale: 0.92,
      palette: 1
    }),

    Object.freeze({
      lane: 1,
      phase: 0.71,
      scale: 0.72,
      palette: 0
    }),

    Object.freeze({
      lane: 2,
      phase: 0.31,
      scale: 1.02,
      palette: 2
    }),

    Object.freeze({
      lane: 2,
      phase: 0.84,
      scale: 0.78,
      palette: 1
    }),

    Object.freeze({
      lane: 3,
      phase: 0.43,
      scale: 0.88,
      palette: 0
    }),

    Object.freeze({
      lane: 3,
      phase: 0.94,
      scale: 0.68,
      palette: 2
    })
  ]);

const SHIP_PALETTES =
  Object.freeze([
    Object.freeze({
      hull: "#293849",
      hullLight: "#456078",
      deck: "#d6c18d",
      bridge: "#e7e0c8",
      window: "#29334c",
      containerA: "#b4473f",
      containerB: "#d2963c",
      containerC: "#3c7197"
    }),

    Object.freeze({
      hull: "#273e4d",
      hullLight: "#3e6877",
      deck: "#cabd99",
      bridge: "#e3dbc4",
      window: "#2a3549",
      containerA: "#3e7194",
      containerB: "#b35c42",
      containerC: "#82813e"
    }),

    Object.freeze({
      hull: "#3d3840",
      hullLight: "#655665",
      deck: "#cbb98b",
      bridge: "#ddd6bd",
      window: "#273247",
      containerA: "#a94343",
      containerB: "#687e9a",
      containerC: "#b17a35"
    })
  ]);

function clamp01(value) {
  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}

function smoothstep(value) {
  const t =
    clamp01(value);

  return (
    t *
    t *
    (3 - 2 * t)
  );
}

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
  } catch {
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
    if (
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return -2.2;
}

function createCargoShipTexture(
  documentObject,
  palette
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
    CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE
      .textureWidth;

  canvas.height =
    CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE
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
   * hull shadow
   */
  context.fillStyle =
    "#171d27";

  context.fillRect(
    8,
    25,
    75,
    3
  );

  /*
   * main hull
   */
  context.fillStyle =
    palette.hull;

  context.fillRect(
    10,
    20,
    70,
    6
  );

  context.fillRect(
    17,
    26,
    57,
    2
  );

  /*
   * bow
   */
  context.fillRect(
    80,
    21,
    6,
    4
  );

  context.fillRect(
    86,
    22,
    3,
    2
  );

  /*
   * hull highlight
   */
  context.fillStyle =
    palette.hullLight;

  context.fillRect(
    14,
    20,
    64,
    1
  );

  /*
   * deck
   */
  context.fillStyle =
    palette.deck;

  context.fillRect(
    15,
    18,
    62,
    2
  );

  /*
   * rear superstructure
   */
  context.fillStyle =
    palette.bridge;

  context.fillRect(
    14,
    10,
    13,
    8
  );

  context.fillRect(
    17,
    7,
    8,
    3
  );

  /*
   * bridge windows
   */
  context.fillStyle =
    palette.window;

  context.fillRect(
    16,
    12,
    3,
    2
  );

  context.fillRect(
    21,
    12,
    3,
    2
  );

  /*
   * chimney
   */
  context.fillStyle =
    palette.hull;

  context.fillRect(
    11,
    8,
    3,
    8
  );

  /*
   * container rows
   */
  const colors = [
    palette.containerA,
    palette.containerB,
    palette.containerC
  ];

  let index = 0;

  for (
    let row = 0;
    row < 3;
    row += 1
  ) {
    const y =
      16 - row * 4;

    const startX =
      31 + row * 2;

    const endX =
      73 - row * 2;

    for (
      let x = startX;
      x < endX;
      x += 8
    ) {
      context.fillStyle =
        colors[
          index %
          colors.length
        ];

      context.fillRect(
        x,
        y,
        7,
        3
      );

      context.fillStyle =
        "rgba(255,255,255,0.18)";

      context.fillRect(
        x,
        y,
        7,
        1
      );

      index += 1;
    }
  }

  /*
   * bow mast
   */
  context.fillStyle =
    palette.deck;

  context.fillRect(
    76,
    12,
    1,
    6
  );

  context.fillRect(
    74,
    12,
    5,
    1
  );

  /*
   * tiny wake
   */
  context.fillStyle =
    "#b5d9db";

  context.fillRect(
    4,
    27,
    13,
    1
  );

  context.fillRect(
    0,
    29,
    18,
    1
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.name =
    "cw06-v17-cargo-ship";

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

function createClassroomCargoShipLanesV17({
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
      "V17 requires THREE.Scene"
    );
  }

  if (
    !camera ||
    !camera.isCamera
  ) {
    throw new TypeError(
      "V17 requires THREE.Camera"
    );
  }

  const oceanY =
    resolveOceanY(
      oceanWorld
    );

  const textures =
    SHIP_PALETTES.map(
      (palette) =>
        createCargoShipTexture(
          documentObject,
          palette
        )
    );

  const ships =
    SHIP_BLUEPRINTS.map(
      (
        blueprint,
        index
      ) => {
        const texture =
          textures[
            blueprint.palette
          ];

        const palette =
          SHIP_PALETTES[
            blueprint.palette
          ];

        const material =
          new THREE.SpriteMaterial({
            map:
              texture ||
              null,

            color:
              texture
                ? 0xffffff
                : palette.hullLight,

            transparent: true,

            opacity: 0,

            alphaTest:
              texture
                ? 0.05
                : 0,

            depthTest: true,

            depthWrite: false,

            fog: true,

            sizeAttenuation: true
          });

        material.name =
          "cw06-v17-cargo-ship-material-" +
          index;

        const sprite =
          new THREE.Sprite(
            material
          );

        sprite.name =
          "cw06-v17-cargo-ship-" +
          index;

        sprite.userData = {
          cw06CargoShipV17: true,
          visualOnly: true,
          interactionExcluded: true,
          lane:
            blueprint.lane
        };

        /*
         * Visual-only assets can never
         * become V11 interaction targets.
         */
        sprite.raycast =
          function noCargoShipRaycast() {};

        sprite.renderOrder =
          2;

        const width =
          5.0 *
          blueprint.scale;

        const height =
          1.67 *
          blueprint.scale;

        const lane =
          LANE_BLUEPRINTS[
            blueprint.lane
          ];

        const horizontalDirection =
          lane.end[0] -
          lane.start[0];

        const flip =
          horizontalDirection < 0
            ? -1
            : 1;

        sprite.scale.set(
          width * flip,
          height,
          1
        );

        scene.add(
          sprite
        );

        return {
          id:
            "cargo-ship-" +
            index,

          sprite,

          material,

          blueprint,

          progress:
            blueprint.phase
        };
      }
    );

  let elapsedSeconds = 0;
  let disposed = false;

  function updateShip(
    ship
  ) {
    const lane =
      LANE_BLUEPRINTS[
        ship.blueprint.lane
      ];

    const progress =
      (
        ship.blueprint.phase +
        elapsedSeconds *
          lane.speed
      ) % 1;

    ship.progress =
      progress;

    const x =
      THREE.MathUtils.lerp(
        lane.start[0],
        lane.end[0],
        progress
      );

    const z =
      THREE.MathUtils.lerp(
        lane.start[1],
        lane.end[1],
        progress
      );

    const bob =
      Math.sin(
        elapsedSeconds *
          0.72 +
        ship.blueprint.phase *
          TAU
      ) * 0.055;

    ship.sprite.position.set(
      x,
      oceanY + 0.82 + bob,
      z
    );

    /*
     * Hide at the lane endpoints.
     * The ship appears from haze,
     * crosses the ocean, then fades
     * back into the horizon.
     */
    const edgeDistance =
      Math.min(
        progress,
        1 - progress
      );

    const fade =
      smoothstep(
        (edgeDistance - 0.015) /
        0.085
      );

    ship.material.opacity =
      fade * 0.96;

    ship.sprite.visible =
      fade > 0.015;
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

    for (const ship of ships) {
      updateShip(ship);
    }
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE.id,

      laneCount:
        LANE_BLUEPRINTS.length,

      shipCount:
        ships.length,

      oceanY,

      elapsedSeconds,

      visualOnly: true,

      ships:
        Object.freeze(
          ships.map(
            (ship) =>
              Object.freeze({
                id:
                  ship.id,

                lane:
                  ship.blueprint
                    .lane,

                progress:
                  ship.progress,

                visible:
                  ship.sprite
                    .visible,

                opacity:
                  ship.material
                    .opacity,

                x:
                  ship.sprite
                    .position.x,

                y:
                  ship.sprite
                    .position.y,

                z:
                  ship.sprite
                    .position.z
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

    for (const ship of ships) {
      scene.remove(
        ship.sprite
      );

      ship.material.dispose();
    }

    for (const texture of textures) {
      if (texture) {
        texture.dispose();
      }
    }
  }

  /*
   * Initial deterministic placement.
   */
  for (const ship of ships) {
    updateShip(ship);
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE,
  createClassroomCargoShipLanesV17
};
