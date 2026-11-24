const CHARACTER_FRAME_WIDTH_V31 =
  64;

const CHARACTER_FRAME_HEIGHT_V31 =
  96;

const CHARACTER_DIRECTION_COUNT_V31 =
  8;

const CHARACTER_IDLE_FRAME_COUNT_V31 =
  4;

const CHARACTER_ATLAS_WIDTH_V31 =
  CHARACTER_FRAME_WIDTH_V31 *
  CHARACTER_DIRECTION_COUNT_V31;

const CHARACTER_ATLAS_HEIGHT_V31 =
  CHARACTER_FRAME_HEIGHT_V31 *
  CHARACTER_IDLE_FRAME_COUNT_V31;

const CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE =
  Object.freeze({
    id:
      "cw06-character-silhouette-polish-v31",

    frameWidth:
      CHARACTER_FRAME_WIDTH_V31,

    frameHeight:
      CHARACTER_FRAME_HEIGHT_V31,

    directionCount:
      CHARACTER_DIRECTION_COUNT_V31,

    idleFrameCount:
      CHARACTER_IDLE_FRAME_COUNT_V31,

    atlasWidth:
      CHARACTER_ATLAS_WIDTH_V31,

    atlasHeight:
      CHARACTER_ATLAS_HEIGHT_V31,

    atlasFrameCount:
      CHARACTER_DIRECTION_COUNT_V31 *
      CHARACTER_IDLE_FRAME_COUNT_V31,

    hairStyleCount:
      6,

    shoulderClassCount:
      5,

    statureClassCount:
      5,

    anchorClassCount:
      5,

    addedSprites:
      0,

    addedMeshes:
      0,

    addedMaterials:
      0,

    addedTextures:
      0,

    addedDrawCalls:
      0,

    atlasRedrawPerRuntimeFrame:
      0,

    constructionSceneTraversalCount:
      1,

    runtimeSceneTraversal:
      false,

    runtimeAnimation:
      false,

    collisionAuthority:
      "preserved",

    interactionAuthority:
      "preserved",

    identityAuthority:
      "preserved",

    v9AtlasAuthority:
      "preserved",

    v10PresentationAuthority:
      "preserved",

    visualOnly:
      true,

    deterministic:
      true
  });

const HAIR_COLORS_V31 =
  Object.freeze([
    "#211722",
    "#2d202b",
    "#36252c",
    "#281b25",
    "#3e2b31",
    "#251c25"
  ]);

const HAIR_HIGHLIGHTS_V31 =
  Object.freeze([
    "#5a4042",
    "#67494a",
    "#72504a",
    "#59414a",
    "#76534d",
    "#64484a"
  ]);

const CLOTHING_ACCENTS_V31 =
  Object.freeze([
    "#d98763",
    "#5d9aa3",
    "#d3aa6a",
    "#8d6985",
    "#678d9b",
    "#c6755d"
  ]);

function stableHashStringV31(
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

  return hash >>> 0;
}

function bucketV31(
  hash,
  shift,
  count
) {
  return (
    (
      hash >>>
      shift
    ) %
    count
  );
}

function deriveStudentSilhouetteProfileV31(
  studentKey
) {
  const key =
    String(
      studentKey ??
      "student"
    );

  const hash =
    stableHashStringV31(
      key
    );

  const hairStyle =
    bucketV31(
      hash,
      0,
      6
    );

  const shoulderClass =
    bucketV31(
      hash,
      4,
      5
    );

  const statureClass =
    bucketV31(
      hash,
      8,
      5
    );

  const anchorClass =
    bucketV31(
      hash,
      12,
      5
    );

  const idleAccentClass =
    bucketV31(
      hash,
      16,
      4
    );

  const shoulderScale =
    [
      0.955,
      0.977,
      1.0,
      1.023,
      1.045
    ][
      shoulderClass
    ];

  const statureScale =
    [
      0.970,
      0.985,
      1.000,
      1.020,
      1.040
    ][
      statureClass
    ];

  const anchorY =
    [
      0.475,
      0.487,
      0.500,
      0.513,
      0.525
    ][
      anchorClass
    ];

  const verticalOffset =
    [
      -0.026,
      -0.012,
      0,
      0.012,
      0.024
    ][
      anchorClass
    ];

  return Object.freeze({
    studentKey:
      key,

    hash,

    hairStyle,

    shoulderClass,

    statureClass,

    anchorClass,

    idleAccentClass,

    shoulderScale,

    statureScale,

    anchorY,

    verticalOffset,

    hairColor:
      HAIR_COLORS_V31[
        hairStyle
      ],

    hairHighlight:
      HAIR_HIGHLIGHTS_V31[
        hairStyle
      ],

    clothingAccent:
      CLOTHING_ACCENTS_V31[
        hairStyle
      ]
  });
}

