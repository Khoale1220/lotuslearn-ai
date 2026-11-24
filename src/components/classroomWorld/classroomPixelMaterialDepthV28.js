import * as THREE from "three";

import {
  getClassroomWindowLayout
} from "./classroomArchitectureV2.js";

import {
  seatToWorld
} from "./classroomWorldContract.js";

const CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE =
  Object.freeze({
    id:
      "cw06-pixel-material-depth-v28",

    artDirection:
      "high-detail-vga-layered-pixel-shading",

    seatDepthCueCount:
      12,

    windowLightPoolCount:
      3,

    windowBaseBandCount:
      3,

    boardAccentCount:
      2,

    staticVisualDrawCalls:
      6,

    runtimeSceneTraversal:
      false,

    runtimeAnimation:
      false,

    fogAuthorityMutations:
      0,

    rendererAuthorityMutations:
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

const WARM_EDGE_COLORS_V28 =
  Object.freeze([
    0xd59a68,
    0xc9865b,
    0xe1b477,
    0xb97052
  ]);

const COOL_EDGE_COLORS_V28 =
  Object.freeze([
    0x3f7588,
    0x4d8a96,
    0x315f77,
    0x5594a0
  ]);

const BOARD_ACCENT_COLORS_V28 =
  Object.freeze([
    0xe7c481,
    0x4d8895
  ]);

function disableRaycastV28(
  object
) {
  object.raycast =
    function noV28Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V28:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function freezeObjectV28(
  object
) {
  object.matrixAutoUpdate =
    false;

  object.updateMatrix();

  return object;
}

function setInstanceV28({
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
    },
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

function finalizeInstancedV28(
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

  disableRaycastV28(
    mesh
  );

  freezeObjectV28(
    mesh
  );

  return mesh;
}

function createSeatDepthBlueprintsV28(
  count =
    CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE
      .seatDepthCueCount
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

        contact:
          Object.freeze({
            x:
              seat.x,

            z:
              seat.z -
              0.04,

            scaleX:
              0.92 +
              (
                index % 3
              ) * 0.04,

            scaleY:
              0.86 +
              (
                index % 2
              ) * 0.04
          }),

        warmEdge:
          Object.freeze({
            x:
              seat.x,

            y:
              0.846,

            z:
              seat.z -
              0.545,

            yaw:
              side * 0.012
          }),

        coolEdge:
          Object.freeze({
            x:
              seat.x +
              side * 0.405,

            y:
              0.837,

            z:
              seat.z -
              0.40,

            yaw:
              side * 0.018
          })
      })
    );
  }

  return Object.freeze(
    result
  );
}

function createWindowDepthBlueprintsV28() {
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

            z:
              definition.z,

            pool:
              Object.freeze({
                /*
                 * Window wall lives at x ~= 7.04.
                 * Pull light inward onto the classroom floor.
                 */
                x:
                  5.15,

                y:
                  0.016,

                z:
                  definition.z +
                  (
                    index - 1
                  ) * 0.08
              }),

            wallBand:
              Object.freeze({
                x:
                  6.93,

                y:
                  0.12,

                z:
                  definition.z
              })
          })
      )
  );
}

