import * as THREE from "three";

import {
  CHARACTER_ATLAS_HEIGHT_V31,
  CHARACTER_ATLAS_WIDTH_V31,
  CHARACTER_DIRECTION_COUNT_V31,
  CHARACTER_FRAME_HEIGHT_V31,
  CHARACTER_FRAME_WIDTH_V31,
  CHARACTER_IDLE_FRAME_COUNT_V31,
  isV9StudentSpriteV31,
  stableHashStringV31
} from "./classroomCharacterSilhouettePolishV31.js";

const CLASSROOM_PIXEL_FACE_LIVED_IN_V33_PROFILE =
  Object.freeze({
    id:
      "cw06-pixel-face-lived-in-v33",

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

    expressionStyleCount:
      6,

    visibleFaceDirectionCount:
      5,

    backFaceDirectionCount:
      3,

    deskLivedInMarksPerStudent:
      3,

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

    runtimeAnimationSystem:
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

    v31Silhouette:
      "preserved",

    v32Clothing:
      "preserved",

    visualOnly:
      true,

    deterministic:
      true
  });

const FACE_PALETTES_V33 =
  Object.freeze([
    Object.freeze({
      ink:
        "#211722",

      softInk:
        "#4f343b",

      eyeLight:
        "#ead6b3",

      warm:
        "#c77358"
    }),

    Object.freeze({
      ink:
        "#241824",

      softInk:
        "#593d43",

      eyeLight:
        "#dfc9aa",

      warm:
        "#bd6c56"
    }),

    Object.freeze({
      ink:
        "#1f1824",

      softInk:
        "#4b3b4c",

      eyeLight:
        "#e5d5bc",

      warm:
        "#ca765d"
    })
  ]);

const DESK_MARK_COLORS_V33 =
  Object.freeze({
    label:
      Object.freeze([
        0xd5b66f,
        0x6c9ca1,
        0xc4765b,
        0x927085
      ]),

    tape:
      Object.freeze([
        0xd8cda1,
        0xb6a77a,
        0x8eb0ac,
        0xd5a58e
      ]),

    chip:
      Object.freeze([
        0x3c2830,
        0x4b3235,
        0x2f303b,
        0x513634
      ])
  });

