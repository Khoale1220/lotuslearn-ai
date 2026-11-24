import * as THREE from "three";

import {
  seatToWorld
} from "./classroomWorldContract.js";

const CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE =
  Object.freeze({
    id:
      "cw06-prop-density-lighting-v27",

    artDirection:
      "cinematic-high-detail-vga-classroom",

    seatPropCount:
      12,

    teacherBookCount:
      3,

    teacherPaperCount:
      2,

    wallCardCount:
      4,

    shadowPocketCount:
      6,

    chalkPieceCount:
      5,

    staticVisualDrawCalls:
      6,

    sunlightIntensityMultiplier:
      1.06,

    hemisphereIntensityMultiplier:
      0.82,

    runtimeSceneTraversal:
      false,

    runtimeAnimation:
      false,

    collisionAuthority:
      "preserved",

    interactionAuthority:
      "preserved",

    visualOnly:
      true,

    deterministic:
      true
  });

const BOOK_COLORS_V27 =
  Object.freeze([
    0x25152f,
    0x663245,
    0xa85b4e,
    0x39728a,
    0xc59c58
  ]);

const PAPER_COLORS_V27 =
  Object.freeze([
    0xf2d4a3,
    0xe7c38a,
    0xb7dce0,
    0xd68559
  ]);

const WALL_CARD_COLORS_V27 =
  Object.freeze([
    0x302039,
    0x3d8295,
    0xd37250,
    0xe6c68c
  ]);

function disableRaycastV27(
  object
) {
  object.raycast =
    function noV27Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V27:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function freezeStaticObjectV27(
  object
) {
  object.matrixAutoUpdate =
    false;

  object.updateMatrix();

  return object;
}

function finalizeInstancedMeshV27(
  mesh
) {
  mesh.instanceMatrix.needsUpdate =
    true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate =
      true;
  }

  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();

  disableRaycastV27(
    mesh
  );

  freezeStaticObjectV27(
    mesh
  );

  return mesh;
}

function setInstanceV27({
  mesh,
  index,
  dummy,
  position,
  rotation,
  scale,
  color
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

  if (
    color !==
    undefined
  ) {
    mesh.setColorAt(
      index,
      new THREE.Color(
        color
      )
    );
  }
}

function createSeatPropBlueprintsV27(
  count =
    CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE
      .seatPropCount
) {
  const result =
    [];

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const seat =
      seatToWorld(
        index
      );

    const side =
      index % 2 === 0
        ? -1
        : 1;

    result.push(
      Object.freeze({
        seatIndex:
          index,

        book:
          Object.freeze({
            x:
              seat.x +
              side * 0.16,

            y:
              0.84 +
              (
                index % 3
              ) * 0.006,

            z:
              seat.z -
              0.42,

            yaw:
              side * 0.09
          }),

        paper:
          Object.freeze({
            x:
              seat.x -
              side * 0.12,

            y:
              0.835 +
              (
                index % 2
              ) * 0.004,

            z:
              seat.z -
              0.38,

            yaw:
              -side * 0.055
          })
      })
    );
  }

  return Object.freeze(
    result
  );
}

function discoverLightingV27(
  scene
) {
  let hemisphere =
    null;

  let sunlight =
    scene.getObjectByName(
      "classroom-window-sun"
    ) ?? null;

  scene.traverse(
    (object) => {
      if (
        !hemisphere &&
        object.isHemisphereLight ===
          true
      ) {
        hemisphere =
          object;
      }

      if (
        !sunlight &&
        object.isDirectionalLight ===
          true
      ) {
        sunlight =
          object;
      }
    }
  );

  return {
    hemisphere,
    sunlight
  };
}

