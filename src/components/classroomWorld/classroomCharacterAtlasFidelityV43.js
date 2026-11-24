const CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE =
  Object.freeze({
    version: 43,

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
    frameSelectionMutationCount: 0
  });

const V43_VIEW_SHIFT_BY_DIRECTION =
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

const V43_IDLE_LIFT_BY_FRAME =
  Object.freeze([
    0,
    -1,
    0,
    1
  ]);

const V43_REFERENCE_PALETTE =
  Object.freeze({
    deepPlum:
      Object.freeze([
        31,
        22,
        43
      ]),

    plumMid:
      Object.freeze([
        67,
        40,
        70
      ]),

    warmOrange:
      Object.freeze([
        231,
        126,
        73
      ]),

    warmCream:
      Object.freeze([
        248,
        218,
        169
      ]),

    cyan:
      Object.freeze([
        58,
        169,
        184
      ]),

    cyanBright:
      Object.freeze([
        113,
        215,
        219
      ]),

    eyeWhite:
      Object.freeze([
        244,
        229,
        201
      ]),

    lip:
      Object.freeze([
        137,
        62,
        82
      ])
  });

const EXCLUDED_SPRITE_PATTERN =
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

function isCharacterAtlasSpriteV43(
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
    EXCLUDED_SPRITE_PATTERN.test(
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
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
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

function readOriginalPixel(
  frameImage,
  x,
  y
) {
  if (
    x < 0 ||
    y < 0 ||
    x >=
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .frameWidth ||
    y >=
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .frameHeight
  ) {
    return null;
  }

  const offset =
    (
      y *
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .frameWidth +
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
    readOriginalPixel(
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

  const mixed =
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
    rgbCss(mixed);

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
    let offsetY = 0;
    offsetY < height;
    offsetY += 1
  ) {
    for (
      let offsetX = 0;
      offsetX < width;
      offsetX += 1
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
            offsetX,
          y:
            y +
            offsetY,
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

function paintReferencePortraitFrameV43({
  context,
  originX,
  originY,
  directionIndex,
  animationFrame,
  originals
}) {
  const frameWidth =
    CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
      .frameWidth;

  const frameHeight =
    CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
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
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .directionCount +
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .directionCount
    ) %
    CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
      .directionCount;

  const frame =
    (
      animationFrame %
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .idleFrameCount +
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .idleFrameCount
    ) %
    CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
      .idleFrameCount;

  const viewShift =
    V43_VIEW_SHIFT_BY_DIRECTION[
      direction
    ];

  const idleLift =
    V43_IDLE_LIFT_BY_FRAME[
      frame
    ];

  const centerX =
    32 +
    viewShift;

  const headTop =
    8 +
    idleLift;

  const isBack =
    direction >= 3 &&
    direction <= 5;

  const isRightProfile =
    direction === 2;

  const isLeftProfile =
    direction === 6;

  const isRightQuarter =
    direction === 1;

  const isLeftQuarter =
    direction === 7;

  let painted =
    0;

  /*
   * Hair silhouette:
   * dark clustered outline + warm edge highlights.
   *
   * This follows the supplied reference language:
   * strong dark-plum masses with controlled orange highlights.
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
        headTop +
        4,
      width:
        5,
      height:
        2,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.46
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
        2,
      y:
        headTop +
        3,
      width:
        7,
      height:
        2,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.54
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
        headTop +
        6,
      width:
        4,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .warmOrange,
      amount:
        0.32
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
        headTop +
        7,
      width:
        3,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .warmCream,
      amount:
        0.22
    });

  if (isBack) {
    /*
     * Back-facing frames deliberately do not
     * receive facial features.
     *
     * Only hair volume and nape separation.
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
          headTop +
          13,
        width:
          12,
        height:
          1,
        tint:
          V43_REFERENCE_PALETTE
            .plumMid,
        amount:
          0.32
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
          2,
        y:
          headTop +
          28,
        width:
          4,
        height:
          1,
        tint:
          V43_REFERENCE_PALETTE
            .deepPlum,
        amount:
          0.42
      });

    return painted;
  }

  /*
   * Temple / ear accents.
   */
  if (!isRightProfile) {
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
          headTop +
          18,
        width:
          2,
        height:
          4,
        tint:
          V43_REFERENCE_PALETTE
            .warmOrange,
        amount:
          0.28
      });
  }

  if (!isLeftProfile) {
    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          centerX +
          9,
        y:
          headTop +
          18,
        width:
          2,
        height:
          4,
        tint:
          V43_REFERENCE_PALETTE
            .warmOrange,
        amount:
          0.28
      });
  }

  /*
   * Brows + eyes.
   */
  if (
    !isRightProfile &&
    !isLeftProfile
  ) {
    const leftEyeX =
      centerX -
      (
        isRightQuarter
          ? 5
          : 6
      );

    const rightEyeX =
      centerX +
      (
        isLeftQuarter
          ? 3
          : 4
      );

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          leftEyeX -
          1,
        y:
          headTop +
          16,
        width:
          4,
        height:
          1,
        tint:
          V43_REFERENCE_PALETTE
            .deepPlum,
        amount:
          0.76
      });

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          rightEyeX -
          1,
        y:
          headTop +
          16,
        width:
          4,
        height:
          1,
        tint:
          V43_REFERENCE_PALETTE
            .deepPlum,
        amount:
          0.76
      });

    if (
      paintAbsolutePixel({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          leftEyeX,
        y:
          headTop +
          19,
        rgb:
          V43_REFERENCE_PALETTE
            .eyeWhite
      })
    ) {
      painted +=
        1;
    }

    if (
      paintAbsolutePixel({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          rightEyeX,
        y:
          headTop +
          19,
        rgb:
          V43_REFERENCE_PALETTE
            .eyeWhite
      })
    ) {
      painted +=
        1;
    }

    if (
      paintAbsolutePixel({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          leftEyeX +
          (
            isRightQuarter
              ? 1
              : 0
          ),
        y:
          headTop +
          19,
        rgb:
          V43_REFERENCE_PALETTE
            .cyan
      })
    ) {
      painted +=
        1;
    }

    if (
      paintAbsolutePixel({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          rightEyeX +
          (
            isLeftQuarter
              ? -1
              : 0
          ),
        y:
          headTop +
          19,
        rgb:
          V43_REFERENCE_PALETTE
            .cyan
      })
    ) {
      painted +=
        1;
    }
  }
  else {
    const profileSign =
      isRightProfile
        ? 1
        : -1;

    const eyeX =
      centerX +
      profileSign *
      3;

    painted +=
      paintToneCluster({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          eyeX -
          1,
        y:
          headTop +
          16,
        width:
          3,
        height:
          1,
        tint:
          V43_REFERENCE_PALETTE
            .deepPlum,
        amount:
          0.78
      });

    if (
      paintAbsolutePixel({
        context,
        originals,
        frameImage,
        originX,
        originY,
        x:
          eyeX,
        y:
          headTop +
          19,
        rgb:
          V43_REFERENCE_PALETTE
            .cyanBright
      })
    ) {
      painted +=
        1;
    }
  }

  /*
   * Nose bridge / cheek planes.
   *
   * Small clusters are mixed with the original
   * sprite color instead of imposing one skin tone.
   */
  const noseDirection =
    isRightProfile
      ? 1
      : isLeftProfile
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
        noseDirection,
      y:
        headTop +
        20,
      width:
        1,
      height:
        5,
      tint:
        V43_REFERENCE_PALETTE
          .warmCream,
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
        2 +
        noseDirection,
      y:
        headTop +
        22,
      width:
        1,
      height:
        4,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.30
    });

  if (!isRightProfile) {
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
          headTop +
          22,
        width:
          3,
        height:
          2,
        tint:
          V43_REFERENCE_PALETTE
            .warmOrange,
        amount:
          0.20
      });
  }

  if (!isLeftProfile) {
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
          headTop +
          22,
        width:
          3,
        height:
          2,
        tint:
          V43_REFERENCE_PALETTE
            .deepPlum,
        amount:
          0.22
      });
  }

  /*
   * Mouth / lower lip / chin.
   */
  const mouthCenter =
    centerX +
    noseDirection;

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        mouthCenter -
        (
          isRightProfile ||
          isLeftProfile
            ? 1
            : 3
        ),
      y:
        headTop +
        28,
      width:
        isRightProfile ||
        isLeftProfile
          ? 3
          : 7,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.68
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        mouthCenter -
        1,
      y:
        headTop +
        29,
      width:
        3,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .lip,
      amount:
        0.44
    });

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        mouthCenter -
        2,
      y:
        headTop +
        32,
      width:
        4,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.26
    });

  /*
   * Jaw edge / neck separation.
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
        headTop +
        34,
      width:
        12,
      height:
        1,
      tint:
        V43_REFERENCE_PALETTE
          .deepPlum,
      amount:
        0.22
    });

  /*
   * Tiny cyan reflected-light pixels.
   * These are deliberately sparse to match
   * the supplied cyan/plum/orange reference.
   */
  const reflectedX =
    isLeftProfile
      ? centerX -
        7
      : centerX +
        7;

  painted +=
    paintToneCluster({
      context,
      originals,
      frameImage,
      originX,
      originY,
      x:
        reflectedX,
      y:
        headTop +
        20,
      width:
        1,
      height:
        3,
      tint:
        V43_REFERENCE_PALETTE
          .cyanBright,
      amount:
        0.30
    });

  return painted;
}

