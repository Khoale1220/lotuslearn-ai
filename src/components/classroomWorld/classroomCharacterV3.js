import * as THREE from "three";

const CHARACTER_V3_MAX_STUDENTS =
  64;

const SKIN_TONES =
  Object.freeze([
    0xf0c8a0,
    0xe0ad83,
    0xc88f68,
    0xa96e4d,
    0x87543c
  ]);

const UNIFORM_TONES =
  Object.freeze([
    0x2f5f9d,
    0x376eb2,
    0x31578c,
    0x4f6f9a
  ]);

const TROUSER_TONES =
  Object.freeze([
    0x2f3744,
    0x384351,
    0x27313e
  ]);

const SHOE_TONES =
  Object.freeze([
    0x272727,
    0x3b302b,
    0x303841
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

function disableRaycast() {}

function createCharacterMaterial({
  roughness
}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness: 0
  });
}

function createClassroomCharacterV3({
  scene,
  maxStudents =
    CHARACTER_V3_MAX_STUDENTS
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
    "classroom-character-v3";

  root.userData
    .studentVisualV2Decoration =
      true;

  /*
   * Geometry remains deliberately low-poly enough to
   * preserve stylization, but gains substantially more
   * silhouette definition than the previous cubes.
   */

  const headGeometry =
    new THREE.SphereGeometry(
      0.5,
      12,
      8
    );

  const torsoGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const limbGeometry =
    new THREE.CylinderGeometry(
      0.5,
      0.5,
      1,
      8
    );

  const shoeGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const headMaterial =
    createCharacterMaterial({
      roughness: 0.82
    });

  const uniformMaterial =
    createCharacterMaterial({
      roughness: 0.72
    });

  const trouserMaterial =
    createCharacterMaterial({
      roughness: 0.78
    });

  const shoeMaterial =
    createCharacterMaterial({
      roughness: 0.68
    });

  const heads =
    new THREE.InstancedMesh(
      headGeometry,
      headMaterial,
      maxStudents
    );

  const torsos =
    new THREE.InstancedMesh(
      torsoGeometry,
      uniformMaterial,
      maxStudents
    );

  const arms =
    new THREE.InstancedMesh(
      limbGeometry,
      uniformMaterial,
      maxStudents * 2
    );

  const legs =
    new THREE.InstancedMesh(
      limbGeometry,
      trouserMaterial,
      maxStudents * 2
    );

  const shoes =
    new THREE.InstancedMesh(
      shoeGeometry,
      shoeMaterial,
      maxStudents * 2
    );

  heads.name =
    "student-character-v3-heads";

  torsos.name =
    "student-character-v3-torsos";

  arms.name =
    "student-character-v3-arms";

  legs.name =
    "student-character-v3-legs";

  shoes.name =
    "student-character-v3-shoes";

  const characterMeshes = [
    heads,
    torsos,
    arms,
    legs,
    shoes
  ];

  for (
    const mesh
    of characterMeshes
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

  const sourceMatrix =
    new THREE.Matrix4();

  const sourcePosition =
    new THREE.Vector3();

  const sourceQuaternion =
    new THREE.Quaternion();

  const sourceScale =
    new THREE.Vector3();

  const backpackMatrix =
    new THREE.Matrix4();

  const backpackPosition =
    new THREE.Vector3();

  const backpackQuaternion =
    new THREE.Quaternion();

  const backpackScale =
    new THREE.Vector3();

  const transform =
    new THREE.Object3D();

  const color =
    new THREE.Color();

  let frame =
    0;

  let studentCount =
    0;

  let sourceSignature =
    "";

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

  function finalizeMesh(
    mesh
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
      mesh.count > 0
    ) {
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  function sync() {
    if (disposed) {
      return {
        changed: false,
        count: 0
      };
    }

    const sourceHair =
      scene.getObjectByName(
        "student-visual-v2-hair"
      );

    const sourceBackpacks =
      scene.getObjectByName(
        "student-visual-v2-backpacks"
      );

    if (
      !sourceHair?.isInstancedMesh ||
      !sourceBackpacks?.isInstancedMesh
    ) {
      return {
        changed: false,
        count: 0
      };
    }

    const count =
      Math.min(
        sourceHair.count,
        sourceBackpacks.count,
        maxStudents
      );

    const nextSignature = [
      count,
      sourceHair
        .instanceMatrix
        .version,
      sourceBackpacks
        .instanceMatrix
        .version
    ].join(":");

    if (
      nextSignature ===
      sourceSignature
    ) {
      return {
        changed: false,
        count
      };
    }

    sourceSignature =
      nextSignature;

    studentCount =
      count;

    heads.count =
      count;

    torsos.count =
      count;

    arms.count =
      count * 2;

    legs.count =
      count * 2;

    shoes.count =
      count * 2;

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      sourceHair.getMatrixAt(
        index,
        sourceMatrix
      );

      sourceMatrix.decompose(
        sourcePosition,
        sourceQuaternion,
        sourceScale
      );

      sourceBackpacks.getMatrixAt(
        index,
        backpackMatrix
      );

      backpackMatrix.decompose(
        backpackPosition,
        backpackQuaternion,
        backpackScale
      );

      const studentHeight =
        clamp(
          backpackScale.y /
          0.34,
          0.9,
          1.95
        );

      const studentWidth =
        clamp(
          sourceScale.x /
          0.72,
          0.34,
          0.88
        );

      const studentDepth =
        clamp(
          backpackScale.z /
          0.2,
          0.34,
          0.78
        );

      const headRadius =
        clamp(
          studentWidth *
          0.29,
          0.13,
          0.24
        );

      const headY =
        sourcePosition.y -
        sourceScale.y * 0.7 -
        headRadius * 0.12;

      const torsoHeight =
        studentHeight *
        0.34;

      const torsoY =
        headY -
        headRadius -
        torsoHeight * 0.52;

      const legHeight =
        studentHeight *
        0.28;

      const legY =
        torsoY -
        torsoHeight * 0.5 -
        legHeight * 0.5;

      const shoeY =
        legY -
        legHeight * 0.5 -
        0.045;

      const skin =
        SKIN_TONES[
          index %
          SKIN_TONES.length
        ];

      const uniform =
        UNIFORM_TONES[
          index %
          UNIFORM_TONES.length
        ];

      const trouser =
        TROUSER_TONES[
          index %
          TROUSER_TONES.length
        ];

      const shoe =
        SHOE_TONES[
          index %
          SHOE_TONES.length
        ];

      setInstance({
        mesh:
          heads,

        index,

        position: {
          x:
            sourcePosition.x,

          y:
            headY,

          z:
            sourcePosition.z
        },

        scale: {
          x:
            headRadius * 2,

          y:
            headRadius * 2.08,

          z:
            headRadius * 1.9
        },

        colorHex:
          skin
      });

      setInstance({
        mesh:
          torsos,

        index,

        position: {
          x:
            backpackPosition.x,

          y:
            torsoY,

          z:
            backpackPosition.z -
            studentDepth * 0.18
        },

        scale: {
          x:
            studentWidth * 0.78,

          y:
            torsoHeight,

          z:
            studentDepth * 0.62
        },

        colorHex:
          uniform
      });

      const armBaseIndex =
        index * 2;

      for (
        let sideIndex = 0;
        sideIndex < 2;
        sideIndex += 1
      ) {
        const side =
          sideIndex === 0
            ? -1
            : 1;

        setInstance({
          mesh:
            arms,

          index:
            armBaseIndex +
            sideIndex,

          position: {
            x:
              backpackPosition.x +
              side *
              studentWidth *
              0.45,

            y:
              torsoY -
              torsoHeight *
              0.03,

            z:
              backpackPosition.z -
              studentDepth *
              0.18
          },

          scale: {
            x:
              studentWidth *
              0.115,

            y:
              torsoHeight *
              0.88,

            z:
              studentWidth *
              0.115
          },

          colorHex:
            uniform
        });
      }

      const legBaseIndex =
        index * 2;

      for (
        let sideIndex = 0;
        sideIndex < 2;
        sideIndex += 1
      ) {
        const side =
          sideIndex === 0
            ? -1
            : 1;

        const legX =
          backpackPosition.x +
          side *
          studentWidth *
          0.19;

        setInstance({
          mesh:
            legs,

          index:
            legBaseIndex +
            sideIndex,

          position: {
            x:
              legX,

            y:
              legY,

            z:
              backpackPosition.z -
              studentDepth *
              0.16
          },

          scale: {
            x:
              studentWidth *
              0.13,

            y:
              legHeight,

            z:
              studentWidth *
              0.13
          },

          colorHex:
            trouser
        });

        setInstance({
          mesh:
            shoes,

          index:
            legBaseIndex +
            sideIndex,

          position: {
            x:
              legX,

            y:
              shoeY,

            z:
              backpackPosition.z -
              studentDepth *
              0.24
          },

          scale: {
            x:
              studentWidth *
              0.24,

            y:
              0.085,

            z:
              studentDepth *
              0.34
          },

          colorHex:
            shoe
        });
      }
    }

    for (
      const mesh
      of characterMeshes
    ) {
      finalizeMesh(
        mesh
      );
    }

    return {
      changed: true,
      count
    };
  }

  function tick() {
    if (disposed) {
      return;
    }

    frame += 1;

    if (
      frame % 12 !== 1
    ) {
      return;
    }

    sync();
  }

  return {
    group:
      root,

    tick,

    sync,

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

      for (
        const mesh
        of characterMeshes
      ) {
        mesh.dispose();
      }

      headGeometry.dispose();
      torsoGeometry.dispose();
      limbGeometry.dispose();
      shoeGeometry.dispose();

      headMaterial.dispose();
      uniformMaterial.dispose();
      trouserMaterial.dispose();
      shoeMaterial.dispose();
    }
  };
}

export {
  CHARACTER_V3_MAX_STUDENTS,
  createClassroomCharacterV3
};