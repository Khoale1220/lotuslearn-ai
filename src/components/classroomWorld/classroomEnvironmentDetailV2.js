import * as THREE from "three";

import {
  CLASSROOM_FURNITURE_LAYOUT
} from "./classroomFurnitureV2.js";

function disableRaycast() {}

function createEnvironmentDetailV2({
  scene,
  materials
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
    !materials.sill
  ) {
    throw new TypeError(
      "shared classroom materials are required"
    );
  }

  const root =
    new THREE.Group();

  root.name =
    "classroom-environment-detail-v2";

  const geometries =
    new Set();

  const ownedMaterials =
    new Set();

  const ownGeometry =
    (geometry) => {
      geometries.add(
        geometry
      );

      return geometry;
    };

  const ownMaterial =
    (material) => {
      ownedMaterials.add(
        material
      );

      return material;
    };

  function addDetailMesh({
    geometry,
    material,
    name,
    position
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

    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;

    mesh.raycast =
      disableRaycast;

    mesh.userData
      .environmentDetailV2 =
        true;

    root.add(
      mesh
    );

    return mesh;
  }

  /*
   * Pixel-style wall posters.
   */

  const posterGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        1.18,
        1.45,
        0.05
      )
    );

  const posterMaterials = [
    0xb35f58,
    0x557c9f,
    0xc29b52
  ].map(
    (color) =>
      ownMaterial(
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.88,
          metalness: 0,
          flatShading: true
        })
      )
  );

  const posterX = [
    -1.55,
    0,
    1.55
  ];

  for (
    let index = 0;
    index < posterX.length;
    index += 1
  ) {
    addDetailMesh({
      geometry:
        posterGeometry,

      material:
        posterMaterials[index],

      name:
        `classroom-poster-${index + 1}`,

      position: {
        x:
          posterX[index],

        y:
          2.25,

        z:
          6.9
      }
    });
  }

  /*
   * Blocky wall clock.
   */

  const clockFrameGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.72,
        0.72,
        0.08
      )
    );

  const clockFaceGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.57,
        0.57,
        0.04
      )
    );

  const clockFaceMaterial =
    ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xe8e0ca,
        roughness: 0.82,
        metalness: 0,
        flatShading: true
      })
    );

  addDetailMesh({
    geometry:
      clockFrameGeometry,

    material:
      materials.woodDark,

    name:
      "classroom-wall-clock-frame",

    position: {
      x: -6.91,
      y: 2.7,
      z: -1.2
    }
  });

  addDetailMesh({
    geometry:
      clockFaceGeometry,

    material:
      clockFaceMaterial,

    name:
      "classroom-wall-clock-face",

    position: {
      x: -6.85,
      y: 2.7,
      z: -1.2
    }
  });

  /*
   * Waste bin.
   */

  const binGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.52,
        0.65,
        0.52
      )
    );

  addDetailMesh({
    geometry:
      binGeometry,

    material:
      materials.metal,

    name:
      "classroom-waste-bin",

    position: {
      x: 5.85,
      y: 0.33,
      z: -5.65
    }
  });

  /*
   * Teacher desk books.
   */

  const bookGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.46,
        0.07,
        0.31
      )
    );

  const bookMaterials = [
    posterMaterials[0],
    posterMaterials[1],
    posterMaterials[2]
  ];

  const teacher =
    CLASSROOM_FURNITURE_LAYOUT
      .teacherStation;

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    addDetailMesh({
      geometry:
        bookGeometry,

      material:
        bookMaterials[
          index %
          bookMaterials.length
        ],

      name:
        `teacher-book-${index + 1}`,

      position: {
        x:
          teacher.x - 0.55 +
          index * 0.06,

        y:
          0.995 +
          index * 0.072,

        z:
          teacher.z
      }
    });
  }

  /*
   * Two plants, with leaves rendered as one
   * InstancedMesh.
   */

  const planterGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.56,
        0.48,
        0.56
      )
    );

  const leafGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.16,
        0.62,
        0.16
      )
    );

  const leafMaterial =
    ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x557952,
        roughness: 0.9,
        metalness: 0,
        flatShading: true
      })
    );

  const plantBases = [
    {
      x: 6.35,
      z: -5.3
    },
    {
      x: 6.35,
      z: 5.25
    }
  ];

  for (
    let index = 0;
    index < plantBases.length;
    index += 1
  ) {
    addDetailMesh({
      geometry:
        planterGeometry,

      material:
        materials.sill,

      name:
        `classroom-planter-${index + 1}`,

      position: {
        x:
          plantBases[index].x,

        y:
          0.24,

        z:
          plantBases[index].z
      }
    });
  }

  const leafCount =
    plantBases.length * 6;

  const leaves =
    new THREE.InstancedMesh(
      leafGeometry,
      leafMaterial,
      leafCount
    );

  leaves.name =
    "classroom-plant-leaves-instanced";

  leaves.castShadow =
    true;

  leaves.receiveShadow =
    true;

  leaves.raycast =
    disableRaycast;

  leaves.userData
    .environmentDetailV2 =
      true;

  const leafTransform =
    new THREE.Object3D();

  let leafIndex =
    0;

  for (
    const base
    of plantBases
  ) {
    for (
      let localIndex = 0;
      localIndex < 6;
      localIndex += 1
    ) {
      const angle =
        (
          Math.PI * 2 *
          localIndex
        ) / 6;

      leafTransform.position.set(
        base.x +
        Math.cos(angle) * 0.16,

        0.73 +
        (
          localIndex % 2
        ) * 0.08,

        base.z +
        Math.sin(angle) * 0.16
      );

      leafTransform.rotation.set(
        Math.sin(angle) * 0.18,
        angle,
        Math.cos(angle) * 0.18
      );

      leafTransform.scale.set(
        1,
        0.82 +
        (
          localIndex % 3
        ) * 0.08,
        1
      );

      leafTransform.updateMatrix();

      leaves.setMatrixAt(
        leafIndex,
        leafTransform.matrix
      );

      leafIndex += 1;
    }
  }

  leaves.instanceMatrix
    .needsUpdate =
      true;

  leaves.computeBoundingBox();
  leaves.computeBoundingSphere();

  root.add(
    leaves
  );

  scene.add(
    root
  );

  let disposed =
    false;

  return {
    group:
      root,

    leafInstanceCount:
      leafCount,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        root
      );

      leaves.dispose();

      for (
        const geometry
        of geometries
      ) {
        geometry.dispose();
      }

      for (
        const material
        of ownedMaterials
      ) {
        material.dispose();
      }
    }
  };
}

export {
  createEnvironmentDetailV2
};