import * as THREE from "three";

import {
  CHARACTER_ATLAS_HEIGHT_V31,
  CHARACTER_ATLAS_WIDTH_V31,
  CHARACTER_DIRECTION_COUNT_V31,
  CHARACTER_FRAME_HEIGHT_V31,
  CHARACTER_FRAME_WIDTH_V31,
  CHARACTER_IDLE_FRAME_COUNT_V31,
  deriveStudentSilhouetteProfileV31,
  isV9StudentSpriteV31,
  stableHashStringV31
} from "./classroomCharacterSilhouettePolishV31.js";

const CLASSROOM_REFERENCE_CHARACTER_DESK_V32_PROFILE =
  Object.freeze({
    id:
      "cw06-reference-character-desk-microdetail-v32",

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

    clothingStyleCount:
      6,

    deskMicrodetailTypes:
      Object.freeze([
        "pencil-case",
        "pencil",
        "ruler",
        "eraser"
      ]),

    deskMicrodetailPerStudent:
      4,

    addedStaticDrawCalls:
      1,

    addedTextures:
      0,

    addedSpriteSystems:
      0,

    addedCharacterSystems:
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

    v27BooksAndPapers:
      "untouched",

    visualOnly:
      true,

    deterministic:
      true
  });

const CLOTHING_PALETTES_V32 =
  Object.freeze([
    Object.freeze({
      main:
        "#365d6d",
      light:
        "#6ba1a7",
      dark:
        "#203846",
      accent:
        "#e0a268"
    }),

    Object.freeze({
      main:
        "#704e66",
      light:
        "#a57a8d",
      dark:
        "#342435",
      accent:
        "#e8c98e"
    }),

    Object.freeze({
      main:
        "#8c5645",
      light:
        "#c77a5e",
      dark:
        "#432b31",
      accent:
        "#71a6aa"
    }),

    Object.freeze({
      main:
        "#45657a",
      light:
        "#7195a3",
      dark:
        "#263344",
      accent:
        "#d79965"
    }),

    Object.freeze({
      main:
        "#695a42",
      light:
        "#a28a62",
      dark:
        "#382c2f",
      accent:
        "#66a0a2"
    }),

    Object.freeze({
      main:
        "#5a4967",
      light:
        "#8e718d",
      dark:
        "#2a2031",
      accent:
        "#d77d5e"
    })
  ]);

const DESK_COLORS_V32 =
  Object.freeze({
    pencilCase:
      Object.freeze([
        0x3f7885,
        0x80596f,
        0xb9674d,
        0x516c84
      ]),

    pencil:
      Object.freeze([
        0xe0ad61,
        0xd38455,
        0x71a4aa,
        0xe4c786
      ]),

    ruler:
      Object.freeze([
        0x75a6a8,
        0xe0c582,
        0xb86c52,
        0x74637e
      ]),

    eraser:
      Object.freeze([
        0xe8cfa5,
        0xd48b78,
        0x8cb1b0,
        0xb897a8
      ])
  });

