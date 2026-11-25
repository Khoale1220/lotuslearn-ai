import * as THREE from "three";

import {
  createStudentCharacterSpriteV9
} from "./classroomCharacterSpriteV9.js";

const CLASSROOM_CHARACTER_VISUAL_V10_PROFILE =
  Object.freeze({
    visualLayer:
      30,

    maximumStudents:
      64,

    fallbackStudentKeyPrefix:
      "student-slot",

    authority:
      "CW06_CHARACTER_VISUAL_INTEGRATION_V10",

    legacyAuthority:
      "CW06_CHARACTER_V3",

    characterHeight:
      1.86
  });

const LEGACY_ROLE_PRIORITY =
  Object.freeze({
    shoes:
      100,

    feet:
      100,

    legs:
      80,

    torso:
      60,

    body:
      60,

    head:
      40,

    arms:
      30,

    unknown:
      10
  });

function descriptorText({
  object,
  hints = []
}) {
  const userData =
    object?.userData ??
    {};

  return [
    object?.name,
    userData.role,
    userData.kind,
    userData.type,
    userData.visualRole,
    userData.characterRole,
    ...hints
  ]
    .filter(
      (value) =>
        typeof value ===
          "string" &&
        value.length >
          0
    )
    .join(" ")
    .toLowerCase();
}

function classifyLegacyCharacterRole(
  descriptor
) {
  if (
    /shoe|foot|feet/u.test(
      descriptor
    )
  ) {
    return "shoes";
  }

  if (
    /leg/u.test(
      descriptor
    )
  ) {
    return "legs";
  }

  if (
    /torso|body|shirt/u.test(
      descriptor
    )
  ) {
    return "torso";
  }

  if (
    /head|face|hair/u.test(
      descriptor
    )
  ) {
    return "head";
  }

  if (
    /arm|hand/u.test(
      descriptor
    )
  ) {
    return "arms";
  }

  return "unknown";
}

function addHint(
  map,
  object,
  hint
) {
  if (
    !object?.isObject3D
  ) {
    return;
  }

  let hints =
    map.get(
      object
    );

  if (!hints) {
    hints =
      new Set();

    map.set(
      object,
      hints
    );
  }

  if (
    typeof hint ===
      "string" &&
    hint.length >
      0
  ) {
    hints.add(
      hint
    );
  }
}

function collectLegacySystemObjects(
  legacyCharacterSystem
) {
  const objectHints =
    new Map();

  const visited =
    new WeakSet();

  function visit(
    value,
    path,
    depth
  ) {
    if (
      value === null ||
      typeof value !==
        "object" ||
      depth >
        4
    ) {
      return;
    }

    if (
      visited.has(
        value
      )
    ) {
      return;
    }

    visited.add(
      value
    );

    if (
      value.isObject3D
    ) {
      addHint(
        objectHints,
        value,
        path
      );

      if (
        typeof value.traverse ===
          "function"
      ) {
        value.traverse(
          (descendant) => {
            if (
              descendant
                ?.isInstancedMesh
            ) {
              addHint(
                objectHints,
                descendant,
                `${path}.descendant`
              );
            }
          }
        );
      }

      return;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      for (
        let index = 0;
        index <
          value.length;
        index += 1
      ) {
        visit(
          value[index],
          `${path}[${index}]`,
          depth + 1
        );
      }

      return;
    }

    for (
      const [
        key,
        child
      ]
      of Object.entries(
        value
      )
    ) {
      if (
        typeof child ===
          "function"
      ) {
        continue;
      }

      visit(
        child,
        path
          ? `${path}.${key}`
          : key,
        depth + 1
      );
    }
  }

  visit(
    legacyCharacterSystem,
    "legacyCharacterSystem",
    0
  );

  return objectHints;
}