function resolveAtlasImageV31(
  texture
) {
  if (!texture) {
    return null;
  }

  return (
    texture.image ??
    texture.source?.data ??
    null
  );
}

function atlasImageSizeV31(
  image
) {
  if (!image) {
    return {
      width: 0,
      height: 0
    };
  }

  const width =
    Number(
      image.width ??
      image.naturalWidth ??
      0
    );

  const height =
    Number(
      image.height ??
      image.naturalHeight ??
      0
    );

  return {
    width:
      Number.isFinite(width)
        ? width
        : 0,

    height:
      Number.isFinite(height)
        ? height
        : 0
  };
}

function resolveStudentKeyV31(
  sprite
) {
  const userData =
    sprite?.userData ??
    {};

  const candidates =
    [
      userData.studentKey,
      userData.studentId,
      userData.studentID,
      userData.key,
      userData.identity?.studentKey,
      userData.identity?.studentId
    ];

  for (
    const value
    of candidates
  ) {
    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  if (
    typeof sprite?.name ===
      "string" &&
    /student/i.test(
      sprite.name
    )
  ) {
    return sprite.name;
  }

  return null;
}

function isV9StudentSpriteV31(
  object
) {
  if (
    !object ||
    object.isSprite !==
      true
  ) {
    return false;
  }

  const texture =
    object.material?.map;

  if (
    !texture
  ) {
    return false;
  }

  const image =
    resolveAtlasImageV31(
      texture
    );

  const {
    width,
    height
  } =
    atlasImageSizeV31(
      image
    );

  if (
    width !==
      CHARACTER_ATLAS_WIDTH_V31 ||
    height !==
      CHARACTER_ATLAS_HEIGHT_V31
  ) {
    return false;
  }

  return (
    resolveStudentKeyV31(
      object
    ) !==
    null
  );
}

function commandV31({
  frameIndex,
  x,
  y,
  width,
  height,
  color
}) {
  return Object.freeze({
    frameIndex,
    x,
    y,
    width,
    height,
    color
  });
}

function pushHairCommandsV31({
  commands,
  frameIndex,
  frameX,
  frameY,
  directionIndex,
  idleFrame,
  profile
}) {
  const idleLift =
    [
      0,
      -1,
      0,
      1
    ][
      idleFrame
    ];

  const directionShift =
    directionIndex === 2 ||
    directionIndex === 3
      ? 1
      : (
          directionIndex === 5 ||
          directionIndex === 6
            ? -1
            : 0
        );

  const x =
    frameX +
    directionShift;

  const y =
    frameY +
    idleLift;

  const dark =
    profile.hairColor;

  const highlight =
    profile.hairHighlight;

  /*
   * All six variants stay within the existing head region.
   *
   * They add silhouette pixels around the original V9/V25
   * character rather than replacing the character.
   */

  switch (
    profile.hairStyle
  ) {
    case 0:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 25,
          y:
            y + 11,
          width: 15,
          height: 4,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 29,
          y:
            y + 8,
          width: 4,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 35,
          y:
            y + 9,
          width: 3,
          height: 4,
          color:
            highlight
        })
      );

      break;

    case 1:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 23,
          y:
            y + 12,
          width: 18,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 22,
          y:
            y + 16,
          width: 5,
          height: 10,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 28,
          y:
            y + 11,
          width: 9,
          height: 2,
          color:
            highlight
        })
      );

      break;

    case 2:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 22,
          y:
            y + 12,
          width: 20,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 21,
          y:
            y + 16,
          width: 4,
          height: 16,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 39,
          y:
            y + 16,
          width: 4,
          height: 16,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 25,
          y:
            y + 11,
          width: 12,
          height: 2,
          color:
            highlight
        })
      );

      break;

    case 3:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 24,
          y:
            y + 10,
          width: 17,
          height: 7,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 26,
          y:
            y + 8,
          width: 11,
          height: 3,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 27,
          y:
            y + 11,
          width: 8,
          height: 2,
          color:
            highlight
        })
      );

      break;

    case 4:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 22,
          y:
            y + 11,
          width: 20,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 37,
          y:
            y + 15,
          width: 6,
          height: 13,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 40,
          y:
            y + 25,
          width: 5,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 26,
          y:
            y + 10,
          width: 10,
          height: 2,
          color:
            highlight
        })
      );

      break;

    default:
      commands.push(
        commandV31({
          frameIndex,
          x:
            x + 23,
          y:
            y + 12,
          width: 19,
          height: 5,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 24,
          y:
            y + 8,
          width: 4,
          height: 6,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 32,
          y:
            y + 7,
          width: 4,
          height: 6,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 39,
          y:
            y + 9,
          width: 3,
          height: 6,
          color:
            dark
        }),

        commandV31({
          frameIndex,
          x:
            x + 29,
          y:
            y + 10,
          width: 7,
          height: 2,
          color:
            highlight
        })
      );
  }
}

