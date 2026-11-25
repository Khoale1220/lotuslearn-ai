import * as THREE from "three";

const VISUAL_64BIT_PROFILE =
  Object.freeze({
    name:
      "64-bit-era-high-fidelity",

    literalFramebufferMode:
      false,

    surfaceTextureResolution:
      256,

    floorTextureResolution:
      512,

    exteriorTextureWidth:
      512,

    exteriorTextureHeight:
      256,

    maximumAnisotropy:
      4,

    shadowMapSize:
      2048
  });

function get64BitVisualProfile() {
  return {
    ...VISUAL_64BIT_PROFILE
  };
}

function createCanvas({
  documentObject,
  width,
  height
}) {
  if (
    !documentObject ||
    typeof documentObject.createElement
      !== "function"
  ) {
    throw new TypeError(
      "documentObject.createElement is required"
    );
  }

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "2D canvas context unavailable"
    );
  }

  context.imageSmoothingEnabled =
    true;

  return {
    canvas,
    context
  };
}

function configureColorTexture({
  texture,
  anisotropy,
  repeatX = 1,
  repeatY = 1
}) {
  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.LinearFilter;

  texture.minFilter =
    THREE.LinearMipmapLinearFilter;

  texture.generateMipmaps =
    true;

  texture.anisotropy =
    anisotropy;

  if (
    repeatX !== 1 ||
    repeatY !== 1
  ) {
    texture.wrapS =
      THREE.RepeatWrapping;

    texture.wrapT =
      THREE.RepeatWrapping;

    texture.repeat.set(
      repeatX,
      repeatY
    );
  }

  texture.needsUpdate =
    true;

  return texture;
}

function createWallTexture({
  documentObject,
  anisotropy
}) {
  const size =
    VISUAL_64BIT_PROFILE
      .surfaceTextureResolution;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width: size,
      height: size
    });

  context.fillStyle =
    "#e8dfc9";

  context.fillRect(
    0,
    0,
    size,
    size
  );

  for (
    let y = 0;
    y < size;
    y += 8
  ) {
    for (
      let x = 0;
      x < size;
      x += 8
    ) {
      const tone =
        (
          (
            x * 17 +
            y * 31
          ) %
          19
        );

      context.fillStyle =
        tone < 7
          ? "rgba(108,96,75,0.035)"
          : "rgba(255,255,255,0.035)";

      context.fillRect(
        x,
        y,
        3,
        3
      );
    }
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy,
    repeatX: 3,
    repeatY: 2
  });
}

function createWoodTexture({
  documentObject,
  anisotropy
}) {
  const size =
    VISUAL_64BIT_PROFILE
      .surfaceTextureResolution;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width: size,
      height: size
    });

  context.fillStyle =
    "#b47b49";

  context.fillRect(
    0,
    0,
    size,
    size
  );

  for (
    let y = 6;
    y < size;
    y += 12
  ) {
    context.strokeStyle =
      y % 24 === 0
        ? "rgba(69,42,24,0.27)"
        : "rgba(81,48,26,0.16)";

    context.lineWidth =
      2;

    context.beginPath();

    context.moveTo(
      0,
      y
    );

    for (
      let x = 0;
      x <= size;
      x += 24
    ) {
      context.lineTo(
        x,
        y +
        Math.sin(
          (
            x +
            y
          ) * 0.035
        ) * 3
      );
    }

    context.stroke();
  }

  for (
    let x = 28;
    x < size;
    x += 64
  ) {
    context.fillStyle =
      "rgba(78,45,25,0.18)";

    context.beginPath();

    context.ellipse(
      x,
      90 +
      (
        x %
        53
      ),
      10,
      5,
      0,
      0,
      Math.PI * 2
    );

    context.fill();
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy,
    repeatX: 2,
    repeatY: 2
  });
}

function createMetalTexture({
  documentObject,
  anisotropy
}) {
  const size =
    VISUAL_64BIT_PROFILE
      .surfaceTextureResolution;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width: size,
      height: size
    });

  context.fillStyle =
    "#899198";

  context.fillRect(
    0,
    0,
    size,
    size
  );

  for (
    let y = 0;
    y < size;
    y += 4
  ) {
    context.fillStyle =
      y % 8 === 0
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.025)";

    context.fillRect(
      0,
      y,
      size,
      1
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy
  });
}

