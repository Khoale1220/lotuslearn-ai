import * as THREE from "three";

import {
  scoreDeskTopCandidateV47
} from "./classroomDeskSurfacePropsV47.js";

const CLASSROOM_ENVIRONMENTAL_STORY_DENSITY_V49_PROFILE =
  Object.freeze({
    version: 49,

    visualOnly: true,
    deterministic: true,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    deskPropInstancedMeshCount: 1,
    noticeboardLayerInstancedMeshCount: 1,

    totalInstancedMeshCount: 2,
    maximumAddedDrawCalls: 2,

    addedTextures: 0,
    addedSprites: 0,
    addedLights: 0,

    secondAnimationLoop: false,
    secondRaycastAuthority: false,

    noticeboardPolygonOffset: true
  });

const V49_DARK =
  0x211d29;

const V49_DEEP_PLUM =
  0x3c2845;

const V49_CYAN =
  0x4c9fa4;

const V49_CYAN_DARK =
  0x315f6d;

const V49_ORANGE =
  0xd47742;

const V49_ORANGE_DARK =
  0x9d5438;

const V49_CREAM =
  0xe8d7aa;

const V49_CREAM_DARK =
  0xb8a77b;

const V49_GREEN =
  0x64784d;

const V49_ROSE =
  0xb96f6f;

const V49_DESK_COLORS =
  Object.freeze([
    V49_CYAN,
    V49_CYAN_DARK,
    V49_ORANGE,
    V49_ORANGE_DARK,
    V49_GREEN,
    V49_ROSE,
    V49_DEEP_PLUM
  ]);

const V49_NOTICEBOARD_COLORS =
  Object.freeze([
    V49_DARK,
    V49_DEEP_PLUM,
    V49_CYAN,
    V49_ORANGE,
    V49_CREAM,
    V49_CREAM_DARK
  ]);

const V49_AXIS_X =
  new THREE.Vector3(
    1,
    0,
    0
  );

const V49_AXIS_Y =
  new THREE.Vector3(
    0,
    1,
    0
  );

const V49_AXIS_Z =
  new THREE.Vector3(
    0,
    0,
    1
  );

function noV49Raycast() {}

function stableHashV49(
  value
) {
  let hash =
    2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return hash >>> 0;
}

function readGeometryBoundsV49(
  geometry
) {
  if (
    !geometry?.isBufferGeometry
  ) {
    return null;
  }

  if (
    !geometry.boundingBox
  ) {
    geometry.computeBoundingBox();
  }

  if (
    !geometry.boundingBox
  ) {
    return null;
  }

  const size =
    new THREE.Vector3();

  geometry.boundingBox.getSize(
    size
  );

  return Object.freeze({
    size,
    bounds:
      geometry.boundingBox.clone()
  });
}

function deriveDeskStoryPlanV49(
  index
) {
  const hash =
    stableHashV49(
      `lotuslearn-v49-desk-${index}`
    );

  return Object.freeze({
    hash,

    side:
      (hash & 1)
        ? 1
        : -1,

    hasBottle:
      hash % 3 !== 0,

    hasPencilCup:
      hash % 4 !== 0,

    bottleColorIndex:
      hash %
      V49_DESK_COLORS.length,

    cupColorIndex:
      (hash >>> 7) %
      V49_DESK_COLORS.length,

    bottleOffsetX:
      (
        ((hash >>> 10) % 5) -
        2
      ) *
      0.012,

    bottleOffsetZ:
      (
        ((hash >>> 13) % 5) -
        2
      ) *
      0.010,

    cupOffsetX:
      (
        ((hash >>> 16) % 5) -
        2
      ) *
      0.010,

    pencilTiltA:
      (
        ((hash >>> 19) % 5) -
        2
      ) *
      0.035,

    pencilTiltB:
      (
        ((hash >>> 22) % 5) -
        2
      ) *
      0.030
  });
}

