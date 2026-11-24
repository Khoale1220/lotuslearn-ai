import * as THREE from "three";

import {
  getClassroomWindowLayout
} from "./classroomArchitectureV2.js";

import {
  seatToWorld
} from "./classroomWorldContract.js";

const CLASSROOM_REFERENCE_SURFACE_V29_PROFILE =
  Object.freeze({
    id:
      "cw06-reference-surface-silhouette-v29",

    artDirection:
      "reference-driven-high-detail-vga",

    textureCount:
      6,

    wallWearCount:
      8,

    floorScuffCount:
      10,

    deskGrainCount:
      12,

    boardSmudgeCount:
      4,

    skylineInstanceCount:
      3,

    foliageInstanceCount:
      3,

    staticVisualDrawCalls:
      6,

    textureFiltering:
      "nearest",

    mipmaps:
      false,

    anisotropy:
      1,

    runtimeSceneTraversal:
      false,

    runtimeAnimation:
      false,

    rendererAuthorityMutations:
      0,

    fogAuthorityMutations:
      0,

    shadowMapMutations:
      0,

    collisionAuthority:
      "preserved",

    interactionAuthority:
      "preserved",

    visualOnly:
      true,

    deterministic:
      true
  });

const WALL_PATCHES_V29 =
  Object.freeze([
    Object.freeze({
      x: -5.65,
      y: 1.52,
      z: -7.135,
      rotationY: 0,
      scaleX: 1.05,
      scaleY: 0.95
    }),

    Object.freeze({
      x: 4.85,
      y: 2.26,
      z: -7.135,
      rotationY: 0,
      scaleX: 0.82,
      scaleY: 1.10
    }),

    Object.freeze({
      x: -5.15,
      y: 1.38,
      z: 7.135,
      rotationY: Math.PI,
      scaleX: 1.08,
      scaleY: 0.90
    }),

    Object.freeze({
      x: 4.70,
      y: 2.10,
      z: 7.135,
      rotationY: Math.PI,
      scaleX: 0.92,
      scaleY: 1.08
    }),

    Object.freeze({
      x: -7.135,
      y: 1.34,
      z: -3.45,
      rotationY: Math.PI / 2,
      scaleX: 0.88,
      scaleY: 1.04
    }),

    Object.freeze({
      x: -7.135,
      y: 2.22,
      z: 2.95,
      rotationY: Math.PI / 2,
      scaleX: 1.0,
      scaleY: 0.90
    }),

    Object.freeze({
      x: 6.985,
      y: 0.76,
      z: -1.85,
      rotationY: -Math.PI / 2,
      scaleX: 0.70,
      scaleY: 0.62
    }),

    Object.freeze({
      x: 6.985,
      y: 0.79,
      z: 1.88,
      rotationY: -Math.PI / 2,
      scaleX: 0.72,
      scaleY: 0.64
    })
  ]);

const FLOOR_SCUFFS_V29 =
  Object.freeze([
    [-4.9, -5.3, 1.1, 0.72, -0.08],
    [-2.5, -4.2, 0.9, 0.78, 0.06],
    [0.0, -5.2, 1.2, 0.70, -0.02],
    [2.8, -4.0, 0.86, 0.74, 0.07],
    [4.8, -2.6, 1.0, 0.68, -0.09],
    [-4.3, 0.2, 0.92, 0.78, 0.05],
    [-1.6, 1.4, 1.15, 0.68, -0.06],
    [1.5, 0.8, 0.95, 0.76, 0.08],
    [4.5, 2.6, 1.05, 0.72, -0.04],
    [0.2, 5.3, 1.22, 0.66, 0.03]
  ].map(
    (
      [
        x,
        z,
        scaleX,
        scaleY,
        rotationZ
      ]
    ) =>
      Object.freeze({
        x,
        z,
        scaleX,
        scaleY,
        rotationZ
      })
  ));

function configurePixelTextureV29(
  texture
) {
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

  texture.wrapS =
    THREE.ClampToEdgeWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.needsUpdate =
    true;

  return texture;
}

function createTextureV29({
  name,
  width,
  height,
  pixel
}) {
  const data =
    new Uint8Array(
      width *
      height *
      4
    );

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      const [
        red,
        green,
        blue,
        alpha
      ] =
        pixel(
          x,
          y
        );

      const offset =
        (
          y *
            width +
          x
        ) *
        4;

      data[offset] =
        red;

      data[offset + 1] =
        green;

      data[offset + 2] =
        blue;

      data[offset + 3] =
        alpha;
    }
  }

  const texture =
    new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

  texture.name =
    name;

  return configurePixelTextureV29(
    texture
  );
}

function createWallWearTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-wall-wear",

    width:
      32,

    height:
      32,

    pixel(
      x,
      y
    ) {
      const speck =
        (
          x * 13 +
          y * 17 +
          x * y * 3
        ) %
        31;

      const crackA =
        Math.abs(
          x -
          (
            8 +
            Math.floor(
              y / 5
            )
          )
        ) <=
        1;

      const crackB =
        y > 15 &&
        Math.abs(
          x -
          (
            25 -
            Math.floor(
              (
                y - 15
              ) /
              4
            )
          )
        ) ===
          0;

      if (
        crackA ||
        crackB
      ) {
        return [
          48,
          33,
          54,
          150
        ];
      }

      if (
        speck <= 2
      ) {
        return [
          178,
          135,
          105,
          100
        ];
      }

      if (
        speck === 7
      ) {
        return [
          63,
          105,
          119,
          90
        ];
      }

      return [
        0,
        0,
        0,
        0
      ];
    }
  });
}

function createFloorScuffTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-floor-scuff",

    width:
      32,

    height:
      16,

    pixel(
      x,
      y
    ) {
      const line =
        (
          y ===
            5 +
              (
                x %
                3
              ) ||
          y ===
            10 -
              (
                x %
                4
              )
        );

      const chips =
        (
          x * 7 +
          y * 11
        ) %
        29 ===
        0;

      if (line) {
        return [
          36,
          24,
          42,
          100
        ];
      }

      if (chips) {
        return [
          208,
          157,
          104,
          82
        ];
      }

      return [
        0,
        0,
        0,
        0
      ];
    }
  });
}

function createWoodGrainTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-wood-grain",

    width:
      32,

    height:
      16,

    pixel(
      x,
      y
    ) {
      const grain =
        (
          y ===
            4 +
              (
                x %
                2
              ) ||
          y ===
            9 +
              (
                (
                  x + 1
                ) %
                3
              )
        );

      const knot =
        (
          (
            x - 22
          ) *
          (
            x - 22
          ) +
          (
            y - 7
          ) *
          (
            y - 7
          )
        ) <=
        5;

      if (knot) {
        return [
          71,
          37,
          42,
          145
        ];
      }

      if (grain) {
        return [
          233,
          169,
          102,
          100
        ];
      }

      if (
        (
          x * 5 +
          y * 13
        ) %
        37 ===
        0
      ) {
        return [
          62,
          44,
          48,
          82
        ];
      }

      return [
        0,
        0,
        0,
        0
      ];
    }
  });
}

function createBoardSmudgeTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-board-smudge",

    width:
      32,

    height:
      16,

    pixel(
      x,
      y
    ) {
      const chalk =
        (
          x * 7 +
          y * 5
        ) %
        19;

      const stroke =
        (
          y ===
            5 &&
          x >
            4 &&
          x <
            15
        ) ||
        (
          y ===
            10 &&
          x >
            17 &&
          x <
            29
        );

      if (stroke) {
        return [
          232,
          219,
          172,
          125
        ];
      }

      if (
        chalk <= 1
      ) {
        return [
          168,
          205,
          201,
          72
        ];
      }

      return [
        0,
        0,
        0,
        0
      ];
    }
  });
}

function createSkylineTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-window-skyline",

    width:
      48,

    height:
      32,

    pixel(
      x,
      y
    ) {
      const buildingHeight =
        10 +
        (
          (
            x * 7 +
            3
          ) %
          11
        );

      const top =
        32 -
        buildingHeight;

      if (
        y <
        top
      ) {
        return [
          0,
          0,
          0,
          0
        ];
      }

      const windowPixel =
        (
          x %
            6 ===
            2 &&
          (
            y -
            top
          ) %
            6 ===
            2
        );

      if (windowPixel) {
        return [
          217,
          166,
          93,
          185
        ];
      }

      const distant =
        y <
        25;

      return distant
        ? [
            45,
            65,
            85,
            190
          ]
        : [
            28,
            24,
            43,
            225
          ];
    }
  });
}