function createChalkboardTexture({
  documentObject,
  anisotropy
}) {
  const size =
    VISUAL_64BIT_PROFILE
      .surfaceTextureResolution;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width: size,
      height: size
    });

  context.fillStyle =
    "#31584d";

  context.fillRect(
    0,
    0,
    size,
    size
  );

  for (
    let index = 0;
    index < 110;
    index += 1
  ) {
    const x =
      (
        index * 73
      ) %
      size;

    const y =
      (
        index * 109
      ) %
      size;

    context.fillStyle =
      index % 3 === 0
        ? "rgba(238,235,214,0.045)"
        : "rgba(12,28,24,0.055)";

    context.fillRect(
      x,
      y,
      7 +
      (
        index % 13
      ),
      1
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy,
    repeatX: 2,
    repeatY: 1
  });
}

function createFloorTexture({
  documentObject,
  anisotropy
}) {
  const size =
    VISUAL_64BIT_PROFILE
      .floorTextureResolution;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width: size,
      height: size
    });

  const tile =
    64;

  context.fillStyle =
    "#b2916f";

  context.fillRect(
    0,
    0,
    size,
    size
  );

  for (
    let y = 0;
    y < size;
    y += tile
  ) {
    for (
      let x = 0;
      x < size;
      x += tile
    ) {
      const alternate =
        (
          x / tile +
          y / tile
        ) % 2 === 0;

      context.fillStyle =
        alternate
          ? "#b89876"
          : "#aa8968";

      context.fillRect(
        x + 2,
        y + 2,
        tile - 4,
        tile - 4
      );

      context.fillStyle =
        "rgba(80,58,40,0.12)";

      context.fillRect(
        x,
        y,
        tile,
        2
      );

      context.fillRect(
        x,
        y,
        2,
        tile
      );
    }
  }

  for (
    let index = 0;
    index < 360;
    index += 1
  ) {
    const x =
      (
        index * 149
      ) %
      size;

    const y =
      (
        index * 83
      ) %
      size;

    context.fillStyle =
      index % 2 === 0
        ? "rgba(255,245,225,0.045)"
        : "rgba(62,44,33,0.04)";

    context.fillRect(
      x,
      y,
      2,
      2
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy,
    repeatX: 2,
    repeatY: 2
  });
}