function createClassroomPixelMaterialDepthV28({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V28 requires THREE.Scene"
    );
  }

  const profile =
    CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE;

  const root =
    new THREE.Group();

  root.name =
    "classroom-pixel-material-depth-v28";

  root.userData = {
    cw06V28:
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

  /*
   * ======================================================
   * GEOMETRY
   * ======================================================
   */

  const contactGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        1.34,
        0.78
      )
    );

  const warmDeskEdgeGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.82,
        0.026,
        0.038
      )
    );

  const coolDeskEdgeGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.038,
        0.024,
        0.46
      )
    );

  const windowPoolGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        3.15,
        2.05
      )
    );

  const windowBaseGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.055,
        0.22,
        2.48
      )
    );

  const boardAccentGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        2.10,
        0.028,
        0.038
      )
    );

  /*
   * ======================================================
   * MATERIAL LANGUAGE
   * ======================================================
   *
   * Deliberately layered and graphic rather than PBR-heavy.
   *
   * - deep plum = contact / separation
   * - warm orange = key-light facing edges
   * - cyan = window / cool-side accents
   * - cream = chalkboard/front focal highlight
   *
   * No renderer state is changed.
   */

  const contactMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x120b1d,

        transparent:
          true,

        opacity:
          0.43,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );

  const warmDeskEdgeMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  const coolDeskEdgeMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  const windowPoolMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x7fcbd4,

        transparent:
          true,

        opacity:
          0.105,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );

  const windowBaseMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x1b1026,

        transparent:
          true,

        opacity:
          0.78,

        toneMapped:
          false
      })
    );

  const boardAccentMaterial =
    ownMaterial(
      new THREE.MeshLambertMaterial({
        color:
          0xffffff,

        vertexColors:
          true
      })
    );

  /*
   * ======================================================
   * DRAW CALL 1 — CONTACT DARKNESS
   * ======================================================
   */

  const seatBlueprints =
    createSeatDepthBlueprintsV28();

  const contacts =
    new THREE.InstancedMesh(
      contactGeometry,
      contactMaterial,
      seatBlueprints.length
    );

  contacts.name =
    "cw06-v28-seat-contact-darkness";

  contacts.renderOrder =
    -3;

  /*
   * ======================================================
   * DRAW CALL 2 — WARM DESK EDGE
   * ======================================================
   */

  const warmEdges =
    new THREE.InstancedMesh(
      warmDeskEdgeGeometry,
      warmDeskEdgeMaterial,
      seatBlueprints.length
    );

  warmEdges.name =
    "cw06-v28-warm-desk-rims";

  /*
   * ======================================================
   * DRAW CALL 3 — COOL DESK EDGE
   * ======================================================
   */

  const coolEdges =
    new THREE.InstancedMesh(
      coolDeskEdgeGeometry,
      coolDeskEdgeMaterial,
      seatBlueprints.length
    );

  coolEdges.name =
    "cw06-v28-cool-desk-rims";

  const dummy =
    new THREE.Object3D();

  seatBlueprints.forEach(
    (
      entry,
      index
    ) => {
      setInstanceV28({
        mesh:
          contacts,

        index,

        dummy,

        position:
          {
            x:
              entry.contact.x,

            y:
              0.013,

            z:
              entry.contact.z
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
              0.018
          },

        scale:
          {
            x:
              entry.contact
                .scaleX,

            y:
              entry.contact
                .scaleY,

            z: 1
          }
      });

      setInstanceV28({
        mesh:
          warmEdges,

        index,

        dummy,

        position:
          {
            x:
              entry.warmEdge.x,

            y:
              entry.warmEdge.y,

            z:
              entry.warmEdge.z
          },

        rotation:
          {
            x: 0,

            y:
              entry.warmEdge.yaw,

            z: 0
          },

        color:
          WARM_EDGE_COLORS_V28[
            index %
            WARM_EDGE_COLORS_V28.length
          ]
      });

      setInstanceV28({
        mesh:
          coolEdges,

        index,

        dummy,

        position:
          {
            x:
              entry.coolEdge.x,

            y:
              entry.coolEdge.y,

            z:
              entry.coolEdge.z
          },

        rotation:
          {
            x: 0,

            y:
              entry.coolEdge.yaw,

            z: 0
          },

        color:
          COOL_EDGE_COLORS_V28[
            index %
            COOL_EDGE_COLORS_V28.length
          ]
      });
    }
  );

  finalizeInstancedV28(
    contacts
  );

  finalizeInstancedV28(
    warmEdges
  );

  finalizeInstancedV28(
    coolEdges
  );

  /*
   * ======================================================
   * DRAW CALL 4 — WINDOW LIGHT POOLS
   * ======================================================
   */

  const windowBlueprints =
    createWindowDepthBlueprintsV28();

  const windowPools =
    new THREE.InstancedMesh(
      windowPoolGeometry,
      windowPoolMaterial,
      windowBlueprints.length
    );

  windowPools.name =
    "cw06-v28-window-light-pools";

  windowPools.renderOrder =
    -2;

  /*
   * ======================================================
   * DRAW CALL 5 — WINDOW WALL BASE DARKNESS
   * ======================================================
   */

  const windowBaseBands =
    new THREE.InstancedMesh(
      windowBaseGeometry,
      windowBaseMaterial,
      windowBlueprints.length
    );

  windowBaseBands.name =
    "cw06-v28-window-wall-depth-bands";

  windowBlueprints.forEach(
    (
      entry,
      index
    ) => {
      setInstanceV28({
        mesh:
          windowPools,

        index,

        dummy,

        position:
          entry.pool,

        rotation:
          {
            x:
              -Math.PI / 2,

            y: 0,

            z:
              -0.11
          },

        scale:
          {
            x:
              1.0,

            y:
              1.0 +
              (
                index === 1
                  ? 0.08
                  : 0
              ),

            z: 1
          }
      });

      setInstanceV28({
        mesh:
          windowBaseBands,

        index,

        dummy,

        position:
          entry.wallBand
      });
    }
  );

  finalizeInstancedV28(
    windowPools
  );

  finalizeInstancedV28(
    windowBaseBands
  );

  /*
   * ======================================================
   * DRAW CALL 6 — FRONT-BOARD FOCAL ACCENTS
   * ======================================================
   *
   * A warm lower rim + cyan side rim makes the blackboard
   * read as a focal plane without replacing V24/V27 art.
   */

  const boardAccents =
    new THREE.InstancedMesh(
      boardAccentGeometry,
      boardAccentMaterial,
      profile.boardAccentCount
    );

  boardAccents.name =
    "cw06-v28-board-focal-accents";

  setInstanceV28({
    mesh:
      boardAccents,

    index:
      0,

    dummy,

    position:
      {
        x:
          -1.22,

        y:
          1.125,

        z:
          -7.455
      },

    scale:
      {
        x:
          1.06,

        y: 1,

        z: 1
      },

    color:
      BOARD_ACCENT_COLORS_V28[0]
  });

  setInstanceV28({
    mesh:
      boardAccents,

    index:
      1,

    dummy,

    position:
      {
        x:
          1.22,

        y:
          1.125,

        z:
          -7.455
      },

    scale:
      {
        x:
          1.06,

        y: 1,

        z: 1
      },

    color:
      BOARD_ACCENT_COLORS_V28[1]
  });

  finalizeInstancedV28(
    boardAccents
  );

  root.add(
    contacts,
    warmEdges,
    coolEdges,
    windowPools,
    windowBaseBands,
    boardAccents
  );

  disableRaycastV28(
    root
  );

  freezeObjectV28(
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

      seatDepthCueCount:
        seatBlueprints.length,

      windowLightPoolCount:
        windowBlueprints.length,

      windowBaseBandCount:
        windowBlueprints.length,

      boardAccentCount:
        profile.boardAccentCount,

      staticVisualDrawCalls:
        root.children.length,

      runtimeSceneTraversal:
        false,

      runtimeAnimation:
        false,

      fogAuthorityMutations:
        0,

      rendererAuthorityMutations:
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
  }

  return Object.freeze({
    root,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE,
  createClassroomPixelMaterialDepthV28,
  createSeatDepthBlueprintsV28,
  createWindowDepthBlueprintsV28
};