function collectLegacyCharacterVisualMeshes({
  scene,
  legacyCharacterSystem
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "scene.traverse is required"
    );
  }

  const systemObjects =
    collectLegacySystemObjects(
      legacyCharacterSystem
    );

  const descriptors =
    new Map();

  for (
    const [
      object,
      hints
    ]
    of systemObjects.entries()
  ) {
    if (
      !object.isInstancedMesh ||
      !Number.isInteger(
        object.count
      ) ||
      object.count <=
        0
    ) {
      continue;
    }

    const hintArray =
      [
        ...hints
      ];

    const text =
      descriptorText({
        object,
        hints:
          hintArray
      });

    descriptors.set(
      object,
      {
        mesh:
          object,

        hints:
          hintArray,

        text,

        role:
          classifyLegacyCharacterRole(
            text
          ),

        fromLegacySystem:
          true
      }
    );
  }

  scene.traverse(
    (object) => {
      if (
        !object
          ?.isInstancedMesh ||
        !Number.isInteger(
          object.count
        ) ||
        object.count <=
          0
      ) {
        return;
      }

      if (
        descriptors.has(
          object
        )
      ) {
        return;
      }

      const text =
        descriptorText({
          object
        });

      if (
        !/character|student|pupil|avatar/u.test(
          text
        )
      ) {
        return;
      }

      descriptors.set(
        object,
        {
          mesh:
            object,

          hints:
            [],

          text,

          role:
            classifyLegacyCharacterRole(
              text
            ),

          fromLegacySystem:
            false
        }
      );
    }
  );

  return [
    ...descriptors.values()
  ];
}

function findDominantInstanceCount(
  descriptors
) {
  const frequencies =
    new Map();

  for (
    const descriptor
    of descriptors
  ) {
    const count =
      descriptor.mesh.count;

    frequencies.set(
      count,
      (
        frequencies.get(
          count
        ) ??
        0
      ) +
      1
    );
  }

  let selectedCount =
    0;

  let selectedFrequency =
    -1;

  for (
    const [
      count,
      frequency
    ]
    of frequencies.entries()
  ) {
    if (
      frequency >
        selectedFrequency ||
      (
        frequency ===
          selectedFrequency &&
        count >
          selectedCount
      )
    ) {
      selectedCount =
        count;

      selectedFrequency =
        frequency;
    }
  }

  return selectedCount;
}

function selectLegacyCharacterAnchor(
  descriptors
) {
  if (
    !Array.isArray(
      descriptors
    ) ||
    descriptors.length ===
      0
  ) {
    throw new Error(
      "legacy character visual meshes unavailable"
    );
  }

  const dominantCount =
    findDominantInstanceCount(
      descriptors
    );

  const matching =
    descriptors.filter(
      (descriptor) =>
        descriptor.mesh.count ===
        dominantCount
    );

  matching.sort(
    (
      left,
      right
    ) => {
      const leftPriority =
        LEGACY_ROLE_PRIORITY[
          left.role
        ] ??
        0;

      const rightPriority =
        LEGACY_ROLE_PRIORITY[
          right.role
        ] ??
        0;

      if (
        rightPriority !==
        leftPriority
      ) {
        return (
          rightPriority -
          leftPriority
        );
      }

      if (
        right.fromLegacySystem !==
        left.fromLegacySystem
      ) {
        return right.fromLegacySystem
          ? 1
          : -1;
      }

      return (
        String(
          left.mesh.name
        ).localeCompare(
          String(
            right.mesh.name
          )
        )
      );
    }
  );

  return {
    descriptor:
      matching[0],

    dominantCount
  };
}

function normalizeStudentKeyEntry(
  entry
) {
  if (
    typeof entry ===
      "string" &&
    entry.trim().length >
      0
  ) {
    return entry.trim();
  }

  if (
    entry &&
    typeof entry ===
      "object"
  ) {
    for (
      const candidate
      of [
        entry.studentKey,
        entry.key,
        entry.studentId,
        entry.id
      ]
    ) {
      if (
        typeof candidate ===
          "string" &&
        candidate.trim().length >
          0
      ) {
        return candidate.trim();
      }
    }
  }

  return null;
}

function collectIdentityArrays(
  root
) {
  const candidates = [];

  const visited =
    new WeakSet();

  function visit(
    value,
    path,
    depth
  ) {
    if (
      value === null ||
      typeof value !==
        "object" ||
      depth >
        3
    ) {
      return;
    }

    if (
      visited.has(
        value
      )
    ) {
      return;
    }

    visited.add(
      value
    );

    if (
      value.isObject3D
    ) {
      return;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      if (
        /student|identity|key|pupil/u.test(
          path
            .toLowerCase()
        )
      ) {
        candidates.push({
          path,
          values:
            value
        });
      }

      return;
    }

    for (
      const [
        key,
        child
      ]
      of Object.entries(
        value
      )
    ) {
      if (
        typeof child ===
          "function"
      ) {
        continue;
      }

      visit(
        child,
        path
          ? `${path}.${key}`
          : key,
        depth + 1
      );
    }
  }

  visit(
    root,
    "legacyCharacterSystem",
    0
  );

  return candidates;
}

