const CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE =
  Object.freeze({
    version: 45,

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

    castVariantCount: 8,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    addedDrawCalls: 0,
    addedTextures: 0,
    addedSprites: 0,
    addedMeshes: 0,
    addedMaterials: 0,
    addedLights: 0,

    positionMutationCount: 0,
    scaleMutationCount: 0,
    uvMutationCount: 0,
    frameSelectionMutationCount: 0,
    alphaMutationCount: 0,
    materialColorMutationCount: 0
  });

const CAST_VARIANTS_V45 =
  Object.freeze([
    Object.freeze({
      id:
        "ink-teal",

      hair:
        Object.freeze([36, 29, 38]),

      hairHighlight:
        Object.freeze([86, 63, 66]),

      complexion:
        Object.freeze([221, 172, 132]),

      upper:
        Object.freeze([67, 106, 116]),

      lower:
        Object.freeze([45, 56, 76]),

      accent:
        Object.freeze([225, 125, 72]),

      shoe:
        Object.freeze([58, 60, 71])
    }),

    Object.freeze({
      id:
        "plum-navy",

      hair:
        Object.freeze([31, 26, 39]),

      hairHighlight:
        Object.freeze([83, 52, 79]),

      complexion:
        Object.freeze([214, 164, 128]),

      upper:
        Object.freeze([91, 58, 89]),

      lower:
        Object.freeze([40, 49, 70]),

      accent:
        Object.freeze([111, 190, 199]),

      shoe:
        Object.freeze([52, 55, 69])
    }),

    Object.freeze({
      id:
        "warm-brown",

      hair:
        Object.freeze([48, 34, 31]),

      hairHighlight:
        Object.freeze([111, 72, 52]),

      complexion:
        Object.freeze([226, 178, 137]),

      upper:
        Object.freeze([113, 78, 65]),

      lower:
        Object.freeze([57, 55, 63]),

      accent:
        Object.freeze([231, 154, 86]),

      shoe:
        Object.freeze([66, 58, 58])
    }),

    Object.freeze({
      id:
        "graphite-cyan",

      hair:
        Object.freeze([28, 30, 36]),

      hairHighlight:
        Object.freeze([65, 74, 83]),

      complexion:
        Object.freeze([208, 159, 126]),

      upper:
        Object.freeze([65, 78, 91]),

      lower:
        Object.freeze([42, 48, 59]),

      accent:
        Object.freeze([73, 179, 196]),

      shoe:
        Object.freeze([48, 53, 62])
    }),

    Object.freeze({
      id:
        "burgundy-cream",

      hair:
        Object.freeze([39, 28, 34]),

      hairHighlight:
        Object.freeze([94, 55, 59]),

      complexion:
        Object.freeze([222, 168, 131]),

      upper:
        Object.freeze([111, 57, 66]),

      lower:
        Object.freeze([53, 48, 64]),

      accent:
        Object.freeze([237, 207, 160]),

      shoe:
        Object.freeze([60, 52, 60])
    }),

    Object.freeze({
      id:
        "cool-navy",

      hair:
        Object.freeze([27, 30, 41]),

      hairHighlight:
        Object.freeze([58, 73, 99]),

      complexion:
        Object.freeze([211, 163, 134]),

      upper:
        Object.freeze([54, 72, 104]),

      lower:
        Object.freeze([40, 47, 67]),

      accent:
        Object.freeze([109, 194, 204]),

      shoe:
        Object.freeze([47, 54, 70])
    }),

    Object.freeze({
      id:
        "olive-amber",

      hair:
        Object.freeze([41, 35, 29]),

      hairHighlight:
        Object.freeze([92, 76, 54]),

      complexion:
        Object.freeze([219, 171, 133]),

      upper:
        Object.freeze([89, 96, 68]),

      lower:
        Object.freeze([48, 55, 55]),

      accent:
        Object.freeze([225, 142, 66]),

      shoe:
        Object.freeze([58, 59, 57])
    }),

    Object.freeze({
      id:
        "violet-cyan",

      hair:
        Object.freeze([34, 27, 43]),

      hairHighlight:
        Object.freeze([78, 56, 95]),

      complexion:
        Object.freeze([216, 167, 136]),

      upper:
        Object.freeze([79, 65, 104]),

      lower:
        Object.freeze([43, 47, 68]),

      accent:
        Object.freeze([88, 190, 201]),

      shoe:
        Object.freeze([52, 53, 70])
    })
  ]);

