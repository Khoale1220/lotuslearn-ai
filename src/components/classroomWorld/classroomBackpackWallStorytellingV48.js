import * as THREE from "three";

import {
  scoreDeskTopCandidateV47
} from "./classroomDeskSurfacePropsV47.js";

const CLASSROOM_BACKPACK_WALL_STORYTELLING_V48_PROFILE =
  Object.freeze({
    version: 48,

    visualOnly: true,
    deterministic: true,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    backpackInstancedMeshCount: 3,
    wallInstancedMeshCount: 3,

    totalInstancedMeshCount: 6,
    maximumAddedDrawCalls: 6,

    addedTextures: 0,
    addedSprites: 0,
    addedLights: 0,

    secondAnimationLoop: false,
    secondRaycastAuthority: false
  });

const V48_BAG_PALETTE =
  Object.freeze([
    0x452944,
    0x315f6d,
    0xb65f3d,
    0x64784d,
    0x6d536f,
    0x976b38
  ]);

const V48_PAPER_PALETTE =
  Object.freeze([
    0xf0dfb5,
    0xd9c78e,
    0x77b9bb,
    0xd4814c,
    0xb8c68a,
    0xd7a5a0
  ]);

const V48_DARK =
  0x211d29;

const V48_PLUM =
  0x3c2845;

const V48_CYAN =
  0x4c9fa4;

const V48_ORANGE =
  0xd47742;

const V48_CREAM =
  0xe8d7aa;

const V48_AXIS_Y =
  new THREE.Vector3(
    0,
    1,
    0
  );

function noV48Raycast() {}

