const CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE =
  Object.freeze({
    version: 44,

    visualOnly: true,
    deterministic: true,
    constructionOnly: true,

    frameWidth: 64,
    frameHeight: 96,

    directionCount: 8,
    idleFrameCount: 4,

    atlasWidth: 512,
    atlasHeight: 384,
    atlasFrameCount: 32,

    characterLayer: 30,

    bodyRegionStartY: 42,
    bodyRegionEndY: 95,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    addedDrawCalls: 0,
    addedTextures: 0,
    addedSprites: 0,
    addedMeshes: 0,
    addedLights: 0,

    scaleMutationCount: 0,
    positionMutationCount: 0,
    uvMutationCount: 0,
    frameSelectionMutationCount: 0,
    alphaMutationCount: 0
  });

const VIEW_SHIFT_BY_DIRECTION =
  Object.freeze([
    0,
    -1,
    -3,
    -2,
    0,
    2,
    3,
    1
  ]);

const IDLE_LIFT_BY_FRAME =
  Object.freeze([
    0,
    -1,
    0,
    1
  ]);

const V44_PALETTE =
  Object.freeze({
    ink:
      Object.freeze([
        25,
        20,
        36
      ]),

    deepPlum:
      Object.freeze([
        43,
        28,
        55
      ]),

    plum:
      Object.freeze([
        78,
        47,
        76
      ]),

    navy:
      Object.freeze([
        39,
        51,
        72
      ]),

    cyan:
      Object.freeze([
        56,
        157,
        177
      ]),

    cyanBright:
      Object.freeze([
        105,
        208,
        213
      ]),

    warmOrange:
      Object.freeze([
        226,
        122,
        68
      ]),

    warmCream:
      Object.freeze([
        244,
        214,
        169
      ]),

    clothHighlight:
      Object.freeze([
        190,
        170,
        156
      ]),

    shoeHighlight:
      Object.freeze([
        103,
        120,
        138
      ])
  });

const EXCLUDED_PATTERN =
  /(seagull|cargo|ship|cloud|whitecap|ocean.?atmosphere|environmental.?sprite|v41.?accent)/i;

const CHARACTER_PATTERN =
  /(student|character|sprite.?v9|character.?v10)/i;

function descriptorText(object) {
  const userData =
    object?.userData &&
    typeof object.userData === "object"
      ? object.userData
      : {};

  return [
    object?.name,
    object?.material?.name,
    object?.material?.map?.name,
    userData.studentKey,
    userData.displayLabel,
    userData.role,
    userData.kind,
    userData.type,
    userData.visualRole,
    userData.characterRole,
    userData.raycastRole
  ]
    .filter(Boolean)
    .join(" ");
}

function isLayerEnabled(
  object,
  layerIndex
) {
  if (
    !object?.layers ||
    !Number.isInteger(object.layers.mask)
  ) {
    return false;
  }

  const mask =
    1 << layerIndex;

  return (
    object.layers.mask &
    mask
  ) !== 0;
}

function isCharacterBodyAtlasSpriteV44(
  object
) {
  if (
    !object?.isSprite ||
    !object.material?.isSpriteMaterial ||
    !object.material.map
  ) {
    return false;
  }

  const userData =
    object.userData ?? {};

  if (
    userData.cw06SeagullV18 === true ||
    userData.cw06CargoShipV17 === true ||
    userData.cw06OceanAtmosphereV19 === true ||
    userData.cw06EnvironmentalSpriteFidelityV41 === true
  ) {
    return false;
  }

  const descriptor =
    descriptorText(object);

  if (
    EXCLUDED_PATTERN.test(
      descriptor
    )
  ) {
    return false;
  }

  if (
    typeof userData.studentKey === "string" &&
    userData.studentKey.length > 0
  ) {
    return true;
  }

  if (
    isLayerEnabled(
      object,
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .characterLayer
    )
  ) {
    return true;
  }

  return CHARACTER_PATTERN.test(
    descriptor
  );
}

function clampByte(value) {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(value)
    )
  );
}