function pushShoulderCommandsV31({
  commands,
  frameIndex,
  frameX,
  frameY,
  directionIndex,
  idleFrame,
  profile
}) {
  const facingSide =
    directionIndex === 2 ||
    directionIndex === 3
      ? 1
      : (
          directionIndex === 5 ||
          directionIndex === 6
            ? -1
            : 0
        );

  const idleShift =
    [
      0,
      1,
      0,
      -1
    ][
      idleFrame
    ];

  const widthExtra =
    profile.shoulderClass;

  const leftX =
    frameX +
    18 -
    widthExtra +
    facingSide;

  const rightX =
    frameX +
    42 -
    facingSide;

  const y =
    frameY +
    44 +
    idleShift;

  commands.push(
    commandV31({
      frameIndex,
      x:
        leftX,
      y,
      width:
        3 +
        widthExtra,
      height: 4,
      color:
        profile.clothingAccent
    }),

    commandV31({
      frameIndex,
      x:
        rightX,
      y:
        y + 1,
      width:
        3 +
        Math.max(
          0,
          widthExtra - 1
        ),
      height: 4,
      color:
        profile.clothingAccent
    })
  );

  /*
   * Small asymmetry in one idle frame is enough to stop
   * all four idle cells from reading as exact duplicates.
   */

  if (
    idleFrame ===
    profile.idleAccentClass
  ) {
    commands.push(
      commandV31({
        frameIndex,
        x:
          frameX +
          27 +
          facingSide,
        y:
          frameY +
          50,
        width: 4,
        height: 2,
        color:
          profile.clothingAccent
      })
    );
  }
}

function buildCharacterAtlasDecorationCommandsV31(
  studentKey
) {
  const profile =
    deriveStudentSilhouetteProfileV31(
      studentKey
    );

  const commands =
    [];

  for (
    let idleFrame = 0;
    idleFrame <
      CHARACTER_IDLE_FRAME_COUNT_V31;
    idleFrame += 1
  ) {
    for (
      let directionIndex = 0;
      directionIndex <
        CHARACTER_DIRECTION_COUNT_V31;
      directionIndex += 1
    ) {
      const frameIndex =
        idleFrame *
          CHARACTER_DIRECTION_COUNT_V31 +
        directionIndex;

      const frameX =
        directionIndex *
        CHARACTER_FRAME_WIDTH_V31;

      const frameY =
        idleFrame *
        CHARACTER_FRAME_HEIGHT_V31;

      pushHairCommandsV31({
        commands,
        frameIndex,
        frameX,
        frameY,
        directionIndex,
        idleFrame,
        profile
      });

      pushShoulderCommandsV31({
        commands,
        frameIndex,
        frameX,
        frameY,
        directionIndex,
        idleFrame,
        profile
      });
    }
  }

  return Object.freeze(
    commands
  );
}

