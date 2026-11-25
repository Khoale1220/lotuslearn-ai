import * as THREE from "three";

const CLASSROOM_DESK_SURFACE_PROPS_V47_PROFILE =
  Object.freeze({
    version: 47,
    visualOnly: true,
    deterministic: true,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    instancedPropMeshCount: 6,
    maximumAddedDrawCalls: 6,

    addedTextures: 0,
    addedSprites: 0,
    addedLights: 0
  });

const BOOK_COLORS_V47 =
  Object.freeze([
    0x7c4054,
    0x416b78,
    0x667748,
    0xaa6242,
    0x625785,
    0x49766d
  ]);

const Y_AXIS_V47 =
  new THREE.Vector3(0, 1, 0);

function stableHashV47(value) {
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

function clampV47(
  value,
  minimum,
  maximum
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

function noV47Raycast() {}

function hasRetroAncestorV47(
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

function readGeometryV47(
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

  return {
    size,
    bounds:
      geometry.boundingBox.clone()
  };
}

function scoreDeskTopCandidateV47(
  object
) {
  if (
    !object?.isInstancedMesh ||
    !hasRetroAncestorV47(object)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  /*
   * Production RetroCompositionV4 uses unit-cube
   * geometry and encodes desk dimensions through
   * per-instance matrices.
   *
   * Therefore raw geometry proportions are not a
   * valid way to identify its canonical desk surface.
   */
  if (
    object.userData
      ?.classroomCanonicalDeskSurface ===
      true
  ) {
    const capacity =
      Math.max(
        1,
        Number(
          object.instanceMatrix?.count ??
          object.count ??
          1
        )
      );

    return (
      1_000_000_000 +
      Math.sqrt(capacity)
    );
  }

  const dimensions =
    readGeometryV47(
      object.geometry
    );

  if (!dimensions) {
    return Number.NEGATIVE_INFINITY;
  }

  const {
    x,
    y,
    z
  } =
    dimensions.size;

  if (
    x <= 0.2 ||
    z <= 0.2 ||
    y <= 0
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  /*
   * Canonical desk tops are broad and thin.
   */
  if (
    y >= x * 0.35 ||
    y >= z * 0.35
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const capacity =
    Math.max(
      1,
      Number(
        object.instanceMatrix?.count ??
        object.count ??
        1
      )
    );

  return (
    (x * z) /
    Math.max(y, 0.01) *
    Math.sqrt(capacity)
  );
}

function selectDeskTopInstancedMeshV47(
  scene
) {
  let mesh =
    null;

  let score =
    Number.NEGATIVE_INFINITY;

  let candidateCount =
    0;

  /*
   * Read-only traversal.
   * Never mutate scene inside traverse().
   */
  scene.traverse((object) => {
    const candidateScore =
      scoreDeskTopCandidateV47(
        object
      );

    if (
      !Number.isFinite(
        candidateScore
      )
    ) {
      return;
    }

    candidateCount +=
      1;

    if (
      candidateScore >
      score
    ) {
      score =
        candidateScore;

      mesh =
        object;
    }
  });

  return Object.freeze({
    mesh,
    score,
    candidateCount,
    traversalCount: 1
  });
}

function deriveDeskPropPlanV47(
  index
) {
  const hash =
    stableHashV47(
      `lotuslearn-v47-${index}`
    );

  const direction =
    (hash & 1)
      ? 1
      : -1;

  return Object.freeze({
    hash,
    direction,

    bookCount:
      hash % 5 === 0
        ? 0
        : (
            hash % 3 === 0
              ? 2
              : 1
          ),

    hasPencil:
      hash % 7 !== 0,

    hasRuler:
      ((hash >>> 3) % 3) === 0,

    hasEraser:
      ((hash >>> 5) % 2) === 0,

    hasPencilCase:
      ((hash >>> 7) % 4) === 0,

    notebookRotation:
      direction *
      (
        0.025 +
        ((hash >>> 9) % 3) *
          0.018
      ),

    bookRotation:
      -direction *
      (
        0.02 +
        ((hash >>> 11) % 3) *
          0.015
      ),

    pencilRotation:
      direction *
      (
        0.08 +
        ((hash >>> 13) % 3) *
          0.035
      )
  });
}

function createV47Material(
  color
) {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    depthTest: true,
    depthWrite: true
  });
}

function createV47InstancedProp({
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
    true;

  mesh.frustumCulled =
    true;

  mesh.raycast =
    noV47Raycast;

  mesh.layers.set(0);

  mesh.instanceMatrix.setUsage(
    THREE.DynamicDrawUsage
  );

  mesh.userData = {
    ...mesh.userData,

    visualOnly:
      true,

    classroomDeskSurfacePropV47:
      true,

    kind
  };

  return mesh;
}

function buildLocalMatrixV47({
  baseMatrix,
  x,
  y,
  z,
  rotationY = 0
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
        Y_AXIS_V47,
        rotationY
      );

  const quaternion =
    baseQuaternion
      .clone()
      .multiply(
        localRotation
      );

  const matrix =
    new THREE.Matrix4();

  matrix.compose(
    position,
    quaternion,
    baseScale
  );

  return matrix;
}

function finalizeV47Instances(
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

function deskSignatureV47(
  mesh
) {
  return [
    mesh.count,
    mesh.instanceMatrix?.version ?? 0
  ].join(":");
}

function createClassroomDeskSurfacePropsV47({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V47 requires scene.traverse"
    );
  }

  const discovery =
    selectDeskTopInstancedMeshV47(
      scene
    );

  const deskMesh =
    discovery.mesh;

  if (!deskMesh) {
    throw new Error(
      "V47_DESK_DISCOVERY_EMPTY"
    );
  }

  const dimensions =
    readGeometryV47(
      deskMesh.geometry
    );

  if (!dimensions) {
    throw new Error(
      "V47_DESK_DIMENSIONS_UNAVAILABLE"
    );
  }

  if (!deskMesh.parent) {
    throw new Error(
      "V47_DESK_PARENT_MISSING"
    );
  }

  const {
    size,
    bounds
  } =
    dimensions;

  const capacity =
    Math.max(
      1,
      Number(
        deskMesh.instanceMatrix?.count ??
        deskMesh.count ??
        1
      )
    );

  const root =
    new THREE.Group();

  root.name =
    "classroom-desk-surface-props-v47";

  root.userData = {
    visualOnly:
      true,

    classroomDeskSurfacePropsV47:
      true
  };

  const notebookHeight =
    clampV47(
      size.y * 0.18,
      0.012,
      0.022
    );

  const bookHeight =
    clampV47(
      size.y * 0.45,
      0.028,
      0.055
    );

  const pencilHeight =
    clampV47(
      size.y * 0.16,
      0.012,
      0.02
    );

  const rulerHeight =
    clampV47(
      size.y * 0.12,
      0.009,
      0.016
    );

  const eraserHeight =
    clampV47(
      size.y * 0.28,
      0.02,
      0.035
    );

  const caseHeight =
    clampV47(
      size.y * 0.55,
      0.04,
      0.07
    );

  const geometries = [
    new THREE.BoxGeometry(
      size.x * 0.38,
      notebookHeight,
      size.z * 0.42
    ),

    new THREE.BoxGeometry(
      size.x * 0.27,
      bookHeight,
      size.z * 0.34
    ),

    new THREE.BoxGeometry(
      size.x * 0.29,
      pencilHeight,
      Math.max(
        size.z * 0.035,
        0.018
      )
    ),

    new THREE.BoxGeometry(
      size.x * 0.33,
      rulerHeight,
      Math.max(
        size.z * 0.045,
        0.022
      )
    ),

    new THREE.BoxGeometry(
      size.x * 0.09,
      eraserHeight,
      size.z * 0.09
    ),

    new THREE.BoxGeometry(
      size.x * 0.25,
      caseHeight,
      size.z * 0.13
    )
  ];

  const materials = [
    createV47Material(0xf1e3b8),
    createV47Material(0xffffff),
    createV47Material(0xd88a35),
    createV47Material(0x4ca5a3),
    createV47Material(0xd9877c),
    createV47Material(0x5d3a55)
  ];

  const notebookMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-notebooks",

      kind:
        "notebook",

      geometry:
        geometries[0],

      material:
        materials[0],

      capacity
    });

  const bookMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-books",

      kind:
        "book",

      geometry:
        geometries[1],

      material:
        materials[1],

      capacity:
        capacity * 2
    });

  const pencilMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-pencils",

      kind:
        "pencil",

      geometry:
        geometries[2],

      material:
        materials[2],

      capacity
    });

  const rulerMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-rulers",

      kind:
        "ruler",

      geometry:
        geometries[3],

      material:
        materials[3],

      capacity
    });

  const eraserMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-erasers",

      kind:
        "eraser",

      geometry:
        geometries[4],

      material:
        materials[4],

      capacity
    });

  const pencilCaseMesh =
    createV47InstancedProp({
      name:
        "classroom-v47-pencil-cases",

      kind:
        "pencil-case",

      geometry:
        geometries[5],

      material:
        materials[5],

      capacity
    });

  const meshes = [
    notebookMesh,
    bookMesh,
    pencilMesh,
    rulerMesh,
    eraserMesh,
    pencilCaseMesh
  ];

  for (
    const mesh
    of meshes
  ) {
    root.add(mesh);
  }

  /*
   * Important:
   * mutation occurs only after scene discovery.
   */
  deskMesh.parent.add(root);

  const sourceMatrix =
    new THREE.Matrix4();

  const deskMatrix =
    new THREE.Matrix4();

  const bookColor =
    new THREE.Color();

  const centerX =
    (
      bounds.min.x +
      bounds.max.x
    ) / 2;

  const centerZ =
    (
      bounds.min.z +
      bounds.max.z
    ) / 2;

  const topY =
    bounds.max.y;

  let rebuildCount =
    0;

  let lastSignature =
    null;

  let notebookCount =
    0;

  let bookCount =
    0;

  let pencilCount =
    0;

  let rulerCount =
    0;

  let eraserCount =
    0;

  let pencilCaseCount =
    0;

  function rebuild() {
    notebookCount = 0;
    bookCount = 0;
    pencilCount = 0;
    rulerCount = 0;
    eraserCount = 0;
    pencilCaseCount = 0;

    deskMesh.updateMatrix();

    const activeDeskCount =
      Math.min(
        deskMesh.count,
        capacity
      );

    for (
      let index = 0;
      index < activeDeskCount;
      index += 1
    ) {
      deskMesh.getMatrixAt(
        index,
        sourceMatrix
      );

      deskMatrix.multiplyMatrices(
        deskMesh.matrix,
        sourceMatrix
      );

      const plan =
        deriveDeskPropPlanV47(
          index
        );

      notebookMesh.setMatrixAt(
        notebookCount,
        buildLocalMatrixV47({
          baseMatrix:
            deskMatrix,

          x:
            centerX -
            size.x * 0.12,

          y:
            topY +
            notebookHeight / 2 +
            0.01,

          z:
            centerZ +
            size.z * 0.03,

          rotationY:
            plan.notebookRotation
        })
      );

      notebookCount += 1;

      for (
        let stack = 0;
        stack < plan.bookCount;
        stack += 1
      ) {
        bookMesh.setMatrixAt(
          bookCount,
          buildLocalMatrixV47({
            baseMatrix:
              deskMatrix,

            x:
              centerX +
              size.x *
                (
                  0.21 +
                  stack *
                    0.018 *
                    plan.direction
                ),

            y:
              topY +
              bookHeight *
                (
                  stack +
                  0.5
                ) +
              0.012,

            z:
              centerZ -
              size.z * 0.17,

            rotationY:
              plan.bookRotation +
              stack *
                0.025 *
                plan.direction
          })
        );

        bookColor.setHex(
          BOOK_COLORS_V47[
            (
              plan.hash +
              stack
            ) %
            BOOK_COLORS_V47.length
          ]
        );

        bookMesh.setColorAt(
          bookCount,
          bookColor
        );

        bookCount += 1;
      }

      if (
        plan.hasPencil
      ) {
        pencilMesh.setMatrixAt(
          pencilCount,
          buildLocalMatrixV47({
            baseMatrix:
              deskMatrix,

            x:
              centerX +
              size.x * 0.13,

            y:
              topY +
              pencilHeight / 2 +
              0.012,

            z:
              centerZ +
              size.z * 0.28,

            rotationY:
              plan.pencilRotation
          })
        );

        pencilCount += 1;
      }

      if (
        plan.hasRuler
      ) {
        rulerMesh.setMatrixAt(
          rulerCount,
          buildLocalMatrixV47({
            baseMatrix:
              deskMatrix,

            x:
              centerX -
              size.x * 0.22,

            y:
              topY +
              rulerHeight / 2 +
              0.014,

            z:
              centerZ -
              size.z * 0.26,

            rotationY:
              -0.075 *
              plan.direction
          })
        );

        rulerCount += 1;
      }

      if (
        plan.hasEraser
      ) {
        eraserMesh.setMatrixAt(
          eraserCount,
          buildLocalMatrixV47({
            baseMatrix:
              deskMatrix,

            x:
              centerX +
              size.x * 0.35,

            y:
              topY +
              eraserHeight / 2 +
              0.012,

            z:
              centerZ +
              size.z * 0.16,

            rotationY:
              0.05 *
              plan.direction
          })
        );

        eraserCount += 1;
      }

      if (
        plan.hasPencilCase
      ) {
        pencilCaseMesh.setMatrixAt(
          pencilCaseCount,
          buildLocalMatrixV47({
            baseMatrix:
              deskMatrix,

            x:
              centerX -
              size.x * 0.30,

            y:
              topY +
              caseHeight / 2 +
              0.012,

            z:
              centerZ +
              size.z * 0.23,

            rotationY:
              0.04 *
              plan.direction
          })
        );

        pencilCaseCount += 1;
      }
    }

    finalizeV47Instances(
      notebookMesh,
      notebookCount
    );

    finalizeV47Instances(
      bookMesh,
      bookCount
    );

    finalizeV47Instances(
      pencilMesh,
      pencilCount
    );

    finalizeV47Instances(
      rulerMesh,
      rulerCount
    );

    finalizeV47Instances(
      eraserMesh,
      eraserCount
    );

    finalizeV47Instances(
      pencilCaseMesh,
      pencilCaseCount
    );

    lastSignature =
      deskSignatureV47(
        deskMesh
      );

    rebuildCount += 1;
  }

  rebuild();

  let disposed =
    false;

  function tick() {
    if (disposed) {
      return false;
    }

    const signature =
      deskSignatureV47(
        deskMesh
      );

    if (
      signature ===
      lastSignature
    ) {
      return false;
    }

    rebuild();

    return true;
  }

  function getSnapshot() {
    return Object.freeze({
      version: 47,

      activeDeskCount:
        deskMesh.count,

      deskCapacity:
        capacity,

      deskCandidateCount:
        discovery.candidateCount,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversalCount:
        0,

      rebuildCount,

      instancedPropMeshCount:
        6,

      maximumAddedDrawCalls:
        6,

      notebookCount,
      bookCount,
      pencilCount,
      rulerCount,
      eraserCount,
      pencilCaseCount,

      totalPropCount:
        notebookCount +
        bookCount +
        pencilCount +
        rulerCount +
        eraserCount +
        pencilCaseCount,

      addedTextures:
        0,

      addedSprites:
        0,

      addedLights:
        0
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    root.removeFromParent();

    for (
      const mesh
      of meshes
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
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_DESK_SURFACE_PROPS_V47_PROFILE,
  deriveDeskPropPlanV47,
  scoreDeskTopCandidateV47,
  selectDeskTopInstancedMeshV47,
  createClassroomDeskSurfacePropsV47
};