function mixChannel(
  source,
  target,
  amount
) {
  return clampByte(
    source +
    (
      target -
      source
    ) *
    amount
  );
}

function mixRgb(
  source,
  target,
  amount
) {
  return [
    mixChannel(
      source[0],
      target[0],
      amount
    ),

    mixChannel(
      source[1],
      target[1],
      amount
    ),

    mixChannel(
      source[2],
      target[2],
      amount
    )
  ];
}

function rgbCss(rgb) {
  return (
    "rgb(" +
    rgb[0] +
    ", " +
    rgb[1] +
    ", " +
    rgb[2] +
    ")"
  );
}

function readPixel(
  frameImage,
  x,
  y
) {
  const frameWidth =
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .frameWidth;

  const frameHeight =
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .frameHeight;

  if (
    x < 0 ||
    y < 0 ||
    x >= frameWidth ||
    y >= frameHeight
  ) {
    return null;
  }

  const offset =
    (
      y *
      frameWidth +
      x
    ) *
    4;

  return {
    r:
      frameImage.data[
        offset
      ],

    g:
      frameImage.data[
        offset +
        1
      ],

    b:
      frameImage.data[
        offset +
        2
      ],

    a:
      frameImage.data[
        offset +
        3
      ]
  };
}

function rememberPixel({
  originals,
  frameImage,
  originX,
  originY,
  x,
  y
}) {
  const original =
    readPixel(
      frameImage,
      x,
      y
    );

  if (
    !original ||
    original.a < 224
  ) {
    return null;
  }

  const absoluteX =
    originX +
    x;

  const absoluteY =
    originY +
    y;

  const key =
    absoluteX +
    ":" +
    absoluteY;

  if (
    !originals.has(key)
  ) {
    originals.set(
      key,
      {
        x:
          absoluteX,

        y:
          absoluteY,

        ...original
      }
    );
  }

  return original;
}

function paintTonePixel({
  context,
  originals,
  frameImage,
  originX,
  originY,
  x,
  y,
  tint,
  amount
}) {
  const original =
    rememberPixel({
      originals,
      frameImage,
      originX,
      originY,
      x,
      y
    });

  if (!original) {
    return false;
  }

  const color =
    mixRgb(
      [
        original.r,
        original.g,
        original.b
      ],
      tint,
      amount
    );

  context.fillStyle =
    rgbCss(color);

  context.fillRect(
    originX + x,
    originY + y,
    1,
    1
  );

  return true;
}

function paintAbsolutePixel({
  context,
  originals,
  frameImage,
  originX,
  originY,
  x,
  y,
  rgb
}) {
  const original =
    rememberPixel({
      originals,
      frameImage,
      originX,
      originY,
      x,
      y
    });

  if (!original) {
    return false;
  }

  context.fillStyle =
    rgbCss(rgb);

  context.fillRect(
    originX + x,
    originY + y,
    1,
    1
  );

  return true;
}

function paintToneCluster({
  context,
  originals,
  frameImage,
  originX,
  originY,
  x,
  y,
  width,
  height,
  tint,
  amount
}) {
  let painted =
    0;

  for (
    let dy = 0;
    dy < height;
    dy += 1
  ) {
    for (
      let dx = 0;
      dx < width;
      dx += 1
    ) {
      if (
        paintTonePixel({
          context,
          originals,
          frameImage,
          originX,
          originY,
          x:
            x +
            dx,
          y:
            y +
            dy,
          tint,
          amount
        })
      ) {
        painted +=
          1;
      }
    }
  }

  return painted;
}