function createClassroomPropDensityLightingV27({
  scene,
  teacherAnchor =
    {
      x: 0,
      z: 0
    }
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V27 requires THREE.Scene"
    );
  }

  const profile =
    CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE;

  const root =
    new THREE.Group();

  root.name =
    "classroom-prop-density-lighting-v27";

  root.userData = {
    cw06V27:
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

  const bookGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.30,
        0.055,
        0.22
      )
    );

  const paperGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.32,
        0.014,
        0.235
      )
    );

  const shadowGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        1.65,
        1.20
      )
    );

  const wallCardGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        0.76,
        0.52
      )
    );

  const chalkGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.16,
        0.025,
        0.025
      )
    );

  const penCupGeometry =
    ownGeometry(
      new THREE.CylinderGeometry(
        0.075,
        0.09,
        0.18,
        8
      )
    );

  const bookMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  const paperMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  const shadowMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x100b19,

        transparent:
          true,

        opacity:
          0.32,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );

  const wallCardMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true,

        side:
          THREE.DoubleSide
      })
    );

  const chalkMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  const penCupMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0x294b59
      })
    );

  const seatProps =
    createSeatPropBlueprintsV27();

  const bookCount =
    seatProps.length +
    profile.teacherBookCount;

  const paperCount =
    seatProps.length +
    profile.teacherPaperCount;

  const books =
    new THREE.InstancedMesh(
      bookGeometry,
      bookMaterial,
      bookCount
    );

  books.name =
    "cw06-v27-books";

  const papers =
    new THREE.InstancedMesh(
      paperGeometry,
      paperMaterial,
      paperCount
    );

  papers.name =
    "cw06-v27-papers";

  const shadows =
    new THREE.InstancedMesh(
      shadowGeometry,
      shadowMaterial,
      profile.shadowPocketCount
    );

  shadows.name =
    "cw06-v27-shadow-pockets";

  shadows.renderOrder =
    -2;

  const wallCards =
    new THREE.InstancedMesh(
      wallCardGeometry,
      wallCardMaterial,
      profile.wallCardCount
    );

  wallCards.name =
    "cw06-v27-wall-dressing";

  const chalk =
    new THREE.InstancedMesh(
      chalkGeometry,
      chalkMaterial,
      profile.chalkPieceCount
    );

  chalk.name =
    "cw06-v27-board-chalk";

  const dummy =
    new THREE.Object3D();

  /*
   * ------------------------------------------------------
   * STUDENT-DESK BOOKS + PAPERS
   * ------------------------------------------------------
   *
   * Decorative only.
   * The student / desk collision models remain untouched.
   */

  seatProps.forEach(
    (
      entry,
      index
    ) => {
      setInstanceV27({
        mesh:
          books,

        index,

        dummy,

        position:
          {
            x:
              entry.book.x,

            y:
              entry.book.y,

            z:
              entry.book.z
          },

        rotation:
          {
            x: 0,
            y:
              entry.book.yaw,
            z: 0
          },

        scale:
          {
            x:
              1 +
              (
                index % 3
              ) * 0.05,

            y: 1,
            z: 1
          },

        color:
          BOOK_COLORS_V27[
            index %
            BOOK_COLORS_V27.length
          ]
      });

      setInstanceV27({
        mesh:
          papers,

        index,

        dummy,

        position:
          {
            x:
              entry.paper.x,

            y:
              entry.paper.y,

            z:
              entry.paper.z
          },

        rotation:
          {
            x: 0,
            y:
              entry.paper.yaw,
            z: 0
          },

        scale:
          {
            x: 1,
            y: 1,
            z:
              1 +
              (
                index % 2
              ) * 0.08
          },

        color:
          PAPER_COLORS_V27[
            index %
            PAPER_COLORS_V27.length
          ]
      });
    }
  );

  /*
   * ------------------------------------------------------
   * TEACHER STATION CLUTTER
   * ------------------------------------------------------
   */

  for (
    let index = 0;
    index <
      profile.teacherBookCount;
    index += 1
  ) {
    setInstanceV27({
      mesh:
        books,

      index:
        seatProps.length +
        index,

      dummy,

      position:
        {
          x:
            teacherAnchor.x +
            0.34 +
            index * 0.075,

          y:
            1.055 +
            index * 0.052,

          z:
            teacherAnchor.z -
            0.10
        },

      rotation:
        {
          x: 0,
          y:
            -0.10 +
            index * 0.055,
          z: 0
        },

      scale:
        {
          x:
            1.12,
          y: 1,
          z:
            1.06
        },

      color:
        BOOK_COLORS_V27[
          (
            index + 2
          ) %
          BOOK_COLORS_V27.length
        ]
    });
  }

  for (
    let index = 0;
    index <
      profile.teacherPaperCount;
    index += 1
  ) {
    setInstanceV27({
      mesh:
        papers,

      index:
        seatProps.length +
        index,

      dummy,

      position:
        {
          x:
            teacherAnchor.x -
            0.35 +
            index * 0.05,

          y:
            1.042 +
            index * 0.018,

          z:
            teacherAnchor.z +
            0.08
        },

      rotation:
        {
          x: 0,
          y:
            0.07 -
            index * 0.04,
          z: 0
        },

      scale:
        {
          x:
            1.3,
          y: 1,
          z:
            1.15
        },

      color:
        PAPER_COLORS_V27[
          index
        ]
    });
  }

  /*
   * ------------------------------------------------------
   * CHEAP CINEMATIC SHADOW POCKETS
   * ------------------------------------------------------
   *
   * These are not additional real-time shadow maps.
   * They provide deliberate dark-value grouping under
   * furniture clusters at one cheap instanced draw call.
   */

  for (
    let index = 0;
    index <
      profile.shadowPocketCount;
    index += 1
  ) {
    const seat =
      seatToWorld(
        index * 2
      );

    setInstanceV27({
      mesh:
        shadows,

      index,

      dummy,

      position:
        {
          x:
            seat.x,

          y:
            0.012,

          z:
            seat.z -
            0.06
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
            0.025
        },

      scale:
        {
          x:
            0.92 +
            (
              index % 3
            ) * 0.05,

          y:
            0.88,

          z: 1
        }
    });
  }

  /*
   * ------------------------------------------------------
   * WALL DRESSING
   * ------------------------------------------------------
   *
   * Kept toward the side edges of the front wall so
   * the central blackboard remains visually dominant.
   */

  const wallCardDefinitions =
    [
      {
        x: -5.82,
        y: 2.40,
        z: -7.84,
        scaleX: 1.0,
        scaleY: 1.0
      },
      {
        x: -4.82,
        y: 2.46,
        z: -7.835,
        scaleX: 0.78,
        scaleY: 1.15
      },
      {
        x: 4.86,
        y: 2.42,
        z: -7.835,
        scaleX: 0.82,
        scaleY: 1.10
      },
      {
        x: 5.82,
        y: 2.52,
        z: -7.84,
        scaleX: 1.0,
        scaleY: 0.94
      }
    ];

  wallCardDefinitions.forEach(
    (
      definition,
      index
    ) => {
      setInstanceV27({
        mesh:
          wallCards,

        index,

        dummy,

        position:
          {
            x:
              definition.x,

            y:
              definition.y,

            z:
              definition.z
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
          },

        color:
          WALL_CARD_COLORS_V27[
            index
          ]
      });
    }
  );

  /*
   * ------------------------------------------------------
   * CHALK TRAY DETAIL
   * ------------------------------------------------------
   */

  for (
    let index = 0;
    index <
      profile.chalkPieceCount;
    index += 1
  ) {
    setInstanceV27({
      mesh:
        chalk,

      index,

      dummy,

      position:
        {
          x:
            -0.42 +
            index * 0.20,

          y:
            1.12 +
            (
              index % 2
            ) * 0.012,

          z:
            -7.48
        },

      rotation:
        {
          x: 0,
          y:
            (
              index - 2
            ) * 0.065,
          z: 0
        },

      scale:
        {
          x:
            0.9 +
            (
              index % 2
            ) * 0.18,

          y: 1,
          z: 1
        },

      color:
        index === 1
          ? 0x8ccbd2
          : index === 3
            ? 0xd98960
            : 0xe8d7af
    });
  }

  finalizeInstancedMeshV27(
    books
  );

  finalizeInstancedMeshV27(
    papers
  );

  finalizeInstancedMeshV27(
    shadows
  );

  finalizeInstancedMeshV27(
    wallCards
  );

  finalizeInstancedMeshV27(
    chalk
  );

  /*
   * ------------------------------------------------------
   * TEACHER PEN CUP
   * ------------------------------------------------------
   */

  const penCup =
    new THREE.Mesh(
      penCupGeometry,
      penCupMaterial
    );

  penCup.name =
    "cw06-v27-teacher-pen-cup";

  penCup.position.set(
    teacherAnchor.x -
      0.58,

    1.13,

    teacherAnchor.z -
      0.10
  );

  penCup.rotation.y =
    0.06;

  disableRaycastV27(
    penCup
  );

  freezeStaticObjectV27(
    penCup
  );

  root.add(
    shadows,
    books,
    papers,
    wallCards,
    chalk,
    penCup
  );

  freezeStaticObjectV27(
    root
  );

  scene.add(
    root
  );

  /*
   * ------------------------------------------------------
   * EXISTING LIGHTING RIG — CONTRAST TUNING ONLY
   * ------------------------------------------------------
   *
   * No new runtime light authority.
   * No shadow-map resolution increase.
   */

  const {
    hemisphere,
    sunlight
  } =
    discoverLightingV27(
      scene
    );

  const originalLighting =
    {
      hemisphere:
        hemisphere
          ? {
              intensity:
                hemisphere.intensity,

              color:
                hemisphere.color.clone(),

              groundColor:
                hemisphere.groundColor
                  .clone()
            }
          : null,

      sunlight:
        sunlight
          ? {
              intensity:
                sunlight.intensity,

              color:
                sunlight.color.clone()
            }
          : null
    };

  if (hemisphere) {
    hemisphere.intensity =
      originalLighting
        .hemisphere
        .intensity *
      profile
        .hemisphereIntensityMultiplier;

    hemisphere.color.lerp(
      new THREE.Color(
        0x9ed6df
      ),
      0.08
    );

    hemisphere.groundColor.lerp(
      new THREE.Color(
        0x24152d
      ),
      0.18
    );
  }

  if (sunlight) {
    sunlight.intensity =
      originalLighting
        .sunlight
        .intensity *
      profile
        .sunlightIntensityMultiplier;

    sunlight.color.lerp(
      new THREE.Color(
        0xffc58c
      ),
      0.12
    );
  }

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      id:
        profile.id,

      seatPropCount:
        seatProps.length,

      bookInstanceCount:
        bookCount,

      paperInstanceCount:
        paperCount,

      shadowPocketCount:
        profile.shadowPocketCount,

      wallCardCount:
        profile.wallCardCount,

      chalkPieceCount:
        profile.chalkPieceCount,

      staticVisualDrawCalls:
        profile.staticVisualDrawCalls,

      sunlightFound:
        Boolean(
          sunlight
        ),

      hemisphereFound:
        Boolean(
          hemisphere
        ),

      runtimeSceneTraversal:
        false,

      runtimeAnimation:
        false,

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

    if (
      hemisphere &&
      originalLighting.hemisphere
    ) {
      hemisphere.intensity =
        originalLighting
          .hemisphere
          .intensity;

      hemisphere.color.copy(
        originalLighting
          .hemisphere
          .color
      );

      hemisphere.groundColor.copy(
        originalLighting
          .hemisphere
          .groundColor
      );
    }

    if (
      sunlight &&
      originalLighting.sunlight
    ) {
      sunlight.intensity =
        originalLighting
          .sunlight
          .intensity;

      sunlight.color.copy(
        originalLighting
          .sunlight
          .color
      );
    }

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
  }

  return Object.freeze({
    root,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE,
  createClassroomPropDensityLightingV27,
  createSeatPropBlueprintsV27
};