function discoverV49Anchors(
  scene
) {
  let deskMesh =
    null;

  let deskScore =
    Number.NEGATIVE_INFINITY;

  let deskCandidateCount =
    0;

  let storyPanelMesh =
    null;

  let storyPaperMesh =
    null;

  let storyRoot =
    null;

  scene.traverse((object) => {
    const currentDeskScore =
      scoreDeskTopCandidateV47(
        object
      );

    if (
      Number.isFinite(
        currentDeskScore
      )
    ) {
      deskCandidateCount += 1;

      if (
        currentDeskScore >
        deskScore
      ) {
        deskScore =
          currentDeskScore;

        deskMesh =
          object;
      }
    }

    if (
      object.name ===
      "classroom-v48-story-panel"
    ) {
      storyPanelMesh =
        object;
    }

    if (
      object.name ===
      "classroom-v48-story-papers"
    ) {
      storyPaperMesh =
        object;
    }

    if (
      object.name ===
      "classroom-v48-wall-story-root"
    ) {
      storyRoot =
        object;
    }
  });

  return Object.freeze({
    deskMesh,
    deskScore,
    deskCandidateCount,

    storyPanelMesh,
    storyPaperMesh,
    storyRoot,

    traversalCount: 1
  });
}

function createPixelMaterialV49({
  polygonOffset = false
} = {}) {
  return new THREE.MeshBasicMaterial({
    color:
      0xffffff,

    toneMapped:
      false,

    depthTest:
      true,

    depthWrite:
      true,

    polygonOffset,

    polygonOffsetFactor:
      polygonOffset
        ? -1
        : 0,

    polygonOffsetUnits:
      polygonOffset
        ? -1
        : 0
  });
}

function createPixelInstanceMeshV49({
  name,
  kind,
  geometry,
  material,
  capacity
}) {
  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      Math.max(
        1,
        capacity
      )
    );

  mesh.name =
    name;

  mesh.count =
    0;

  mesh.castShadow =
    false;

  mesh.receiveShadow =
    false;

  mesh.frustumCulled =
    true;

  mesh.raycast =
    noV49Raycast;

  mesh.layers.set(0);

  mesh.instanceMatrix.setUsage(
    THREE.DynamicDrawUsage
  );

  mesh.userData = {
    ...mesh.userData,

    visualOnly:
      true,

    classroomEnvironmentalStoryDensityV49:
      true,

    kind
  };

  return mesh;
}

function finalizePixelInstancesV49(
  mesh,
  count
) {
  mesh.count =
    count;

  mesh.instanceMatrix.needsUpdate =
    true;

  if (
    mesh.instanceColor
  ) {
    mesh.instanceColor.needsUpdate =
      true;
  }

  if (
    count > 0
  ) {
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }
}

function composePixelMatrixV49({
  baseMatrix,

  x = 0,
  y = 0,
  z = 0,

  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,

  scaleX = 1,
  scaleY = 1,
  scaleZ = 1
}) {
  const basePosition =
    new THREE.Vector3();

  const baseQuaternion =
    new THREE.Quaternion();

  const baseScale =
    new THREE.Vector3();

  baseMatrix.decompose(
    basePosition,
    baseQuaternion,
    baseScale
  );

  const offset =
    new THREE.Vector3(
      x,
      y,
      z
    )
      .multiply(
        baseScale
      )
      .applyQuaternion(
        baseQuaternion
      );

  const position =
    basePosition
      .clone()
      .add(
        offset
      );

  const qx =
    new THREE.Quaternion()
      .setFromAxisAngle(
        V49_AXIS_X,
        rotationX
      );

  const qy =
    new THREE.Quaternion()
      .setFromAxisAngle(
        V49_AXIS_Y,
        rotationY
      );

  const qz =
    new THREE.Quaternion()
      .setFromAxisAngle(
        V49_AXIS_Z,
        rotationZ
      );

  const quaternion =
    baseQuaternion
      .clone()
      .multiply(
        qy
      )
      .multiply(
        qx
      )
      .multiply(
        qz
      );

  const finalScale =
    baseScale
      .clone()
      .multiply(
        new THREE.Vector3(
          scaleX,
          scaleY,
          scaleZ
        )
      );

  const matrix =
    new THREE.Matrix4();

  matrix.compose(
    position,
    quaternion,
    finalScale
  );

  return matrix;
}

function deskSignatureV49(
  deskMesh
) {
  return [
    deskMesh.count,
    deskMesh.instanceMatrix?.version ?? 0
  ].join(":");
}

