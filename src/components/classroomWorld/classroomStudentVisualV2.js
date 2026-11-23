import * as THREE from "three";

const HAIR_COLORS =
  Object.freeze([
    0x282421,
    0x49362b,
    0x6b4b33,
    0x1d1c1b
  ]);

const BACKPACK_COLORS =
  Object.freeze([
    0x476f91,
    0x9a554e,
    0x5d7b59,
    0xa17b42,
    0x665c88
  ]);

const ACCENT_COLORS =
  Object.freeze([
    0xe2b969,
    0x77a1ba,
    0xc47772,
    0x76a27b,
    0x9e86b6
  ]);

const TOP_LEVEL_STUDENT_KEYS =
  Object.freeze([
    "studentKey",
    "studentId",
    "student_id",
    "learnerKey",
    "learnerId"
  ]);

const NESTED_STUDENT_KEYS =
  Object.freeze([
    "student",
    "studentData",
    "runtimeStudent",
    "learner",
    "profile",
    "record"
  ]);

function clamp(
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

function hashIdentity(
  identity
) {
  let hash =
    2166136261;

  for (
    let index = 0;
    index < identity.length;
    index += 1
  ) {
    hash ^=
      identity.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return hash >>> 0;
}

function getStudentVisualVariant(
  identity
) {
  const normalized =
    String(identity);

  const hash =
    hashIdentity(
      normalized
    );

  return {
    hairColor:
      HAIR_COLORS[
        hash %
        HAIR_COLORS.length
      ],

    backpackColor:
      BACKPACK_COLORS[
        (hash >>> 5) %
        BACKPACK_COLORS.length
      ],

    accentColor:
      ACCENT_COLORS[
        (hash >>> 11) %
        ACCENT_COLORS.length
      ],

    hairHeightFactor:
      [
        0.1,
        0.13,
        0.16
      ][
        (hash >>> 17) % 3
      ]
  };
}

function normalizeIdentity(
  value
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function identityFromRecord(
  record
) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return null;
  }

  for (
    const key
    of [
      "studentKey",
      "studentId",
      "student_id",
      "learnerKey",
      "learnerId",
      "key",
      "id"
    ]
  ) {
    const identity =
      normalizeIdentity(
        record[key]
      );

    if (identity) {
      return identity;
    }
  }

  return null;
}

function identityFromUserData(
  userData
) {
  if (
    !userData ||
    typeof userData !== "object"
  ) {
    return null;
  }

  for (
    const key
    of TOP_LEVEL_STUDENT_KEYS
  ) {
    const identity =
      normalizeIdentity(
        userData[key]
      );

    if (identity) {
      return identity;
    }
  }

  for (
    const key
    of NESTED_STUDENT_KEYS
  ) {
    const identity =
      identityFromRecord(
        userData[key]
      );

    if (identity) {
      return identity;
    }
  }

  return null;
}

function findStudentAnchor(
  object
) {
  let current =
    object;

  let depth =
    0;

  while (
    current &&
    !current.isScene &&
    depth < 8
  ) {
    if (
      current.userData
        ?.studentVisualV2Decoration
    ) {
      return null;
    }

    const identity =
      identityFromUserData(
        current.userData
      );

    if (identity) {
      return {
        identity,
        anchor:
          current
      };
    }

    const name =
      typeof current.name ===
      "string"
        ? current.name.trim()
        : "";

    if (
      /^student(?:[-_:]|$)/iu
        .test(name)
    ) {
      return {
        identity:
          name,

        anchor:
          current
      };
    }

    current =
      current.parent;

    depth += 1;
  }

  return null;
}

function collectStudentRecords(
  scene
) {
  const uniqueAnchors =
    new Map();

  scene.traverse(
    (object) => {
      if (
        !object.isMesh ||
        object.userData
          ?.studentVisualV2Decoration
      ) {
        return;
      }

      const result =
        findStudentAnchor(
          object
        );

      if (!result) {
        return;
      }

      if (
        !uniqueAnchors.has(
          result.anchor.uuid
        )
      ) {
        uniqueAnchors.set(
          result.anchor.uuid,
          result
        );
      }
    }
  );

  const strongestByIdentity =
    new Map();

  for (
    const result
    of uniqueAnchors.values()
  ) {
    const box =
      new THREE.Box3()
        .setFromObject(
          result.anchor
        );

    if (box.isEmpty()) {
      continue;
    }

    const size =
      box.getSize(
        new THREE.Vector3()
      );

    const center =
      box.getCenter(
        new THREE.Vector3()
      );

    if (
      ![
        size.x,
        size.y,
        size.z,
        center.x,
        center.y,
        center.z
      ].every(Number.isFinite)
    ) {
      continue;
    }

    if (
      size.y < 0.2
    ) {
      continue;
    }

    const volume =
      Math.max(
        size.x,
        0.01
      ) *
      Math.max(
        size.y,
        0.01
      ) *
      Math.max(
        size.z,
        0.01
      );

    const existing =
      strongestByIdentity.get(
        result.identity
      );

    if (
      !existing ||
      volume >
        existing.volume
    ) {
      strongestByIdentity.set(
        result.identity,
        {
          identity:
            result.identity,

          box,
          size,
          center,
          volume
        }
      );
    }
  }

  return [
    ...strongestByIdentity.values()
  ].sort(
    (left, right) =>
      left.identity.localeCompare(
        right.identity
      )
  );
}

function recordSignature(
  records
) {
  return records
    .map(
      (record) => {
        const values = [
          record.center.x,
          record.center.y,
          record.center.z,
          record.size.x,
          record.size.y,
          record.size.z
        ].map(
          (value) =>
            value.toFixed(3)
        );

        return [
          record.identity,
          ...values
        ].join("@");
      }
    )
    .join("|");
}

function disableRaycast() {}

function createVisualMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    flatShading: true
  });
}