function resolveStudentKeyV32(
  sprite
) {
  const userData =
    sprite?.userData ??
    {};

  const values =
    [
      userData.studentKey,
      userData.studentId,
      userData.studentID,
      userData.key,
      userData.identity?.studentKey,
      userData.identity?.studentId,
      sprite?.name
    ];

  for (
    const value
    of values
  ) {
    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "student";
}

function resolveAtlasImageV32(
  texture
) {
  return (
    texture?.image ??
    texture?.source?.data ??
    null
  );
}

function commandV32({
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

function atlasCommandInBoundsV32(
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

function deriveCharacterClothingProfileV32(
  studentKey
) {
  const key =
    String(
      studentKey ??
      "student"
    );

  const silhouette =
    deriveStudentSilhouetteProfileV31(
      key
    );

  const hash =
    stableHashStringV31(
      "v32:" +
      key
    );

  const clothingStyle =
    hash %
    CLOTHING_PALETTES_V32.length;

  const palette =
    CLOTHING_PALETTES_V32[
      clothingStyle
    ];

  return Object.freeze({
    studentKey:
      key,

    hash,

    clothingStyle,

    palette,

    seamOffset:
      (
        (
          hash >>>
          8
        ) %
        3
      ) -
      1,

    cuffVariant:
      (
        hash >>>
        12
      ) %
      3,

    collarVariant:
      (
        hash >>>
        16
      ) %
      3,

    foldVariant:
      (
        hash >>>
        20
      ) %
      4,

    shoulderScale:
      silhouette
        .shoulderScale,

    statureScale:
      silhouette
        .statureScale
  });
}

function pushClothingFrameCommandsV32({
  commands,
  frameIndex,
  frameX,
  frameY,
  directionIndex,
  idleFrame,
  profile
}) {
  const palette =
    profile.palette;

  const sideShift =
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

  const centerX =
    frameX +
    32 +
    sideShift;

  const torsoY =
    frameY +
    44 +
    idleShift;

  /*
   * Collar.
   */

  if (
    profile.collarVariant ===
    0
  ) {
    commands.push(
      commandV32({
        frameIndex,
        x:
          centerX - 8,
        y:
          torsoY,
        width: 6,
        height: 2,
        color:
          palette.light
      }),

      commandV32({
        frameIndex,
        x:
          centerX + 2,
        y:
          torsoY,
        width: 6,
        height: 2,
        color:
          palette.light
      })
    );
  }
  else if (
    profile.collarVariant ===
    1
  ) {
    commands.push(
      commandV32({
        frameIndex,
        x:
          centerX - 7,
        y:
          torsoY,
        width: 14,
        height: 2,
        color:
          palette.accent
      }),

      commandV32({
        frameIndex,
        x:
          centerX - 2,
        y:
          torsoY + 2,
        width: 4,
        height: 3,
        color:
          palette.dark
      })
    );
  }
  else {
    commands.push(
      commandV32({
        frameIndex,
        x:
          centerX - 9,
        y:
          torsoY,
        width: 7,
        height: 2,
        color:
          palette.light
      }),

      commandV32({
        frameIndex,
        x:
          centerX + 2,
        y:
          torsoY + 1,
        width: 7,
        height: 2,
        color:
          palette.accent
      })
    );
  }

  /*
   * Central seam / tie / zipper.
   */

  switch (
    profile.clothingStyle
  ) {
    case 0:
    case 3:
      commands.push(
        commandV32({
          frameIndex,
          x:
            centerX +
            profile.seamOffset,
          y:
            torsoY + 4,
          width: 2,
          height: 20,
          color:
            palette.dark
        }),

        commandV32({
          frameIndex,
          x:
            centerX +
            profile.seamOffset +
            2,
          y:
            torsoY + 5,
          width: 1,
          height: 17,
          color:
            palette.light
        })
      );

      break;

    case 1:
    case 4:
      commands.push(
        commandV32({
          frameIndex,
          x:
            centerX - 2,
          y:
            torsoY + 4,
          width: 4,
          height: 5,
          color:
            palette.accent
        }),

        commandV32({
          frameIndex,
          x:
            centerX - 1,
          y:
            torsoY + 9,
          width: 2,
          height: 14,
          color:
            palette.dark
        })
      );

      break;

    default:
      commands.push(
        commandV32({
          frameIndex,
          x:
            centerX - 7,
          y:
            torsoY + 8,
          width: 14,
          height: 2,
          color:
            palette.light
        }),

        commandV32({
          frameIndex,
          x:
            centerX - 6,
          y:
            torsoY + 20,
          width: 12,
          height: 2,
          color:
            palette.dark
        })
      );
  }

  /*
   * Direction-aware sleeve/cuff accents.
   */

  const cuffY =
    torsoY +
    13 +
    profile.cuffVariant;

  commands.push(
    commandV32({
      frameIndex,
      x:
        frameX +
        18 +
        sideShift,
      y:
        cuffY,
      width: 4,
      height: 2,
      color:
        palette.accent
    }),

    commandV32({
      frameIndex,
      x:
        frameX +
        42 +
        sideShift,
      y:
        cuffY + 1,
      width: 4,
      height: 2,
      color:
        palette.accent
    })
  );

  /*
   * Tiny idle fold differences.
   * No animation system is added; the existing V9 idle
   * frame selection simply reveals these authored cells.
   */

  if (
    idleFrame ===
    profile.foldVariant
  ) {
    commands.push(
      commandV32({
        frameIndex,
        x:
          centerX - 8,
        y:
          torsoY + 17,
        width: 5,
        height: 2,
        color:
          palette.dark
      }),

      commandV32({
        frameIndex,
        x:
          centerX + 4,
        y:
          torsoY + 14,
        width: 4,
        height: 2,
        color:
          palette.light
      })
    );
  }
}

function buildCharacterClothingCommandsV32(
  studentKey
) {
  const profile =
    deriveCharacterClothingProfileV32(
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

      pushClothingFrameCommandsV32({
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

function applyCharacterClothingV32({
  texture,
  studentKey
}) {
  const image =
    resolveAtlasImageV32(
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
    buildCharacterClothingCommandsV32(
      studentKey
    );

  for (
    const command
    of commands
  ) {
    if (
      !atlasCommandInBoundsV32(
        command
      )
    ) {
      throw new RangeError(
        "V32 clothing decoration escaped atlas bounds"
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

function resolveSpriteWorldPositionV32(
  sprite
) {
  const target =
    new THREE.Vector3();

  if (
    typeof sprite.getWorldPosition ===
      "function"
  ) {
    sprite.getWorldPosition(
      target
    );

    return target;
  }

  target.set(
    sprite.position?.x ??
      0,

    sprite.position?.y ??
      0,

    sprite.position?.z ??
      0
  );

  return target;
}

function deriveDeskMicrodetailBlueprintsV32({
  sprite,
  studentKey,
  studentIndex
}) {
  const position =
    resolveSpriteWorldPositionV32(
      sprite
    );

  const hash =
    stableHashStringV31(
      "desk-v32:" +
      studentKey
    );

  const side =
    (
      hash &
      1
    ) ===
      0
      ? -1
      : 1;

  const smallYaw =
    (
      (
        (
          hash >>>
          5
        ) %
        9
      ) -
      4
    ) *
    0.022;

  /*
   * Students face the classroom front (-Z).
   * The desk surface sits in front of the seated sprite.
   *
   * These are decorative only. V27 books/papers remain
   * untouched and authoritative for its own visual layer.
   */

  const deskCenterX =
    position.x;

  const deskCenterZ =
    position.z -
    0.64;

  const topY =
    0.87;

  const colorIndex =
    hash %
    4;

  return Object.freeze([
    Object.freeze({
      studentIndex,
      studentKey,
      type:
        "pencil-case",

      position:
        Object.freeze({
          x:
            deskCenterX +
            side *
            0.34,

          y:
            topY,

          z:
            deskCenterZ -
            0.08
        }),

      rotationY:
        smallYaw,

      scale:
        Object.freeze({
          x:
            0.40,

          y:
            0.055,

          z:
            0.15
        }),

      color:
        DESK_COLORS_V32
          .pencilCase[
            colorIndex
          ]
    }),

    Object.freeze({
      studentIndex,
      studentKey,
      type:
        "pencil",

      position:
        Object.freeze({
          x:
            deskCenterX -
            side *
            0.18,

          y:
            topY +
            0.018,

          z:
            deskCenterZ +
            0.08
        }),

      rotationY:
        -0.12 *
        side +
        smallYaw,

      scale:
        Object.freeze({
          x:
            0.34,

          y:
            0.022,

          z:
            0.025
        }),

      color:
        DESK_COLORS_V32
          .pencil[
            colorIndex
          ]
    }),

    Object.freeze({
      studentIndex,
      studentKey,
      type:
        "ruler",

      position:
        Object.freeze({
          x:
            deskCenterX +
            side *
            0.05,

          y:
            topY +
            0.012,

          z:
            deskCenterZ +
            0.16
        }),

      rotationY:
        0.07 *
        side -
        smallYaw,

      scale:
        Object.freeze({
          x:
            0.38,

          y:
            0.016,

          z:
            0.045
        }),

      color:
        DESK_COLORS_V32
          .ruler[
            colorIndex
          ]
    }),

    Object.freeze({
      studentIndex,
      studentKey,
      type:
        "eraser",

      position:
        Object.freeze({
          x:
            deskCenterX -
            side *
            0.05,

          y:
            topY +
            0.026,

          z:
            deskCenterZ -
            0.13
        }),

      rotationY:
        smallYaw *
        0.5,

      scale:
        Object.freeze({
          x:
            0.11,

          y:
            0.05,

          z:
            0.075
        }),

      color:
        DESK_COLORS_V32
          .eraser[
            colorIndex
          ]
    })
  ]);
}

function disableRaycastV32(
  object
) {
  object.raycast =
    function noV32Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V32:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function createClassroomReferenceCharacterDeskMicrodetailV32({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V32 requires THREE.Scene"
    );
  }

  const studentSprites =
    [];

  /*
   * Exactly one construction-time scene traversal.
   * Never repeated in tick/update.
   */

  scene.traverse(
    (object) => {
      if (
        isV9StudentSpriteV31(
          object
        )
      ) {
        studentSprites.push(
          object
        );
      }
    }
  );

  const atlasRecords =
    [];

  const visitedTextures =
    new Set();

  let decoratedAtlasCount =
    0;

  let clothingCommandCount =
    0;

  const deskBlueprints =
    [];

  studentSprites.forEach(
    (
      sprite,
      studentIndex
    ) => {
      const studentKey =
        resolveStudentKeyV32(
          sprite
        );

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

      if (
        texture &&
        !visitedTextures.has(
          texture
        )
      ) {
        visitedTextures.add(
          texture
        );

        decoration =
          applyCharacterClothingV32({
            texture,
            studentKey
          });

        if (
          decoration.decorated
        ) {
          decoratedAtlasCount +=
            1;

          clothingCommandCount +=
            decoration.commandCount;
        }
      }

      atlasRecords.push({
        texture,
        decoration
      });

      deskBlueprints.push(
        ...deriveDeskMicrodetailBlueprintsV32({
          sprite,
          studentKey,
          studentIndex
        })
      );
    }
  );

  const root =
    new THREE.Group();

  root.name =
    "classroom-reference-character-desk-microdetail-v32";

  root.userData = {
    cw06V32:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  let microdetailMesh =
    null;

  let microdetailGeometry =
    null;

  let microdetailMaterial =
    null;

  if (
    deskBlueprints.length >
    0
  ) {
    /*
     * Every stationery item is a scaled rectangular pixel
     * primitive. That allows pencil case, pencil, ruler and
     * eraser to share one geometry/material/draw call.
     */

    microdetailGeometry =
      new THREE.BoxGeometry(
        1,
        1,
        1
      );

    microdetailMaterial =
      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        toneMapped:
          false
      });

    microdetailMesh =
      new THREE.InstancedMesh(
        microdetailGeometry,
        microdetailMaterial,
        deskBlueprints.length
      );

    microdetailMesh.name =
      "cw06-v32-student-desk-stationery";

    microdetailMesh.layers.set(
      30
    );

    microdetailMesh.castShadow =
      false;

    microdetailMesh.receiveShadow =
      false;

    disableRaycastV32(
      microdetailMesh
    );

    const dummy =
      new THREE.Object3D();

    deskBlueprints.forEach(
      (
        item,
        index
      ) => {
        dummy.position.set(
          item.position.x,
          item.position.y,
          item.position.z
        );

        dummy.rotation.set(
          0,
          item.rotationY,
          0
        );

        dummy.scale.set(
          item.scale.x,
          item.scale.y,
          item.scale.z
        );

        dummy.updateMatrix();

        microdetailMesh.setMatrixAt(
          index,
          dummy.matrix
        );

        microdetailMesh.setColorAt(
          index,
          new THREE.Color(
            item.color
          )
        );
      }
    );

    microdetailMesh
      .instanceMatrix
      .needsUpdate =
      true;

    if (
      microdetailMesh
        .instanceColor
    ) {
      microdetailMesh
        .instanceColor
        .needsUpdate =
        true;
    }

    microdetailMesh.computeBoundingBox();
    microdetailMesh.computeBoundingSphere();

    microdetailMesh.matrixAutoUpdate =
      false;

    microdetailMesh.updateMatrix();

    root.add(
      microdetailMesh
    );
  }

  disableRaycastV32(
    root
  );

  root.matrixAutoUpdate =
    false;

  root.updateMatrix();

  scene.add(
    root
  );

  let disposed =
    false;

  function getSnapshot() {
    const clothingStyles =
      new Set(
        studentSprites.map(
          (sprite) =>
            deriveCharacterClothingProfileV32(
              resolveStudentKeyV32(
                sprite
              )
            ).clothingStyle
        )
      );

    return Object.freeze({
      id:
        CLASSROOM_REFERENCE_CHARACTER_DESK_V32_PROFILE
          .id,

      studentSpriteCount:
        studentSprites.length,

      uniqueClothingStyleCount:
        clothingStyles.size,

      decoratedAtlasCount,

      clothingCommandCount,

      deskMicrodetailInstanceCount:
        deskBlueprints.length,

      deskMicrodetailPerStudent:
        4,

      staticDrawCalls:
        microdetailMesh
          ? 1
          : 0,

      addedTextures:
        0,

      addedSpriteSystems:
        0,

      addedCharacterSystems:
        0,

      atlasRedrawPerRuntimeFrame:
        0,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversal:
        false,

      runtimeAnimation:
        false,

      v27BooksAndPapers:
        "untouched",

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

    /*
     * Restore the atlas to the exact state that existed
     * after V31 and before V32.
     *
     * World lifecycle disposes V32 before V31, therefore
     * V31 can subsequently restore its own original state.
     */

    for (
      const record
      of atlasRecords
    ) {
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
           * Cosmetic restoration must not become a
           * gameplay/lifecycle failure authority.
           */
        }
      }
    }

    scene.remove(
      root
    );

    microdetailGeometry?.dispose();
    microdetailMaterial?.dispose();
  }

  return Object.freeze({
    root,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_REFERENCE_CHARACTER_DESK_V32_PROFILE,
  applyCharacterClothingV32,
  buildCharacterClothingCommandsV32,
  createClassroomReferenceCharacterDeskMicrodetailV32,
  deriveCharacterClothingProfileV32,
  deriveDeskMicrodetailBlueprintsV32
};
