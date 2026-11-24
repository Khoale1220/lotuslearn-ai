import * as THREE from "three";

import {
  getClassroomWindowLayout
} from "./classroomArchitectureV2.js";

const CLASSROOM_REFERENCE_LIGHT_FRAMING_V30_PROFILE =
  Object.freeze({
    id:
      "cw06-reference-light-framing-v30",

    artDirection:
      "reference-driven-vga-cinematic-light-shapes",

    windowLightShaftCount:
      3,

    mullionShadowCount:
      9,

    boardFrameCount:
      4,

    cornerFrameCount:
      4,

    teacherFocusCount:
      1,

    staticVisualDrawCalls:
      5,

    addedRealLights:
      0,

    addedShadowCastingLights:
      0,

    cameraProjectionMutations:
      0,

    rendererAuthorityMutations:
      0,

    fogAuthorityMutations:
      0,

    shadowMapMutations:
      0,

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

const BOARD_FRAME_COLORS_V30 =
  Object.freeze([
    0xe6c78e,
    0x24142d,
    0x4f8996,
    0xc87655
  ]);

function disableRaycastV30(
  object
) {
  object.raycast =
    function noV30Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V30:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function freezeObjectV30(
  object
) {
  object.matrixAutoUpdate =
    false;

  object.updateMatrix();

  return object;
}

function setInstanceV30({
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

function finalizeInstancedV30(
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

  disableRaycastV30(
    mesh
  );

  freezeObjectV30(
    mesh
  );

  return mesh;
}

function createLightShaftGeometryV30() {
  const geometry =
    new THREE.BufferGeometry();

  /*
   * One graphic diagonal beam.
   *
   * Instance origin is placed beside each canonical window.
   *
   * Near edge:
   *   x ~= window wall
   *
   * Far edge:
   *   reaches into the classroom and toward the floor.
   *
   * The shape is intentionally hard-edged rather than
   * physically volumetric. The 240p renderer turns these
   * edges into the desired VGA/pixel-light language.
   */

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        0.00,  0.72, 0.00,
        0.00, -0.62, 0.00,
       -5.15, -2.48, 0.00,
       -5.15, -2.12, 0.00
      ]),
      3
    )
  );

  geometry.setIndex([
    0,
    1,
    2,

    0,
    2,
    3
  ]);

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createWindowLightBlueprintsV30() {
  const windows =
    getClassroomWindowLayout();

  const shafts =
    [];

  const mullions =
    [];

  windows.forEach(
    (
      windowDefinition,
      windowIndex
    ) => {
      shafts.push(
        Object.freeze({
          id:
            windowDefinition.id,

          x:
            6.88,

          y:
            2.39,

          z:
            windowDefinition.z,

          yaw:
            (
              windowIndex - 1
            ) *
            0.025
        })
      );

      const offsets =
        [
          -0.56,
          0,
          0.56
        ];

      offsets.forEach(
        (
          offset,
          mullionIndex
        ) => {
          mullions.push(
            Object.freeze({
              windowId:
                windowDefinition.id,

              x:
                4.56,

              y:
                0.024,

              z:
                windowDefinition.z +
                offset,

              yaw:
                -0.045 +
                windowIndex * 0.025 +
                mullionIndex * 0.012
            })
          );
        }
      );
    }
  );

  return Object.freeze({
    shafts:
      Object.freeze(
        shafts
      ),

    mullions:
      Object.freeze(
        mullions
      )
  });
}

function createClassroomReferenceLightFramingV30({
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
      "V30 requires THREE.Scene"
    );
  }

  const profile =
    CLASSROOM_REFERENCE_LIGHT_FRAMING_V30_PROFILE;

  const root =
    new THREE.Group();

  root.name =
    "classroom-reference-light-framing-v30";

  root.userData = {
    cw06V30:
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

  const shaftGeometry =
    ownGeometry(
      createLightShaftGeometryV30()
    );

  const mullionGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        4.15,
        0.012,
        0.055
      )
    );

  const frameGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        1,
        1,
        1
      )
    );

  const cornerGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        1,
        1,
        1
      )
    );

  const focusGeometry =
    ownGeometry(
      new THREE.PlaneGeometry(
        3.35,
        2.25
      )
    );

  /*
   * ======================================================
   * MATERIALS
   * ======================================================
   *
   * No real lights.
   * No shadow map.
   * No shader pipeline mutation.
   *
   * These are graphic light / darkness shapes.
   */

  const shaftMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0xffc98b,

        transparent:
          true,

        opacity:
          0.095,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );

  shaftMaterial.forceSinglePass =
    true;

  const mullionMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x170c22,

        transparent:
          true,

        opacity:
          0.26,

        depthWrite:
          false,

        toneMapped:
          false
      })
    );

  const boardFrameMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        vertexColors:
          true,

        toneMapped:
          false
      })
    );

  const cornerMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0x140b1e,

        transparent:
          true,

        opacity:
          0.74,

        toneMapped:
          false
      })
    );

  const focusMaterial =
    ownMaterial(
      new THREE.MeshBasicMaterial({
        color:
          0xe8a26b,

        transparent:
          true,

        opacity:
          0.075,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );

  focusMaterial.forceSinglePass =
    true;

  const dummy =
    new THREE.Object3D();

  const windowBlueprints =
    createWindowLightBlueprintsV30();

  /*
   * ======================================================
   * DRAW CALL 1 — WINDOW AIR LIGHT SHAFTS
   * ======================================================
   */

  const shafts =
    new THREE.InstancedMesh(
      shaftGeometry,
      shaftMaterial,
      windowBlueprints
        .shafts
        .length
    );

  shafts.name =
    "cw06-v30-window-air-light-shafts";

  shafts.renderOrder =
    2;

  windowBlueprints
    .shafts
    .forEach(
      (
        definition,
        index
      ) => {
        setInstanceV30({
          mesh:
            shafts,

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

              y:
                definition.yaw,

              z: 0
            }
        });
      }
    );

  finalizeInstancedV30(
    shafts
  );

  /*
   * ======================================================
   * DRAW CALL 2 — MULLION SHADOW STRIPES
   * ======================================================
   */

  const mullionShadows =
    new THREE.InstancedMesh(
      mullionGeometry,
      mullionMaterial,
      windowBlueprints
        .mullions
        .length
    );

  mullionShadows.name =
    "cw06-v30-mullion-shadow-stripes";

  mullionShadows.renderOrder =
    1;

  windowBlueprints
    .mullions
    .forEach(
      (
        definition,
        index
      ) => {
        setInstanceV30({
          mesh:
            mullionShadows,

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

              y:
                definition.yaw,

              z: 0
            },

          scale:
            {
              x:
                0.95 +
                (
                  index %
                  3
                ) *
                0.035,

              y: 1,

              z: 1
            }
        });
      }
    );

  finalizeInstancedV30(
    mullionShadows
  );

  /*
   * ======================================================
   * DRAW CALL 3 — BLACKBOARD CINEMATIC FRAME
   * ======================================================
   *
   * Four compact rails reinforce the front focal plane.
   *
   * warm cream  = upper key-light edge
   * deep plum   = lower separation
   * cyan        = cool side accent
   * orange      = warm opposing side accent
   */

  const boardFrame =
    new THREE.InstancedMesh(
      frameGeometry,
      boardFrameMaterial,
      profile.boardFrameCount
    );

  boardFrame.name =
    "cw06-v30-blackboard-cinematic-frame";

  const boardFrameDefinitions =
    [
      {
        position:
          {
            x: 0,
            y: 3.34,
            z: -7.405
          },

        scale:
          {
            x: 6.55,
            y: 0.055,
            z: 0.045
          }
      },

      {
        position:
          {
            x: 0,
            y: 1.05,
            z: -7.405
          },

        scale:
          {
            x: 6.55,
            y: 0.050,
            z: 0.045
          }
      },

      {
        position:
          {
            x: -3.275,
            y: 2.195,
            z: -7.405
          },

        scale:
          {
            x: 0.052,
            y: 2.34,
            z: 0.045
          }
      },

      {
        position:
          {
            x: 3.275,
            y: 2.195,
            z: -7.405
          },

        scale:
          {
            x: 0.052,
            y: 2.34,
            z: 0.045
          }
      }
    ];

  boardFrameDefinitions.forEach(
    (
      definition,
      index
    ) => {
      setInstanceV30({
        mesh:
          boardFrame,

        index,

        dummy,

        position:
          definition.position,

        scale:
          definition.scale,

        color:
          BOARD_FRAME_COLORS_V30[
            index
          ]
      });
    }
  );

  finalizeInstancedV30(
    boardFrame
  );

  /*
   * ======================================================
   * DRAW CALL 4 — ROOM-CORNER DARK FRAME
   * ======================================================
   *
   * Large, narrow deep-plum silhouettes strengthen
   * foreground / edge framing without a screen-space
   * vignette or post-processing pass.
   */

  const cornerFrames =
    new THREE.InstancedMesh(
      cornerGeometry,
      cornerMaterial,
      profile.cornerFrameCount
    );

  cornerFrames.name =
    "cw06-v30-room-corner-framing";

  const cornerDefinitions =
    [
      {
        x: -7.03,
        z: -7.03
      },

      {
        x: 7.03,
        z: -7.03
      },

      {
        x: -7.03,
        z: 7.03
      },

      {
        x: 7.03,
        z: 7.03
      }
    ];

  cornerDefinitions.forEach(
    (
      definition,
      index
    ) => {
      setInstanceV30({
        mesh:
          cornerFrames,

        index,

        dummy,

        position:
          {
            x:
              definition.x,

            y:
              2.02,

            z:
              definition.z
          },

        scale:
          {
            x:
              0.11,

            y:
              4.02,

            z:
              0.11
          }
      });
    }
  );

  finalizeInstancedV30(
    cornerFrames
  );

  /*
   * ======================================================
   * DRAW CALL 5 — TEACHER-STATION FOCAL LIGHT
   * ======================================================
   *
   * One low-opacity warm plane.
   *
   * This is not a Light object and therefore cannot
   * generate or allocate a shadow map.
   */

  const teacherFocus =
    new THREE.InstancedMesh(
      focusGeometry,
      focusMaterial,
      profile.teacherFocusCount
    );

  teacherFocus.name =
    "cw06-v30-teacher-station-focus";

  teacherFocus.renderOrder =
    1;

  setInstanceV30({
    mesh:
      teacherFocus,

    index:
      0,

    dummy,

    position:
      {
        x:
          teacherAnchor.x,

        y:
          0.018,

        z:
          teacherAnchor.z -
          0.18
      },

    rotation:
      {
        x:
          -Math.PI / 2,

        y: 0,

        z:
          -0.035
      },

    scale:
      {
        x:
          1.0,

        y:
          0.82,

        z: 1
      }
  });

  finalizeInstancedV30(
    teacherFocus
  );

  root.add(
    shafts,
    mullionShadows,
    boardFrame,
    cornerFrames,
    teacherFocus
  );

  disableRaycastV30(
    root
  );

  freezeObjectV30(
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

      windowLightShaftCount:
        windowBlueprints
          .shafts
          .length,

      mullionShadowCount:
        windowBlueprints
          .mullions
          .length,

      boardFrameCount:
        profile.boardFrameCount,

      cornerFrameCount:
        profile.cornerFrameCount,

      teacherFocusCount:
        profile.teacherFocusCount,

      staticVisualDrawCalls:
        root.children.length,

      addedRealLights:
        0,

      addedShadowCastingLights:
        0,

      cameraProjectionMutations:
        0,

      rendererAuthorityMutations:
        0,

      fogAuthorityMutations:
        0,

      shadowMapMutations:
        0,

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
  CLASSROOM_REFERENCE_LIGHT_FRAMING_V30_PROFILE,
  createClassroomReferenceLightFramingV30,
  createLightShaftGeometryV30,
  createWindowLightBlueprintsV30
};