function polishCharacterAtlasV43({
  context,
  originals
}) {
  let paintedPixelCount =
    0;

  for (
    let animationFrame = 0;
    animationFrame <
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
        .idleFrameCount;
    animationFrame += 1
  ) {
    for (
      let directionIndex = 0;
      directionIndex <
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
          .directionCount;
      directionIndex += 1
    ) {
      const originX =
        directionIndex *
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
          .frameWidth;

      const originY =
        animationFrame *
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
          .frameHeight;

      paintedPixelCount +=
        paintReferencePortraitFrameV43({
          context,
          originX,
          originY,
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

function createClassroomCharacterAtlasFidelityV43({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !== "function"
  ) {
    throw new Error(
      "V43 requires a Three.js scene"
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
      !isCharacterAtlasSpriteV43(
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
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
          .atlasWidth ||
      image.height !==
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
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

    const atlasPaintCount =
      polishCharacterAtlasV43({
        context,
        originals
      });

    if (
      atlasPaintCount <= 0
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
      atlasPaintCount;
  });

  constructionTraversalCount +=
    1;

  if (
    atlases.length === 0
  ) {
    throw new Error(
      "V43_CHARACTER_ATLAS_DISCOVERY_EMPTY"
    );
  }

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
          .version,

      atlasCount:
        atlases.length,

      polishedFrameCount:
        atlases.length *
        CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE
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
        0
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

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
  CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE,
  isCharacterAtlasSpriteV43,
  paintReferencePortraitFrameV43,
  polishCharacterAtlasV43,
  createClassroomCharacterAtlasFidelityV43
};