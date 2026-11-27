import * as THREE from "three";

const CLASSROOM_FURNITURE_LAYOUT =
  Object.freeze({
    teacherStation:
      Object.freeze({
        x: -3.8,
        z: -5.55
      }),

    podium:
      Object.freeze({
        x: 2.8,
        z: -5.85
      }),

    storageWall:
      Object.freeze({
        x: -6.68,

        zPositions:
          Object.freeze([
            -4.2,
            -3.25,
            -2.3,
            -1.35,
            -0.4,
            0.55,
            1.5,
            2.45,
            3.4
          ])
      }),

    readingShelf:
      Object.freeze({
        x: -4.75,
        z: 6.58
      })
  });

function getClassroomFurnitureLayout() {
  return {
    teacherStation: {
      ...CLASSROOM_FURNITURE_LAYOUT
        .teacherStation
    },

    podium: {
      ...CLASSROOM_FURNITURE_LAYOUT
        .podium
    },

    storageWall: {
      x:
        CLASSROOM_FURNITURE_LAYOUT
          .storageWall
          .x,

      zPositions: [
        ...CLASSROOM_FURNITURE_LAYOUT
          .storageWall
          .zPositions
      ]
    },

    readingShelf: {
      ...CLASSROOM_FURNITURE_LAYOUT
        .readingShelf
    }
  };
}

function createShadowMesh({
  geometry,
  material,
  name,
  position,
  rotation
}) {
  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.name =
    name;

  mesh.position.set(
    position.x,
    position.y,
    position.z
  );

  if (rotation) {
    mesh.rotation.set(
      rotation.x ?? 0,
      rotation.y ?? 0,
      rotation.z ?? 0
    );
  }

  mesh.castShadow =
    true;

  mesh.receiveShadow =
    true;

  return mesh;
}