function resolveStudentKeys({
  legacyCharacterSystem,
  anchorMesh,
  studentCount
}) {
  const candidates =
    collectIdentityArrays(
      legacyCharacterSystem
    );

  const userData =
    anchorMesh?.userData ??
    {};

  for (
    const [
      key,
      value
    ]
    of Object.entries(
      userData
    )
  ) {
    if (
      Array.isArray(
        value
      ) &&
      /student|identity|key|pupil/u.test(
        key.toLowerCase()
      )
    ) {
      candidates.push({
        path:
          `anchorMesh.userData.${key}`,

        values:
          value
      });
    }
  }

  candidates.sort(
    (
      left,
      right
    ) => {
      const score =
        (candidate) => {
          const path =
            candidate.path
              .toLowerCase();

          if (
            path.includes(
              "studentkey"
            )
          ) {
            return 100;
          }

          if (
            path.includes(
              "student"
            )
          ) {
            return 80;
          }

          if (
            path.includes(
              "identity"
            )
          ) {
            return 60;
          }

          return 10;
        };

      return (
        score(
          right
        ) -
        score(
          left
        )
      );
    }
  );

  for (
    const candidate
    of candidates
  ) {
    if (
      candidate.values.length <
      studentCount
    ) {
      continue;
    }

    const keys =
      candidate.values
        .slice(
          0,
          studentCount
        )
        .map(
          normalizeStudentKeyEntry
        );

    if (
      keys.every(
        Boolean
      ) &&
      new Set(
        keys
      ).size ===
        studentCount
    ) {
      return {
        keys,

        source:
          candidate.path,

        synthetic:
          false
      };
    }
  }

  return {
    keys:
      Array.from(
        {
          length:
            studentCount
        },
        (
          _unused,
          index
        ) =>
          `${CLASSROOM_CHARACTER_VISUAL_V10_PROFILE.fallbackStudentKeyPrefix}-${String(
            index +
            1
          ).padStart(
            3,
            "0"
          )}`
      ),

    source:
      "synthetic-slot-order",

    synthetic:
      true
  };
}

function getInstanceWorldMatrix({
  mesh,
  index,
  target
}) {
  const instanceMatrix =
    new THREE.Matrix4();

  mesh.getMatrixAt(
    index,
    instanceMatrix
  );

  mesh.updateMatrixWorld(
    true
  );

  target.multiplyMatrices(
    mesh.matrixWorld,
    instanceMatrix
  );

  return target;
}

function getLegacyCharacterPosition({
  mesh,
  index,
  role
}) {
  const worldMatrix =
    getInstanceWorldMatrix({
      mesh,
      index,
      target:
        new THREE.Matrix4()
    });

  const position =
    new THREE.Vector3()
      .setFromMatrixPosition(
        worldMatrix
      );

  if (
    role ===
      "shoes" ||
    role ===
      "feet" ||
    role ===
      "legs"
  ) {
    const geometry =
      mesh.geometry;

    if (
      geometry &&
      !geometry.boundingBox &&
      typeof geometry.computeBoundingBox ===
        "function"
    ) {
      geometry.computeBoundingBox();
    }

    if (
      geometry?.boundingBox
    ) {
      const footPoint =
        new THREE.Vector3(
          0,
          geometry.boundingBox.min.y,
          0
        );

      footPoint.applyMatrix4(
        worldMatrix
      );

      position.y =
        footPoint.y;
    }

    return position;
  }

  if (
    role ===
      "torso" ||
    role ===
      "body"
  ) {
    position.y -=
      CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
        .characterHeight *
      0.48;

    return position;
  }

  if (
    role ===
      "head"
  ) {
    position.y -=
      CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
        .characterHeight *
      0.82;

    return position;
  }

  position.y -=
    CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
      .characterHeight *
    0.5;

  return position;
}

function isLayerEnabled(
  layers,
  channel
) {
  if (
    typeof layers?.isEnabled ===
      "function"
  ) {
    return layers.isEnabled(
      channel
    );
  }

  const probe =
    new THREE.Layers();

  probe.set(
    channel
  );

  return layers.test(
    probe
  );
}