function resolveStudentKeyV33(
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

function resolveAtlasImageV33(
  texture
) {
  return (
    texture?.image ??
    texture?.source?.data ??
    null
  );
}

function derivePixelExpressionProfileV33(
  studentKey
) {
  const key =
    String(
      studentKey ??
      "student"
    );

  const hash =
    stableHashStringV31(
      "face-v33:" +
      key
    );

  return Object.freeze({
    studentKey:
      key,

    hash,

    expressionStyle:
      hash %
      6,

    blinkFrame:
      (
        hash >>>
        8
      ) %
      4,

    browClass:
      (
        hash >>>
        12
      ) %
      3,

    mouthClass:
      (
        hash >>>
        16
      ) %
      3,

    facePalette:
      FACE_PALETTES_V33[
        (
          hash >>>
          20
        ) %
        FACE_PALETTES_V33.length
      ]
  });
}

function commandV33({
  frameIndex,
  directionIndex,
  idleFrame,
  semantic,
  x,
  y,
  width,
  height,
  color
}) {
  return Object.freeze({
    frameIndex,
    directionIndex,
    idleFrame,
    semantic,
    x,
    y,
    width,
    height,
    color
  });
}

function commandWithinAtlasV33(
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

function pushFaceCommandsV33({
  commands,
  frameIndex,
  frameX,
  frameY,
  directionIndex,
  idleFrame,
  profile
}) {
  /*
   * Existing V9/V25 directional convention:
   *
   * 3 / 4 / 5 = rear-facing cluster
   * 2         = right profile
   * 6         = left profile
   * 0 / 1 / 7 = front / front-quarter cluster
   *
   * Back-facing cells deliberately receive no facial pixels.
   */

  const isBack =
    directionIndex >= 3 &&
    directionIndex <= 5;

  if (isBack) {
    return;
  }

  const isRightProfile =
    directionIndex === 2;

  const isLeftProfile =
    directionIndex === 6;

  const isProfile =
    isRightProfile ||
    isLeftProfile;

  const palette =
    profile.facePalette;

  const idleLift =
    [
      0,
      -1,
      0,
      1
    ][
      idleFrame
    ];

  const quarterShift =
    directionIndex === 1
      ? 1
      : (
          directionIndex === 7
            ? -1
            : 0
        );

  const eyeY =
    frameY +
    27 +
    idleLift;

  const browY =
    eyeY -
    3;

  const noseY =
    eyeY +
    4;

  const mouthY =
    eyeY +
    8;

  const blinking =
    idleFrame ===
    profile.blinkFrame;

  /*
   * FRONT / QUARTER FACE.
   */

  if (!isProfile) {
    const leftEyeX =
      frameX +
      27 +
      quarterShift;

    const rightEyeX =
      frameX +
      35 +
      quarterShift;

    if (blinking) {
      commands.push(
        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "blink-left",

          x:
            leftEyeX,

          y:
            eyeY,

          width: 3,
          height: 1,

          color:
            palette.ink
        }),

        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "blink-right",

          x:
            rightEyeX,

          y:
            eyeY,

          width: 3,
          height: 1,

          color:
            palette.ink
        })
      );
    }
    else {
      commands.push(
        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "eye-left",

          x:
            leftEyeX,

          y:
            eyeY,

          width: 2,
          height: 2,

          color:
            palette.ink
        }),

        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "eye-left-light",

          x:
            leftEyeX + 1,

          y:
            eyeY,

          width: 1,
          height: 1,

          color:
            palette.eyeLight
        }),

        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "eye-right",

          x:
            rightEyeX,

          y:
            eyeY,

          width: 2,
          height: 2,

          color:
            palette.ink
        }),

        commandV33({
          frameIndex,
          directionIndex,
          idleFrame,
          semantic:
            "eye-right-light",

          x:
            rightEyeX,

          y:
            eyeY,

          width: 1,
          height: 1,

          color:
            palette.eyeLight
        })
      );
    }

    let leftBrowY =
      browY;

    let rightBrowY =
      browY;

    if (
      profile.expressionStyle ===
      3
    ) {
      leftBrowY -=
        1;
    }

    if (
      profile.expressionStyle ===
      4
    ) {
      rightBrowY -=
        1;
    }

    if (
      profile.expressionStyle ===
      5
    ) {
      leftBrowY +=
        1;

      rightBrowY +=
        1;
    }

    commands.push(
      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "brow-left",

        x:
          leftEyeX - 1,

        y:
          leftBrowY,

        width: 4,
        height: 1,

        color:
          palette.softInk
      }),

      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "brow-right",

        x:
          rightEyeX - 1,

        y:
          rightBrowY,

        width: 4,
        height: 1,

        color:
          palette.softInk
      }),

      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "nose-shadow",

        x:
          frameX +
          32 +
          quarterShift,

        y:
          noseY,

        width: 2,
        height: 2,

        color:
          palette.softInk
      })
    );

    switch (
      profile.expressionStyle
    ) {
      case 1:
        /*
         * Soft smile.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-smile-left",

            x:
              frameX +
              29 +
              quarterShift,

            y:
              mouthY,

            width: 2,
            height: 1,

            color:
              palette.ink
          }),

          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-smile-center",

            x:
              frameX +
              31 +
              quarterShift,

            y:
              mouthY +
              1,

            width: 4,
            height: 1,

            color:
              palette.softInk
          }),

          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-smile-right",

            x:
              frameX +
              35 +
              quarterShift,

            y:
              mouthY,

            width: 2,
            height: 1,

            color:
              palette.ink
          })
        );

        break;

      case 2:
        /*
         * Attentive / slightly open.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-attentive",

            x:
              frameX +
              31 +
              quarterShift,

            y:
              mouthY,

            width: 4,
            height: 2,

            color:
              palette.ink
          }),

          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-attentive-light",

            x:
              frameX +
              32 +
              quarterShift,

            y:
              mouthY,

            width: 2,
            height: 1,

            color:
              palette.warm
          })
        );

        break;

      case 3:
        /*
         * Curious.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-curious",

            x:
              frameX +
              31 +
              quarterShift,

            y:
              mouthY,

            width: 4,
            height: 1,

            color:
              palette.softInk
          }),

          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "cheek-curious",

            x:
              frameX +
              38 +
              quarterShift,

            y:
              mouthY - 2,

            width: 2,
            height: 1,

            color:
              palette.warm
          })
        );

        break;

      case 4:
        /*
         * Concentrating.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-focused",

            x:
              frameX +
              30 +
              quarterShift,

            y:
              mouthY,

            width: 6,
            height: 1,

            color:
              palette.ink
          })
        );

        break;

      case 5:
        /*
         * Thoughtful.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-thoughtful",

            x:
              frameX +
              32 +
              quarterShift,

            y:
              mouthY,

            width: 4,
            height: 1,

            color:
              palette.softInk
          }),

          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "cheek-thoughtful",

            x:
              frameX +
              27 +
              quarterShift,

            y:
              mouthY - 1,

            width: 2,
            height: 1,

            color:
              palette.warm
          })
        );

        break;

      default:
        /*
         * Neutral.
         */
        commands.push(
          commandV33({
            frameIndex,
            directionIndex,
            idleFrame,
            semantic:
              "mouth-neutral",

            x:
              frameX +
              30 +
              quarterShift,

            y:
              mouthY,

            width: 6,
            height: 1,

            color:
              palette.softInk
          })
        );
    }

    return;
  }

  /*
   * PROFILE FACE.
   *
   * Keep this deliberately tiny. One eye, brow, nose and
   * mouth reads better than trying to force two frontal eyes
   * onto a side-facing pixel head.
   */

  const profileX =
    isRightProfile
      ? frameX + 38
      : frameX + 26;

  const directionSign =
    isRightProfile
      ? 1
      : -1;

  if (blinking) {
    commands.push(
      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "profile-blink",

        x:
          profileX -
          (
            isRightProfile
              ? 1
              : 0
          ),

        y:
          eyeY,

        width: 3,
        height: 1,

        color:
          palette.ink
      })
    );
  }
  else {
    commands.push(
      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "profile-eye",

        x:
          profileX,

        y:
          eyeY,

        width: 2,
        height: 2,

        color:
          palette.ink
      }),

      commandV33({
        frameIndex,
        directionIndex,
        idleFrame,
        semantic:
          "profile-eye-light",

        x:
          profileX,

        y:
          eyeY,

        width: 1,
        height: 1,

        color:
          palette.eyeLight
      })
    );
  }

  commands.push(
    commandV33({
      frameIndex,
      directionIndex,
      idleFrame,
      semantic:
        "profile-brow",

      x:
        profileX -
        (
          isRightProfile
            ? 1
            : 2
        ),

      y:
        browY,

      width: 3,
      height: 1,

      color:
        palette.softInk
    }),

    commandV33({
      frameIndex,
      directionIndex,
      idleFrame,
      semantic:
        "profile-nose",

      x:
        profileX +
        directionSign,

      y:
        noseY,

      width: 2,
      height: 2,

      color:
        palette.softInk
    }),

    commandV33({
      frameIndex,
      directionIndex,
      idleFrame,
      semantic:
        "profile-mouth",

      x:
        profileX -
        (
          isRightProfile
            ? 0
            : 2
        ),

      y:
        mouthY,

      width: 3,
      height: 1,

      color:
        profile.expressionStyle ===
          1
          ? palette.warm
          : palette.ink
    })
  );
}