function paintCharacterBodyFrameV44({
  context,
  originX,
  originY,
  directionIndex,
  animationFrame,
  originals
}) {
  const frameWidth =
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .frameWidth;

  const frameHeight =
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .frameHeight;

  const frameImage =
    context.getImageData(
      originX,
      originY,
      frameWidth,
      frameHeight
    );

  const direction =
    (
      directionIndex %
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .directionCount +
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .directionCount
    ) %
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .directionCount;

  const frame =
    (
      animationFrame %
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .idleFrameCount +
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .idleFrameCount
    ) %
    CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
      .idleFrameCount;

  const viewShift =
    VIEW_SHIFT_BY_DIRECTION[
      direction
    ];

  const idleLift =
    IDLE_LIFT_BY_FRAME[
      frame
    ];

  const centerX =
    32 +
    viewShift;

  /*
   * Existing V9 atlas places torso around y=43.
   * All V44 work is intentionally below the
   * portrait/face region polished in V43.
   */
  const bodyTop =
    43 +
    idleLift;

  const trouserTop =
    bodyTop +
    31;

  const shoeTop =
    bodyTop +
    47;

  const isBack =
    direction >= 3 &&
    direction <= 5;

  const isRightProfile =
    direction === 2;

  const isLeftProfile =
    direction === 6;

  const isProfile =
    isRightProfile ||
    isLeftProfile;

  const isRightQuarter =
    direction === 1;

  const isLeftQuarter =
    direction === 7;

  let painted =
    0;

  /*
   * Shoulder silhouette grounding.
   * Do not touch alpha: only existing opaque
   * pixels are recolored.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        14,
      y:
        bodyTop +
        3,
      width:
        3,
      height:
        13,
      tint:
        V44_PALETTE.ink,
      amount:
        0.38
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        11,
      y:
        bodyTop +
        3,
      width:
        3,
      height:
        13,
      tint:
        V44_PALETTE.deepPlum,
      amount:
        0.32
    });

  /*
   * Warm window-side shoulder highlight.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        8,
      y:
        bodyTop +
        2,
      width:
        3,
      height:
        5,
      tint:
        V44_PALETTE.warmCream,
      amount:
        0.23
    });

  /*
   * Cyan reflected-light rim on the opposite
   * silhouette edge.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        12,
      y:
        bodyTop +
        8,
      width:
        1,
      height:
        9,
      tint:
        V44_PALETTE.cyanBright,
      amount:
        0.28
    });

  if (isBack) {
    /*
     * Back yoke + center-back cloth seam.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          8,
        y:
          bodyTop +
          5,
        width:
          16,
        height:
          2,
        tint:
          V44_PALETTE.deepPlum,
        amount:
          0.34
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX,
        y:
          bodyTop +
          9,
        width:
          1,
        height:
          18,
        tint:
          V44_PALETTE.plum,
        amount:
          0.30
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          7,
        y:
          bodyTop +
          17,
        width:
          4,
        height:
          2,
        tint:
          V44_PALETTE.navy,
        amount:
          0.25
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          4,
        y:
          bodyTop +
          20,
        width:
          4,
        height:
          2,
        tint:
          V44_PALETTE.warmOrange,
        amount:
          0.16
      });
  }
  else if (isProfile) {
    const profileSign =
      isRightProfile
        ? 1
        : -1;

    /*
     * Profile shoulder ridge.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          profileSign *
          7,
        y:
          bodyTop +
          3,
        width:
          2,
        height:
          8,
        tint:
          V44_PALETTE.warmCream,
        amount:
          0.22
      });

    /*
     * Profile side seam.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          profileSign *
          5,
        y:
          bodyTop +
          10,
        width:
          1,
        height:
          19,
        tint:
          V44_PALETTE.deepPlum,
        amount:
          0.40
      });

    /*
     * Profile cloth fold.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          profileSign *
          2,
        y:
          bodyTop +
          16,
        width:
          2,
        height:
          7,
        tint:
          V44_PALETTE.cyan,
        amount:
          0.18
      });
  }
  else {
    /*
     * Front / quarter collar.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          6,
        y:
          bodyTop +
          2,
        width:
          5,
        height:
          3,
        tint:
          V44_PALETTE.warmCream,
        amount:
          0.28
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          1,
        y:
          bodyTop +
          2,
        width:
          5,
        height:
          3,
        tint:
          V44_PALETTE.deepPlum,
        amount:
          0.31
      });

    /*
     * Shirt / jacket center seam.
     */
    const seamShift =
      isRightQuarter
        ? 1
        : isLeftQuarter
          ? -1
          : 0;

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          seamShift,
        y:
          bodyTop +
          7,
        width:
          1,
        height:
          21,
        tint:
          V44_PALETTE.ink,
        amount:
          0.48
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          seamShift +
          1,
        y:
          bodyTop +
          8,
        width:
          1,
        height:
          17,
        tint:
          V44_PALETTE.warmOrange,
        amount:
          0.13
      });

    /*
     * Buttons / zip glints.
     */
    for (
      const localY
      of [
        bodyTop + 10,
        bodyTop + 16,
        bodyTop + 22
      ]
    ) {
      if (
        paintAbsolutePixel({
          context,
          originals,
          frameImage,
          originX,
          originY,
          x:
            centerX +
            seamShift,
          y:
            localY,
          rgb:
            V44_PALETTE.warmCream
        })
      ) {
        painted +=
          1;
      }
    }

    /*
     * Chest fold clusters.
     */
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          9,
        y:
          bodyTop +
          11,
        width:
          5,
        height:
          2,
        tint:
          V44_PALETTE.deepPlum,
        amount:
          0.25
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          4,
        y:
          bodyTop +
          13,
        width:
          5,
        height:
          2,
        tint:
          V44_PALETTE.warmCream,
        amount:
          0.15
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX -
          6,
        y:
          bodyTop +
          21,
        width:
          4,
        height:
          2,
        tint:
          V44_PALETTE.cyan,
        amount:
          0.17
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          3,
        y:
          bodyTop +
          24,
        width:
          4,
        height:
          2,
        tint:
          V44_PALETTE.deepPlum,
        amount:
          0.23
      });
  }

  /*
   * Sleeve cuffs.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        14,
      y:
        bodyTop +
        23,
      width:
        4,
      height:
        2,
      tint:
        V44_PALETTE.ink,
      amount:
        0.40
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        10,
      y:
        bodyTop +
        23,
      width:
        4,
      height:
        2,
      tint:
        V44_PALETTE.warmCream,
      amount:
        0.20
    });

  /*
   * Waist separation.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        9,
      y:
        bodyTop +
        29,
      width:
        18,
      height:
        2,
      tint:
        V44_PALETTE.deepPlum,
      amount:
        0.34
    });

  /*
   * Trouser silhouette, leg separation,
   * crease highlights and shadow mass.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        9,
      y:
        trouserTop,
      width:
        3,
      height:
        14,
      tint:
        V44_PALETTE.ink,
      amount:
        0.40
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        6,
      y:
        trouserTop,
      width:
        3,
      height:
        14,
      tint:
        V44_PALETTE.deepPlum,
      amount:
        0.34
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX,
      y:
        trouserTop +
        1,
      width:
        1,
      height:
        13,
      tint:
        V44_PALETTE.ink,
      amount:
        0.55
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        4,
      y:
        trouserTop +
        3,
      width:
        1,
      height:
        9,
      tint:
        V44_PALETTE.cyan,
      amount:
        0.20
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        4,
      y:
        trouserTop +
        2,
      width:
        1,
      height:
        10,
      tint:
        V44_PALETTE.clothHighlight,
      amount:
        0.16
    });

  /*
   * Knee shadow clusters.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        7,
      y:
        trouserTop +
        9,
      width:
        5,
      height:
        2,
      tint:
        V44_PALETTE.deepPlum,
      amount:
        0.28
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        2,
      y:
        trouserTop +
        10,
      width:
        5,
      height:
        2,
      tint:
        V44_PALETTE.navy,
      amount:
        0.24
    });

  /*
   * Shoes: hard dark footprint with sparse
   * cool/warm pixel highlights.
   */
  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        10,
      y:
        shoeTop,
      width:
        8,
      height:
        3,
      tint:
        V44_PALETTE.ink,
      amount:
        0.60
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        2,
      y:
        shoeTop,
      width:
        8,
      height:
        3,
      tint:
        V44_PALETTE.ink,
      amount:
        0.60
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX -
        8,
      y:
        shoeTop,
      width:
        3,
      height:
        1,
      tint:
        V44_PALETTE.cyanBright,
      amount:
        0.24
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        centerX +
        4,
      y:
        shoeTop,
      width:
        3,
      height:
        1,
      tint:
        V44_PALETTE.shoeHighlight,
      amount:
        0.28
    });

  return painted;
}