function createFoliageTextureV29() {
  return createTextureV29({
    name:
      "cw06-v29-window-foliage",

    width:
      48,

    height:
      32,

    pixel(
      x,
      y
    ) {
      const base =
        27;

      const cluster =
        (
          x * 11 +
          y * 7 +
          x * y
        ) %
        17;

      const canopy =
        y >
          16 &&
        (
          cluster <
            6 ||
          y >
            base
        );

      if (!canopy) {
        return [
          0,
          0,
          0,
          0
        ];
      }

      if (
        cluster <= 1
      ) {
        return [
          49,
          107,
          112,
          215
        ];
      }

      return [
        30,
        48,
        57,
        235
      ];
    }
  });
}

function createReferenceSurfaceTextureSetV29() {
  return Object.freeze({
    wallWear:
      createWallWearTextureV29(),

    floorScuff:
      createFloorScuffTextureV29(),

    woodGrain:
      createWoodGrainTextureV29(),

    boardSmudge:
      createBoardSmudgeTextureV29(),

    skyline:
      createSkylineTextureV29(),

    foliage:
      createFoliageTextureV29()
  });
}

function disableRaycastV29(
  object
) {
  object.raycast =
    function noV29Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V29:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function freezeObjectV29(
  object
) {
  object.matrixAutoUpdate =
    false;

  object.updateMatrix();

  return object;
}

function setInstanceV29({
  mesh,
  index,
  dummy,
  position,
  rotation =
    {
      x: 0,
      y: 0,
      z: 0
    },
  scale =
    {
      x: 1,
      y: 1,
      z: 1
    }
}) {
  dummy.position.set(
    position.x,
    position.y,
    position.z
  );

  dummy.rotation.set(
    rotation.x,
    rotation.y,
    rotation.z
  );

  dummy.scale.set(
    scale.x,
    scale.y,
    scale.z
  );

  dummy.updateMatrix();

  mesh.setMatrixAt(
    index,
    dummy.matrix
  );
}

function finalizeInstancedV29(
  mesh
) {
  mesh.instanceMatrix.needsUpdate =
    true;

  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();

  disableRaycastV29(
    mesh
  );

  freezeObjectV29(
    mesh
  );

  return mesh;
}

function createOverlayMaterialV29({
  map,
  opacity =
    1,
  alphaTest =
    0.02
}) {
  return new THREE.MeshBasicMaterial({
    map,

    color:
      0xffffff,

    transparent:
      true,

    opacity,

    alphaTest,

    depthWrite:
      false,

    toneMapped:
      false,

    side:
      THREE.DoubleSide,

    polygonOffset:
      true,

    polygonOffsetFactor:
      -1,

    polygonOffsetUnits:
      -1
  });
}

function createWindowSilhouetteBlueprintsV29() {
  return Object.freeze(
    getClassroomWindowLayout()
      .map(
        (
          definition,
          index
        ) =>
          Object.freeze({
            id:
              definition.id,

            skyline:
              Object.freeze({
                x:
                  definition.x +
                  0.085,

                y:
                  definition.y -
                  0.03,

                z:
                  definition.z,

                scaleX:
                  0.96,

                scaleY:
                  0.93
              }),

            foliage:
              Object.freeze({
                x:
                  definition.x +
                  0.055,

                y:
                  definition.y -
                  0.11,

                z:
                  definition.z +
                  (
                    index - 1
                  ) *
                  0.06,

                scaleX:
                  0.99,

                scaleY:
                  0.97
              })
          })
      )
  );
}

function createClassroomReferenceSurfaceSilhouetteV29({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V29 requires THREE.Scene"
    );
  }

  const profile =
    CLASSROOM_REFERENCE_SURFACE_V29_PROFILE;

  const root =
    new THREE.Group();

  root.name =
    "classroom-reference-surface-silhouette-v29";

  root.userData = {
    cw06V29:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  const geometries =
    new Set();

  const materials =
    new Set();

  const textures =
    createReferenceSurfaceTextureSetV29();

  function ownGeometry(
    geometry
  ) {
    geometries.add(
      geometry
    );

    return geometry;
  }

  function ownMaterial(
    material
  ) {
    materials.add(
      material
    );

    return material;
  }

  /*
   * ======================================================
   * GEOMETRY
   * ======================================================
   */

  const wallPatchGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        1.75,
        1.18
      )
    );

  const floorScuffGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        1.72,
        0.90
      )
    );

  const deskGrainGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        0.80,
        0.42
      )
    );

  const boardSmudgeGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        1.65,
        0.74
      )
    );

  const skylineGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        2.34,
        1.52
      )
    );

  const foliageGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        2.34,
        1.52
      )
    );

  /*
   * ======================================================
   * MATERIALS — 6 SHARED TEXTURE MATERIALS
   * ======================================================
   */

  const wallMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.wallWear,

        opacity:
          0.74
      })
    );

  const floorMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.floorScuff,

        opacity:
          0.68
      })
    );

  const woodMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.woodGrain,

        opacity:
          0.76
      })
    );

  const boardMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.boardSmudge,

        opacity:
          0.70
      })
    );

  const skylineMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.skyline,

        opacity:
          0.88,

        alphaTest:
          0.08
      })
    );

  const foliageMaterial =
    ownMaterial(
      createOverlayMaterialV29({
        map:
          textures.foliage,

        opacity:
          0.88,

        alphaTest:
          0.08
      })
    );

  const dummy =
    new THREE.Object3D();

  /*
   * ======================================================
   * DRAW CALL 1 — WALL WEAR
   * ======================================================
   */

  const wallWear =
    new THREE.InstancedMesh(
      wallPatchGeometry,
      wallMaterial,
      WALL_PATCHES_V29.length
    );

  wallWear.name =
    "cw06-v29-wall-surface-breakup";

  WALL_PATCHES_V29.forEach(
    (
      patch,
      index
    ) => {
      setInstanceV29({
        mesh:
          wallWear,

        index,

        dummy,

        position:
          {
            x:
              patch.x,

            y:
              patch.y,

            z:
              patch.z
          },

        rotation:
          {
            x: 0,
            y:
              patch.rotationY,
            z:
              (
                index % 2 === 0
                  ? -1
                  : 1
              ) *
              0.025
          },

        scale:
          {
            x:
              patch.scaleX,

            y:
              patch.scaleY,

            z: 1
          }
      });
    }
  );

  finalizeInstancedV29(
    wallWear
  );

  /*
   * ======================================================
   * DRAW CALL 2 — FLOOR SCUFF / AGE
   * ======================================================
   */

  const floorScuffs =
    new THREE.InstancedMesh(
      floorScuffGeometry,
      floorMaterial,
      FLOOR_SCUFFS_V29.length
    );

  floorScuffs.name =
    "cw06-v29-floor-surface-breakup";

  FLOOR_SCUFFS_V29.forEach(
    (
      patch,
      index
    ) => {
      setInstanceV29({
        mesh:
          floorScuffs,

        index,

        dummy,

        position:
          {
            x:
              patch.x,

            y:
              0.021 +
              (
                index % 2
              ) *
              0.001,

            z:
              patch.z
          },

        rotation:
          {
            x:
              -Math.PI / 2,

            y: 0,

            z:
              patch.rotationZ
          },

        scale:
          {
            x:
              patch.scaleX,

            y:
              patch.scaleY,

            z: 1
          }
      });
    }
  );

  finalizeInstancedV29(
    floorScuffs
  );

  /*
   * ======================================================
   * DRAW CALL 3 — DESK WOOD-GRAIN BREAKUP
   * ======================================================
   */

  const deskGrain =
    new THREE.InstancedMesh(
      deskGrainGeometry,
      woodMaterial,
      profile.deskGrainCount
    );

  deskGrain.name =
    "cw06-v29-desk-wood-grain";

  for (
    let index = 0;
    index <
      profile.deskGrainCount;
    index += 1
  ) {
    const seat =
      seatToWorld(
        index
      );

    setInstanceV29({
      mesh:
        deskGrain,

      index,

      dummy,

      position:
        {
          x:
            seat.x,

          y:
            0.857,

          z:
            seat.z -
            0.405
        },

      rotation:
        {
          x:
            -Math.PI / 2,

          y: 0,

          z:
            (
              index % 2 === 0
                ? -1
                : 1
            ) *
            0.012
        },

      scale:
        {
          x:
            0.94 +
            (
              index % 3
            ) *
            0.025,

          y:
            0.94,

          z: 1
        }
    });
  }

  finalizeInstancedV29(
    deskGrain
  );

  /*
   * ======================================================
   * DRAW CALL 4 — BLACKBOARD CHALK / SURFACE BREAKUP
   * ======================================================
   */

  const boardSmudges =
    new THREE.InstancedMesh(
      boardSmudgeGeometry,
      boardMaterial,
      profile.boardSmudgeCount
    );

  boardSmudges.name =
    "cw06-v29-board-surface-breakup";

  const boardDefinitions =
    [
      {
        x: -2.45,
        y: 2.53,
        scaleX: 0.86,
        scaleY: 0.76
      },
      {
        x: -0.74,
        y: 1.88,
        scaleX: 1.04,
        scaleY: 0.88
      },
      {
        x: 1.12,
        y: 2.48,
        scaleX: 0.96,
        scaleY: 0.80
      },
      {
        x: 2.72,
        y: 1.82,
        scaleX: 0.76,
        scaleY: 0.70
      }
    ];

  boardDefinitions.forEach(
    (
      definition,
      index
    ) => {
      setInstanceV29({
        mesh:
          boardSmudges,

        index,

        dummy,

        position:
          {
            x:
              definition.x,

            y:
              definition.y,

            z:
              -7.438
          },

        rotation:
          {
            x: 0,
            y: 0,
            z:
              (
                index % 2 === 0
                  ? -1
                  : 1
              ) *
              0.018
          },

        scale:
          {
            x:
              definition.scaleX,

            y:
              definition.scaleY,

            z: 1
          }
      });
    }
  );

  finalizeInstancedV29(
    boardSmudges
  );

  /*
   * ======================================================
   * DRAW CALL 5 + 6 — WINDOW SILHOUETTES
   * ======================================================
   *
   * Two independent layers:
   *
   * foliage = nearer / darker
   * skyline = farther / cooler
   *
   * Both derive position from canonical ArchitectureV2
   * window layout instead of duplicating window coordinates.
   */

  const windowBlueprints =
    createWindowSilhouetteBlueprintsV29();

  const skyline =
    new THREE.InstancedMesh(
      skylineGeometry,
      skylineMaterial,
      windowBlueprints.length
    );

  skyline.name =
    "cw06-v29-window-skyline";

  const foliage =
    new THREE.InstancedMesh(
      foliageGeometry,
      foliageMaterial,
      windowBlueprints.length
    );

  foliage.name =
    "cw06-v29-window-foreground-foliage";

  windowBlueprints.forEach(
    (
      entry,
      index
    ) => {
      setInstanceV29({
        mesh:
          skyline,

        index,

        dummy,

        position:
          entry.skyline,

        rotation:
          {
            x: 0,
            y:
              -Math.PI / 2,
            z: 0
          },

        scale:
          {
            x:
              entry.skyline
                .scaleX,

            y:
              entry.skyline
                .scaleY,

            z: 1
          }
      });

      setInstanceV29({
        mesh:
          foliage,

        index,

        dummy,

        position:
          entry.foliage,

        rotation:
          {
            x: 0,
            y:
              -Math.PI / 2,
            z: 0
          },

        scale:
          {
            x:
              entry.foliage
                .scaleX,

            y:
              entry.foliage
                .scaleY,

            z: 1
          }
      });
    }
  );

  finalizeInstancedV29(
    skyline
  );

  finalizeInstancedV29(
    foliage
  );

  root.add(
    wallWear,
    floorScuffs,
    deskGrain,
    boardSmudges,
    skyline,
    foliage
  );

  disableRaycastV29(
    root
  );

  freezeObjectV29(
    root
  );

  scene.add(
    root
  );

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      id:
        profile.id,

      textureCount:
        Object.keys(
          textures
        ).length,

      wallWearCount:
        WALL_PATCHES_V29.length,

      floorScuffCount:
        FLOOR_SCUFFS_V29.length,

      deskGrainCount:
        profile.deskGrainCount,

      boardSmudgeCount:
        profile.boardSmudgeCount,

      skylineInstanceCount:
        windowBlueprints.length,

      foliageInstanceCount:
        windowBlueprints.length,

      staticVisualDrawCalls:
        root.children.length,

      runtimeSceneTraversal:
        false,

      runtimeAnimation:
        false,

      rendererAuthorityMutations:
        0,

      fogAuthorityMutations:
        0,

      shadowMapMutations:
        0,

      collisionAuthority:
        "preserved",

      interactionAuthority:
        "preserved",

      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    scene.remove(
      root
    );

    for (
      const geometry
      of geometries
    ) {
      geometry.dispose();
    }

    for (
      const material
      of materials
    ) {
      material.dispose();
    }

    for (
      const texture
      of Object.values(
        textures
      )
    ) {
      texture.dispose();
    }
  }

  return Object.freeze({
    root,
    textures,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_REFERENCE_SURFACE_V29_PROFILE,
  configurePixelTextureV29,
  createClassroomReferenceSurfaceSilhouetteV29,
  createReferenceSurfaceTextureSetV29,
  createWindowSilhouetteBlueprintsV29
};
