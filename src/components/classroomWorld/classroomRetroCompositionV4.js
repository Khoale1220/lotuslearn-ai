import * as THREE from "three";

const RETRO_COMPOSITION_V4_PROFILE =
  Object.freeze({
    wallTexture:
      32,

    woodTexture:
      32,

    metalTexture:
      16,

    chalkboardTexture:
      32,

    floorTexture:
      64,

    chalkboardArtWidth:
      64,

    chalkboardArtHeight:
      32,

    studentSpriteWidth:
      32,

    studentSpriteHeight:
      48,

    studentSpriteVariants:
      4,

    maxStudents:
      64
  });

const STUDENT_SHIRTS =
  Object.freeze([
    [45, 91, 161],
    [43, 118, 126],
    [158, 70, 65],
    [94, 72, 139]
  ]);

const STUDENT_SKIN =
  Object.freeze([
    [235, 188, 143],
    [216, 158, 112],
    [194, 132, 90],
    [164, 102, 68]
  ]);

function getRetroCompositionV4Profile() {
  return {
    ...RETRO_COMPOSITION_V4_PROFILE
  };
}

function computeRetroStudentIdlePose({
  timestamp = 0,
  index = 0
}) {
  const safeTimestamp =
    Number.isFinite(timestamp)
      ? timestamp
      : 0;

  const safeIndex =
    Number.isFinite(index)
      ? index
      : 0;

  const phase =
    safeTimestamp *
    0.0022 +
    safeIndex *
    0.79;

  return {
    bob:
      Math.sin(phase) *
      0.014,

    sway:
      Math.sin(
        phase *
        0.63
      ) *
      0.006,

    scaleY:
      1 +
      Math.sin(
        phase *
        0.81
      ) *
      0.008
  };
}

function createPixelData({
  width,
  height,
  fill = [0, 0, 0, 255]
}) {
  const data =
    new Uint8Array(
      width *
      height *
      4
    );

  for (
    let index = 0;
    index <
    width * height;
    index += 1
  ) {
    const offset =
      index * 4;

    data[offset] =
      fill[0];

    data[offset + 1] =
      fill[1];

    data[offset + 2] =
      fill[2];

    data[offset + 3] =
      fill[3];
  }

  return data;
}

function setPixel({
  data,
  width,
  height,
  x,
  y,
  color
}) {
  if (
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height
  ) {
    return;
  }

  /*
   * DataTexture row zero is treated as the bottom row
   * for our generated sprite convention.
   */
  const flippedY =
    height -
    1 -
    y;

  const offset =
    (
      flippedY *
      width +
      x
    ) * 4;

  data[offset] =
    color[0];

  data[offset + 1] =
    color[1];

  data[offset + 2] =
    color[2];

  data[offset + 3] =
    color[3] ?? 255;
}

function fillRect({
  data,
  width,
  height,
  x,
  y,
  rectWidth,
  rectHeight,
  color
}) {
  for (
    let row = y;
    row < y + rectHeight;
    row += 1
  ) {
    for (
      let column = x;
      column < x + rectWidth;
      column += 1
    ) {
      setPixel({
        data,
        width,
        height,
        x: column,
        y: row,
        color
      });
    }
  }
}

function createDataTexture({
  data,
  width,
  height,
  repeatX = 1,
  repeatY = 1,
  repeating = false
}) {
  const texture =
    new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy =
    1;

  texture.wrapS =
    repeating
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;

  texture.wrapT =
    repeating
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;

  texture.repeat.set(
    repeatX,
    repeatY
  );

  texture.needsUpdate =
    true;

  return texture;
}

function createWallTexture() {
  const size =
    RETRO_COMPOSITION_V4_PROFILE
      .wallTexture;

  const data =
    createPixelData({
      width: size,
      height: size,
      fill: [
        188,
        172,
        139,
        255
      ]
    });

  for (
    let y = 0;
    y < size;
    y += 8
  ) {
    fillRect({
      data,
      width: size,
      height: size,
      x: 0,
      y,
      rectWidth: size,
      rectHeight: 1,
      color: [
        120,
        105,
        87,
        255
      ]
    });

    const offset =
      (
        y / 8
      ) % 2 === 0
        ? 0
        : 8;

    for (
      let x = offset;
      x < size;
      x += 16
    ) {
      fillRect({
        data,
        width: size,
        height: size,
        x,
        y,
        rectWidth: 1,
        rectHeight: 8,
        color: [
          133,
          117,
          96,
          255
        ]
      });
    }
  }

  for (
    let index = 0;
    index < 42;
    index += 1
  ) {
    setPixel({
      data,
      width: size,
      height: size,
      x:
        (
          index * 11
        ) %
        size,

      y:
        (
          index * 17
        ) %
        size,

      color: [
        211,
        195,
        158,
        255
      ]
    });
  }

  return createDataTexture({
    data,
    width: size,
    height: size,
    repeatX: 7,
    repeatY: 3,
    repeating: true
  });
}