function commandWithinAtlasV31(
  command
) {
  return (
    Number.isInteger(
      command.x
    ) &&
    Number.isInteger(
      command.y
    ) &&
    Number.isInteger(
      command.width
    ) &&
    Number.isInteger(
      command.height
    ) &&
    command.x >= 0 &&
    command.y >= 0 &&
    command.width > 0 &&
    command.height > 0 &&
    command.x +
      command.width <=
      CHARACTER_ATLAS_WIDTH_V31 &&
    command.y +
      command.height <=
      CHARACTER_ATLAS_HEIGHT_V31
  );
}

function applyAtlasDecorationV31({
  texture,
  studentKey
}) {
  const image =
    resolveAtlasImageV31(
      texture
    );

  if (
    !image ||
    typeof image.getContext !==
      "function"
  ) {
    return {
      decorated:
        false,

      backup:
        null,

      context:
        null,

      commandCount:
        0
    };
  }

  const context =
    image.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  if (
    !context ||
    typeof context.fillRect !==
      "function"
  ) {
    return {
      decorated:
        false,

      backup:
        null,

      context:
        null,

      commandCount:
        0
    };
  }

  let backup =
    null;

  if (
    typeof context.getImageData ===
      "function"
  ) {
    try {
      backup =
        context.getImageData(
          0,
          0,
          CHARACTER_ATLAS_WIDTH_V31,
          CHARACTER_ATLAS_HEIGHT_V31
        );
    }
    catch {
      backup =
        null;
    }
  }

  const commands =
    buildCharacterAtlasDecorationCommandsV31(
      studentKey
    );

  for (
    const command
    of commands
  ) {
    if (
      !commandWithinAtlasV31(
        command
      )
    ) {
      throw new RangeError(
        "V31 atlas decoration escaped atlas bounds"
      );
    }

    context.fillStyle =
      command.color;

    context.fillRect(
      command.x,
      command.y,
      command.width,
      command.height
    );
  }

  texture.needsUpdate =
    true;

  return {
    decorated:
      true,

    backup,

    context,

    commandCount:
      commands.length
  };
}

function captureSpriteStateV31(
  sprite
) {
  return {
    scaleX:
      sprite.scale.x,

    scaleY:
      sprite.scale.y,

    scaleZ:
      sprite.scale.z,

    centerX:
      sprite.center?.x,

    centerY:
      sprite.center?.y,

    positionY:
      sprite.position.y
  };
}

function applySpriteProportionV31({
  sprite,
  profile
}) {
  sprite.scale.x *=
    profile.shoulderScale;

  sprite.scale.y *=
    profile.statureScale;

  if (
    sprite.center &&
    typeof sprite.center.set ===
      "function"
  ) {
    sprite.center.set(
      sprite.center.x,
      profile.anchorY
    );
  }
  else if (
    sprite.center
  ) {
    sprite.center.y =
      profile.anchorY;
  }

  sprite.position.y +=
    profile.verticalOffset;
}

function restoreSpriteStateV31({
  sprite,
  state
}) {
  sprite.scale.x =
    state.scaleX;

  sprite.scale.y =
    state.scaleY;

  sprite.scale.z =
    state.scaleZ;

  if (
    sprite.center
  ) {
    sprite.center.x =
      state.centerX;

    sprite.center.y =
      state.centerY;
  }

  sprite.position.y =
    state.positionY;
}

