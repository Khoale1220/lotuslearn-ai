import * as THREE from "three";

import {
  auditPixelSpriteMaterial,
  configurePixelTexture,
  createPixelSpriteMaterial
} from "./classroomPixelArtDirectionV8.js";

const CHARACTER_SPRITE_V9_DIRECTION_NAMES =
  Object.freeze([
    "front",
    "front-right",
    "right",
    "back-right",
    "back",
    "back-left",
    "left",
    "front-left"
  ]);

const CLASSROOM_CHARACTER_SPRITE_V9_PROFILE =
  Object.freeze({
    frameWidth:
      64,

    frameHeight:
      96,

    directionCount:
      8,

    idleFrameCount:
      4,

    atlasColumns:
      8,

    atlasRows:
      4,

    atlasWidth:
      512,

    atlasHeight:
      384,

    idleFrameDurationMs:
      220,

    worldWidth:
      0.95,

    worldHeight:
      1.86,

    interactionType:
      "student",

    visualAuthority:
      "CW06_CHARACTER_SPRITE_V9",

    forwardAxis:
      "+Z"
  });

const STUDENT_V9_PALETTE =
  Object.freeze({
    skin: Object.freeze([
      0xf2c49b,
      0xe7ad7d,
      0xd99665,
      0xc77b4f,
      0xad633f,
      0x8d4f35
    ]),

    hair: Object.freeze([
      0x17120f,
      0x241712,
      0x382116,
      0x542f1c,
      0x211b1d,
      0x51372a
    ]),

    shirt: Object.freeze([
      0x2e5da8,
      0x386fb4,
      0x477fc5,
      0x31538b,
      0x6177a8,
      0x345d92
    ]),

    shirtHighlight: Object.freeze([
      0x82a7df,
      0x8cb6ee,
      0x92bcea,
      0x789bd1
    ]),

    trouser: Object.freeze([
      0x19243a,
      0x222f4b,
      0x2b3651,
      0x183052
    ]),

    accent: Object.freeze([
      0xa22534,
      0xb52b3e,
      0x8c2538,
      0xc24735,
      0x7b2944,
      0x9e3333
    ]),

    outline:
      0x161316,

    deepShadow:
      0x241b24,

    shoe:
      0x15171b
  });

function positiveModulo(
  value,
  divisor
) {
  return (
    (
      value %
      divisor
    ) +
    divisor
  ) %
    divisor;
}

function stableHashString(
  value
) {
  const text =
    String(
      value ??
      ""
    );

  let hash =
    2166136261;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        16777619
      ) >>>
      0;
  }

  return hash >>>
    0;
}

function choosePaletteValue(
  values,
  hash,
  shift = 0
) {
  if (
    !Array.isArray(
      values
    ) ||
    values.length ===
      0
  ) {
    throw new TypeError(
      "palette values are required"
    );
  }

  const shifted =
    hash >>>
    shift;

  return values[
    shifted %
    values.length
  ];
}

function deriveStudentSpriteVariant(
  studentKey
) {
  if (
    typeof studentKey !==
      "string" ||
    studentKey.trim().length ===
      0
  ) {
    throw new TypeError(
      "studentKey is required"
    );
  }

  const normalizedKey =
    studentKey.trim();

  const hash =
    stableHashString(
      normalizedKey
    );

  return Object.freeze({
    studentKey:
      normalizedKey,

    hash,

    skin:
      choosePaletteValue(
        STUDENT_V9_PALETTE.skin,
        hash,
        0
      ),

    hair:
      choosePaletteValue(
        STUDENT_V9_PALETTE.hair,
        hash,
        4
      ),

    shirt:
      choosePaletteValue(
        STUDENT_V9_PALETTE.shirt,
        hash,
        8
      ),

    shirtHighlight:
      choosePaletteValue(
        STUDENT_V9_PALETTE.shirtHighlight,
        hash,
        12
      ),

    trouser:
      choosePaletteValue(
        STUDENT_V9_PALETTE.trouser,
        hash,
        16
      ),

    accent:
      choosePaletteValue(
        STUDENT_V9_PALETTE.accent,
        hash,
        20
      ),

    hairStyle:
      (
        hash >>>
        24
      ) %
      4,

    shirtPattern:
      (
        hash >>>
        26
      ) %
      3,

    bodyVariant:
      (
        hash >>>
        28
      ) %
      3
  });
}