function createWoodTexture() {
  const size =
    RETRO_COMPOSITION_V4_PROFILE
      .woodTexture;

  const data =
    createPixelData({
      width: size,
      height: size,
      fill: [
        135,
        82,
        45,
        255
      ]
    });

  for (
    let y = 0;
    y < size;
    y += 4
  ) {
    fillRect({
      data,
      width: size,
      height: size,
      x: 0,
      y,
      rectWidth: size,
      rectHeight: 1,
      color:
        y % 8 === 0
          ? [
              88,
              49,
              29,
              255
            ]
          : [
              171,
              107,
              58,
              255
            ]
    });
  }

  for (
    let index = 0;
    index < 16;
    index += 1
  ) {
    fillRect({
      data,
      width: size,
      height: size,
      x:
        (
          index * 13
        ) %
        size,

      y:
        (
          index * 7
        ) %
        size,

      rectWidth: 3,
      rectHeight: 1,
      color: [
        73,
        42,
        25,
        255
      ]
    });
  }

  return createDataTexture({
    data,
    width: size,
    height: size,
    repeatX: 2,
    repeatY: 2,
    repeating: true
  });
}

function createMetalTexture() {
  const size =
    RETRO_COMPOSITION_V4_PROFILE
      .metalTexture;

  const data =
    createPixelData({
      width: size,
      height: size,
      fill: [
        102,
        108,
        111,
        255
      ]
    });

  for (
    let y = 0;
    y < size;
    y += 2
  ) {
    fillRect({
      data,
      width: size,
      height: size,
      x: 0,
      y,
      rectWidth: size,
      rectHeight: 1,
      color:
        y % 4 === 0
          ? [
              136,
              141,
              142,
              255
            ]
          : [
              78,
              82,
              84,
              255
            ]
    });
  }

  return createDataTexture({
    data,
    width: size,
    height: size,
    repeating: true
  });
}

function createChalkboardTexture() {
  const size =
    RETRO_COMPOSITION_V4_PROFILE
      .chalkboardTexture;

  const data =
    createPixelData({
      width: size,
      height: size,
      fill: [
        39,
        78,
        62,
        255
      ]
    });

  for (
    let index = 0;
    index < 54;
    index += 1
  ) {
    fillRect({
      data,
      width: size,
      height: size,
      x:
        (
          index * 19
        ) %
        size,

      y:
        (
          index * 7
        ) %
        size,

      rectWidth:
        1 +
        (
          index % 5
        ),

      rectHeight: 1,

      color:
        index % 3 === 0
          ? [
              198,
              207,
              177,
              255
            ]
          : [
              31,
              61,
              49,
              255
            ]
    });
  }

  return createDataTexture({
    data,
    width: size,
    height: size,
    repeatX: 2,
    repeatY: 1,
    repeating: true
  });
}

function createFloorTexture() {
  const size =
    RETRO_COMPOSITION_V4_PROFILE
      .floorTexture;

  const data =
    createPixelData({
      width: size,
      height: size,
      fill: [
        125,
        126,
        117,
        255
      ]
    });

  const tile =
    8;

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

      fillRect({
        data,
        width: size,
        height: size,
        x: x + 1,
        y: y + 1,
        rectWidth:
          tile - 1,
        rectHeight:
          tile - 1,
        color:
          alternate
            ? [
                137,
                137,
                125,
                255
              ]
            : [
                116,
                118,
                109,
                255
              ]
      });

      fillRect({
        data,
        width: size,
        height: size,
        x,
        y,
        rectWidth:
          tile,
        rectHeight: 1,
        color: [
          79,
          81,
          77,
          255
        ]
      });

      fillRect({
        data,
        width: size,
        height: size,
        x,
        y,
        rectWidth: 1,
        rectHeight:
          tile,
        color: [
          79,
          81,
          77,
          255
        ]
      });
    }
  }

  return createDataTexture({
    data,
    width: size,
    height: size,
    repeatX: 9,
    repeatY: 9,
    repeating: true
  });
}