function createClassroomEnvironmentalStoryDensityV49({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V49 requires scene.traverse"
    );
  }

  const discovery =
    discoverV49Anchors(
      scene
    );

  const deskMesh =
    discovery.deskMesh;

  const storyPanelMesh =
    discovery.storyPanelMesh;

  const storyPaperMesh =
    discovery.storyPaperMesh;

  const storyRoot =
    discovery.storyRoot;

  if (!deskMesh) {
    throw new Error(
      "V49_CANONICAL_DESK_NOT_FOUND"
    );
  }

  if (
    !storyPanelMesh ||
    !storyPaperMesh ||
    !storyRoot
  ) {
    throw new Error(
      "V49_V48_STORY_LAYER_NOT_FOUND"
    );
  }

  if (
    !deskMesh.parent ||
    !storyPanelMesh.parent ||
    !storyPaperMesh.parent
  ) {
    throw new Error(
      "V49_CANONICAL_PARENT_MISSING"
    );
  }

  const deskGeometry =
    readGeometryBoundsV49(
      deskMesh.geometry
    );

  const panelGeometry =
    readGeometryBoundsV49(
      storyPanelMesh.geometry
    );

  const paperGeometry =
    readGeometryBoundsV49(
      storyPaperMesh.geometry
    );

  if (
    !deskGeometry ||
    !panelGeometry ||
    !paperGeometry
  ) {
    throw new Error(
      "V49_GEOMETRY_BOUNDS_MISSING"
    );
  }

  const deskCapacity =
    Math.max(
      1,
      Number(
        deskMesh.instanceMatrix?.count ??
        deskMesh.count ??
        1
      )
    );

  /*
   * Maximum five primitive silhouettes per desk:
   *
   * bottle body
   * bottle cap
   * pencil cup
   * pencil A
   * pencil B
   */
  const deskInstanceCapacity =
    deskCapacity * 5;

  /*
   * Board layer capacity:
   *
   * 4 frame strips
   * up to 16 paper shadows
   * up to 32 pin blocks
   * 8 caption / index bars
   */
  const boardInstanceCapacity =
    60;

  const unitBoxGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const deskMaterial =
    createPixelMaterialV49();

  const noticeboardMaterial =
    createPixelMaterialV49({
      polygonOffset:
        true
    });

  const deskPixelMesh =
    createPixelInstanceMeshV49({
      name:
        "classroom-v49-desk-pixel-props",

      kind:
        "desk-pixel-props",

      geometry:
        unitBoxGeometry,

      material:
        deskMaterial,

      capacity:
        deskInstanceCapacity
    });

  const noticeboardPixelMesh =
    createPixelInstanceMeshV49({
      name:
        "classroom-v49-noticeboard-pixel-layer",

      kind:
        "noticeboard-pixel-layer",

      geometry:
        unitBoxGeometry,

      material:
        noticeboardMaterial,

      capacity:
        boardInstanceCapacity
    });

  const deskRoot =
    new THREE.Group();

  deskRoot.name =
    "classroom-v49-desk-story-root";

  deskRoot.userData = {
    visualOnly:
      true,

    classroomEnvironmentalStoryDensityV49:
      true,

    role:
      "desk-story-density"
  };

  const boardRoot =
    new THREE.Group();

  boardRoot.name =
    "classroom-v49-noticeboard-layer-root";

  boardRoot.userData = {
    visualOnly:
      true,

    classroomEnvironmentalStoryDensityV49:
      true,

    role:
      "noticeboard-layering"
  };

  deskRoot.add(
    deskPixelMesh
  );

  boardRoot.add(
    noticeboardPixelMesh
  );

  /*
   * Mutations only begin after the single
   * construction traversal has completed.
   */
  deskMesh.parent.add(
    deskRoot
  );

  storyPanelMesh.parent.add(
    boardRoot
  );

  const sourceMatrix =
    new THREE.Matrix4();

  const baseMatrix =
    new THREE.Matrix4();

  const panelInstanceMatrix =
    new THREE.Matrix4();

  const panelBaseMatrix =
    new THREE.Matrix4();

  const paperInstanceMatrix =
    new THREE.Matrix4();

  const paperBaseMatrix =
    new THREE.Matrix4();

  const color =
    new THREE.Color();

  const deskBounds =
    deskGeometry.bounds;

  const deskSize =
    deskGeometry.size;

  const deskCenterX =
    (
      deskBounds.min.x +
      deskBounds.max.x
    ) / 2;

  const deskCenterZ =
    (
      deskBounds.min.z +
      deskBounds.max.z
    ) / 2;

  const deskTopY =
    deskBounds.max.y;

  let deskPropCount =
    0;

  let noticeboardLayerCount =
    0;

  let bottleCount =
    0;

  let pencilCupCount =
    0;

  let pencilCount =
    0;

  let paperShadowCount =
    0;

  let pinCount =
    0;

  let frameStripCount =
    0;

  let captionBarCount =
    0;

  let deskRebuildCount =
    0;

  let lastDeskSignature =
    null;

  function appendDeskPrimitive({
    matrix,
    colorHex
  }) {
    if (
      deskPropCount >=
      deskInstanceCapacity
    ) {
      return;
    }

    deskPixelMesh.setMatrixAt(
      deskPropCount,
      matrix
    );

    color.setHex(
      colorHex
    );

    deskPixelMesh.setColorAt(
      deskPropCount,
      color
    );

    deskPropCount += 1;
  }

  function appendBoardPrimitive({
    matrix,
    colorHex
  }) {
    if (
      noticeboardLayerCount >=
      boardInstanceCapacity
    ) {
      return;
    }

    noticeboardPixelMesh.setMatrixAt(
      noticeboardLayerCount,
      matrix
    );

    color.setHex(
      colorHex
    );

    noticeboardPixelMesh.setColorAt(
      noticeboardLayerCount,
      color
    );

    noticeboardLayerCount += 1;
  }

  function rebuildDeskStory() {
    deskPropCount =
      0;

    bottleCount =
      0;

    pencilCupCount =
      0;

    pencilCount =
      0;

    deskMesh.updateMatrix();

    const activeCount =
      Math.min(
        deskMesh.count,
        deskCapacity
      );

    for (
      let index = 0;
      index < activeCount;
      index += 1
    ) {
      const plan =
        deriveDeskStoryPlanV49(
          index
        );

      deskMesh.getMatrixAt(
        index,
        sourceMatrix
      );

      baseMatrix.multiplyMatrices(
        deskMesh.matrix,
        sourceMatrix
      );

      const side =
        plan.side;

      if (
        plan.hasBottle
      ) {
        const bottleX =
          deskCenterX +
          side *
          (
            deskSize.x *
            0.31
          ) +
          plan.bottleOffsetX;

        const bottleZ =
          deskCenterZ -
          deskSize.z *
          0.16 +
          plan.bottleOffsetZ;

        appendDeskPrimitive({
          matrix:
            composePixelMatrixV49({
              baseMatrix,

              x:
                bottleX,

              y:
                deskTopY +
                0.145,

              z:
                bottleZ,

              scaleX:
                0.085,

              scaleY:
                0.27,

              scaleZ:
                0.085
            }),

          colorHex:
            V49_DESK_COLORS[
              plan.bottleColorIndex
            ]
        });

        appendDeskPrimitive({
          matrix:
            composePixelMatrixV49({
              baseMatrix,

              x:
                bottleX,

              y:
                deskTopY +
                0.30,

              z:
                bottleZ,

              scaleX:
                0.058,

              scaleY:
                0.045,

              scaleZ:
                0.058
            }),

          colorHex:
            V49_CREAM
        });

        bottleCount += 1;
      }

      if (
        plan.hasPencilCup
      ) {
        const cupX =
          deskCenterX -
          side *
          (
            deskSize.x *
            0.27
          ) +
          plan.cupOffsetX;

        const cupZ =
          deskCenterZ +
          deskSize.z *
          0.18;

        appendDeskPrimitive({
          matrix:
            composePixelMatrixV49({
              baseMatrix,

              x:
                cupX,

              y:
                deskTopY +
                0.075,

              z:
                cupZ,

              rotationY:
                side *
                0.05,

              scaleX:
                0.13,

              scaleY:
                0.145,

              scaleZ:
                0.13
            }),

          colorHex:
            V49_DESK_COLORS[
              plan.cupColorIndex
            ]
        });

        appendDeskPrimitive({
          matrix:
            composePixelMatrixV49({
              baseMatrix,

              x:
                cupX -
                0.025,

              y:
                deskTopY +
                0.235,

              z:
                cupZ,

              rotationZ:
                plan.pencilTiltA,

              scaleX:
                0.022,

              scaleY:
                0.255,

              scaleZ:
                0.022
            }),

          colorHex:
            V49_ORANGE
        });

        appendDeskPrimitive({
          matrix:
            composePixelMatrixV49({
              baseMatrix,

              x:
                cupX +
                0.030,

              y:
                deskTopY +
                0.225,

              z:
                cupZ +
                0.015,

              rotationZ:
                plan.pencilTiltB,

              scaleX:
                0.022,

              scaleY:
                0.235,

              scaleZ:
                0.022
            }),

          colorHex:
            V49_CYAN
        });

        pencilCupCount += 1;
        pencilCount += 2;
      }
    }

    finalizePixelInstancesV49(
      deskPixelMesh,
      deskPropCount
    );

    lastDeskSignature =
      deskSignatureV49(
        deskMesh
      );

    deskRebuildCount += 1;
  }

  function buildNoticeboardLayer() {
    noticeboardLayerCount =
      0;

    paperShadowCount =
      0;

    pinCount =
      0;

    frameStripCount =
      0;

    captionBarCount =
      0;

    storyPanelMesh.updateMatrix();

    storyPanelMesh.getMatrixAt(
      0,
      panelInstanceMatrix
    );

    panelBaseMatrix.multiplyMatrices(
      storyPanelMesh.matrix,
      panelInstanceMatrix
    );

    const panelWidth =
      panelGeometry.size.x;

    const panelHeight =
      panelGeometry.size.y;

    const panelDepth =
      panelGeometry.size.z;

    const frontZ =
      panelDepth / 2 +
      0.035;

    /*
     * Hard-edged pixel frame:
     * top / bottom / left / right.
     */
    const frameThickness =
      0.055;

    appendBoardPrimitive({
      matrix:
        composePixelMatrixV49({
          baseMatrix:
            panelBaseMatrix,

          y:
            panelHeight / 2 +
            frameThickness / 2,

          z:
            frontZ,

          scaleX:
            panelWidth +
            frameThickness *
            2,

          scaleY:
            frameThickness,

          scaleZ:
            0.045
        }),

      colorHex:
        V49_CREAM_DARK
    });

    appendBoardPrimitive({
      matrix:
        composePixelMatrixV49({
          baseMatrix:
            panelBaseMatrix,

          y:
            -panelHeight / 2 -
            frameThickness / 2,

          z:
            frontZ,

          scaleX:
            panelWidth +
            frameThickness *
            2,

          scaleY:
            frameThickness,

          scaleZ:
            0.045
        }),

      colorHex:
        V49_DARK
    });

    appendBoardPrimitive({
      matrix:
        composePixelMatrixV49({
          baseMatrix:
            panelBaseMatrix,

          x:
            -panelWidth / 2 -
            frameThickness / 2,

          z:
            frontZ,

          scaleX:
            frameThickness,

          scaleY:
            panelHeight,

          scaleZ:
            0.045
        }),

      colorHex:
        V49_DARK
    });

    appendBoardPrimitive({
      matrix:
        composePixelMatrixV49({
          baseMatrix:
            panelBaseMatrix,

          x:
            panelWidth / 2 +
            frameThickness / 2,

          z:
            frontZ,

          scaleX:
            frameThickness,

          scaleY:
            panelHeight,

          scaleZ:
            0.045
        }),

      colorHex:
        V49_CREAM_DARK
    });

    frameStripCount =
      4;

    /*
     * Existing V48 paper cards become visually
     * richer by receiving dark pixel drop shadows
     * and two tiny block pins each.
     */
    storyPaperMesh.updateMatrix();

    const activePaperCount =
      Math.min(
        storyPaperMesh.count,
        16
      );

    for (
      let index = 0;
      index < activePaperCount;
      index += 1
    ) {
      storyPaperMesh.getMatrixAt(
        index,
        paperInstanceMatrix
      );

      paperBaseMatrix.multiplyMatrices(
        storyPaperMesh.matrix,
        paperInstanceMatrix
      );

      appendBoardPrimitive({
        matrix:
          composePixelMatrixV49({
            baseMatrix:
              paperBaseMatrix,

            x:
              0.025,

            y:
              -0.025,

            z:
              -0.020,

            scaleX:
              paperGeometry.size.x *
              1.03,

            scaleY:
              paperGeometry.size.y *
              1.03,

            scaleZ:
              0.018
          }),

        colorHex:
          V49_DARK
      });

      paperShadowCount += 1;

      const pinY =
        paperGeometry.size.y *
        0.40;

      const pinX =
        paperGeometry.size.x *
        0.27;

      appendBoardPrimitive({
        matrix:
          composePixelMatrixV49({
            baseMatrix:
              paperBaseMatrix,

            x:
              -pinX,

            y:
              pinY,

            z:
              paperGeometry.size.z /
              2 +
              0.026,

            scaleX:
              0.040,

            scaleY:
              0.040,

            scaleZ:
              0.030
          }),

        colorHex:
          index % 2 === 0
            ? V49_ORANGE
            : V49_CYAN
      });

      appendBoardPrimitive({
        matrix:
          composePixelMatrixV49({
            baseMatrix:
              paperBaseMatrix,

            x:
              pinX,

            y:
              pinY,

            z:
              paperGeometry.size.z /
              2 +
              0.026,

            scaleX:
              0.040,

            scaleY:
              0.040,

            scaleZ:
              0.030
          }),

        colorHex:
          index % 2 === 0
            ? V49_CYAN
            : V49_ORANGE
      });

      pinCount += 2;
    }

    /*
     * Bottom index/caption strips.
     * They read as tiny pixel labels rather than
     * legible text at normal gameplay distance.
     */
    const captionLayout =
      [
        [-0.30, 0.19, V49_CREAM],
        [-0.08, 0.12, V49_CYAN],
        [ 0.12, 0.16, V49_ORANGE],
        [ 0.32, 0.10, V49_CREAM_DARK]
      ];

    for (
      const [
        normalizedX,
        normalizedWidth,
        colorHex
      ]
      of captionLayout
    ) {
      appendBoardPrimitive({
        matrix:
          composePixelMatrixV49({
            baseMatrix:
              panelBaseMatrix,

            x:
              normalizedX *
              panelWidth,

            y:
              -panelHeight *
              0.41,

            z:
              frontZ +
              0.020,

            scaleX:
              panelWidth *
              normalizedWidth,

            scaleY:
              0.045,

            scaleZ:
              0.030
          }),

        colorHex
      });

      captionBarCount += 1;
    }

    finalizePixelInstancesV49(
      noticeboardPixelMesh,
      noticeboardLayerCount
    );
  }

  buildNoticeboardLayer();
  rebuildDeskStory();

  let disposed =
    false;

  function tick() {
    if (disposed) {
      return false;
    }

    const signature =
      deskSignatureV49(
        deskMesh
      );

    if (
      signature ===
      lastDeskSignature
    ) {
      return false;
    }

    rebuildDeskStory();

    return true;
  }

  function getSnapshot() {
    return Object.freeze({
      version: 49,

      deskCandidateCount:
        discovery.deskCandidateCount,

      constructionSceneTraversalCount:
        discovery.traversalCount,

      runtimeSceneTraversalCount:
        0,

      deskPropCount,
      bottleCount,
      pencilCupCount,
      pencilCount,

      noticeboardLayerCount,
      paperShadowCount,
      pinCount,
      frameStripCount,
      captionBarCount,

      deskRebuildCount,

      deskPropInstancedMeshCount:
        1,

      noticeboardLayerInstancedMeshCount:
        1,

      totalInstancedMeshCount:
        2,

      maximumAddedDrawCalls:
        2,

      addedTextures:
        0,

      addedSprites:
        0,

      addedLights:
        0,

      secondAnimationLoop:
        false,

      secondRaycastAuthority:
        false,

      noticeboardPolygonOffset:
        noticeboardMaterial.polygonOffset
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    deskRoot.removeFromParent();
    boardRoot.removeFromParent();

    if (
      typeof deskPixelMesh.dispose ===
        "function"
    ) {
      deskPixelMesh.dispose();
    }

    if (
      typeof noticeboardPixelMesh.dispose ===
        "function"
    ) {
      noticeboardPixelMesh.dispose();
    }

    unitBoxGeometry.dispose();

    deskMaterial.dispose();
    noticeboardMaterial.dispose();
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_ENVIRONMENTAL_STORY_DENSITY_V49_PROFILE,
  stableHashV49,
  deriveDeskStoryPlanV49,
  discoverV49Anchors,
  createClassroomEnvironmentalStoryDensityV49
};