function normalizeRadians(
  radians
) {
  const circle =
    Math.PI *
    2;

  return positiveModulo(
    radians,
    circle
  );
}

function computeCharacterViewDirectionIndex({
  cameraPosition,
  characterPosition,
  forwardYaw = 0
}) {
  if (
    !cameraPosition ||
    !characterPosition
  ) {
    throw new TypeError(
      "cameraPosition and characterPosition are required"
    );
  }

  const deltaX =
    Number(
      cameraPosition.x
    ) -
    Number(
      characterPosition.x
    );

  const deltaZ =
    Number(
      cameraPosition.z
    ) -
    Number(
      characterPosition.z
    );

  if (
    !Number.isFinite(
      deltaX
    ) ||
    !Number.isFinite(
      deltaZ
    )
  ) {
    throw new TypeError(
      "character direction inputs must be finite"
    );
  }

  if (
    Math.abs(
      deltaX
    ) <
      1e-9 &&
    Math.abs(
      deltaZ
    ) <
      1e-9
  ) {
    return 0;
  }

  const cameraBearing =
    Math.atan2(
      deltaX,
      deltaZ
    );

  const relativeBearing =
    normalizeRadians(
      cameraBearing -
      forwardYaw
    );

  const sectorSize =
    Math.PI /
    4;

  return (
    Math.round(
      relativeBearing /
      sectorSize
    ) %
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .directionCount
  );
}

function getCharacterDirectionName(
  directionIndex
) {
  return (
    CHARACTER_SPRITE_V9_DIRECTION_NAMES[
      positiveModulo(
        Math.trunc(
          directionIndex
        ),
        CHARACTER_SPRITE_V9_DIRECTION_NAMES.length
      )
    ]
  );
}

function computeStudentIdleFrame({
  timestamp,
  studentKey,
  frameDurationMs =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .idleFrameDurationMs
}) {
  const safeTimestamp =
    Math.max(
      0,
      Number.isFinite(
        timestamp
      )
        ? timestamp
        : 0
    );

  const safeDuration =
    Math.max(
      1,
      Number.isFinite(
        frameDurationMs
      )
        ? frameDurationMs
        : (
            CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
              .idleFrameDurationMs
          )
    );

  const frameCount =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .idleFrameCount;

  const cycleDuration =
    safeDuration *
    frameCount;

  const phase =
    stableHashString(
      studentKey
    ) %
    cycleDuration;

  return (
    Math.floor(
      (
        safeTimestamp +
        phase
      ) /
      safeDuration
    ) %
    frameCount
  );
}

function computeCharacterAtlasFrameUv({
  directionIndex,
  animationFrame
}) {
  const profile =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE;

  const column =
    positiveModulo(
      Math.trunc(
        directionIndex
      ),
      profile.atlasColumns
    );

  const row =
    positiveModulo(
      Math.trunc(
        animationFrame
      ),
      profile.atlasRows
    );

  const repeatX =
    1 /
    profile.atlasColumns;

  const repeatY =
    1 /
    profile.atlasRows;

  return {
    column,
    row,

    repeatX,
    repeatY,

    offsetX:
      column *
      repeatX,

    offsetY:
      1 -
      (
        row +
        1
      ) *
      repeatY
  };
}

function applyCharacterAtlasFrame(
  texture,
  frame
) {
  if (
    !texture?.isTexture
  ) {
    throw new TypeError(
      "character atlas texture is required"
    );
  }

  texture.repeat.set(
    frame.repeatX,
    frame.repeatY
  );

  texture.offset.set(
    frame.offsetX,
    frame.offsetY
  );

  texture.matrixAutoUpdate =
    true;

  return texture;
}