function polishCharacterBodyAtlasV44({
  context,
  originals
}) {
  let paintedPixelCount =
    0;

  for (
    let animationFrame = 0;
    animationFrame <
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
        .idleFrameCount;
    animationFrame += 1
  ) {
    for (
      let directionIndex = 0;
      directionIndex <
        CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
          .directionCount;
      directionIndex += 1
    ) {
      paintedPixelCount +=
        paintCharacterBodyFrameV44({
          context,

          originX:
            directionIndex *
            CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
              .frameWidth,

          originY:
            animationFrame *
            CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
              .frameHeight,

          directionIndex,
          animationFrame,
          originals
        });
    }
  }

  return paintedPixelCount;
}

function restorePixels({
  context,
  originals
}) {
  for (
    const original
    of originals.values()
  ) {
    context.fillStyle =
      "rgb(" +
      original.r +
      ", " +
      original.g +
      ", " +
      original.b +
      ")";

    context.fillRect(
      original.x,
      original.y,
      1,
      1
    );
  }
}

function createClassroomCharacterBodyClothingFidelityV44({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !== "function"
  ) {
    throw new Error(
      "V44 requires a Three.js scene"
    );
  }

  const atlases =
    [];

  const seenTextures =
    new Set();

  let constructionTraversalCount =
    0;

  let paintedPixelCount =
    0;

  scene.traverse((object) => {
    if (
      !isCharacterBodyAtlasSpriteV44(
        object
      )
    ) {
      return;
    }

    const texture =
      object.material.map;

    if (
      seenTextures.has(
        texture
      )
    ) {
      return;
    }

    seenTextures.add(
      texture
    );

    const image =
      texture.image;

    if (
      !image ||
      image.width !==
        CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
          .atlasWidth ||
      image.height !==
        CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
          .atlasHeight ||
      typeof image.getContext !==
        "function"
    ) {
      return;
    }

    const context =
      image.getContext(
        "2d"
      );

    if (
      !context ||
      typeof context.getImageData !==
        "function" ||
      typeof context.fillRect !==
        "function"
    ) {
      return;
    }

    const originals =
      new Map();

    const count =
      polishCharacterBodyAtlasV44({
        context,
        originals
      });

    if (
      count <= 0
    ) {
      return;
    }

    texture.needsUpdate =
      true;

    atlases.push({
      texture,
      context,
      originals
    });

    paintedPixelCount +=
      count;
  });

  constructionTraversalCount +=
    1;

  if (
    atlases.length === 0
  ) {
    throw new Error(
      "V44_CHARACTER_ATLAS_DISCOVERY_EMPTY"
    );
  }

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
          .version,

      atlasCount:
        atlases.length,

      polishedFrameCount:
        atlases.length *
        CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE
          .atlasFrameCount,

      paintedPixelCount,

      constructionSceneTraversalCount:
        constructionTraversalCount,

      runtimeSceneTraversalCount:
        0,

      addedDrawCalls:
        0,

      addedTextures:
        0,

      addedSprites:
        0,

      addedMeshes:
        0,

      addedLights:
        0,

      scaleMutationCount:
        0,

      positionMutationCount:
        0,

      uvMutationCount:
        0,

      frameSelectionMutationCount:
        0,

      alphaMutationCount:
        0
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    /*
     * Restore the exact V43 canvas state.
     * V43 then restores the prior atlas during
     * its own later dispose call.
     */
    for (
      const atlas
      of atlases
    ) {
      restorePixels({
        context:
          atlas.context,

        originals:
          atlas.originals
      });

      atlas.texture.needsUpdate =
        true;
    }
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE,
  isCharacterBodyAtlasSpriteV44,
  paintCharacterBodyFrameV44,
  polishCharacterBodyAtlasV44,
  createClassroomCharacterBodyClothingFidelityV44
};