const EXCLUDED_PATTERN =
  /(seagull|cargo|ship|cloud|whitecap|ocean.?atmosphere|environmental.?sprite|v41.?accent)/i;

const CHARACTER_PATTERN =
  /(student|character|sprite.?v9|character.?v10)/i;

function stableHashStringV45(value) {
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
      ) >>> 0;
  }

  return hash >>> 0;
}

function deriveCharacterCastVariantV45(
  studentKey
) {
  const normalizedKey =
    String(
      studentKey ??
      "anonymous-student"
    )
      .trim() ||
    "anonymous-student";

  const hash =
    stableHashStringV45(
      normalizedKey
    );

  const index =
    hash %
    CAST_VARIANTS_V45.length;

  const palette =
    CAST_VARIANTS_V45[
      index
    ];

  return Object.freeze({
    studentKey:
      normalizedKey,

    hash,

    index,

    id:
      palette.id,

    seed:
      (
        hash >>>
        8
      ) %
      997,

    palette
  });
}

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
    !Number.isInteger(
      object.layers.mask
    )
  ) {
    return false;
  }

  return (
    object.layers.mask &
    (
      1 <<
      layerIndex
    )
  ) !== 0;
}

function isCharacterCastSpriteV45(
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
    object.userData ??
    {};

  if (
    userData.cw06SeagullV18 === true ||
    userData.cw06CargoShipV17 === true ||
    userData.cw06OceanAtmosphereV19 === true ||
    userData.cw06EnvironmentalSpriteFidelityV41 === true
  ) {
    return false;
  }

  const descriptor =
    descriptorText(
      object
    );

  if (
    EXCLUDED_PATTERN.test(
      descriptor
    )
  ) {
    return false;
  }

  if (
    typeof userData.studentKey ===
      "string" &&
    userData.studentKey.length > 0
  ) {
    return true;
  }

  if (
    isLayerEnabled(
      object,
      CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
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

function applyRgbGrade(
  data,
  offset,
  target,
  amount
) {
  data[
    offset
  ] =
    mixChannel(
      data[offset],
      target[0],
      amount
    );

  data[
    offset +
    1
  ] =
    mixChannel(
      data[
        offset +
        1
      ],
      target[1],
      amount
    );

  data[
    offset +
    2
  ] =
    mixChannel(
      data[
        offset +
        2
      ],
      target[2],
      amount
    );
}

function pixelLuminance(
  red,
  green,
  blue
) {
  return (
    red *
      0.299 +
    green *
      0.587 +
    blue *
      0.114
  );
}

function applyCastVariantToAtlasImageDataV45({
  imageData,
  variant
}) {
  const data =
    imageData.data;

  const atlasWidth =
    CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
      .atlasWidth;

  const atlasHeight =
    CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
      .atlasHeight;

  const frameWidth =
    CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
      .frameWidth;

  const frameHeight =
    CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
      .frameHeight;

  let modifiedPixelCount =
    0;

  let hairPixelCount =
    0;

  let complexionPixelCount =
    0;

  let upperClothingPixelCount =
    0;

  let lowerClothingPixelCount =
    0;

  let accentPixelCount =
    0;

  let shoePixelCount =
    0;

  for (
    let y = 0;
    y < atlasHeight;
    y += 1
  ) {
    const localY =
      y %
      frameHeight;

    const animationFrame =
      Math.floor(
        y /
        frameHeight
      );

    for (
      let x = 0;
      x < atlasWidth;
      x += 1
    ) {
      const localX =
        x %
        frameWidth;

      const directionIndex =
        Math.floor(
          x /
          frameWidth
        );

      const offset =
        (
          y *
          atlasWidth +
          x
        ) *
        4;

      const alpha =
        data[
          offset +
          3
        ];

      if (
        alpha <
        224
      ) {
        continue;
      }

      const red =
        data[
          offset
        ];

      const green =
        data[
          offset +
          1
        ];

      const blue =
        data[
          offset +
          2
        ];

      const luminance =
        pixelLuminance(
          red,
          green,
          blue
        );

      /*
       * Preserve darkest VGA ink / outline pixels.
       * This keeps the silhouette language authored
       * by V9, V43 and V44 intact.
       */
      if (
        luminance <
        38
      ) {
        continue;
      }

      let target =
        null;

      let amount =
        0;

      let category =
        null;

      /*
       * Hair zone.
       *
       * Only darker and mid-value pixels are graded.
       * High-value facial pixels remain outside this
       * branch even when the bounding regions overlap.
       */
      if (
        localY <=
          25 &&
        luminance <
          155
      ) {
        const highlight =
          (
            localX *
              3 +
            localY +
            variant.seed +
            directionIndex *
              5 +
            animationFrame *
              7
          ) %
          17 ===
          0;

        target =
          highlight
            ? variant.palette
                .hairHighlight
            : variant.palette
                .hair;

        amount =
          highlight
            ? 0.22
            : 0.15;

        category =
          "hair";
      }

      /*
       * Face / neck color-family variation.
       *
       * Deliberately subtle so V43 facial modelling,
       * eye/brow/nose/mouth pixels and dark outlines
       * remain visually authoritative.
       */
      else if (
        localY >=
          16 &&
        localY <=
          42 &&
        luminance >=
          92
      ) {
        target =
          variant.palette
            .complexion;

        amount =
          0.055;

        category =
          "complexion";
      }

      /*
       * Shirt / jacket / upper-body cloth.
       */
      else if (
        localY >=
          43 &&
        localY <=
          73
      ) {
        const accent =
          (
            localX +
            localY *
              2 +
            variant.seed +
            directionIndex *
              3
          ) %
          19 ===
          0;

        target =
          accent
            ? variant.palette
                .accent
            : variant.palette
                .upper;

        amount =
          accent
            ? 0.19
            : 0.105;

        category =
          accent
            ? "accent"
            : "upper";
      }

      /*
       * Trousers / lower-body cloth.
       */
      else if (
        localY >=
          74 &&
        localY <=
          90
      ) {
        const creaseAccent =
          (
            localX *
              5 +
            localY +
            variant.seed
          ) %
          23 ===
          0;

        target =
          creaseAccent
            ? variant.palette
                .accent
            : variant.palette
                .lower;

        amount =
          creaseAccent
            ? 0.11
            : 0.095;

        category =
          creaseAccent
            ? "accent"
            : "lower";
      }

      /*
       * Shoes.
       */
      else if (
        localY >=
          91
      ) {
        target =
          variant.palette
            .shoe;

        amount =
          0.12;

        category =
          "shoe";
      }

      if (
        !target ||
        amount <= 0
      ) {
        continue;
      }

      applyRgbGrade(
        data,
        offset,
        target,
        amount
      );

      modifiedPixelCount +=
        1;

      if (
        category ===
        "hair"
      ) {
        hairPixelCount +=
          1;
      }
      else if (
        category ===
        "complexion"
      ) {
        complexionPixelCount +=
          1;
      }
      else if (
        category ===
        "upper"
      ) {
        upperClothingPixelCount +=
          1;
      }
      else if (
        category ===
        "lower"
      ) {
        lowerClothingPixelCount +=
          1;
      }
      else if (
        category ===
        "accent"
      ) {
        accentPixelCount +=
          1;
      }
      else if (
        category ===
        "shoe"
      ) {
        shoePixelCount +=
          1;
      }
    }
  }

  return Object.freeze({
    modifiedPixelCount,
    hairPixelCount,
    complexionPixelCount,
    upperClothingPixelCount,
    lowerClothingPixelCount,
    accentPixelCount,
    shoePixelCount
  });
}

function createClassroomCharacterCastVarietyV45({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new Error(
      "V45 requires a Three.js scene"
    );
  }

  const textureGroups =
    new Map();

  let constructionTraversalCount =
    0;

  scene.traverse((object) => {
    if (
      !isCharacterCastSpriteV45(
        object
      )
    ) {
      return;
    }

    const texture =
      object.material.map;

    const image =
      texture?.image;

    if (
      !image ||
      image.width !==
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .atlasWidth ||
      image.height !==
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
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
      typeof context.putImageData !==
        "function"
    ) {
      return;
    }

    let group =
      textureGroups.get(
        texture
      );

    if (!group) {
      group = {
        texture,
        context,
        studentKeys:
          new Set(),
        descriptors:
          new Set()
      };

      textureGroups.set(
        texture,
        group
      );
    }

    const studentKey =
      typeof object.userData?.studentKey ===
        "string" &&
      object.userData.studentKey.length >
        0
        ? object.userData.studentKey
        : null;

    if (studentKey) {
      group.studentKeys.add(
        studentKey
      );
    }

    const descriptor =
      descriptorText(
        object
      );

    if (descriptor) {
      group.descriptors.add(
        descriptor
      );
    }
  });

  constructionTraversalCount +=
    1;

  if (
    textureGroups.size ===
    0
  ) {
    throw new Error(
      "V45_CHARACTER_ATLAS_DISCOVERY_EMPTY"
    );
  }

  const atlasRecords =
    [];

  const variantHistogram =
    new Map();

  let modifiedPixelCount =
    0;

  let hairPixelCount =
    0;

  let complexionPixelCount =
    0;

  let upperClothingPixelCount =
    0;

  let lowerClothingPixelCount =
    0;

  let accentPixelCount =
    0;

  let shoePixelCount =
    0;

  let sharedTextureGroupCount =
    0;

  for (
    const group
    of textureGroups.values()
  ) {
    const studentKeys =
      Array.from(
        group.studentKeys
      )
        .sort();

    if (
      studentKeys.length >
      1
    ) {
      sharedTextureGroupCount +=
        1;
    }

    const fallbackDescriptor =
      Array.from(
        group.descriptors
      )
        .sort()[0] ??
      "anonymous-character";

    const canonicalStudentKey =
      studentKeys[0] ??
      fallbackDescriptor;

    const variant =
      deriveCharacterCastVariantV45(
        canonicalStudentKey
      );

    const originalImageData =
      group.context.getImageData(
        0,
        0,
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .atlasWidth,
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .atlasHeight
      );

    const workingImageData =
      group.context.getImageData(
        0,
        0,
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .atlasWidth,
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .atlasHeight
      );

    const result =
      applyCastVariantToAtlasImageDataV45({
        imageData:
          workingImageData,

        variant
      });

    group.context.putImageData(
      workingImageData,
      0,
      0
    );

    group.texture.needsUpdate =
      true;

    atlasRecords.push({
      texture:
        group.texture,

      context:
        group.context,

      originalImageData,

      canonicalStudentKey,

      studentKeys,

      variant
    });

    variantHistogram.set(
      variant.id,
      (
        variantHistogram.get(
          variant.id
        ) ??
        0
      ) +
      1
    );

    modifiedPixelCount +=
      result.modifiedPixelCount;

    hairPixelCount +=
      result.hairPixelCount;

    complexionPixelCount +=
      result.complexionPixelCount;

    upperClothingPixelCount +=
      result.upperClothingPixelCount;

    lowerClothingPixelCount +=
      result.lowerClothingPixelCount;

    accentPixelCount +=
      result.accentPixelCount;

    shoePixelCount +=
      result.shoePixelCount;
  }

  const castSignatures =
    Object.freeze(
      atlasRecords.map(
        (record) =>
          Object.freeze({
            studentKey:
              record.canonicalStudentKey,

            variantId:
              record.variant.id,

            variantIndex:
              record.variant.index
          })
      )
    );

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE
          .version,

      atlasCount:
        atlasRecords.length,

      studentTextureGroupCount:
        textureGroups.size,

      sharedTextureGroupCount,

      distinctVariantCount:
        variantHistogram.size,

      castSignatures,

      modifiedPixelCount,
      hairPixelCount,
      complexionPixelCount,
      upperClothingPixelCount,
      lowerClothingPixelCount,
      accentPixelCount,
      shoePixelCount,

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

      addedMaterials:
        0,

      addedLights:
        0,

      positionMutationCount:
        0,

      scaleMutationCount:
        0,

      uvMutationCount:
        0,

      frameSelectionMutationCount:
        0,

      alphaMutationCount:
        0,

      materialColorMutationCount:
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
     * Restore exact V44 canvas state.
     *
     * Disposal chain remains:
     *
     * V45 -> V44 -> V43 -> predecessors
     */
    for (
      const record
      of atlasRecords
    ) {
      record.context.putImageData(
        record.originalImageData,
        0,
        0
      );

      record.texture.needsUpdate =
        true;
    }
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE,
  CAST_VARIANTS_V45,
  stableHashStringV45,
  deriveCharacterCastVariantV45,
  isCharacterCastSpriteV45,
  applyCastVariantToAtlasImageDataV45,
  createClassroomCharacterCastVarietyV45
};