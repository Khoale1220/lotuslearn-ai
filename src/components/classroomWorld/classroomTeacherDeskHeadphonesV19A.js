import * as THREE from "three";

const CLASSROOM_TEACHER_DESK_HEADPHONES_V19A_PROFILE =
  Object.freeze({
    id: "cw06-teacher-desk-headphones-v19a",
    visualStyle: "high-detail-1990s-vga-pixel-art",
    productClass: "black-over-ear-headphones",
    visualOnly: true,
    deterministic: true,
    runtimeRandomness: 0,
    interactionAuthorityMutations: 0,
    locomotionMutations: 0,
    collisionMutations: 0
  });

const DESK_NAME_PATTERN =
  /(teacher.*desk|desk.*teacher|teacher.*station|station.*teacher|teacher.*table|front.*desk|podium)/i;

function disableRaycast(object) {
  object.raycast =
    function noHeadphoneRaycast() {};
}

function createMaterial(
  color
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.08,
    flatShading: true
  });
}

function isFiniteVector3(
  value
) {
  return Boolean(
    value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function candidateScore({
  object,
  box,
  teacherAnchor
}) {
  const size =
    new THREE.Vector3();

  box.getSize(size);

  const center =
    new THREE.Vector3();

  box.getCenter(center);

  let score = 0;

  const name =
    String(object.name || "");

  if (
    DESK_NAME_PATTERN.test(name)
  ) {
    score += 1000;
  }

  if (
    object.userData?.teacherDesk === true ||
    object.userData?.isTeacherDesk === true ||
    object.userData?.teacherStation === true
  ) {
    score += 1200;
  }

  if (
    size.x >= 0.8 &&
    size.x <= 4.5
  ) {
    score += 40;
  }

  if (
    size.z >= 0.35 &&
    size.z <= 2.5
  ) {
    score += 40;
  }

  if (
    size.y >= 0.4 &&
    size.y <= 1.8
  ) {
    score += 30;
  }

  if (
    isFiniteVector3(
      teacherAnchor
    )
  ) {
    const dx =
      center.x -
      teacherAnchor.x;

    const dz =
      center.z -
      teacherAnchor.z;

    const distance =
      Math.hypot(dx, dz);

    score +=
      Math.max(
        0,
        160 - distance * 30
      );
  }

  return score;
}

function discoverTeacherDesk({
  scene,
  teacherAnchor
}) {
  scene.updateMatrixWorld(true);

  const candidates = [];

  scene.traverse(
    (object) => {
      if (
        !object ||
        object === scene ||
        !object.visible
      ) {
        return;
      }

      const name =
        String(object.name || "");

      const explicit =
        DESK_NAME_PATTERN.test(name) ||
        object.userData?.teacherDesk === true ||
        object.userData?.isTeacherDesk === true ||
        object.userData?.teacherStation === true;

      if (
        !explicit &&
        !object.isMesh &&
        !object.isGroup
      ) {
        return;
      }

      const box =
        new THREE.Box3();

      try {
        box.setFromObject(
          object,
          true
        );
      }
      catch {
        return;
      }

      if (box.isEmpty()) {
        return;
      }

      const size =
        new THREE.Vector3();

      box.getSize(size);

      if (
        !explicit &&
        (
          size.x < 0.7 ||
          size.x > 4.5 ||
          size.z < 0.3 ||
          size.z > 2.5 ||
          size.y < 0.3 ||
          size.y > 2
        )
      ) {
        return;
      }

      candidates.push({
        object,
        box,
        score:
          candidateScore({
            object,
            box,
            teacherAnchor
          })
      });
    }
  );

  candidates.sort(
    (left, right) =>
      right.score -
      left.score
  );

  return candidates[0] || null;
}

function createClassroomTeacherDeskHeadphonesV19A({
  scene,
  teacherAnchor = null
}) {
  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "V19A requires THREE.Scene"
    );
  }

  const root =
    new THREE.Group();

  root.name =
    "cw06-v19a-teacher-headphones";

  root.userData = {
    cw06TeacherHeadphonesV19A: true,
    visualOnly: true,
    interactionExcluded: true
  };

  const black =
    createMaterial(
      0x17191c
    );

  const shell =
    createMaterial(
      0x25292d
    );

  const cushion =
    createMaterial(
      0x090a0b
    );

  const hinge =
    createMaterial(
      0x3a3e42
    );

  const accent =
    createMaterial(
      0x781d1d
    );

  const materials = [
    black,
    shell,
    cushion,
    hinge,
    accent
  ];

  const geometries = [];

  const headbandGeometry =
    new THREE.TorusGeometry(
      0.34,
      0.035,
      4,
      14,
      Math.PI
    );

  geometries.push(
    headbandGeometry
  );

  const headband =
    new THREE.Mesh(
      headbandGeometry,
      black
    );

  headband.name =
    "cw06-v19a-headband";

  headband.rotation.z =
    Math.PI;

  headband.position.y =
    0.20;

  root.add(headband);

  const innerBandGeometry =
    new THREE.TorusGeometry(
      0.29,
      0.018,
      4,
      14,
      Math.PI
    );

  geometries.push(
    innerBandGeometry
  );

  const innerBand =
    new THREE.Mesh(
      innerBandGeometry,
      cushion
    );

  innerBand.name =
    "cw06-v19a-inner-band";

  innerBand.rotation.z =
    Math.PI;

  innerBand.position.y =
    0.19;

  innerBand.position.z =
    0.012;

  root.add(innerBand);

  const earcupGeometry =
    new THREE.CylinderGeometry(
      0.135,
      0.135,
      0.075,
      10
    );

  geometries.push(
    earcupGeometry
  );

  const cushionGeometry =
    new THREE.TorusGeometry(
      0.108,
      0.025,
      4,
      10
    );

  geometries.push(
    cushionGeometry
  );

  const hingeGeometry =
    new THREE.BoxGeometry(
      0.045,
      0.12,
      0.045
    );

  geometries.push(
    hingeGeometry
  );

  const accentGeometry =
    new THREE.BoxGeometry(
      0.016,
      0.016,
      0.012
    );

  geometries.push(
    accentGeometry
  );

  for (
    const side
    of [-1, 1]
  ) {
    const cup =
      new THREE.Mesh(
        earcupGeometry,
        shell
      );

    cup.name =
      side < 0
        ? "cw06-v19a-left-earcup"
        : "cw06-v19a-right-earcup";

    cup.rotation.z =
      Math.PI / 2;

    cup.position.set(
      side * 0.34,
      -0.015,
      0
    );

    root.add(cup);

    const pad =
      new THREE.Mesh(
        cushionGeometry,
        cushion
      );

    pad.name =
      side < 0
        ? "cw06-v19a-left-cushion"
        : "cw06-v19a-right-cushion";

    pad.rotation.y =
      Math.PI / 2;

    pad.position.set(
      side * 0.382,
      -0.015,
      0
    );

    root.add(pad);

    const yoke =
      new THREE.Mesh(
        hingeGeometry,
        hinge
      );

    yoke.name =
      side < 0
        ? "cw06-v19a-left-yoke"
        : "cw06-v19a-right-yoke";

    yoke.position.set(
      side * 0.305,
      0.105,
      0
    );

    yoke.rotation.z =
      side * 0.12;

    root.add(yoke);
  }

  const redMark =
    new THREE.Mesh(
      accentGeometry,
      accent
    );

  redMark.name =
    "cw06-v19a-red-accent";

  redMark.position.set(
    -0.27,
    0.16,
    0.043
  );

  root.add(redMark);

  root.traverse(
    (object) => {
      if (object.isMesh) {
        object.castShadow =
          false;

        object.receiveShadow =
          false;

        object.userData = {
          ...object.userData,
          cw06TeacherHeadphonesV19A:
            true,
          visualOnly: true,
          interactionExcluded: true
        };

        disableRaycast(
          object
        );
      }
    }
  );

  const desk =
    discoverTeacherDesk({
      scene,
      teacherAnchor
    });

  let anchorMode;
  let candidateName = null;

  if (desk) {
    const center =
      new THREE.Vector3();

    desk.box.getCenter(
      center
    );

    const size =
      new THREE.Vector3();

    desk.box.getSize(
      size
    );

    const offsetX =
      Math.min(
        0.32,
        size.x * 0.18
      );

    const offsetZ =
      Math.min(
        0.18,
        size.z * 0.16
      );

    root.position.set(
      center.x + offsetX,
      desk.box.max.y + 0.085,
      center.z + offsetZ
    );

    anchorMode =
      "desk-bounds";

    candidateName =
      String(
        desk.object.name ||
        "unnamed-desk-candidate"
      );
  }
  else if (
    isFiniteVector3(
      teacherAnchor
    )
  ) {
    root.position.set(
      teacherAnchor.x + 0.65,
      0.92,
      teacherAnchor.z + 0.25
    );

    anchorMode =
      "teacher-anchor-fallback";
  }
  else {
    root.position.set(
      0,
      0.92,
      0
    );

    anchorMode =
      "world-fallback";
  }

  /*
   * Headphones rest naturally on the
   * desk at a slight angle rather than
   * standing perfectly upright.
   */
  root.rotation.set(
    -0.22,
    0.34,
    -0.08
  );

  root.scale.setScalar(
    0.82
  );

  scene.add(root);

  let disposed = false;

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_TEACHER_DESK_HEADPHONES_V19A_PROFILE.id,

      anchorMode,
      candidateName,

      position:
        Object.freeze({
          x:
            root.position.x,
          y:
            root.position.y,
          z:
            root.position.z
        }),

      rotation:
        Object.freeze({
          x:
            root.rotation.x,
          y:
            root.rotation.y,
          z:
            root.rotation.z
        }),

      meshCount:
        root.children.length,

      visualOnly: true,
      deterministic: true,

      runtimeRandomness: 0,
      interactionAuthorityMutations: 0,
      locomotionMutations: 0,
      collisionMutations: 0
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    scene.remove(root);

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
  CLASSROOM_TEACHER_DESK_HEADPHONES_V19A_PROFILE,
  createClassroomTeacherDeskHeadphonesV19A
};