function readExplicitCharacterVisualContract(
  legacyCharacterSystem
) {
  if (
    typeof legacyCharacterSystem
      ?.getVisualMeshes !==
      "function"
  ) {
    throw new TypeError(
      "legacyCharacterSystem.getVisualMeshes is required"
    );
  }

  if (
    typeof legacyCharacterSystem
      ?.getStudentCount !==
      "function"
  ) {
    throw new TypeError(
      "legacyCharacterSystem.getStudentCount is required"
    );
  }

  const parts =
    legacyCharacterSystem
      .getVisualMeshes();

  if (
    !Array.isArray(parts) ||
    parts.length ===
      0
  ) {
    throw new TypeError(
      "legacyCharacterSystem.getVisualMeshes() must return a non-empty array"
    );
  }

  const descriptors =
    parts.map(
      (
        part,
        index
      ) => {
        if (
          !part ||
          typeof part !==
            "object" ||
          !part.mesh
            ?.isInstancedMesh
        ) {
          throw new TypeError(
            `visual part ${index} must expose an InstancedMesh`
          );
        }

        if (
          !Number.isInteger(
            part.instancesPerStudent
          ) ||
          part.instancesPerStudent <
            1
        ) {
          throw new TypeError(
            `visual part ${index} must define a positive instancesPerStudent`
          );
        }

        const role =
          typeof part.role ===
            "string" &&
          part.role.length >
            0
            ? part.role
            : classifyLegacyCharacterRole(
                descriptorText({
                  object:
                    part.mesh
                })
              );

        return {
          mesh:
            part.mesh,

          hints: [
            "legacyCharacterSystem.getVisualMeshes"
          ],

          text:
            descriptorText({
              object:
                part.mesh,

              hints: [
                role
              ]
            }),

          role,

          fromLegacySystem:
            true,

          instancesPerStudent:
            part.instancesPerStudent,

          canonicalAnchor:
            part.canonicalAnchor ===
            true
        };
      }
    );

  const anchors =
    descriptors.filter(
      (descriptor) =>
        descriptor
          .canonicalAnchor
    );

  if (
    anchors.length !==
      1
  ) {
    throw new Error(
      "Character V3 visual contract must define exactly one canonical anchor"
    );
  }

  if (
    anchors[0]
      .instancesPerStudent !==
      1
  ) {
    throw new Error(
      "Character V3 canonical anchor must map one instance per student"
    );
  }

  return {
    descriptors,

    anchorDescriptor:
      anchors[0]
  };
}

function readSemanticStudentCount(
  legacyCharacterSystem
) {
  const studentCount =
    legacyCharacterSystem
      .getStudentCount();

  if (
    !Number.isInteger(
      studentCount
    ) ||
    studentCount <
      0 ||
    studentCount >
      CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
        .maximumStudents
  ) {
    throw new Error(
      `invalid semantic student count: ${studentCount}`
    );
  }

  return studentCount;
}

function assertSemanticVisualCardinality({
  descriptors,
  studentCount
}) {
  for (
    const descriptor
    of descriptors
  ) {
    const expectedCount =
      studentCount *
      descriptor
        .instancesPerStudent;

    if (
      descriptor.mesh.count !==
      expectedCount
    ) {
      throw new Error(
        `Character V3 visual cardinality mismatch for ${descriptor.role}: expected ${expectedCount}, received ${descriptor.mesh.count}`
      );
    }
  }
}