function createClassroomCharacterSilhouettePolishV31({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V31 requires traversable THREE.Scene"
    );
  }

  const candidates =
    [];

  /*
   * Exactly one construction-time traversal.
   *
   * No runtime traversal is introduced.
   */

  scene.traverse(
    (object) => {
      if (
        isV9StudentSpriteV31(
          object
        )
      ) {
        candidates.push(
          object
        );
      }
    }
  );

  const records =
    [];

  const decoratedTextures =
    new Set();

  let decoratedAtlasCount =
    0;

  let atlasDecorationCommandCount =
    0;

  for (
    const sprite
    of candidates
  ) {
    const studentKey =
      resolveStudentKeyV31(
        sprite
      );

    const silhouette =
      deriveStudentSilhouetteProfileV31(
        studentKey
      );

    const originalState =
      captureSpriteStateV31(
        sprite
      );

    applySpriteProportionV31({
      sprite,
      profile:
        silhouette
    });

    const texture =
      sprite.material?.map ??
      null;

    let decoration =
      {
        decorated:
          false,

        backup:
          null,

        context:
          null,

        commandCount:
          0
      };

    /*
     * Normally each student owns its procedural atlas.
     *
     * If a future implementation intentionally shares an
     * atlas, never paint the same texture multiple times.
     */

    if (
      texture &&
      !decoratedTextures.has(
        texture
      )
    ) {
      decoratedTextures.add(
        texture
      );

      decoration =
        applyAtlasDecorationV31({
          texture,
          studentKey
        });

      if (
        decoration.decorated
      ) {
        decoratedAtlasCount +=
          1;

        atlasDecorationCommandCount +=
          decoration.commandCount;
      }
    }

    records.push({
      sprite,
      studentKey,
      silhouette,
      originalState,
      texture,
      decoration
    });
  }

  let disposed =
    false;

  function getSnapshot() {
    const hairStyles =
      new Set(
        records.map(
          (record) =>
            record.silhouette
              .hairStyle
        )
      );

    const shoulderClasses =
      new Set(
        records.map(
          (record) =>
            record.silhouette
              .shoulderClass
        )
      );

    const statureClasses =
      new Set(
        records.map(
          (record) =>
            record.silhouette
              .statureClass
        )
      );

    return Object.freeze({
      id:
        CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE
          .id,

      studentSpriteCount:
        records.length,

      uniqueHairStyleCount:
        hairStyles.size,

      uniqueShoulderClassCount:
        shoulderClasses.size,

      uniqueStatureClassCount:
        statureClasses.size,

      decoratedAtlasCount,

      atlasDecorationCommandCount,

      addedSprites:
        0,

      addedMeshes:
        0,

      addedMaterials:
        0,

      addedTextures:
        0,

      addedDrawCalls:
        0,

      atlasRedrawPerRuntimeFrame:
        0,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversal:
        false,

      runtimeAnimation:
        false,

      collisionAuthority:
        "preserved",

      interactionAuthority:
        "preserved",

      identityAuthority:
        "preserved",

      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    for (
      const record
      of records
    ) {
      restoreSpriteStateV31({
        sprite:
          record.sprite,

        state:
          record.originalState
      });

      const {
        decoration,
        texture
      } =
        record;

      if (
        decoration.backup &&
        decoration.context &&
        typeof decoration.context
          .putImageData ===
          "function"
      ) {
        try {
          decoration.context.putImageData(
            decoration.backup,
            0,
            0
          );

          if (texture) {
            texture.needsUpdate =
              true;
          }
        }
        catch {
          /*
           * Texture ownership remains with V9/V10.
           * Disposal must never become a new failure
           * authority because restoration is cosmetic.
           */
        }
      }
    }
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CHARACTER_ATLAS_HEIGHT_V31,
  CHARACTER_ATLAS_WIDTH_V31,
  CHARACTER_DIRECTION_COUNT_V31,
  CHARACTER_FRAME_HEIGHT_V31,
  CHARACTER_FRAME_WIDTH_V31,
  CHARACTER_IDLE_FRAME_COUNT_V31,
  CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE,
  applyAtlasDecorationV31,
  buildCharacterAtlasDecorationCommandsV31,
  createClassroomCharacterSilhouettePolishV31,
  deriveStudentSilhouetteProfileV31,
  isV9StudentSpriteV31,
  stableHashStringV31
};