function createStudentVisualV2({
  scene,
  maxStudents = 64
}) {
  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "scene must be a THREE.Scene"
    );
  }

  if (
    !Number.isInteger(maxStudents) ||
    maxStudents < 1 ||
    maxStudents > 128
  ) {
    throw new RangeError(
      "maxStudents must be an integer from 1 to 128"
    );
  }

  const root =
    new THREE.Group();

  root.name =
    "classroom-student-visual-v2";

  root.userData
    .studentVisualV2Decoration =
      true;

  const hairGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const backpackGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const accentGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const hairMaterial =
    createVisualMaterial();

  const backpackMaterial =
    createVisualMaterial();

  const accentMaterial =
    createVisualMaterial();

  const hair =
    new THREE.InstancedMesh(
      hairGeometry,
      hairMaterial,
      maxStudents
    );

  const backpacks =
    new THREE.InstancedMesh(
      backpackGeometry,
      backpackMaterial,
      maxStudents
    );

  const accents =
    new THREE.InstancedMesh(
      accentGeometry,
      accentMaterial,
      maxStudents
    );

  hair.name =
    "student-visual-v2-hair";

  backpacks.name =
    "student-visual-v2-backpacks";

  accents.name =
    "student-visual-v2-accents";

  for (
    const mesh
    of [
      hair,
      backpacks,
      accents
    ]
  ) {
    mesh.count = 0;

    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;

    mesh.raycast =
      disableRaycast;

    mesh.userData
      .studentVisualV2Decoration =
        true;

    root.add(
      mesh
    );
  }

  scene.add(
    root
  );

  const transform =
    new THREE.Object3D();

  const color =
    new THREE.Color();

  let signature =
    "";

  let studentCount =
    0;

  let tickCount =
    0;

  let stableCycles =
    0;

  let settled =
    false;

  let disposed =
    false;

  function setInstance({
    mesh,
    index,
    position,
    scale,
    colorHex
  }) {
    transform.position.set(
      position.x,
      position.y,
      position.z
    );

    transform.rotation.set(
      0,
      0,
      0
    );

    transform.scale.set(
      scale.x,
      scale.y,
      scale.z
    );

    transform.updateMatrix();

    mesh.setMatrixAt(
      index,
      transform.matrix
    );

    color.setHex(
      colorHex
    );

    mesh.setColorAt(
      index,
      color
    );
  }

  function sync() {
    if (disposed) {
      return {
        changed: false,
        count: 0
      };
    }

    const records =
      collectStudentRecords(
        scene
      ).slice(
        0,
        maxStudents
      );

    const nextSignature =
      recordSignature(
        records
      );

    if (
      nextSignature ===
      signature
    ) {
      return {
        changed: false,
        count:
          records.length
      };
    }

    signature =
      nextSignature;

    studentCount =
      records.length;

    hair.count =
      studentCount;

    backpacks.count =
      studentCount;

    accents.count =
      studentCount;

    for (
      let index = 0;
      index < records.length;
      index += 1
    ) {
      const record =
        records[index];

      const variant =
        getStudentVisualVariant(
          record.identity
        );

      const height =
        clamp(
          record.size.y,
          0.85,
          2
        );

      const width =
        clamp(
          record.size.x,
          0.34,
          0.92
        );

      const depth =
        clamp(
          record.size.z,
          0.3,
          0.82
        );

      const hairHeight =
        clamp(
          height *
            variant
              .hairHeightFactor,
          0.08,
          0.23
        );

      setInstance({
        mesh:
          hair,

        index,

        position: {
          x:
            record.center.x,

          y:
            record.box.max.y -
            hairHeight * 0.35,

          z:
            record.center.z
        },

        scale: {
          x:
            width * 0.72,

          y:
            hairHeight,

          z:
            depth * 0.72
        },

        colorHex:
          variant.hairColor
      });

      setInstance({
        mesh:
          backpacks,

        index,

        position: {
          x:
            record.center.x,

          y:
            record.center.y +
            height * 0.04,

          z:
            record.center.z +
            depth * 0.55
        },

        scale: {
          x:
            width * 0.55,

          y:
            height * 0.34,

          z:
            Math.max(
              0.1,
              depth * 0.2
            )
        },

        colorHex:
          variant.backpackColor
      });

      setInstance({
        mesh:
          accents,

        index,

        position: {
          x:
            record.center.x,

          y:
            record.center.y +
            height * 0.16,

          z:
            record.center.z -
            depth * 0.52
        },

        scale: {
          x:
            width * 0.4,

          y:
            Math.max(
              0.08,
              height * 0.1
            ),

          z:
            Math.max(
              0.04,
              depth * 0.08
            )
        },

        colorHex:
          variant.accentColor
      });
    }

    for (
      const mesh
      of [
        hair,
        backpacks,
        accents
      ]
    ) {
      mesh.instanceMatrix
        .needsUpdate =
          true;

      if (mesh.instanceColor) {
        mesh.instanceColor
          .needsUpdate =
            true;
      }

      if (
        studentCount > 0
      ) {
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
      }
    }

    return {
      changed: true,
      count:
        studentCount
    };
  }

  function tick() {
    if (
      disposed ||
      settled
    ) {
      return;
    }

    tickCount += 1;

    if (
      tickCount % 12 !== 1
    ) {
      return;
    }

    const result =
      sync();

    if (
      result.count > 0 &&
      !result.changed
    ) {
      stableCycles += 1;
    }
    else {
      stableCycles = 0;
    }

    if (
      stableCycles >= 2
    ) {
      settled = true;
    }
  }

  function refresh() {
    settled = false;
    stableCycles = 0;
    signature = "";

    return sync();
  }

  return {
    group:
      root,

    sync,

    tick,

    refresh,

    getStudentCount() {
      return studentCount;
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        root
      );

      hair.dispose();
      backpacks.dispose();
      accents.dispose();

      hairGeometry.dispose();
      backpackGeometry.dispose();
      accentGeometry.dispose();

      hairMaterial.dispose();
      backpackMaterial.dispose();
      accentMaterial.dispose();
    }
  };
}

export {
  createStudentVisualV2,
  getStudentVisualVariant
};