function stableHashV48(value) {
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

function hasRetroAncestorV48(
  object
) {
  let current =
    object;

  while (current) {
    if (
      current.name ===
      "classroom-retro-composition-v4"
    ) {
      return true;
    }

    current =
      current.parent;
  }

  return false;
}

function readGeometryBoundsV48(
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

function scoreBoardCandidateV48(
  object
) {
  if (
    !object?.isMesh ||
    object.isInstancedMesh ||
    !hasRetroAncestorV48(object)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  if (
    object.userData
      ?.classroomCanonicalBlackboard ===
      true
  ) {
    return 1_000_000_000;
  }

  const geometry =
    readGeometryBoundsV48(
      object.geometry
    );

  if (!geometry) {
    return Number.NEGATIVE_INFINITY;
  }

  const {
    x,
    y,
    z
  } =
    geometry.size;

  /*
   * Retro blackboard art is expected to be:
   *
   * - wide
   * - vertically meaningful
   * - very shallow in local Z
   */
  if (
    x < 2 ||
    y < 0.8 ||
    z > 0.35
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  object.updateWorldMatrix(
    true,
    false
  );

  const quaternion =
    new THREE.Quaternion();

  object.getWorldQuaternion(
    quaternion
  );

  const normal =
    new THREE.Vector3(
      0,
      0,
      1
    )
      .applyQuaternion(
        quaternion
      )
      .normalize();

  /*
   * Board normal should be mostly horizontal.
   * This prevents floor surfaces winning.
   */
  if (
    Math.abs(normal.y) >
    0.45
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const aspect =
    x / Math.max(
      y,
      0.01
    );

  const thinness =
    1 /
    Math.max(
      z,
      0.01
    );

  return (
    x *
    y *
    thinness *
    (
      1 +
      Math.min(
        aspect,
        4
      )
    )
  );
}

function discoverCanonicalAnchorsV48(
  scene
) {
  let deskMesh =
    null;

  let deskScore =
    Number.NEGATIVE_INFINITY;

  let boardMesh =
    null;

  let boardScore =
    Number.NEGATIVE_INFINITY;

  let deskCandidateCount =
    0;

  let boardCandidateCount =
    0;

  /*
   * Read-only scene traversal.
   *
   * Scene graph mutations happen only after
   * this callback has completed.
   */
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

    const currentBoardScore =
      scoreBoardCandidateV48(
        object
      );

    if (
      Number.isFinite(
        currentBoardScore
      )
    ) {
      boardCandidateCount += 1;

      if (
        currentBoardScore >
        boardScore
      ) {
        boardScore =
          currentBoardScore;

        boardMesh =
          object;
      }
    }
  });

  return Object.freeze({
    deskMesh,
    boardMesh,

    deskScore,
    boardScore,

    deskCandidateCount,
    boardCandidateCount,

    traversalCount: 1
  });
}

function deriveBackpackPlanV48(
  index
) {
  const hash =
    stableHashV48(
      `lotuslearn-v48-bag-${index}`
    );

  const side =
    (hash & 1)
      ? 1
      : -1;

  return Object.freeze({
    hash,
    side,

    hasBag:
      hash % 5 !== 0,

    colorIndex:
      hash %
      V48_BAG_PALETTE.length,

    rotationY:
      side *
      (
        0.07 +
        ((hash >>> 5) % 4) *
          0.025
      ),

    lateralJitter:
      (
        ((hash >>> 9) % 5) -
        2
      ) *
      0.018,

    depthJitter:
      (
        ((hash >>> 12) % 5) -
        2
      ) *
      0.015,

    verticalJitter:
      ((hash >>> 15) % 3) *
      0.012
  });
}

function createV48Material(
  color = 0xffffff
) {
  return new THREE.MeshBasicMaterial({
    color,

    toneMapped:
      false,

    depthTest:
      true,

    depthWrite:
      true
  });
}

function createV48InstancedMesh({
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
    noV48Raycast;

  mesh.layers.set(0);

  mesh.instanceMatrix.setUsage(
    THREE.DynamicDrawUsage
  );

  mesh.userData = {
    ...mesh.userData,

    visualOnly:
      true,

    classroomBackpackWallStorytellingV48:
      true,

    kind
  };

  return mesh;
}

function finalizeInstancesV48(
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

function buildLocalMatrixV48({
  baseMatrix,
  x,
  y,
  z,
  rotationY = 0,
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
    );

  offset.multiply(
    baseScale
  );

  offset.applyQuaternion(
    baseQuaternion
  );

  const position =
    basePosition
      .clone()
      .add(offset);

  const localRotation =
    new THREE.Quaternion()
      .setFromAxisAngle(
        V48_AXIS_Y,
        rotationY
      );

  const quaternion =
    baseQuaternion
      .clone()
      .multiply(
        localRotation
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

function signatureV48(
  deskMesh
) {
  return [
    deskMesh.count,
    deskMesh.instanceMatrix?.version ?? 0
  ].join(":");
}

function createClassroomBackpackWallStorytellingV48({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V48 requires scene.traverse"
    );
  }

  const discovery =
    discoverCanonicalAnchorsV48(
      scene
    );

  const deskMesh =
    discovery.deskMesh;

  const boardMesh =
    discovery.boardMesh;

  if (!deskMesh) {
    throw new Error(
      "V48_CANONICAL_DESK_NOT_FOUND"
    );
  }

  if (!boardMesh) {
    throw new Error(
      "V48_CANONICAL_BOARD_NOT_FOUND"
    );
  }

  if (
    !deskMesh.parent ||
    !boardMesh.parent
  ) {
    throw new Error(
      "V48_CANONICAL_PARENT_MISSING"
    );
  }

  const deskGeometry =
    readGeometryBoundsV48(
      deskMesh.geometry
    );

  const boardGeometry =
    readGeometryBoundsV48(
      boardMesh.geometry
    );

  if (
    !deskGeometry ||
    !boardGeometry
  ) {
    throw new Error(
      "V48_CANONICAL_GEOMETRY_MISSING"
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

  const bagRoot =
    new THREE.Group();

  bagRoot.name =
    "classroom-v48-backpack-root";

  bagRoot.userData = {
    visualOnly:
      true,

    classroomBackpackWallStorytellingV48:
      true,

    role:
      "backpacks"
  };

  const wallRoot =
    new THREE.Group();

  wallRoot.name =
    "classroom-v48-wall-story-root";

  wallRoot.userData = {
    visualOnly:
      true,

    classroomBackpackWallStorytellingV48:
      true,

    role:
      "wall-storytelling"
  };

  const bagBodyGeometry =
    new THREE.BoxGeometry(
      0.38,
      0.46,
      0.20
    );

  const bagPocketGeometry =
    new THREE.BoxGeometry(
      0.30,
      0.18,
      0.075
    );

  const bagHandleGeometry =
    new THREE.BoxGeometry(
      0.17,
      0.055,
      0.055
    );

  const panelWidth =
    Math.max(
      1.25,
      boardGeometry.size.x *
      0.27
    );

  const panelHeight =
    Math.max(
      1.15,
      boardGeometry.size.y *
      0.72
    );

  const wallPanelGeometry =
    new THREE.BoxGeometry(
      panelWidth,
      panelHeight,
      0.045
    );

  const paperGeometry =
    new THREE.BoxGeometry(
      panelWidth * 0.34,
      panelHeight * 0.29,
      0.018
    );

  const tapeGeometry =
    new THREE.BoxGeometry(
      panelWidth * 0.075,
      panelHeight * 0.032,
      0.025
    );

  const bagBodyMaterial =
    createV48Material(
      0xffffff
    );

  const bagPocketMaterial =
    createV48Material(
      0xffffff
    );

  const bagHandleMaterial =
    createV48Material(
      V48_DARK
    );

  const wallPanelMaterial =
    createV48Material(
      V48_PLUM
    );

  const paperMaterial =
    createV48Material(
      0xffffff
    );

  const tapeMaterial =
    createV48Material(
      V48_CREAM
    );

  const bagBodyMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-backpack-bodies",

      kind:
        "backpack-body",

      geometry:
        bagBodyGeometry,

      material:
        bagBodyMaterial,

      capacity:
        deskCapacity
    });

  const bagPocketMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-backpack-pockets",

      kind:
        "backpack-pocket",

      geometry:
        bagPocketGeometry,

      material:
        bagPocketMaterial,

      capacity:
        deskCapacity
    });

  const bagHandleMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-backpack-handles",

      kind:
        "backpack-handle",

      geometry:
        bagHandleGeometry,

      material:
        bagHandleMaterial,

      capacity:
        deskCapacity
    });

  const wallPanelMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-story-panel",

      kind:
        "story-panel",

      geometry:
        wallPanelGeometry,

      material:
        wallPanelMaterial,

      capacity:
        1
    });

  const paperMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-story-papers",

      kind:
        "story-paper",

      geometry:
        paperGeometry,

      material:
        paperMaterial,

      capacity:
        6
    });

  const tapeMesh =
    createV48InstancedMesh({
      name:
        "classroom-v48-story-tape",

      kind:
        "story-tape",

      geometry:
        tapeGeometry,

      material:
        tapeMaterial,

      capacity:
        12
    });

  bagRoot.add(
    bagBodyMesh,
    bagPocketMesh,
    bagHandleMesh
  );

  wallRoot.add(
    wallPanelMesh,
    paperMesh,
    tapeMesh
  );

  /*
   * Mutations begin only after discovery traversal.
   */
  deskMesh.parent.add(
    bagRoot
  );

  boardMesh.parent.add(
    wallRoot
  );

  const sourceMatrix =
    new THREE.Matrix4();

  const deskBaseMatrix =
    new THREE.Matrix4();

  const boardBaseMatrix =
    new THREE.Matrix4();

  const bagColor =
    new THREE.Color();

  const darkerBagColor =
    new THREE.Color();

  const paperColor =
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

  const boardBounds =
    boardGeometry.bounds;

  const boardCenterY =
    (
      boardBounds.min.y +
      boardBounds.max.y
    ) / 2;

  const boardFaceZ =
    boardBounds.max.z;

  let backpackCount =
    0;

  let paperCount =
    0;

  let tapeCount =
    0;

  let rebuildCount =
    0;

  let lastSignature =
    null;

  function rebuildBackpacks() {
    backpackCount =
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
        deriveBackpackPlanV48(
          index
        );

      if (
        !plan.hasBag
      ) {
        continue;
      }

      deskMesh.getMatrixAt(
        index,
        sourceMatrix
      );

      deskBaseMatrix.multiplyMatrices(
        deskMesh.matrix,
        sourceMatrix
      );

      const bodyX =
        deskCenterX +
        plan.side *
        (
          deskSize.x *
          0.54
        ) +
        plan.lateralJitter;

      const bodyY =
        deskBounds.min.y -
        0.28 +
        plan.verticalJitter;

      const bodyZ =
        deskCenterZ +
        0.055 +
        plan.depthJitter;

      const bodyMatrix =
        buildLocalMatrixV48({
          baseMatrix:
            deskBaseMatrix,

          x:
            bodyX,

          y:
            bodyY,

          z:
            bodyZ,

          rotationY:
            plan.rotationY
        });

      bagBodyMesh.setMatrixAt(
        backpackCount,
        bodyMatrix
      );

      bagColor.setHex(
        V48_BAG_PALETTE[
          plan.colorIndex
        ]
      );

      bagBodyMesh.setColorAt(
        backpackCount,
        bagColor
      );

      darkerBagColor
        .copy(
          bagColor
        )
        .multiplyScalar(
          0.70
        );

      const pocketMatrix =
        buildLocalMatrixV48({
          baseMatrix:
            deskBaseMatrix,

          x:
            bodyX,

          y:
            bodyY -
            0.055,

          z:
            bodyZ +
            0.125,

          rotationY:
            plan.rotationY,

          scaleX:
            0.96,

          scaleY:
            0.92,

          scaleZ:
            1
        });

      bagPocketMesh.setMatrixAt(
        backpackCount,
        pocketMatrix
      );

      bagPocketMesh.setColorAt(
        backpackCount,
        darkerBagColor
      );

      const handleMatrix =
        buildLocalMatrixV48({
          baseMatrix:
            deskBaseMatrix,

          x:
            bodyX,

          y:
            bodyY +
            0.255,

          z:
            bodyZ -
            0.015,

          rotationY:
            plan.rotationY
        });

      bagHandleMesh.setMatrixAt(
        backpackCount,
        handleMatrix
      );

      backpackCount += 1;
    }

    finalizeInstancesV48(
      bagBodyMesh,
      backpackCount
    );

    finalizeInstancesV48(
      bagPocketMesh,
      backpackCount
    );

    finalizeInstancesV48(
      bagHandleMesh,
      backpackCount
    );

    lastSignature =
      signatureV48(
        deskMesh
      );

    rebuildCount += 1;
  }

  function buildWallStory() {
    boardMesh.updateMatrix();

    boardBaseMatrix.copy(
      boardMesh.matrix
    );

    const panelCenterX =
      boardBounds.max.x +
      panelWidth *
      0.62;

    const panelCenterY =
      boardCenterY -
      boardGeometry.size.y *
      0.02;

    const panelCenterZ =
      boardFaceZ +
      0.035;

    wallPanelMesh.setMatrixAt(
      0,
      buildLocalMatrixV48({
        baseMatrix:
          boardBaseMatrix,

        x:
          panelCenterX,

        y:
          panelCenterY,

        z:
          panelCenterZ
      })
    );

    wallPanelMesh.setColorAt(
      0,
      new THREE.Color(
        V48_PLUM
      )
    );

    finalizeInstancesV48(
      wallPanelMesh,
      1
    );

    const paperLayout = [
      [-0.23,  0.25, -0.020],
      [ 0.23,  0.23,  0.025],
      [-0.24, -0.15,  0.018],
      [ 0.22, -0.17, -0.025],
      [ 0.00, -0.37,  0.010]
    ];

    paperCount =
      0;

    tapeCount =
      0;

    for (
      let index = 0;
      index < paperLayout.length;
      index += 1
    ) {
      const [
        normalizedX,
        normalizedY,
        rotation
      ] =
        paperLayout[index];

      const x =
        panelCenterX +
        normalizedX *
        panelWidth;

      const y =
        panelCenterY +
        normalizedY *
        panelHeight;

      const z =
        panelCenterZ +
        0.040;

      paperMesh.setMatrixAt(
        paperCount,
        buildLocalMatrixV48({
          baseMatrix:
            boardBaseMatrix,

          x,
          y,
          z,

          rotationY:
            rotation
        })
      );

      paperColor.setHex(
        V48_PAPER_PALETTE[
          index %
          V48_PAPER_PALETTE.length
        ]
      );

      paperMesh.setColorAt(
        paperCount,
        paperColor
      );

      const tapeYOffset =
        paperGeometry.parameters.height *
        0.53;

      for (
        const direction
        of [-1, 1]
      ) {
        tapeMesh.setMatrixAt(
          tapeCount,
          buildLocalMatrixV48({
            baseMatrix:
              boardBaseMatrix,

            x:
              x +
              direction *
              paperGeometry.parameters.width *
              0.27,

            y:
              y +
              tapeYOffset,

            z:
              z +
              0.022,

            rotationY:
              direction *
              0.035
          })
        );

        tapeCount += 1;
      }

      paperCount += 1;
    }

    finalizeInstancesV48(
      paperMesh,
      paperCount
    );

    finalizeInstancesV48(
      tapeMesh,
      tapeCount
    );
  }

  buildWallStory();
  rebuildBackpacks();

  let disposed =
    false;

  function tick() {
    if (disposed) {
      return false;
    }

    const currentSignature =
      signatureV48(
        deskMesh
      );

    if (
      currentSignature ===
      lastSignature
    ) {
      return false;
    }

    rebuildBackpacks();

    return true;
  }

  function getSnapshot() {
    return Object.freeze({
      version: 48,

      deskCandidateCount:
        discovery.deskCandidateCount,

      boardCandidateCount:
        discovery.boardCandidateCount,

      constructionSceneTraversalCount:
        discovery.traversalCount,

      runtimeSceneTraversalCount:
        0,

      backpackCount,

      wallPaperCount:
        paperCount,

      wallTapeCount:
        tapeCount,

      wallPanelCount:
        1,

      rebuildCount,

      backpackInstancedMeshCount:
        3,

      wallInstancedMeshCount:
        3,

      totalInstancedMeshCount:
        6,

      maximumAddedDrawCalls:
        6,

      addedTextures:
        0,

      addedSprites:
        0,

      addedLights:
        0,

      secondAnimationLoop:
        false,

      secondRaycastAuthority:
        false
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    bagRoot.removeFromParent();
    wallRoot.removeFromParent();

    for (
      const mesh
      of [
        bagBodyMesh,
        bagPocketMesh,
        bagHandleMesh,
        wallPanelMesh,
        paperMesh,
        tapeMesh
      ]
    ) {
      if (
        typeof mesh.dispose ===
          "function"
      ) {
        mesh.dispose();
      }
    }

    for (
      const geometry
      of [
        bagBodyGeometry,
        bagPocketGeometry,
        bagHandleGeometry,
        wallPanelGeometry,
        paperGeometry,
        tapeGeometry
      ]
    ) {
      geometry.dispose();
    }

    for (
      const material
      of [
        bagBodyMaterial,
        bagPocketMaterial,
        bagHandleMaterial,
        wallPanelMaterial,
        paperMaterial,
        tapeMaterial
      ]
    ) {
      material.dispose();
    }
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_BACKPACK_WALL_STORYTELLING_V48_PROFILE,
  stableHashV48,
  deriveBackpackPlanV48,
  scoreBoardCandidateV48,
  discoverCanonicalAnchorsV48,
  createClassroomBackpackWallStorytellingV48
};