function createChalkboardArtTexture() {
  const width =
    RETRO_COMPOSITION_V4_PROFILE
      .chalkboardArtWidth;

  const height =
    RETRO_COMPOSITION_V4_PROFILE
      .chalkboardArtHeight;

  const data =
    createPixelData({
      width,
      height,
      fill: [
        29,
        65,
        48,
        255
      ]
    });

  const chalk = [
    225,
    220,
    183,
    255
  ];

  /*
   * Fake lesson title.
   */
  fillRect({
    data,
    width,
    height,
    x: 5,
    y: 5,
    rectWidth: 39,
    rectHeight: 2,
    color: chalk
  });

  fillRect({
    data,
    width,
    height,
    x: 5,
    y: 10,
    rectWidth: 25,
    rectHeight: 1,
    color: chalk
  });

  fillRect({
    data,
    width,
    height,
    x: 5,
    y: 14,
    rectWidth: 42,
    rectHeight: 1,
    color: chalk
  });

  fillRect({
    data,
    width,
    height,
    x: 5,
    y: 18,
    rectWidth: 33,
    rectHeight: 1,
    color: chalk
  });

  /*
   * Diagnostic chart.
   */
  for (
    let column = 0;
    column < 5;
    column += 1
  ) {
    const barHeight =
      4 +
      column * 3;

    fillRect({
      data,
      width,
      height,
      x:
        45 +
        column * 3,

      y:
        27 -
        barHeight,

      rectWidth: 2,
      rectHeight:
        barHeight,

      color:
        column < 3
          ? [
              215,
              178,
              69,
              255
            ]
          : [
              108,
              169,
              118,
              255
            ]
    });
  }

  return createDataTexture({
    data,
    width,
    height
  });
}

function createStudentSpriteTexture(
  variant
) {
  const width =
    RETRO_COMPOSITION_V4_PROFILE
      .studentSpriteWidth;

  const height =
    RETRO_COMPOSITION_V4_PROFILE
      .studentSpriteHeight;

  const data =
    createPixelData({
      width,
      height,
      fill: [
        0,
        0,
        0,
        0
      ]
    });

  const outline = [
    27,
    26,
    24,
    255
  ];

  const skin =
    STUDENT_SKIN[
      variant %
      STUDENT_SKIN.length
    ];

  const shirt =
    STUDENT_SHIRTS[
      variant %
      STUDENT_SHIRTS.length
    ];

  const hair =
    variant % 2 === 0
      ? [
          42,
          31,
          24,
          255
        ]
      : [
          66,
          45,
          30,
          255
        ];

  const trousers =
    variant % 2 === 0
      ? [
          44,
          49,
          63,
          255
        ]
      : [
          53,
          57,
          66,
          255
        ];

  /*
   * Chunky outline silhouette.
   */
  fillRect({
    data,
    width,
    height,
    x: 9,
    y: 3,
    rectWidth: 14,
    rectHeight: 14,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 6,
    y: 17,
    rectWidth: 20,
    rectHeight: 18,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 4,
    y: 20,
    rectWidth: 5,
    rectHeight: 15,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 23,
    y: 20,
    rectWidth: 5,
    rectHeight: 15,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 8,
    y: 34,
    rectWidth: 7,
    rectHeight: 12,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 17,
    y: 34,
    rectWidth: 7,
    rectHeight: 12,
    color: outline
  });

  /*
   * Face.
   */
  fillRect({
    data,
    width,
    height,
    x: 11,
    y: 7,
    rectWidth: 10,
    rectHeight: 9,
    color: [
      ...skin,
      255
    ]
  });

  /*
   * Hair.
   */
  fillRect({
    data,
    width,
    height,
    x: 10,
    y: 4,
    rectWidth: 12,
    rectHeight: 5,
    color: hair
  });

  fillRect({
    data,
    width,
    height,
    x:
      variant % 2 === 0
        ? 10
        : 19,

    y: 8,
    rectWidth: 3,
    rectHeight: 5,
    color: hair
  });

  /*
   * Eyes.
   */
  setPixel({
    data,
    width,
    height,
    x: 13,
    y: 11,
    color: outline
  });

  setPixel({
    data,
    width,
    height,
    x: 18,
    y: 11,
    color: outline
  });

  /*
   * Uniform.
   */
  fillRect({
    data,
    width,
    height,
    x: 8,
    y: 19,
    rectWidth: 16,
    rectHeight: 14,
    color: [
      ...shirt,
      255
    ]
  });

  fillRect({
    data,
    width,
    height,
    x: 5,
    y: 22,
    rectWidth: 4,
    rectHeight: 11,
    color: [
      ...shirt,
      255
    ]
  });

  fillRect({
    data,
    width,
    height,
    x: 23,
    y: 22,
    rectWidth: 4,
    rectHeight: 11,
    color: [
      ...shirt,
      255
    ]
  });

  /*
   * Collar.
   */
  fillRect({
    data,
    width,
    height,
    x: 14,
    y: 19,
    rectWidth: 4,
    rectHeight: 3,
    color: [
      221,
      226,
      214,
      255
    ]
  });

  /*
   * Legs.
   */
  fillRect({
    data,
    width,
    height,
    x: 10,
    y: 34,
    rectWidth: 5,
    rectHeight: 10,
    color: trousers
  });

  fillRect({
    data,
    width,
    height,
    x: 17,
    y: 34,
    rectWidth: 5,
    rectHeight: 10,
    color: trousers
  });

  /*
   * Shoes.
   */
  fillRect({
    data,
    width,
    height,
    x: 8,
    y: 43,
    rectWidth: 7,
    rectHeight: 3,
    color: outline
  });

  fillRect({
    data,
    width,
    height,
    x: 17,
    y: 43,
    rectWidth: 7,
    rectHeight: 3,
    color: outline
  });

  return createDataTexture({
    data,
    width,
    height
  });
}