function createClassroomCharacterVisualIntegrationV10({
  scene,
  camera,
  legacyCharacterSystem,
  documentObject
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "scene is required"
    );
  }

  if (
    !camera?.isCamera
  ) {
    throw new TypeError(
      "camera is required"
    );
  }

  if (
    !documentObject ||
    typeof documentObject.createElement !==
      "function"
  ) {
    throw new TypeError(
      "documentObject is required"
    );
  }

  const {
    descriptors,
    anchorDescriptor
  } =
    readExplicitCharacterVisualContract(
      legacyCharacterSystem
    );

  const anchorMesh =
    anchorDescriptor.mesh;

  const originalVisibility =
    new Map();

  for (
    const descriptor
    of descriptors
  ) {
    originalVisibility.set(
      descriptor.mesh,
      descriptor.mesh.visible
    );

    descriptor.mesh.visible =
      false;
  }

  const visualLayer =
    CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
      .visualLayer;

  const cameraAlreadyHadLayer =
    isLayerEnabled(
      camera.layers,
      visualLayer
    );

  camera.layers.enable(
    visualLayer
  );

  const controllers = [];

  let identity = {
    keys: [],

    source:
      "waiting-for-population",

    synthetic:
      true
  };

  let semanticStudentCount =
    -1;

  let disposed =
    false;

  function disposeControllers(
    targetControllers
  ) {
    for (
      const controller
      of targetControllers
    ) {
      controller.dispose();
    }
  }

  function materializePopulation(
    studentCount
  ) {
    assertSemanticVisualCardinality({
      descriptors,
      studentCount
    });

    if (
      studentCount ===
        semanticStudentCount &&
      controllers.length ===
        studentCount
    ) {
      return false;
    }

    if (
      studentCount ===
        0
    ) {
      disposeControllers(
        controllers
      );

      controllers.splice(
        0,
        controllers.length
      );

      semanticStudentCount =
        0;

      identity = {
        keys: [],

        source:
          "waiting-for-population",

        synthetic:
          true
      };

      return true;
    }

    const nextIdentity =
      resolveStudentKeys({
        legacyCharacterSystem,
        anchorMesh,
        studentCount
      });

    const nextControllers =
      [];

    try {
      for (
        let index = 0;
        index <
          studentCount;
        index += 1
      ) {
        const studentKey =
          nextIdentity.keys[
            index
          ];

        const position =
          getLegacyCharacterPosition({
            mesh:
              anchorMesh,

            index,

            role:
              anchorDescriptor.role
          });

        const controller =
          createStudentCharacterSpriteV9({
            scene,
            studentKey,
            position,
            documentObject
          });

        controller.sprite.layers.set(
          visualLayer
        );

        controller.sprite.userData = {
          ...controller.sprite
            .userData,

          visualIntegrationAuthority:
            CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
              .authority,

          legacyVisualIndex:
            index,

          legacyAnchorName:
            anchorMesh.name ||
            "unnamed-anchor",

          identitySource:
            nextIdentity.source,

          syntheticIdentity:
            nextIdentity.synthetic
        };

        nextControllers.push(
          controller
        );
      }
    }
    catch (error) {
      disposeControllers(
        nextControllers
      );

      throw error;
    }

    disposeControllers(
      controllers
    );

    controllers.splice(
      0,
      controllers.length,
      ...nextControllers
    );

    identity =
      nextIdentity;

    semanticStudentCount =
      studentCount;

    return true;
  }

  try {
    materializePopulation(
      readSemanticStudentCount(
        legacyCharacterSystem
      )
    );
  }
  catch (error) {
    for (
      const descriptor
      of descriptors
    ) {
      descriptor.mesh.visible =
        originalVisibility.get(
          descriptor.mesh
        );
    }

    if (
      !cameraAlreadyHadLayer
    ) {
      camera.layers.disable(
        visualLayer
      );
    }

    throw error;
  }

  function tick({
    timestamp = 0,

    camera:
      tickCamera =
        camera
  } = {}) {
    if (disposed) {
      return 0;
    }

    materializePopulation(
      readSemanticStudentCount(
        legacyCharacterSystem
      )
    );

    let changedCount =
      0;

    for (
      const controller
      of controllers
    ) {
      if (
        controller.tick({
          timestamp,

          camera:
            tickCamera
        })
      ) {
        changedCount +=
          1;
      }
    }

    return changedCount;
  }

  function getSnapshot() {
    return {
      authority:
        CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
          .authority,

      visualLayer,

      studentCount:
        controllers.length,

      semanticStudentCount:
        Math.max(
          semanticStudentCount,
          0
        ),

      populationState:
        semanticStudentCount >
          0
          ? "active"
          : "waiting-for-population",

      legacyMeshCount:
        descriptors.length,

      legacyMeshesHidden:
        descriptors.every(
          (descriptor) =>
            descriptor.mesh
              .visible ===
            false
        ),

      anchorRole:
        anchorDescriptor.role,

      anchorName:
        anchorMesh.name ||
        "unnamed-anchor",

      identitySource:
        identity.source,

      syntheticIdentity:
        identity.synthetic,

      spriteCount:
        controllers.length,

      disposed
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    disposeControllers(
      controllers
    );

    controllers.splice(
      0,
      controllers.length
    );

    for (
      const descriptor
      of descriptors
    ) {
      descriptor.mesh.visible =
        originalVisibility.get(
          descriptor.mesh
        );
    }

    if (
      !cameraAlreadyHadLayer
    ) {
      camera.layers.disable(
        visualLayer
      );
    }
  }

  return {
    controllers,
    descriptors,
    anchorDescriptor,
    tick,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_CHARACTER_VISUAL_V10_PROFILE,
  LEGACY_ROLE_PRIORITY,
  classifyLegacyCharacterRole,
  collectLegacyCharacterVisualMeshes,
  collectLegacySystemObjects,
  createClassroomCharacterVisualIntegrationV10,
  descriptorText,
  findDominantInstanceCount,
  getLegacyCharacterPosition,
  resolveStudentKeys,
  selectLegacyCharacterAnchor
};