function hexCss(
  value
) {
  return `#${(
    Number(
      value
    ) >>>
    0
  )
    .toString(16)
    .padStart(
      6,
      "0"
    )
    .slice(-6)}`;
}

function fillPixelRect(
  context,
  color,
  x,
  y,
  width,
  height
) {
  context.fillStyle =
    hexCss(
      color
    );

  context.fillRect(
    Math.round(
      x
    ),
    Math.round(
      y
    ),
    Math.round(
      width
    ),
    Math.round(
      height
    )
  );
}

function drawStudentFrame({
  context,
  originX,
  originY,
  directionIndex,
  animationFrame,
  variant
}) {
  const frameWidth =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .frameWidth;

  const frameHeight =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .frameHeight;

  context.clearRect(
    originX,
    originY,
    frameWidth,
    frameHeight
  );

  const idleOffsets = [
    0,
    -1,
    0,
    1
  ];

  const idleLift =
    idleOffsets[
      animationFrame %
      idleOffsets.length
    ];

  const viewShiftByDirection = [
    0,
    -1,
    -3,
    -2,
    0,
    2,
    3,
    1
  ];

  const viewShift =
    viewShiftByDirection[
      directionIndex %
      viewShiftByDirection.length
    ];

  const isBack =
    directionIndex >=
      3 &&
    directionIndex <=
      5;

  const isRightProfile =
    directionIndex ===
      2;

  const isLeftProfile =
    directionIndex ===
      6;

  const outline =
    STUDENT_V9_PALETTE
      .outline;

  const deepShadow =
    STUDENT_V9_PALETTE
      .deepShadow;

  const shoe =
    STUDENT_V9_PALETTE
      .shoe;

  const bodyX =
    originX +
    20 +
    Math.round(
      viewShift *
      0.35
    );

  const bodyY =
    originY +
    43 +
    idleLift;

  /*
   * Ground contact pixels.
   */
  fillPixelRect(
    context,
    deepShadow,
    originX + 18,
    originY + 91,
    28,
    3
  );

  /*
   * Legs - dark outside silhouette first.
   */
  fillPixelRect(
    context,
    outline,
    bodyX + 2,
    bodyY + 31,
    10,
    20
  );

  fillPixelRect(
    context,
    outline,
    bodyX + 18,
    bodyY + 31,
    10,
    20
  );

  fillPixelRect(
    context,
    variant.trouser,
    bodyX + 4,
    bodyY + 31,
    7,
    17
  );

  fillPixelRect(
    context,
    variant.trouser,
    bodyX + 19,
    bodyY + 31,
    7,
    17
  );

  /*
   * Trouser highlight clusters.
   */
  fillPixelRect(
    context,
    0x46536e,
    bodyX + 5,
    bodyY + 33,
    2,
    11
  );

  fillPixelRect(
    context,
    0x46536e,
    bodyX + 20,
    bodyY + 33,
    2,
    11
  );

  /*
   * Shoes.
   */
  fillPixelRect(
    context,
    shoe,
    bodyX,
    bodyY + 47,
    12,
    5
  );

  fillPixelRect(
    context,
    shoe,
    bodyX + 18,
    bodyY + 47,
    12,
    5
  );

  /*
   * Torso silhouette.
   */
  fillPixelRect(
    context,
    outline,
    bodyX - 3,
    bodyY - 2,
    36,
    36
  );

  fillPixelRect(
    context,
    variant.shirt,
    bodyX,
    bodyY,
    30,
    31
  );

  /*
   * Directional body shadow.
   */
  if (
    directionIndex ===
      1 ||
    directionIndex ===
      2 ||
    directionIndex ===
      3
  ) {
    fillPixelRect(
      context,
      0x203b70,
      bodyX,
      bodyY,
      8,
      31
    );
  }
  else if (
    directionIndex ===
      5 ||
    directionIndex ===
      6 ||
    directionIndex ===
      7
  ) {
    fillPixelRect(
      context,
      0x203b70,
      bodyX + 22,
      bodyY,
      8,
      31
    );
  }
  else {
    fillPixelRect(
      context,
      0x203b70,
      bodyX,
      bodyY + 24,
      30,
      7
    );
  }

  /*
   * Shirt highlight pixels.
   */
  fillPixelRect(
    context,
    variant.shirtHighlight,
    bodyX + 7,
    bodyY + 3,
    3,
    18
  );

  fillPixelRect(
    context,
    variant.shirtHighlight,
    bodyX + 13,
    bodyY + 4,
    2,
    22
  );

  if (
    variant.shirtPattern ===
      0
  ) {
    fillPixelRect(
      context,
      0xc4d8f4,
      bodyX + 4,
      bodyY + 8,
      22,
      2
    );

    fillPixelRect(
      context,
      0xc4d8f4,
      bodyX + 4,
      bodyY + 17,
      22,
      2
    );
  }
  else if (
    variant.shirtPattern ===
      1
  ) {
    fillPixelRect(
      context,
      0xa6c4ec,
      bodyX + 5,
      bodyY + 5,
      2,
      21
    );

    fillPixelRect(
      context,
      0xa6c4ec,
      bodyX + 23,
      bodyY + 5,
      2,
      21
    );
  }

  /*
   * Arms.
   */
  fillPixelRect(
    context,
    outline,
    bodyX - 7,
    bodyY + 2,
    7,
    26
  );

  fillPixelRect(
    context,
    outline,
    bodyX + 30,
    bodyY + 2,
    7,
    26
  );

  fillPixelRect(
    context,
    variant.shirt,
    bodyX - 5,
    bodyY + 4,
    5,
    20
  );

  fillPixelRect(
    context,
    variant.shirt,
    bodyX + 30,
    bodyY + 4,
    5,
    20
  );

  /*
   * Hands.
   */
  fillPixelRect(
    context,
    variant.skin,
    bodyX - 5,
    bodyY + 23,
    5,
    5
  );

  fillPixelRect(
    context,
    variant.skin,
    bodyX + 30,
    bodyY + 23,
    5,
    5
  );

  /*
   * Collar / tie / straps.
   */
  fillPixelRect(
    context,
    0xd5e5f8,
    bodyX + 8,
    bodyY,
    5,
    5
  );

  fillPixelRect(
    context,
    0xd5e5f8,
    bodyX + 17,
    bodyY,
    5,
    5
  );

  fillPixelRect(
    context,
    variant.accent,
    bodyX + 14,
    bodyY + 3,
    3,
    19
  );

  fillPixelRect(
    context,
    variant.accent,
    bodyX + 3,
    bodyY + 3,
    3,
    28
  );

  fillPixelRect(
    context,
    variant.accent,
    bodyX + 24,
    bodyY + 3,
    3,
    28
  );

  /*
   * Neck.
   */
  fillPixelRect(
    context,
    outline,
    bodyX + 10,
    bodyY - 9,
    11,
    10
  );

  fillPixelRect(
    context,
    variant.skin,
    bodyX + 12,
    bodyY - 8,
    7,
    9
  );

  /*
   * Head silhouette.
   */
  const headX =
    bodyX +
    6 +
    viewShift;

  const headY =
    bodyY -
    31;

  const headWidth =
    isRightProfile ||
    isLeftProfile
      ? 17
      : 20;

  fillPixelRect(
    context,
    outline,
    headX - 2,
    headY - 2,
    headWidth + 4,
    25
  );

  fillPixelRect(
    context,
    variant.skin,
    headX,
    headY,
    headWidth,
    21
  );

  /*
   * Face shadow plane.
   */
  if (
    directionIndex ===
      1 ||
    directionIndex ===
      2 ||
    directionIndex ===
      3
  ) {
    fillPixelRect(
      context,
      0xc87e55,
      headX,
      headY + 2,
      6,
      17
    );
  }
  else if (
    directionIndex ===
      5 ||
    directionIndex ===
      6 ||
    directionIndex ===
      7
  ) {
    fillPixelRect(
      context,
      0xc87e55,
      headX +
        headWidth -
        6,
      headY + 2,
      6,
      17
    );
  }
  else {
    fillPixelRect(
      context,
      0xd99162,
      headX,
      headY + 15,
      headWidth,
      6
    );
  }

  /*
   * Hair mass.
   */
  fillPixelRect(
    context,
    variant.hair,
    headX - 1,
    headY - 3,
    headWidth + 2,
    8
  );

  if (
    variant.hairStyle ===
      0
  ) {
    fillPixelRect(
      context,
      variant.hair,
      headX - 3,
      headY + 1,
      5,
      12
    );
  }
  else if (
    variant.hairStyle ===
      1
  ) {
    fillPixelRect(
      context,
      variant.hair,
      headX +
        headWidth -
        2,
      headY + 1,
      5,
      13
    );
  }
  else if (
    variant.hairStyle ===
      2
  ) {
    fillPixelRect(
      context,
      variant.hair,
      headX - 2,
      headY + 1,
      4,
      16
    );

    fillPixelRect(
      context,
      variant.hair,
      headX +
        headWidth -
        2,
      headY + 1,
      4,
      16
    );
  }

  /*
   * Warm hair highlights - the reference style relies
   * on explicit hand-authored highlight clusters.
   */
  fillPixelRect(
    context,
    0x9a5a2d,
    headX + 4,
    headY - 1,
    4,
    2
  );

  fillPixelRect(
    context,
    0xc87a34,
    headX + 9,
    headY,
    5,
    2
  );

  /*
   * Face pixels only when camera can see the face.
   */
  if (!isBack) {
    const eyeColor =
      0x152334;

    if (
      isRightProfile
    ) {
      fillPixelRect(
        context,
        eyeColor,
        headX + 11,
        headY + 8,
        3,
        2
      );

      fillPixelRect(
        context,
        0xa85d42,
        headX + 14,
        headY + 11,
        3,
        2
      );
    }
    else if (
      isLeftProfile
    ) {
      fillPixelRect(
        context,
        eyeColor,
        headX + 3,
        headY + 8,
        3,
        2
      );

      fillPixelRect(
        context,
        0xa85d42,
        headX,
        headY + 11,
        3,
        2
      );
    }
    else {
      fillPixelRect(
        context,
        eyeColor,
        headX + 4,
        headY + 8,
        3,
        2
      );

      fillPixelRect(
        context,
        eyeColor,
        headX + 13,
        headY + 8,
        3,
        2
      );

      fillPixelRect(
        context,
        0xa85d42,
        headX + 9,
        headY + 11,
        2,
        4
      );

      fillPixelRect(
        context,
        0x7e3e35,
        headX + 7,
        headY + 17,
        6,
        2
      );
    }
  }
  else {
    /*
     * Back-of-head clusters.
     */
    fillPixelRect(
      context,
      variant.hair,
      headX + 2,
      headY + 5,
      headWidth - 4,
      11
    );

    fillPixelRect(
      context,
      0x6e4027,
      headX + 5,
      headY + 7,
      4,
      2
    );

    fillPixelRect(
      context,
      0x8c542e,
      headX + 11,
      headY + 9,
      4,
      2
    );
  }

  /*
   * Small animation pixels: shoulders shift subtly instead
   * of interpolated smooth motion.
   */
  if (
    animationFrame ===
      1
  ) {
    fillPixelRect(
      context,
      variant.shirtHighlight,
      bodyX - 4,
      bodyY + 8,
      2,
      5
    );
  }

  if (
    animationFrame ===
      3
  ) {
    fillPixelRect(
      context,
      variant.shirtHighlight,
      bodyX + 32,
      bodyY + 8,
      2,
      5
    );
  }
}