function buildPixelFaceExpressionCommandsV33(
  studentKey
) {
  const profile =
    derivePixelExpressionProfileV33(
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

      pushFaceCommandsV33({
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

function applyPixelFaceExpressionV33({
  texture,
  studentKey
}) {
  const image =
    resolveAtlasImageV33(
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
    buildPixelFaceExpressionCommandsV33(
      studentKey
    );

  for (
    const command
    of commands
  ) {
    if (
      !commandWithinAtlasV33(
        command
      )
    ) {
      throw new RangeError(
        "V33 face decoration escaped atlas bounds"
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

function resolveSpriteWorldPositionV33(
  sprite
) {
  const result =
    new THREE.Vector3();

  if (
    typeof sprite.getWorldPosition ===
      "function"
  ) {
    sprite.getWorldPosition(
      result
    );

    return result;
  }

  result.set(
    sprite.position?.x ??
      0,

    sprite.position?.y ??
      0,

    sprite.position?.z ??
      0
  );

  return result;
}

function deriveDeskLivedInBlueprintsV33({
  sprite,
  studentKey,
  studentIndex
}) {
  const position =
    resolveSpriteWorldPositionV33(
      sprite
    );

  const hash =
    stableHashStringV31(
      "lived-in-v33:" +
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

  const colorIndex =
    hash %
    4;

  const yaw =
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
    0.018;

  const deskZ =
    position.z -
    0.64;

  return Object.freeze([
    Object.freeze({
      studentIndex,
      studentKey,

      type:
        "desk-label",

      position:
        Object.freeze({
          x:
            position.x +
            side *
            0.17,

          y:
            0.886,

          z:
            deskZ -
            0.25
        }),

      rotationY:
        yaw,

      scale:
        Object.freeze({
          x:
            0.31,

          y:
            0.018,

          z:
            0.075
        }),

      color:
        DESK_MARK_COLORS_V33
          .label[
            colorIndex
          ]
    }),

    Object.freeze({
      studentIndex,
      studentKey,

      type:
        "tape-tab",

      position:
        Object.freeze({
          x:
            position.x -
            side *
            0.30,

          y:
            0.892,

          z:
            deskZ +
            0.16
        }),

      rotationY:
        -yaw *
        1.4,

      scale:
        Object.freeze({
          x:
            0.16,

          y:
            0.012,

          z:
            0.045
        }),

      color:
        DESK_MARK_COLORS_V33
          .tape[
            colorIndex
          ]
    }),

    Object.freeze({
      studentIndex,
      studentKey,

      type:
        "desk-edge-chip",

      position:
        Object.freeze({
          x:
            position.x +
            side *
            0.38,

          y:
            0.843,

          z:
            deskZ -
            0.30
        }),

      rotationY:
        yaw *
        0.4,

      scale:
        Object.freeze({
          x:
            0.11,

          y:
            0.040,

          z:
            0.035
        }),

      color:
        DESK_MARK_COLORS_V33
          .chip[
            colorIndex
          ]
    })
  ]);
}

function disableRaycastV33(
  object
) {
  object.raycast =
    function noV33Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V33:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  return object;
}

function createClassroomPixelFaceLivedInPolishV33({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V33 requires THREE.Scene"
    );
  }

  const studentSprites =
    [];

  /*
   * ONE construction-time traversal only.
   * No runtime scene searching.
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

  const livedInBlueprints =
    [];

  let decoratedAtlasCount =
    0;

  let faceCommandCount =
    0;

  studentSprites.forEach(
    (
      sprite,
      studentIndex
    ) => {
      const studentKey =
        resolveStudentKeyV33(
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
          applyPixelFaceExpressionV33({
            texture,
            studentKey
          });

        if (
          decoration.decorated
        ) {
          decoratedAtlasCount +=
            1;

          faceCommandCount +=
            decoration.commandCount;
        }
      }

      atlasRecords.push({
        texture,
        decoration
      });

      livedInBlueprints.push(
        ...deriveDeskLivedInBlueprintsV33({
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
    "classroom-pixel-face-lived-in-polish-v33";

  root.userData = {
    cw06V33:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true
  };

  let livedInMesh =
    null;

  let livedInGeometry =
    null;

  let livedInMaterial =
    null;

  if (
    livedInBlueprints.length >
    0
  ) {
    /*
     * Label strip, tape tab and desk-edge chip all share
     * one primitive geometry and one material.
     *
     * Scale + per-instance color provide visual variety
     * without one draw call per object.
     */

    livedInGeometry =
      new THREE.BoxGeometry(
        1,
        1,
        1
      );

    livedInMaterial =
      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        toneMapped:
          false
      });

    livedInMesh =
      new THREE.InstancedMesh(
        livedInGeometry,
        livedInMaterial,
        livedInBlueprints.length
      );

    livedInMesh.name =
      "cw06-v33-student-desk-lived-in-marks";

    livedInMesh.layers.set(
      30
    );

    livedInMesh.castShadow =
      false;

    livedInMesh.receiveShadow =
      false;

    disableRaycastV33(
      livedInMesh
    );

    const dummy =
      new THREE.Object3D();

    livedInBlueprints.forEach(
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

        livedInMesh.setMatrixAt(
          index,
          dummy.matrix
        );

        livedInMesh.setColorAt(
          index,
          new THREE.Color(
            item.color
          )
        );
      }
    );

    livedInMesh
      .instanceMatrix
      .needsUpdate =
      true;

    if (
      livedInMesh.instanceColor
    ) {
      livedInMesh
        .instanceColor
        .needsUpdate =
        true;
    }

    livedInMesh.computeBoundingBox();
    livedInMesh.computeBoundingSphere();

    livedInMesh.matrixAutoUpdate =
      false;

    livedInMesh.updateMatrix();

    root.add(
      livedInMesh
    );
  }

  disableRaycastV33(
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
    const expressions =
      new Set(
        studentSprites.map(
          (sprite) =>
            derivePixelExpressionProfileV33(
              resolveStudentKeyV33(
                sprite
              )
            ).expressionStyle
        )
      );

    const blinkFrames =
      new Set(
        studentSprites.map(
          (sprite) =>
            derivePixelExpressionProfileV33(
              resolveStudentKeyV33(
                sprite
              )
            ).blinkFrame
        )
      );

    return Object.freeze({
      id:
        CLASSROOM_PIXEL_FACE_LIVED_IN_V33_PROFILE
          .id,

      studentSpriteCount:
        studentSprites.length,

      uniqueExpressionStyleCount:
        expressions.size,

      uniqueBlinkFrameCount:
        blinkFrames.size,

      decoratedAtlasCount,

      faceCommandCount,

      livedInInstanceCount:
        livedInBlueprints.length,

      livedInMarksPerStudent:
        3,

      staticDrawCalls:
        livedInMesh
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

      runtimeAnimationSystem:
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

    /*
     * V33 was constructed after V32.
     * Restore exactly to the post-V32 atlas state.
     *
     * The world will dispose:
     *
     * V33 -> V32 -> V31
     *
     * so each visual pass restores its own predecessor.
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
           * Cosmetic restoration must never acquire
           * lifecycle/gameplay failure authority.
           */
        }
      }
    }

    scene.remove(
      root
    );

    livedInGeometry?.dispose();
    livedInMaterial?.dispose();
  }

  return Object.freeze({
    root,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_PIXEL_FACE_LIVED_IN_V33_PROFILE,
  applyPixelFaceExpressionV33,
  buildPixelFaceExpressionCommandsV33,
  createClassroomPixelFaceLivedInPolishV33,
  deriveDeskLivedInBlueprintsV33,
  derivePixelExpressionProfileV33
};