function createExteriorTexture({
  documentObject,
  anisotropy,
  layer
}) {
  const width =
    VISUAL_64BIT_PROFILE
      .exteriorTextureWidth;

  const height =
    VISUAL_64BIT_PROFILE
      .exteriorTextureHeight;

  const {
    canvas,
    context
  } =
    createCanvas({
      documentObject,
      width,
      height
    });

  context.clearRect(
    0,
    0,
    width,
    height
  );

  if (
    layer ===
    "base"
  ) {
    const sky =
      context.createLinearGradient(
        0,
        0,
        0,
        height
      );

    sky.addColorStop(
      0,
      "#78b7dc"
    );

    sky.addColorStop(
      0.55,
      "#aed7ea"
    );

    sky.addColorStop(
      1,
      "#e4e3cf"
    );

    context.fillStyle =
      sky;

    context.fillRect(
      0,
      0,
      width,
      height
    );

    context.fillStyle =
      "rgba(255,255,245,0.85)";

    const clouds = [
      [55, 42, 115, 19],
      [255, 61, 142, 22],
      [365, 28, 92, 18]
    ];

    for (
      const [
        x,
        y,
        cloudWidth,
        cloudHeight
      ]
      of clouds
    ) {
      context.beginPath();

      context.ellipse(
        x,
        y,
        cloudWidth * 0.32,
        cloudHeight,
        0,
        0,
        Math.PI * 2
      );

      context.ellipse(
        x + cloudWidth * 0.3,
        y + 4,
        cloudWidth * 0.37,
        cloudHeight * 0.85,
        0,
        0,
        Math.PI * 2
      );

      context.ellipse(
        x + cloudWidth * 0.58,
        y + 1,
        cloudWidth * 0.26,
        cloudHeight * 0.7,
        0,
        0,
        Math.PI * 2
      );

      context.fill();
    }
  }

  if (
    layer ===
    "mountains"
  ) {
    const mountainGradient =
      context.createLinearGradient(
        0,
        95,
        0,
        height
      );

    mountainGradient.addColorStop(
      0,
      "rgba(100,137,142,0.82)"
    );

    mountainGradient.addColorStop(
      1,
      "rgba(69,105,103,0.94)"
    );

    context.fillStyle =
      mountainGradient;

    context.beginPath();

    context.moveTo(
      0,
      height
    );

    const peaks = [
      [0, 185],
      [55, 134],
      [118, 174],
      [183, 105],
      [250, 163],
      [315, 92],
      [383, 158],
      [446, 118],
      [512, 169]
    ];

    for (
      const [
        x,
        y
      ]
      of peaks
    ) {
      context.lineTo(
        x,
        y
      );
    }

    context.lineTo(
      width,
      height
    );

    context.closePath();
    context.fill();
  }

  if (
    layer ===
    "campus"
  ) {
    const buildings = [
      {
        x: 24,
        y: 141,
        width: 128,
        height: 91
      },
      {
        x: 202,
        y: 129,
        width: 111,
        height: 103
      },
      {
        x: 348,
        y: 119,
        width: 138,
        height: 113
      }
    ];

    for (
      let index = 0;
      index < buildings.length;
      index += 1
    ) {
      const building =
        buildings[index];

      context.fillStyle =
        index % 2 === 0
          ? "rgba(222,203,166,0.97)"
          : "rgba(205,190,159,0.97)";

      context.fillRect(
        building.x,
        building.y,
        building.width,
        building.height
      );

      context.fillStyle =
        "#6e5445";

      context.fillRect(
        building.x - 4,
        building.y - 9,
        building.width + 8,
        10
      );

      for (
        let windowY =
          building.y + 17;
        windowY <
          building.y +
          building.height -
          15;
        windowY += 27
      ) {
        for (
          let windowX =
            building.x + 12;
          windowX <
            building.x +
            building.width -
            12;
          windowX += 28
        ) {
          context.fillStyle =
            "#557f97";

          context.fillRect(
            windowX,
            windowY,
            13,
            10
          );

          context.fillStyle =
            "rgba(235,245,238,0.45)";

          context.fillRect(
            windowX + 2,
            windowY + 2,
            5,
            3
          );
        }
      }
    }
  }

  if (
    layer ===
    "foliage"
  ) {
    for (
      let index = 0;
      index < 34;
      index += 1
    ) {
      const x =
        index * 17 - 20;

      const treeHeight =
        42 +
        (
          index % 5
        ) * 8;

      context.fillStyle =
        "#4f7653";

      context.beginPath();

      context.arc(
        x,
        height - treeHeight,
        22 +
        (
          index % 3
        ) * 4,
        0,
        Math.PI * 2
      );

      context.fill();

      context.fillStyle =
        "#31573d";

      context.fillRect(
        x - 4,
        height - treeHeight,
        8,
        treeHeight
      );
    }

    context.fillStyle =
      "#66865b";

    context.fillRect(
      0,
      height - 28,
      width,
      28
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configureColorTexture({
    texture,
    anisotropy
  });
}

function disableRaycast() {}

function createClassroom64BitVisualUpgrade({
  renderer,
  scene,
  materials,
  documentObject =
    globalThis.document
}) {
  if (
    !renderer ||
    !renderer.domElement
  ) {
    throw new TypeError(
      "renderer is required"
    );
  }

  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "scene must be a THREE.Scene"
    );
  }

  if (!materials) {
    throw new TypeError(
      "shared materials are required"
    );
  }

  const rendererState = {
    imageRendering:
      renderer.domElement
        .style
        .imageRendering,

    /*
     * CW08.3C-D:
     * Shadow-map type belongs to classroomLightingV2.
     */
  };

  renderer.domElement
    .style
    .imageRendering =
      "auto";

  /*
   * CW08.3C-D:
   * V64 does not acquire renderer shadow-map authority.
   */

  /*
   * CW08.3B:
   * Renderer exposure belongs to classroomVisualSystem.
   */

  const reportedMax =
    renderer.capabilities
      ?.getMaxAnisotropy
      ?.() ??
    renderer.getMaxAnisotropy
      ?.() ??
    1;

  const anisotropy =
    Math.max(
      1,
      Math.min(
        VISUAL_64BIT_PROFILE
          .maximumAnisotropy,
        reportedMax
      )
    );

  const wallTexture =
    createWallTexture({
      documentObject,
      anisotropy
    });

  const woodTexture =
    createWoodTexture({
      documentObject,
      anisotropy
    });

  const metalTexture =
    createMetalTexture({
      documentObject,
      anisotropy
    });

  const chalkboardTexture =
    createChalkboardTexture({
      documentObject,
      anisotropy
    });

  const floorTexture =
    createFloorTexture({
      documentObject,
      anisotropy
    });

  const exteriorBase =
    createExteriorTexture({
      documentObject,
      anisotropy,
      layer: "base"
    });

  const exteriorMountains =
    createExteriorTexture({
      documentObject,
      anisotropy,
      layer: "mountains"
    });

  const exteriorCampus =
    createExteriorTexture({
      documentObject,
      anisotropy,
      layer: "campus"
    });

  const exteriorFoliage =
    createExteriorTexture({
      documentObject,
      anisotropy,
      layer: "foliage"
    });

  const textures = [
    wallTexture,
    woodTexture,
    metalTexture,
    chalkboardTexture,
    floorTexture,
    exteriorBase,
    exteriorMountains,
    exteriorCampus,
    exteriorFoliage
  ];

  const materialStates = [];

  function upgradeSharedMaterial({
    material,
    map,
    roughness,
    metalness
  }) {
    if (!material) {
      return;
    }

    materialStates.push({
      material,

      map:
        material.map,

      roughness:
        material.roughness,

      metalness:
        material.metalness,

      flatShading:
        material.flatShading
    });

    material.map =
      map;

    if (
      typeof roughness ===
      "number"
    ) {
      material.roughness =
        roughness;
    }

    if (
      typeof metalness ===
      "number"
    ) {
      material.metalness =
        metalness;
    }

    material.flatShading =
      false;

    material.needsUpdate =
      true;
  }

  upgradeSharedMaterial({
    material:
      materials.wall,

    map:
      wallTexture,

    roughness:
      0.86,

    metalness:
      0
  });

  upgradeSharedMaterial({
    material:
      materials.wallShadow,

    map:
      wallTexture,

    roughness:
      0.91,

    metalness:
      0
  });

  upgradeSharedMaterial({
    material:
      materials.wood,

    map:
      woodTexture,

    roughness:
      0.65,

    metalness:
      0
  });

  upgradeSharedMaterial({
    material:
      materials.woodDark,

    map:
      woodTexture,

    roughness:
      0.7,

    metalness:
      0
  });

  upgradeSharedMaterial({
    material:
      materials.frame,

    map:
      metalTexture,

    roughness:
      0.42,

    metalness:
      0.34
  });

  upgradeSharedMaterial({
    material:
      materials.metal,

    map:
      metalTexture,

    roughness:
      0.4,

    metalness:
      0.48
  });

  upgradeSharedMaterial({
    material:
      materials.chalkboard,

    map:
      chalkboardTexture,

    roughness:
      0.94,

    metalness:
      0
  });

  const floorGeometry =
    new THREE.PlaneGeometry(
      14.12,
      14.12
    );

  const floorMaterial =
    new THREE.MeshStandardMaterial({
      map:
        floorTexture,

      color:
        0xffffff,

      roughness:
        0.82,

      metalness:
        0
    });

  const floor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

  floor.name =
    "classroom-64bit-floor";

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y =
    0.008;

  floor.receiveShadow =
    true;

  floor.raycast =
    disableRaycast;

  floor.userData
    .environmentDetailV2 =
      true;

  scene.add(
    floor
  );

  /*
   * Upgrade window glass with a richer physical
   * material, but only for the three window panes.
   */
  const glassMaterial =
    new THREE.MeshPhysicalMaterial({
      color:
        0xd9eff8,

      roughness:
        0.09,

      metalness:
        0,

      transmission:
        0.22,

      thickness:
        0.035,

      clearcoat:
        0.32,

      clearcoatRoughness:
        0.12,

      transparent:
        true,

      opacity:
        0.78,

      depthWrite:
        false,

      side:
        THREE.DoubleSide
    });

  const exteriorMaterials = {
    base:
      new THREE.MeshBasicMaterial({
        map:
          exteriorBase,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      }),

    mountains:
      new THREE.MeshBasicMaterial({
        map:
          exteriorMountains,

        transparent:
          true,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      }),

    campus:
      new THREE.MeshBasicMaterial({
        map:
          exteriorCampus,

        transparent:
          true,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      }),

    foliage:
      new THREE.MeshBasicMaterial({
        map:
          exteriorFoliage,

        transparent:
          true,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
  };

  const objectMaterialStates = [];

  function replaceObjectMaterial(
    object,
    replacement
  ) {
    objectMaterialStates.push({
      object,
      material:
        object.material
    });

    object.material =
      replacement;
  }

  scene.traverse(
    (object) => {
      if (!object.isMesh) {
        return;
      }

      if (
        /window-(north|center|south)-glass$/u
          .test(object.name)
      ) {
        replaceObjectMaterial(
          object,
          glassMaterial
        );

        return;
      }

      if (
        /window-(north|center|south)-outside$/u
          .test(object.name)
      ) {
        replaceObjectMaterial(
          object,
          exteriorMaterials.base
        );

        return;
      }

      if (
        /-depth-mountains$/u
          .test(object.name)
      ) {
        replaceObjectMaterial(
          object,
          exteriorMaterials.mountains
        );

        return;
      }

      if (
        /-depth-campus$/u
          .test(object.name)
      ) {
        replaceObjectMaterial(
          object,
          exteriorMaterials.campus
        );

        return;
      }

      if (
        /-depth-foliage$/u
          .test(object.name)
      ) {
        replaceObjectMaterial(
          object,
          exteriorMaterials.foliage
        );
      }
    }
  );

  const sunlight =
    scene.getObjectByName(
      "classroom-window-sun"
    );

  /*
   * CW08.3C-D:
   * V64 no longer mutates sunlight shadow map size,
   * bias, or normalBias.
   *
   * Canonical shadow infrastructure is established by
   * classroomLightingV2.
   */

  let disposed =
    false;

  return {
    profile:
      get64BitVisualProfile(),

    anisotropy,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      /*
       * Restore scene-owned materials before destroying
       * the upgrade-owned resources.
       */
      for (
        const state
        of objectMaterialStates
      ) {
        state.object.material =
          state.material;
      }

      for (
        const state
        of materialStates
      ) {
        state.material.map =
          state.map;

        state.material.roughness =
          state.roughness;

        state.material.metalness =
          state.metalness;

        state.material.flatShading =
          state.flatShading;

        state.material.needsUpdate =
          true;
      }

      scene.remove(
        floor
      );

      floorGeometry.dispose();
      floorMaterial.dispose();
      glassMaterial.dispose();

      for (
        const material
        of Object.values(
          exteriorMaterials
        )
      ) {
        material.dispose();
      }

      for (
        const texture
        of textures
      ) {
        texture.dispose();
      }

      renderer.domElement
        .style
        .imageRendering =
          rendererState
            .imageRendering;

      /*
       * CW08.3C-D:
       * V64 acquired no renderer shadow-map authority,
       * therefore there is nothing to restore.
       */

      /*
       * CW08.3B:
       * No renderer exposure authority to restore.
       */

      /*
       * CW08.3C-D:
       * V64 acquired no sunlight shadow infrastructure,
       * therefore there is nothing to restore.
       */
    }
  };
}

export {
  createClassroom64BitVisualUpgrade,
  get64BitVisualProfile
};