function createClassroomFurnitureV2({
  scene,
  materials,
  presentationMode = "retro"
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
    !materials ||
    !materials.wood ||
    !materials.woodDark ||
    !materials.metal ||
    !materials.trim
  ) {
    throw new TypeError(
      "shared classroom materials are required"
    );
  }

  if (presentationMode !== "retro" && presentationMode !== "hd") {
    throw new RangeError("Invalid furniture presentation mode");
  }

  const hdMode = presentationMode === "hd";
  const root = new THREE.Group();

  root.name =
    "classroom-furniture-v2";

  const ownedGeometries =
    new Set();

  const ownGeometry =
    (geometry) => {
      ownedGeometries.add(
        geometry
      );

      return geometry;
    };

  /*
   * Teacher station.
   *
   * Built from a small number of shared primitive
   * geometries so the authored furniture remains
   * inexpensive while retaining the 32-bit block form.
   */

  const deskTopGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        2.4,
        0.12,
        0.9
      )
    );

  const deskSideGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.12,
        0.82,
        0.8
      )
    );

  const drawerGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.48,
        0.55,
        0.72
      )
    );

  const teacherX =
    CLASSROOM_FURNITURE_LAYOUT
      .teacherStation
      .x;

  const teacherZ =
    CLASSROOM_FURNITURE_LAYOUT
      .teacherStation
      .z;

  root.add(
    createShadowMesh({
      geometry:
        deskTopGeometry,

      material:
        materials.wood,

      name:
        "teacher-desk-top",

      position: {
        x:
          teacherX,

        y:
          0.9,

        z:
          teacherZ
      }
    })
  );

  for (
    const offset
    of [-1.02, 1.02]
  ) {
    root.add(
      createShadowMesh({
        geometry:
          deskSideGeometry,

        material:
          materials.woodDark,

        name:
          `teacher-desk-side-${offset}`,

        position: {
          x:
            teacherX +
            offset,

          y:
            0.45,

          z:
            teacherZ
        }
      })
    );
  }

  root.add(
    createShadowMesh({
      geometry:
        drawerGeometry,

      material:
        materials.woodDark,

      name:
        "teacher-desk-drawers",

      position: {
        x:
          teacherX + 0.67,

        y:
          0.53,

        z:
          teacherZ
      }
    })
  );

  /*
   * Teacher chair.
   */

  const chairSeatGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.58,
        0.1,
        0.58
      )
    );

  const chairBackGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.58,
        0.68,
        0.09
      )
    );

  const chairLegGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.08,
        0.52,
        0.08
      )
    );

  const chairX =
    teacherX;

  const chairZ =
    teacherZ + 1.05;

  root.add(
    createShadowMesh({
      geometry:
        chairSeatGeometry,

      material:
        materials.woodDark,

      name:
        "teacher-chair-seat",

      position: {
        x:
          chairX,

        y:
          0.55,

        z:
          chairZ
      }
    })
  );

  root.add(
    createShadowMesh({
      geometry:
        chairBackGeometry,

      material:
        materials.woodDark,

      name:
        "teacher-chair-back",

      position: {
        x:
          chairX,

        y:
          0.92,

        z:
          chairZ + 0.27
      }
    })
  );

  for (
    const [
      xOffset,
      zOffset
    ]
    of [
      [-0.23, -0.23],
      [0.23, -0.23],
      [-0.23, 0.23],
      [0.23, 0.23]
    ]
  ) {
    root.add(
      createShadowMesh({
        geometry:
          chairLegGeometry,

        material:
          materials.metal,

        name:
          "teacher-chair-leg",

        position: {
          x:
            chairX +
            xOffset,

          y:
            0.27,

          z:
            chairZ +
            zOffset
        }
      })
    );
  }

  /*
   * Teacher podium.
   */

  const podiumBodyGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.82,
        1.08,
        0.72
      )
    );

  const podiumTopGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        1.02,
        0.1,
        0.88
      )
    );

  const podiumLayout =
    CLASSROOM_FURNITURE_LAYOUT
      .podium;

  root.add(
    createShadowMesh({
      geometry:
        podiumBodyGeometry,

      material:
        materials.woodDark,

      name:
        "teacher-podium-body",

      position: {
        x:
          podiumLayout.x,

        y:
          0.54,

        z:
          podiumLayout.z
      }
    })
  );

  root.add(
    createShadowMesh({
      geometry:
        podiumTopGeometry,

      material:
        materials.wood,

      name:
        "teacher-podium-top",

      position: {
        x:
          podiumLayout.x,

        y:
          1.1,

        z:
          podiumLayout.z
      }
    })
  );

  /*
   * Storage wall.
   *
   * Repeated cubbies use InstancedMesh rather than
   * independent meshes.
   */

  const cubbyGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.5,
        0.92,
        0.76
      )
    );

  const cubbyPositions =
    CLASSROOM_FURNITURE_LAYOUT
      .storageWall
      .zPositions;

  const cubbies =
    new THREE.InstancedMesh(
      cubbyGeometry,
      materials.woodDark,
      cubbyPositions.length
    );

  cubbies.name =
    "storage-cubbies-instanced";

  cubbies.castShadow =
    true;

  cubbies.receiveShadow =
    true;

  const matrixObject =
    new THREE.Object3D();

  for (
    let index = 0;
    index < cubbyPositions.length;
    index += 1
  ) {
    matrixObject.position.set(
      CLASSROOM_FURNITURE_LAYOUT
        .storageWall
        .x,

      0.48,

      cubbyPositions[index]
    );

    matrixObject.updateMatrix();

    cubbies.setMatrixAt(
      index,
      matrixObject.matrix
    );
  }

  cubbies.instanceMatrix.needsUpdate =
    true;

  cubbies.computeBoundingBox();
  cubbies.computeBoundingSphere();

  root.add(
    cubbies
  );

  /*
   * Reading shelf on the rear perimeter.
   */

  const shelfSideGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.1,
        1.65,
        0.42
      )
    );

  const shelfBoardGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        2.1,
        0.1,
        0.42
      )
    );

  const shelfLayout =
    CLASSROOM_FURNITURE_LAYOUT
      .readingShelf;

  for (
    const offset
    of [-0.98, 0.98]
  ) {
    root.add(
      createShadowMesh({
        geometry:
          shelfSideGeometry,

        material:
          materials.woodDark,

        name:
          "reading-shelf-side",

        position: {
          x:
            shelfLayout.x +
            offset,

          y:
            0.84,

          z:
            shelfLayout.z
        }
      })
    );
  }

  for (
    const y
    of [0.18, 0.64, 1.1, 1.56]
  ) {
    root.add(
      createShadowMesh({
        geometry:
          shelfBoardGeometry,

        material:
          materials.wood,

        name:
          "reading-shelf-board",

        position: {
          x:
            shelfLayout.x,

          y,

          z:
            shelfLayout.z
        }
      })
    );
  }

  /*
   * Bulletin board adds an authored wall detail and
   * breaks the previous empty-wall silhouette.
   */

  const boardGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.08,
        1.35,
        2.35
      )
    );

  root.add(
    createShadowMesh({
      geometry:
        boardGeometry,

      material:
        materials.trim,

      name:
        "classroom-bulletin-board",

      position: {
        x: -6.96,
        y: 2.05,
        z: 4.45
      }
    })
  );

  scene.add(
    root
  );

  const ownedHdMaterials = new Set();
  let hdFinishApplied = false;

  function applyHdMaterialFinish() {
    if (!hdMode || hdFinishApplied) return false;

    const finishes = [
      ["wood", 0xb89470, 0.86, 0.01],
      ["woodDark", 0x87674f, 0.90, 0.01],
      ["metal", 0x829091, 0.72, 0.18]
    ];

    const replacements = new Map();

    for (const [key, color, roughness, metalness] of finishes) {
      if (!materials[key]?.isMeshStandardMaterial) {
        throw new TypeError("HD furniture requires standard materials");
      }
    }

    for (const [key, color, roughness, metalness] of finishes) {
      const source = materials[key];
      const finish = source.clone();

      finish.color.setHex(color);
      finish.roughness = roughness;
      finish.metalness = metalness;

      replacements.set(source, finish);
      ownedHdMaterials.add(finish);
    }

    for (const object of root.children) {
      if (object.isMesh && replacements.has(object.material)) {
        object.material = replacements.get(object.material);
      }
    }

    hdFinishApplied = true;
    return true;
  }

  let disposed = false;

  return {
    group:
      root,

    storageInstanceCount:
      cubbyPositions.length,

    applyHdMaterialFinish,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        root
      );

      for (
        const geometry
        of ownedGeometries
      ) {
        geometry.dispose();
      }

      for (const material of ownedHdMaterials) {
        material.dispose();
      }
    }
  };
}

export {
  CLASSROOM_FURNITURE_LAYOUT,
  createClassroomFurnitureV2,
  getClassroomFurnitureLayout
};