function createRetroMaterialTextureSet() {
  return {
    wall:
      createWallTexture(),

    wood:
      createWoodTexture(),

    metal:
      createMetalTexture(),

    chalkboard:
      createChalkboardTexture(),

    floor:
      createFloorTexture(),

    chalkboardArt:
      createChalkboardArtTexture(),

    studentSprites:
      Array.from(
        {
          length:
            RETRO_COMPOSITION_V4_PROFILE
              .studentSpriteVariants
        },

        (_, index) =>
          createStudentSpriteTexture(
            index
          )
      )
  };
}

function disposeTextureSet(
  textures
) {
  for (
    const [
      key,
      value
    ]
    of Object.entries(textures)
  ) {
    if (
      key ===
      "studentSprites"
    ) {
      for (
        const texture
        of value
      ) {
        texture.dispose();
      }

      continue;
    }

    value.dispose();
  }
}

function disableRaycast() {}

function createRetroMaterial({
  map
}) {
  return new THREE.MeshLambertMaterial({
    map,
    color: 0xffffff,
    flatShading: true
  });
}

function createClassroomRetroCompositionV4({
  scene,
  materials,
  maxStudents =
    RETRO_COMPOSITION_V4_PROFILE
      .maxStudents
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
    !materials.wood ||
    !materials.woodDark ||
    !materials.chalkboard
  ) {
    throw new TypeError(
      "shared classroom materials are required"
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

  const textures =
    createRetroMaterialTextureSet();

  const sharedMaterialStates =
    [];

  function overrideSharedMaterial({
    material,
    map
  }) {
    if (!material) {
      return;
    }

    sharedMaterialStates.push({
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
      typeof material
        .roughness ===
      "number"
    ) {
      material.roughness =
        1;
    }

    if (
      typeof material
        .metalness ===
      "number"
    ) {
      material.metalness =
        0;
    }

    if (
      "flatShading" in
      material
    ) {
      material.flatShading =
        true;
    }

    material.needsUpdate =
      true;
  }

  overrideSharedMaterial({
    material:
      materials.wall,
    map:
      textures.wall
  });

  overrideSharedMaterial({
    material:
      materials.wallShadow,
    map:
      textures.wall
  });

  overrideSharedMaterial({
    material:
      materials.wood,
    map:
      textures.wood
  });

  overrideSharedMaterial({
    material:
      materials.woodDark,
    map:
      textures.wood
  });

  overrideSharedMaterial({
    material:
      materials.chalkboard,
    map:
      textures.chalkboard
  });

  overrideSharedMaterial({
    material:
      materials.metal,
    map:
      textures.metal
  });

  overrideSharedMaterial({
    material:
      materials.frame,
    map:
      textures.metal
  });

  const root =
    new THREE.Group();

  root.name =
    "classroom-retro-composition-v4";

  root.userData
    .environmentDetailV2 =
      true;

  /*
   * ==================================================
   * RETRO FLOOR
   * ==================================================
   */

  const floorGeometry =
    new THREE.PlaneGeometry(
      13.8,
      13.8
    );

  const floorMaterial =
    new THREE.MeshBasicMaterial({
      map:
        textures.floor,
      color:
        0xffffff,
      toneMapped:
        false
    });

  const floor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

  floor.name =
    "retro-floor-v4";

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y =
    0.026;

  floor.raycast =
    disableRaycast;

  floor.userData
    .environmentDetailV2 =
      true;

  root.add(
    floor
  );

  /*
   * ==================================================
   * CHALKBOARD PIXEL ART
   * ==================================================
   */

  const boardGeometry =
    new THREE.PlaneGeometry(
      4.35,
      1.42
    );

  const boardMaterial =
    new THREE.MeshBasicMaterial({
      map:
        textures.chalkboardArt,
      toneMapped:
        false,
      side:
        THREE.DoubleSide
    });

  const boardArt =
    new THREE.Mesh(
      boardGeometry,
      boardMaterial
    );

  boardArt.name =
    "retro-chalkboard-art-v4";

  boardArt.position.set(
    0,
    2.1,
    -6.7
  );

  boardArt.raycast =
    disableRaycast;

  boardArt.userData
    .environmentDetailV2 =
      true;

  root.add(
    boardArt
  );

  /*
   * ==================================================
   * STUDENT DESK SYSTEM
   * ==================================================
   */

  const deskTopGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const deskLegGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const chairSeatGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const chairBackGeometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const deskMaterial =
    createRetroMaterial({
      map:
        textures.wood
    });

  const metalMaterial =
    createRetroMaterial({
      map:
        textures.metal
    });

  const deskTops =
    new THREE.InstancedMesh(
      deskTopGeometry,
      deskMaterial,
      maxStudents
    );

  const deskLegs =
    new THREE.InstancedMesh(
      deskLegGeometry,
      metalMaterial,
      maxStudents * 4
    );

  const chairSeats =
    new THREE.InstancedMesh(
      chairSeatGeometry,
      deskMaterial,
      maxStudents
    );

  const chairBacks =
    new THREE.InstancedMesh(
      chairBackGeometry,
      deskMaterial,
      maxStudents
    );

  deskTops.name =
    "retro-student-desks-v4";

  deskLegs.name =
    "retro-student-desk-legs-v4";

  chairSeats.name =
    "retro-student-chair-seats-v4";

  chairBacks.name =
    "retro-student-chair-backs-v4";

  for (
    const mesh
    of [
      deskTops,
      deskLegs,
      chairSeats,
      chairBacks
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
      .environmentDetailV2 =
        true;

    root.add(
      mesh
    );
  }

  /*
   * ==================================================
   * RETRO STUDENT SPRITES
   * ==================================================
   */

  const spriteGeometry =
    new THREE.PlaneGeometry(
      1,
      1
    );

  const spriteMaterials =
    textures.studentSprites.map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map:
            texture,
          transparent:
            false,
          alphaTest:
            0.5,
          side:
            THREE.DoubleSide,
          toneMapped:
            false
        })
    );

  const spriteMeshes =
    spriteMaterials.map(
      (material, index) => {
        const mesh =
          new THREE.InstancedMesh(
            spriteGeometry,
            material,
            maxStudents
          );

        mesh.name =
          `retro-student-sprites-v4-${index}`;

        mesh.count =
          0;

        mesh.castShadow =
          false;

        mesh.receiveShadow =
          false;

        mesh.raycast =
          disableRaycast;

        mesh.userData
          .studentVisualV2Decoration =
            true;

        root.add(
          mesh
        );

        return mesh;
      }
    );

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

  const transform =
    new THREE.Object3D();

  const records = [];

  let sourceSignature =
    "";

  let studentCount =
    0;

  let frame =
    0;

  let disposed =
    false;

  const hiddenVisualStates =
    [];

  let replacementActivated =
    false;

  function hideVisualRoot(
    name
  ) {
    const object =
      scene.getObjectByName(
        name
      );

    if (!object) {
      return;
    }

    hiddenVisualStates.push({
      object,
      visible:
        object.visible
    });

    object.visible =
      false;
  }

  function activateReplacementVisuals() {
    if (replacementActivated) {
      return;
    }

    replacementActivated =
      true;

    /*
     * These layers were useful stepping stones,
     * but the retro FPS art direction now owns
     * visible student rendering.
     *
     * The original interaction/student runtime
     * remains untouched.
     */
    hideVisualRoot(
      "classroom-character-v3"
    );

    hideVisualRoot(
      "classroom-student-visual-v2"
    );
  }

  function setInstance({
    mesh,
    index,
    position,
    scale,
    quaternion = null
  }) {
    transform.position.set(
      position.x,
      position.y,
      position.z
    );

    if (quaternion) {
      transform.quaternion.copy(
        quaternion
      );
    }
    else {
      transform.rotation.set(
        0,
        0,
        0
      );
    }

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
  }

  function finalizeInstancedMesh(
    mesh
  ) {
    mesh.instanceMatrix
      .needsUpdate =
        true;

    if (
      mesh.count > 0
    ) {
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  function clearComposition() {
    studentCount =
      0;

    records.length =
      0;

    deskTops.count =
      0;

    deskLegs.count =
      0;

    chairSeats.count =
      0;

    chairBacks.count =
      0;

    for (
      const mesh
      of spriteMeshes
    ) {
      mesh.count = 0;
    }
  }

  function sync() {
    if (disposed) {
      return {
        changed: false,
        count: 0
      };
    }

    const source =
      scene.getObjectByName(
        "student-visual-v2-backpacks"
      );

    if (
      !source ||
      !source.isInstancedMesh
    ) {
      clearComposition();

      return {
        changed: false,
        count: 0
      };
    }

    const count =
      Math.min(
        source.count,
        maxStudents
      );

    const nextSignature = [
      count,
      source.instanceMatrix
        .version
    ].join(":");

    if (
      sourceSignature ===
      nextSignature
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

    records.length =
      0;

    deskTops.count =
      count;

    deskLegs.count =
      count * 4;

    chairSeats.count =
      count;

    chairBacks.count =
      count;

    const variantCounts =
      new Array(
        spriteMeshes.length
      ).fill(0);

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      source.getMatrixAt(
        index,
        sourceMatrix
      );

      sourceMatrix.decompose(
        sourcePosition,
        sourceQuaternion,
        sourceScale
      );

      const studentHeight =
        Math.min(
          1.9,
          Math.max(
            1.05,
            sourceScale.y /
            0.34
          )
        );

      const studentWidth =
        Math.min(
          0.85,
          Math.max(
            0.42,
            studentHeight *
            0.34
          )
        );

      const record = {
        index,
        variant:
          index %
          spriteMeshes.length,

        position:
          sourcePosition.clone(),

        height:
          studentHeight,

        width:
          studentWidth
      };

      records.push(
        record
      );

      const deskZ =
        sourcePosition.z -
        0.64;

      setInstance({
        mesh:
          deskTops,

        index,

        position: {
          x:
            sourcePosition.x,
          y:
            0.76,
          z:
            deskZ
        },

        scale: {
          x:
            1.15,
          y:
            0.09,
          z:
            0.64
        }
      });

      const legBase =
        index * 4;

      const legOffsets = [
        [-0.45, -0.22],
        [0.45, -0.22],
        [-0.45, 0.22],
        [0.45, 0.22]
      ];

      for (
        let legIndex = 0;
        legIndex < 4;
        legIndex += 1
      ) {
        const [
          offsetX,
          offsetZ
        ] =
          legOffsets[
            legIndex
          ];

        setInstance({
          mesh:
            deskLegs,

          index:
            legBase +
            legIndex,

          position: {
            x:
              sourcePosition.x +
              offsetX,

            y:
              0.38,

            z:
              deskZ +
              offsetZ
          },

          scale: {
            x: 0.07,
            y: 0.72,
            z: 0.07
          }
        });
      }

      setInstance({
        mesh:
          chairSeats,

        index,

        position: {
          x:
            sourcePosition.x,

          y:
            0.46,

          z:
            sourcePosition.z +
            0.12
        },

        scale: {
          x:
            0.55,

          y:
            0.08,

          z:
            0.52
        }
      });

      setInstance({
        mesh:
          chairBacks,

        index,

        position: {
          x:
            sourcePosition.x,

          y:
            0.79,

          z:
            sourcePosition.z +
            0.35
        },

        scale: {
          x:
            0.55,

          y:
            0.61,

          z:
            0.07
        }
      });

      variantCounts[
        record.variant
      ] += 1;
    }

    for (
      let variant = 0;
      variant <
      spriteMeshes.length;
      variant += 1
    ) {
      spriteMeshes[
        variant
      ].count =
        variantCounts[
          variant
        ];
    }

    for (
      const mesh
      of [
        deskTops,
        deskLegs,
        chairSeats,
        chairBacks
      ]
    ) {
      finalizeInstancedMesh(
        mesh
      );
    }

    if (
      count > 0
    ) {
      activateReplacementVisuals();
    }

    return {
      changed: true,
      count
    };
  }

  function updateStudentBillboards(
    camera,
    timestamp = 0
  ) {
    if (
      !camera ||
      records.length === 0
    ) {
      return;
    }

    const variantIndices =
      new Array(
        spriteMeshes.length
      ).fill(0);

    for (
      const record
      of records
    ) {
      const mesh =
        spriteMeshes[
          record.variant
        ];

      const instanceIndex =
        variantIndices[
          record.variant
        ];

      variantIndices[
        record.variant
      ] += 1;

      const idlePose =
        computeRetroStudentIdlePose({
          timestamp,
          index:
            record.index
        });

      setInstance({
        mesh,
        index:
          instanceIndex,

        position: {
          x:
            record.position.x +
            idlePose.sway,

          y:
            record.position.y -
            record.height *
            0.07 +
            idlePose.bob,

          z:
            record.position.z
        },

        scale: {
          x:
            record.width *
            1.16,

          y:
            record.height *
            1.12 *
            idlePose.scaleY,

          z: 1
        },

        quaternion:
          camera.quaternion
      });
    }

    for (
      const mesh
      of spriteMeshes
    ) {
      finalizeInstancedMesh(
        mesh
      );
    }
  }

  function tick(
    camera,
    timestamp = 0
  ) {
    if (disposed) {
      return;
    }

    frame += 1;

    /*
     * Student source geometry is static most of the
     * time, so expensive composition sync is sparse.
     */
    if (
      frame % 30 === 1
    ) {
      sync();
    }

    /*
     * Billboard orientation follows camera every frame.
     */
    updateStudentBillboards(
      camera,
      timestamp
    );
  }

  sync();

  return {
    profile:
      getRetroCompositionV4Profile(),

    group:
      root,

    sync,

    tick,

    getStudentCount() {
      return studentCount;
    },

    getDeskCount() {
      return deskTops.count;
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      for (
        const state
        of hiddenVisualStates
      ) {
        state.object.visible =
          state.visible;
      }

      for (
        const state
        of sharedMaterialStates
      ) {
        state.material.map =
          state.map;

        if (
          typeof state
            .roughness ===
          "number"
        ) {
          state.material.roughness =
            state.roughness;
        }

        if (
          typeof state
            .metalness ===
          "number"
        ) {
          state.material.metalness =
            state.metalness;
        }

        if (
          "flatShading" in
          state.material
        ) {
          state.material.flatShading =
            state.flatShading;
        }

        state.material.needsUpdate =
          true;
      }

      scene.remove(
        root
      );

      for (
        const mesh
        of [
          deskTops,
          deskLegs,
          chairSeats,
          chairBacks,
          ...spriteMeshes
        ]
      ) {
        mesh.dispose();
      }

      floorGeometry.dispose();
      boardGeometry.dispose();
      deskTopGeometry.dispose();
      deskLegGeometry.dispose();
      chairSeatGeometry.dispose();
      chairBackGeometry.dispose();
      spriteGeometry.dispose();

      floorMaterial.dispose();
      boardMaterial.dispose();
      deskMaterial.dispose();
      metalMaterial.dispose();

      for (
        const material
        of spriteMaterials
      ) {
        material.dispose();
      }

      disposeTextureSet(
        textures
      );
    }
  };
}

export {
  RETRO_COMPOSITION_V4_PROFILE,
  computeRetroStudentIdlePose,
  createClassroomRetroCompositionV4,
  createRetroMaterialTextureSet,
  getRetroCompositionV4Profile
};