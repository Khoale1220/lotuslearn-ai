import * as THREE from "three";

const ROOM_GEOMETRY_V3_CONFIG =
  Object.freeze({
    ceilingTileCount: 25,
    ceilingY: 3.49,
    doorX: -6.93,
    doorZ: -4.65
  });

function disableRaycast() {}

function freezeStaticObject(
  object
) {
  object.updateMatrix();

  object.matrixAutoUpdate =
    false;

  return object;
}

function configureStaticMesh(
  mesh
) {
  mesh.castShadow =
    true;

  mesh.receiveShadow =
    true;

  mesh.raycast =
    disableRaycast;

  mesh.userData
    .roomGeometryV3 =
      true;

  freezeStaticObject(
    mesh
  );

  return mesh;
}

function createClassroomRoomGeometryV3({
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
    !materials.wall ||
    !materials.wallShadow ||
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
    throw new RangeError("Invalid V3 presentation mode");
  }

  const hdMode = presentationMode === "hd";

  const root = new THREE.Group();

  root.name =
    "classroom-room-geometry-v3";

  root.userData
    .roomGeometryV3 =
      true;

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

  function addMesh({
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

    root.add(
      configureStaticMesh(
        mesh
      )
    );

    if (hdMode && name.startsWith("ceiling-rail-")) {
      mesh.castShadow = false;
    }

    return mesh;
  }

  /*
   * Ceiling grid.
   *
   * One instanced mesh replaces 25 individual draw
   * objects while still creating a much richer ceiling.
   */

  const ceilingTileGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        hdMode ? 2.38 : 2.12,
        0.045,
        hdMode ? 2.38 : 2.12
      )
    );

  const ceilingTileMaterial =
    ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xe7e2d4,
        roughness: 0.9,
        metalness: 0
      })
    );

  const ceilingTiles =
    new THREE.InstancedMesh(
      ceilingTileGeometry,
      ceilingTileMaterial,
      ROOM_GEOMETRY_V3_CONFIG
        .ceilingTileCount
    );

  ceilingTiles.name =
    "ceiling-tiles-v3-instanced";

  ceilingTiles.receiveShadow =
    true;

  ceilingTiles.castShadow =
    false;

  ceilingTiles.raycast =
    disableRaycast;

  ceilingTiles.userData
    .roomGeometryV3 =
      true;

  const tileTransform =
    new THREE.Object3D();

  const coordinates = [
    -4.8,
    -2.4,
    0,
    2.4,
    4.8
  ];

  let tileIndex =
    0;

  for (
    const x
    of coordinates
  ) {
    for (
      const z
      of coordinates
    ) {
      tileTransform.position.set(
        x,
        ROOM_GEOMETRY_V3_CONFIG
          .ceilingY,
        z
      );

      tileTransform.updateMatrix();

      ceilingTiles.setMatrixAt(
        tileIndex,
        tileTransform.matrix
      );

      tileIndex += 1;
    }
  }

  ceilingTiles.instanceMatrix
    .needsUpdate =
      true;

  ceilingTiles.computeBoundingBox();
  ceilingTiles.computeBoundingSphere();

  freezeStaticObject(
    ceilingTiles
  );

  root.add(
    ceilingTiles
  );

  /*
   * Ceiling grid rails.
   */

  const ceilingRailMaterial = hdMode
    ? ownMaterial(new THREE.MeshStandardMaterial({
        color: 0xece9df,
        roughness: 0.95,
        metalness: 0.0
      }))
    : materials.metal;

  const ceilingRailLongGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        13.2,
        0.055,
        0.045
      )
    );

  const ceilingRailCrossGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.045,
        0.055,
        13.2
      )
    );

  for (
    const z
    of [
      -3.6,
      -1.2,
      1.2,
      3.6
    ]
  ) {
    addMesh({
      geometry:
        ceilingRailLongGeometry,

      material:
        ceilingRailMaterial,

      name:
        "ceiling-rail-long-v3",

      position: {
        x: 0,
        y: 3.455,
        z
      }
    });
  }

  for (
    const x
    of [
      -3.6,
      -1.2,
      1.2,
      3.6
    ]
  ) {
    addMesh({
      geometry:
        ceilingRailCrossGeometry,

      material:
        ceilingRailMaterial,

      name:
        "ceiling-rail-cross-v3",

      position: {
        x,
        y: 3.455,
        z: 0
      }
    });
  }

  /*
   * Baseboards.
   */

  const baseboardXGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        13.8,
        0.18,
        0.1
      )
    );

  const baseboardZGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.1,
        0.18,
        13.8
      )
    );

  for (
    const z
    of [-6.9, 6.9]
  ) {
    addMesh({
      geometry:
        baseboardXGeometry,

      material:
        materials.woodDark,

      name:
        "classroom-baseboard-v3",

      position: {
        x: 0,
        y: 0.09,
        z
      }
    });
  }

  for (
    const x
    of [-6.9, 6.9]
  ) {
    addMesh({
      geometry:
        baseboardZGeometry,

      material:
        materials.woodDark,

      name:
        "classroom-baseboard-v3",

      position: {
        x,
        y: 0.09,
        z: 0
      }
    });
  }

  /*
   * Upper cornice gives the room a stronger silhouette.
   */

  const corniceXGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        13.8,
        0.12,
        0.12
      )
    );

  const corniceZGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.12,
        0.12,
        13.8
      )
    );

  for (
    const z
    of [-6.9, 6.9]
  ) {
    addMesh({
      geometry:
        corniceXGeometry,

      material:
        materials.trim,

      name:
        "classroom-cornice-v3",

      position: {
        x: 0,
        y: 3.36,
        z
      }
    });
  }

  for (
    const x
    of [-6.9, 6.9]
  ) {
    addMesh({
      geometry:
        corniceZGeometry,

      material:
        materials.trim,

      name:
        "classroom-cornice-v3",

      position: {
        x,
        y: 3.36,
        z: 0
      }
    });
  }

  /*
   * Classroom door and frame.
   *
   * Pure visual overlay: collision authority remains
   * in the existing deterministic classroom shell.
   */

  const doorGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.075,
        2.32,
        1.28
      )
    );

  const doorMaterial =
    ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x815739,
        roughness: 0.63,
        metalness: 0
      })
    );

  addMesh({
    geometry:
      doorGeometry,

    material:
      doorMaterial,

    name:
      "classroom-door-v3",

    position: {
      x:
        ROOM_GEOMETRY_V3_CONFIG
          .doorX,

      y: 1.16,

      z:
        ROOM_GEOMETRY_V3_CONFIG
          .doorZ
    }
  });

  const verticalDoorFrameGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.13,
        2.55,
        0.12
      )
    );

  const horizontalDoorFrameGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.13,
        0.13,
        1.55
      )
    );

  for (
    const zOffset
    of [-0.72, 0.72]
  ) {
    addMesh({
      geometry:
        verticalDoorFrameGeometry,

      material:
        materials.woodDark,

      name:
        "classroom-door-frame-v3",

      position: {
        x: -6.86,
        y: 1.27,
        z:
          ROOM_GEOMETRY_V3_CONFIG
            .doorZ +
          zOffset
      }
    });
  }

  addMesh({
    geometry:
      horizontalDoorFrameGeometry,

    material:
      materials.woodDark,

    name:
      "classroom-door-frame-top-v3",

    position: {
      x: -6.86,
      y: 2.49,
      z:
        ROOM_GEOMETRY_V3_CONFIG
          .doorZ
    }
  });

  const handleGeometry =
    ownGeometry(
      new THREE.SphereGeometry(
        0.07,
        12,
        8
      )
    );

  addMesh({
    geometry:
      handleGeometry,

    material:
      materials.metal,

    name:
      "classroom-door-handle-v3",

    position: {
      x: -6.81,
      y: 1.08,
      z:
        ROOM_GEOMETRY_V3_CONFIG
          .doorZ +
        0.43
    }
  });

  /*
   * Blackboard dimensional frame and chalk tray.
   */

  const boardTopGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        4.9,
        0.1,
        0.11
      )
    );

  const boardSideGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        0.1,
        1.8,
        0.11
      )
    );

  const chalkTrayGeometry =
    ownGeometry(
      new THREE.BoxGeometry(
        4.75,
        0.08,
        0.24
      )
    );

  addMesh({
    geometry:
      boardTopGeometry,

    material:
      materials.woodDark,

    name:
      "chalkboard-frame-top-v3",

    position: {
      x: 0,
      y: 2.95,
      z: -6.84
    }
  });

  addMesh({
    geometry:
      boardTopGeometry,

    material:
      materials.woodDark,

    name:
      "chalkboard-frame-bottom-v3",

    position: {
      x: 0,
      y: 1.25,
      z: -6.84
    }
  });

  for (
    const x
    of [-2.4, 2.4]
  ) {
    addMesh({
      geometry:
        boardSideGeometry,

      material:
        materials.woodDark,

      name:
        "chalkboard-frame-side-v3",

      position: {
        x,
        y: 2.1,
        z: -6.84
      }
    });
  }

  addMesh({
    geometry:
      chalkTrayGeometry,

    material:
      materials.sill ??
      materials.wood,

    name:
      "chalkboard-tray-v3",

    position: {
      x: 0,
      y: 1.18,
      z: -6.72
    }
  });

  root.updateMatrix();

  root.matrixAutoUpdate =
    false;

  scene.add(
    root
  );

  let disposed =
    false;

  return {
    group:
      root,

    ceilingTileCount:
      ROOM_GEOMETRY_V3_CONFIG
        .ceilingTileCount,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        root
      );

      ceilingTiles.dispose();

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
  ROOM_GEOMETRY_V3_CONFIG,
  createClassroomRoomGeometryV3
};