function createProceduralStudentAtlasV9({
  documentObject,
  studentKey
}) {
  if (
    !documentObject ||
    typeof documentObject.createElement !==
      "function"
  ) {
    throw new TypeError(
      "documentObject.createElement is required"
    );
  }

  const profile =
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE;

  const variant =
    deriveStudentSpriteVariant(
      studentKey
    );

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width =
    profile.atlasWidth;

  canvas.height =
    profile.atlasHeight;

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  if (!context) {
    throw new Error(
      "2D canvas context unavailable"
    );
  }

  context.imageSmoothingEnabled =
    false;

  for (
    let animationFrame = 0;
    animationFrame <
      profile.idleFrameCount;
    animationFrame += 1
  ) {
    for (
      let directionIndex = 0;
      directionIndex <
        profile.directionCount;
      directionIndex += 1
    ) {
      drawStudentFrame({
        context,

        originX:
          directionIndex *
          profile.frameWidth,

        originY:
          animationFrame *
          profile.frameHeight,

        directionIndex,
        animationFrame,
        variant
      });
    }
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  configurePixelTexture(
    texture,
    {
      colorTexture:
        true,

      repeating:
        false,

      name:
        `cw-v9-student-atlas:${studentKey}`
    }
  );

  texture.flipY =
    true;

  const initialFrame =
    computeCharacterAtlasFrameUv({
      directionIndex: 0,
      animationFrame: 0
    });

  applyCharacterAtlasFrame(
    texture,
    initialFrame
  );

  return texture;
}

function auditStudentCharacterSpriteV9(
  sprite
) {
  const violations = [];

  if (
    !sprite?.isSprite
  ) {
    return {
      pass:
        false,

      violations: [
        "NOT_THREE_SPRITE"
      ]
    };
  }

  if (
    typeof sprite.userData
      ?.studentKey !==
      "string" ||
    sprite.userData
      .studentKey
      .length ===
      0
  ) {
    violations.push(
      "STUDENT_KEY_MISSING"
    );
  }

  if (
    sprite.userData
      ?.interactionType !==
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .interactionType
  ) {
    violations.push(
      "INTERACTION_TYPE_INVALID"
    );
  }

  if (
    sprite.userData
      ?.characterVisualAuthority !==
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .visualAuthority
  ) {
    violations.push(
      "VISUAL_AUTHORITY_INVALID"
    );
  }

  const materialAudit =
    auditPixelSpriteMaterial(
      sprite.material
    );

  violations.push(
    ...materialAudit
      .violations
      .map(
        (violation) =>
          `MATERIAL_${violation}`
      )
  );

  if (
    Math.abs(
      sprite.scale.x -
      CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
        .worldWidth
    ) >
    1e-9
  ) {
    violations.push(
      "WORLD_WIDTH_INVALID"
    );
  }

  if (
    Math.abs(
      sprite.scale.y -
      CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
        .worldHeight
    ) >
    1e-9
  ) {
    violations.push(
      "WORLD_HEIGHT_INVALID"
    );
  }

  return {
    pass:
      violations.length ===
      0,

    violations
  };
}

function createStudentCharacterSpriteV9({
  scene = null,
  studentKey,
  position = {
    x: 0,
    y: 0,
    z: 0
  },
  forwardYaw = 0,
  documentObject,
  atlasTexture = null
}) {
  if (
    typeof studentKey !==
      "string" ||
    studentKey.trim().length ===
      0
  ) {
    throw new TypeError(
      "studentKey is required"
    );
  }

  const normalizedStudentKey =
    studentKey.trim();

  const ownsTexture =
    !atlasTexture;

  const texture =
    atlasTexture ??
    createProceduralStudentAtlasV9({
      documentObject,
      studentKey:
        normalizedStudentKey
    });

  configurePixelTexture(
    texture,
    {
      colorTexture:
        true,

      repeating:
        false
    }
  );

  const material =
    createPixelSpriteMaterial({
      texture,
      alphaTest:
        0.5,

      sizeAttenuation:
        true
    });

  material.name =
    `cw-v9-student-material:${normalizedStudentKey}`;

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    `cw-v9-student:${normalizedStudentKey}`;

  sprite.center.set(
    0.5,
    0
  );

  sprite.position.set(
    Number(
      position.x
    ) || 0,

    Number(
      position.y
    ) || 0,

    Number(
      position.z
    ) || 0
  );

  sprite.scale.set(
    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .worldWidth,

    CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
      .worldHeight,

    1
  );

  sprite.userData = {
    ...sprite.userData,

    studentKey:
      normalizedStudentKey,

    interactionType:
      CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
        .interactionType,

    characterVisualAuthority:
      CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
        .visualAuthority,

    raycastRole:
      "student-character",

    spriteAtlasVersion:
      9
  };

  if (
    scene &&
    typeof scene.add ===
      "function"
  ) {
    scene.add(
      sprite
    );
  }

  let lastDirectionIndex =
    -1;

  let lastAnimationFrame =
    -1;

  let disposed =
    false;

  function applyFrame({
    directionIndex,
    animationFrame
  }) {
    if (
      directionIndex ===
        lastDirectionIndex &&
      animationFrame ===
        lastAnimationFrame
    ) {
      return false;
    }

    const frame =
      computeCharacterAtlasFrameUv({
        directionIndex,
        animationFrame
      });

    applyCharacterAtlasFrame(
      texture,
      frame
    );

    lastDirectionIndex =
      directionIndex;

    lastAnimationFrame =
      animationFrame;

    return true;
  }

  applyFrame({
    directionIndex: 0,
    animationFrame:
      computeStudentIdleFrame({
        timestamp: 0,
        studentKey:
          normalizedStudentKey
      })
  });

  function tick({
    timestamp = 0,
    camera = null,
    cameraPosition = null
  } = {}) {
    if (disposed) {
      return false;
    }

    const resolvedCameraPosition =
      cameraPosition ??
      camera?.position;

    if (
      !resolvedCameraPosition
    ) {
      return false;
    }

    const directionIndex =
      computeCharacterViewDirectionIndex({
        cameraPosition:
          resolvedCameraPosition,

        characterPosition:
          sprite.position,

        forwardYaw
      });

    const animationFrame =
      computeStudentIdleFrame({
        timestamp,
        studentKey:
          normalizedStudentKey
      });

    return applyFrame({
      directionIndex,
      animationFrame
    });
  }

  function getSnapshot() {
    return {
      studentKey:
        normalizedStudentKey,

      directionIndex:
        lastDirectionIndex,

      directionName:
        getCharacterDirectionName(
          lastDirectionIndex
        ),

      animationFrame:
        lastAnimationFrame,

      ownsTexture,

      disposed
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    if (
      sprite.parent
    ) {
      sprite.parent.remove(
        sprite
      );
    }

    material.dispose();

    if (
      ownsTexture
    ) {
      texture.dispose();
    }
  }

  return {
    sprite,
    texture,
    material,
    tick,
    getSnapshot,
    dispose
  };
}

export {
  CHARACTER_SPRITE_V9_DIRECTION_NAMES,
  CLASSROOM_CHARACTER_SPRITE_V9_PROFILE,
  STUDENT_V9_PALETTE,
  applyCharacterAtlasFrame,
  auditStudentCharacterSpriteV9,
  computeCharacterAtlasFrameUv,
  computeCharacterViewDirectionIndex,
  computeStudentIdleFrame,
  createProceduralStudentAtlasV9,
  createStudentCharacterSpriteV9,
  deriveStudentSpriteVariant,
  drawStudentFrame,
  getCharacterDirectionName,
  normalizeRadians,
  stableHashString
};