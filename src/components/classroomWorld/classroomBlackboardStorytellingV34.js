import * as THREE from "three";

import {
  stableHashStringV31
} from "./classroomCharacterSilhouettePolishV31.js";

const CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE =
  Object.freeze({
    id:
      "cw06-blackboard-storytelling-v34",

    artDirection:
      "high-detail-1990s-vga-pixel-art",

    blackboardDiscovery:
      "source-aware-existing-data-texture",

    lessonTheme:
      "reading-critical-thinking",

    teachingFragments:
      Object.freeze([
        "TODAY",
        "READ + THINK",
        "CLAIM",
        "EVIDENCE",
        "WHY HOW",
        "HW",
        "PAGE 42"
      ]),

    dateFragment:
      "24/11",

    chalkColors:
      Object.freeze([
        "warm-white",
        "cream",
        "cyan",
        "warm-orange"
      ]),

    eraserResidue:
      true,

    chalkUnderlines:
      true,

    homeworkBox:
      true,

    addedMeshes:
      0,

    addedMaterials:
      0,

    addedTextures:
      0,

    addedDrawCalls:
      0,

    textureMutationCount:
      1,

    constructionSceneTraversalCount:
      1,

    runtimeSceneTraversal:
      false,

    runtimeTick:
      false,

    runtimeTexturePainting:
      false,

    interactionAuthority:
      "preserved",

    collisionAuthority:
      "preserved",

    locomotionAuthority:
      "preserved",

    retroCompositionV4Authority:
      "preserved",

    visualOnly:
      true,

    deterministic:
      true
  });

const PIXEL_FONT_V34 =
  Object.freeze({
    A:
      Object.freeze([
        "010",
        "101",
        "111",
        "101",
        "101"
      ]),

    B:
      Object.freeze([
        "110",
        "101",
        "110",
        "101",
        "110"
      ]),

    C:
      Object.freeze([
        "011",
        "100",
        "100",
        "100",
        "011"
      ]),

    D:
      Object.freeze([
        "110",
        "101",
        "101",
        "101",
        "110"
      ]),

    E:
      Object.freeze([
        "111",
        "100",
        "110",
        "100",
        "111"
      ]),

    F:
      Object.freeze([
        "111",
        "100",
        "110",
        "100",
        "100"
      ]),

    G:
      Object.freeze([
        "011",
        "100",
        "101",
        "101",
        "011"
      ]),

    H:
      Object.freeze([
        "101",
        "101",
        "111",
        "101",
        "101"
      ]),

    I:
      Object.freeze([
        "111",
        "010",
        "010",
        "010",
        "111"
      ]),

    J:
      Object.freeze([
        "001",
        "001",
        "001",
        "101",
        "010"
      ]),

    K:
      Object.freeze([
        "101",
        "101",
        "110",
        "101",
        "101"
      ]),

    L:
      Object.freeze([
        "100",
        "100",
        "100",
        "100",
        "111"
      ]),

    M:
      Object.freeze([
        "101",
        "111",
        "111",
        "101",
        "101"
      ]),

    N:
      Object.freeze([
        "101",
        "111",
        "111",
        "111",
        "101"
      ]),

    O:
      Object.freeze([
        "010",
        "101",
        "101",
        "101",
        "010"
      ]),

    P:
      Object.freeze([
        "110",
        "101",
        "110",
        "100",
        "100"
      ]),

    Q:
      Object.freeze([
        "010",
        "101",
        "101",
        "011",
        "001"
      ]),

    R:
      Object.freeze([
        "110",
        "101",
        "110",
        "101",
        "101"
      ]),

    S:
      Object.freeze([
        "011",
        "100",
        "010",
        "001",
        "110"
      ]),

    T:
      Object.freeze([
        "111",
        "010",
        "010",
        "010",
        "010"
      ]),

    U:
      Object.freeze([
        "101",
        "101",
        "101",
        "101",
        "111"
      ]),

    V:
      Object.freeze([
        "101",
        "101",
        "101",
        "101",
        "010"
      ]),

    W:
      Object.freeze([
        "101",
        "101",
        "111",
        "111",
        "101"
      ]),

    X:
      Object.freeze([
        "101",
        "101",
        "010",
        "101",
        "101"
      ]),

    Y:
      Object.freeze([
        "101",
        "101",
        "010",
        "010",
        "010"
      ]),

    Z:
      Object.freeze([
        "111",
        "001",
        "010",
        "100",
        "111"
      ]),

    "0":
      Object.freeze([
        "111",
        "101",
        "101",
        "101",
        "111"
      ]),

    "1":
      Object.freeze([
        "010",
        "110",
        "010",
        "010",
        "111"
      ]),

    "2":
      Object.freeze([
        "110",
        "001",
        "010",
        "100",
        "111"
      ]),

    "3":
      Object.freeze([
        "110",
        "001",
        "010",
        "001",
        "110"
      ]),

    "4":
      Object.freeze([
        "101",
        "101",
        "111",
        "001",
        "001"
      ]),

    "5":
      Object.freeze([
        "111",
        "100",
        "110",
        "001",
        "110"
      ]),

    "6":
      Object.freeze([
        "011",
        "100",
        "111",
        "101",
        "111"
      ]),

    "7":
      Object.freeze([
        "111",
        "001",
        "010",
        "010",
        "010"
      ]),

    "8":
      Object.freeze([
        "111",
        "101",
        "111",
        "101",
        "111"
      ]),

    "9":
      Object.freeze([
        "111",
        "101",
        "111",
        "001",
        "110"
      ]),

    "+":
      Object.freeze([
        "000",
        "010",
        "111",
        "010",
        "000"
      ]),

    "/":
      Object.freeze([
        "001",
        "001",
        "010",
        "100",
        "100"
      ]),

    "-":
      Object.freeze([
        "000",
        "000",
        "111",
        "000",
        "000"
      ]),

    ":":
      Object.freeze([
        "000",
        "010",
        "000",
        "010",
        "000"
      ])
  });

const CHALK_V34 =
  Object.freeze({
    white:
      Object.freeze([
        226,
        220,
        187
      ]),

    cream:
      Object.freeze([
        211,
        187,
        133
      ]),

    cyan:
      Object.freeze([
        89,
        159,
        161
      ]),

    orange:
      Object.freeze([
        203,
        113,
        77
      ]),

    residue:
      Object.freeze([
        126,
        139,
        116
      ])
  });

function searchableTextV34(
  object
) {
  if (!object) {
    return "";
  }

  const values =
    [
      object.name,
      object.type,
      object.material?.name,
      object.material?.map?.name,
      object.userData?.role,
      object.userData?.kind,
      object.userData?.type,
      object.userData?.visualRole,
      object.userData?.classroomVisualAuthority
    ];

  return values
    .filter(
      (value) =>
        typeof value ===
          "string"
    )
    .join(" ")
    .toLowerCase();
}

function resolvePixelDataV34(
  texture
) {
  if (!texture) {
    return null;
  }

  const image =
    texture.image ??
    texture.source?.data ??
    null;

  const width =
    Number(
      image?.width ??
      0
    );

  const height =
    Number(
      image?.height ??
      0
    );

  const data =
    image?.data ??
    null;

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  if (
    !(
      data instanceof
        Uint8Array ||
      data instanceof
        Uint8ClampedArray
    )
  ) {
    return null;
  }

  if (
    data.length <
      width *
      height *
      4
  ) {
    return null;
  }

  return {
    texture,
    image,
    data,
    width,
    height
  };
}

function scoreBlackboardCandidateV34(
  object
) {
  if (
    !object ||
    object.isMesh !==
      true
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const pixelData =
    resolvePixelDataV34(
      object.material?.map
    );

  if (!pixelData) {
    return Number.NEGATIVE_INFINITY;
  }

  /*
   * Student character atlas must never be mistaken for
   * the board texture.
   */

  if (
    pixelData.width ===
      512 &&
    pixelData.height ===
      384
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  let score =
    0;

  const text =
    searchableTextV34(
      object
    );

  if (
    /chalkboard|blackboard/u
      .test(
        text
      )
  ) {
    score +=
      12;
  }
  else if (
    /\bboard\b|chalk/u
      .test(
        text
      )
  ) {
    score +=
      8;
  }

  if (
    object.geometry?.type ===
      "PlaneGeometry"
  ) {
    score +=
      3;
  }

  const width =
    Number(
      object.geometry?.parameters
        ?.width ??
      0
    );

  const height =
    Number(
      object.geometry?.parameters
        ?.height ??
      0
    );

  if (
    width > 0 &&
    height > 0 &&
    width / height >=
      1.5
  ) {
    score +=
      3;
  }

  if (
    pixelData.width >=
      64 &&
    pixelData.height >=
      24
  ) {
    score +=
      2;
  }

  const worldPosition =
    new THREE.Vector3();

  if (
    typeof object.getWorldPosition ===
      "function"
  ) {
    object.getWorldPosition(
      worldPosition
    );
  }
  else {
    worldPosition.copy(
      object.position
    );
  }

  /*
   * Current room's teaching wall is the negative-Z side.
   * This is only a ranking signal, not the primary ID.
   */

  if (
    worldPosition.z <
      -5
  ) {
    score +=
      3;
  }

  if (
    worldPosition.y >
      1 &&
    worldPosition.y <
      4
  ) {
    score +=
      2;
  }

  return score;
}

function findBlackboardCandidateV34(
  scene
) {
  let best =
    null;

  let bestScore =
    Number.NEGATIVE_INFINITY;

  let candidateCount =
    0;

  scene.traverse(
    (object) => {
      const score =
        scoreBlackboardCandidateV34(
          object
        );

      if (
        !Number.isFinite(
          score
        )
      ) {
        return;
      }

      candidateCount +=
        1;

      if (
        score >
        bestScore
      ) {
        best =
          object;

        bestScore =
          score;
      }
    }
  );

  return Object.freeze({
    board:
      bestScore >= 8
        ? best
        : null,

    score:
      bestScore,

    candidateCount
  });
}

function blendPixelV34({
  data,
  width,
  height,
  x,
  y,
  color,
  alpha = 1
}) {
  if (
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height
  ) {
    return 0;
  }

  const offset =
    (
      y *
        width +
      x
    ) *
    4;

  const inverse =
    1 -
    alpha;

  data[
    offset
  ] =
    Math.round(
      data[
        offset
      ] *
        inverse +
      color[0] *
        alpha
    );

  data[
    offset + 1
  ] =
    Math.round(
      data[
        offset + 1
      ] *
        inverse +
      color[1] *
        alpha
    );

  data[
    offset + 2
  ] =
    Math.round(
      data[
        offset + 2
      ] *
        inverse +
      color[2] *
        alpha
    );

  data[
    offset + 3
  ] =
    255;

  return 1;
}

function fillPixelBlockV34({
  data,
  width,
  height,
  x,
  y,
  blockWidth,
  blockHeight,
  color,
  alpha = 1
}) {
  let writes =
    0;

  for (
    let py = 0;
    py <
      blockHeight;
    py += 1
  ) {
    for (
      let px = 0;
      px <
        blockWidth;
      px += 1
    ) {
      writes +=
        blendPixelV34({
          data,
          width,
          height,

          x:
            x +
            px,

          y:
            y +
            py,

          color,
          alpha
        });
    }
  }

  return writes;
}

function drawPixelTextV34({
  data,
  width,
  height,
  text,
  x,
  y,
  scale = 1,
  color,
  alpha = 1
}) {
  let cursorX =
    x;

  let writes =
    0;

  for (
    const rawCharacter
    of String(
      text
    ).toUpperCase()
  ) {
    if (
      rawCharacter ===
      " "
    ) {
      cursorX +=
        4 *
        scale;

      continue;
    }

    const glyph =
      PIXEL_FONT_V34[
        rawCharacter
      ];

    if (!glyph) {
      cursorX +=
        4 *
        scale;

      continue;
    }

    glyph.forEach(
      (
        row,
        rowIndex
      ) => {
        for (
          let column = 0;
          column <
            row.length;
          column += 1
        ) {
          if (
            row[column] !==
            "1"
          ) {
            continue;
          }

          writes +=
            fillPixelBlockV34({
              data,
              width,
              height,

              x:
                cursorX +
                column *
                  scale,

              y:
                y +
                rowIndex *
                  scale,

              blockWidth:
                scale,

              blockHeight:
                scale,

              color,
              alpha
            });
        }
      }
    );

    cursorX +=
      4 *
      scale;
  }

  return Object.freeze({
    writes,

    endX:
      cursorX
  });
}

function drawHorizontalStrokeV34({
  data,
  width,
  height,
  x,
  y,
  length,
  color,
  alpha = 1
}) {
  return fillPixelBlockV34({
    data,
    width,
    height,
    x,
    y,

    blockWidth:
      Math.max(
        1,
        length
      ),

    blockHeight:
      1,

    color,
    alpha
  });
}

function drawBoxV34({
  data,
  width,
  height,
  x,
  y,
  boxWidth,
  boxHeight,
  color,
  alpha = 1
}) {
  let writes =
    0;

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,
      x,
      y,

      length:
        boxWidth,

      color,
      alpha
    });

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,
      x,

      y:
        y +
        boxHeight -
        1,

      length:
        boxWidth,

      color,
      alpha
    });

  writes +=
    fillPixelBlockV34({
      data,
      width,
      height,
      x,
      y,

      blockWidth:
        1,

      blockHeight:
        boxHeight,

      color,
      alpha
    });

  writes +=
    fillPixelBlockV34({
      data,
      width,
      height,

      x:
        x +
        boxWidth -
        1,

      y,

      blockWidth:
        1,

      blockHeight:
        boxHeight,

      color,
      alpha
    });

  return writes;
}

function applyEraserResidueV34({
  data,
  width,
  height
}) {
  let writes =
    0;

  const seed =
    stableHashStringV31(
      `board-${width}x${height}`
    );

  const startX =
    Math.max(
      3,
      Math.floor(
        width *
        0.08
      )
    );

  const endX =
    Math.min(
      width - 3,
      Math.floor(
        width *
        0.94
      )
    );

  const startY =
    Math.max(
      3,
      Math.floor(
        height *
        0.10
      )
    );

  const endY =
    Math.min(
      height - 3,
      Math.floor(
        height *
        0.90
      )
    );

  for (
    let y = startY;
    y < endY;
    y += 1
  ) {
    for (
      let x = startX;
      x < endX;
      x += 1
    ) {
      const value =
        (
          (
            x *
            37
          ) +
          (
            y *
            53
          ) +
          seed
        ) >>>
        0;

      if (
        value %
          41 !==
        0
      ) {
        continue;
      }

      writes +=
        blendPixelV34({
          data,
          width,
          height,
          x,
          y,

          color:
            CHALK_V34
              .residue,

          alpha:
            0.12
        });
    }
  }

  /*
   * Broad previous-erasure ghosts.
   */

  const ghostY =
    Math.max(
      4,
      Math.floor(
        height *
        0.69
      )
    );

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,

      x:
        Math.floor(
          width *
          0.12
        ),

      y:
        ghostY,

      length:
        Math.floor(
          width *
          0.28
        ),

      color:
        CHALK_V34
          .residue,

      alpha:
        0.10
    });

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,

      x:
        Math.floor(
          width *
          0.47
        ),

      y:
        ghostY +
        3,

      length:
        Math.floor(
          width *
          0.22
        ),

      color:
        CHALK_V34
          .residue,

      alpha:
        0.08
    });

  return writes;
}

function paintBlackboardTeachingStoryV34(
  pixelData
) {
  const {
    data,
    width,
    height
  } =
    pixelData;

  let writes =
    0;

  writes +=
    applyEraserResidueV34({
      data,
      width,
      height
    });

  const baseScale =
    width >=
      220 &&
    height >=
      100
      ? 2
      : 1;

  const marginX =
    Math.max(
      4,
      Math.floor(
        width *
        0.055
      )
    );

  const marginY =
    Math.max(
      3,
      Math.floor(
        height *
        0.08
      )
    );

  const rightColumnX =
    Math.max(
      marginX +
        55 *
        baseScale,

      Math.floor(
        width *
        0.64
      )
    );

  const heading =
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "TODAY",

      x:
        marginX,

      y:
        marginY,

      scale:
        baseScale,

      color:
        CHALK_V34
          .cream
    });

  writes +=
    heading.writes;

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,

      x:
        marginX,

      y:
        marginY +
        7 *
        baseScale,

      length:
        Math.min(
          width -
            marginX -
            4,

          31 *
            baseScale
        ),

      color:
        CHALK_V34
          .orange,

      alpha:
        0.92
    });

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "READ + THINK",

      x:
        marginX,

      y:
        marginY +
        11 *
        baseScale,

      scale:
        baseScale,

      color:
        CHALK_V34
          .white
    }).writes;

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "CLAIM",

      x:
        marginX,

      y:
        marginY +
        22 *
        baseScale,

      scale:
        baseScale,

      color:
        CHALK_V34
          .cyan
    }).writes;

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,

      x:
        marginX,

      y:
        marginY +
        29 *
        baseScale,

      length:
        Math.min(
          24 *
            baseScale,

          width -
            marginX -
            2
        ),

      color:
        CHALK_V34
          .cyan,

      alpha:
        0.72
    });

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "EVIDENCE",

      x:
        marginX,

      y:
        marginY +
        33 *
        baseScale,

      scale:
        baseScale,

      color:
        CHALK_V34
          .white,

      alpha:
        0.94
    }).writes;

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "WHY HOW",

      x:
        marginX,

      y:
        marginY +
        44 *
        baseScale,

      scale:
        baseScale,

      color:
        CHALK_V34
          .cream,

      alpha:
        0.90
    }).writes;

  /*
   * Right-hand side:
   * date + small homework block.
   */

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "24/11",

      x:
        rightColumnX,

      y:
        marginY,

      scale:
        baseScale,

      color:
        CHALK_V34
          .cyan,

      alpha:
        0.92
    }).writes;

  const homeworkY =
    marginY +
    25 *
    baseScale;

  const homeworkWidth =
    Math.max(
      27 *
        baseScale,

      32
    );

  const homeworkHeight =
    Math.max(
      20 *
        baseScale,

      18
    );

  if (
    rightColumnX +
      homeworkWidth <
      width - 2 &&
    homeworkY +
      homeworkHeight <
      height - 2
  ) {
    writes +=
      drawBoxV34({
        data,
        width,
        height,

        x:
          rightColumnX -
          2,

        y:
          homeworkY -
          3,

        boxWidth:
          homeworkWidth,

        boxHeight:
          homeworkHeight,

        color:
          CHALK_V34
            .orange,

        alpha:
          0.78
      });
  }

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "HW",

      x:
        rightColumnX,

      y:
        homeworkY,

      scale:
        baseScale,

      color:
        CHALK_V34
          .orange
    }).writes;

  writes +=
    drawPixelTextV34({
      data,
      width,
      height,

      text:
        "PAGE 42",

      x:
        rightColumnX,

      y:
        homeworkY +
        8 *
        baseScale,

      scale:
        baseScale,

      color:
        CHALK_V34
          .white,

      alpha:
        0.92
    }).writes;

  /*
   * Small teaching arrows / hierarchy marks.
   */

  const arrowX =
    marginX +
    38 *
    baseScale;

  const arrowY =
    marginY +
    25 *
    baseScale;

  writes +=
    drawHorizontalStrokeV34({
      data,
      width,
      height,
      x:
        arrowX,
      y:
        arrowY,

      length:
        8 *
        baseScale,

      color:
        CHALK_V34
          .orange,

      alpha:
        0.82
    });

  writes +=
    fillPixelBlockV34({
      data,
      width,
      height,

      x:
        arrowX +
        7 *
        baseScale,

      y:
        arrowY -
        1,

      blockWidth:
        1 +
        baseScale,

      blockHeight:
        3,

      color:
        CHALK_V34
          .orange,

      alpha:
        0.82
    });

  return Object.freeze({
    pixelWriteCount:
      writes,

    width,

    height,

    baseScale,

    contentFragments:
      CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE
        .teachingFragments
  });
}

function applyBlackboardStorytellingV34(
  board
) {
  const texture =
    board?.material?.map ??
    null;

  const pixelData =
    resolvePixelDataV34(
      texture
    );

  if (!pixelData) {
    return Object.freeze({
      applied:
        false,

      texture:
        null,

      backup:
        null,

      pixelWriteCount:
        0,

      width:
        0,

      height:
        0
    });
  }

  const backup =
    new Uint8Array(
      pixelData.data
    );

  const originalSampling =
    Object.freeze({
      magFilter:
        texture.magFilter,

      minFilter:
        texture.minFilter,

      generateMipmaps:
        texture.generateMipmaps,

      colorSpace:
        texture.colorSpace,

      anisotropy:
        texture.anisotropy
    });

  const result =
    paintBlackboardTeachingStoryV34(
      pixelData
    );

  /*
   * Do NOT change filtering, dimensions, format, type or
   * color-space. Only upload new pixels into the existing
   * V4 texture.
   */

  texture.needsUpdate =
    true;

  return Object.freeze({
    applied:
      true,

    texture,

    data:
      pixelData.data,

    backup,

    width:
      pixelData.width,

    height:
      pixelData.height,

    pixelWriteCount:
      result.pixelWriteCount,

    baseScale:
      result.baseScale,

    originalSampling
  });
}

function restoreBlackboardStorytellingV34(
  mutation
) {
  if (
    !mutation?.applied ||
    !mutation.data ||
    !mutation.backup
  ) {
    return false;
  }

  mutation.data.set(
    mutation.backup
  );

  if (
    mutation.texture
  ) {
    mutation.texture.needsUpdate =
      true;
  }

  return true;
}

function createClassroomBlackboardStorytellingV34({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V34 requires THREE.Scene"
    );
  }

  const discovery =
    findBlackboardCandidateV34(
      scene
    );

  if (!discovery.board) {
    throw new Error(
      "V34 could not discover canonical blackboard DataTexture"
    );
  }

  const board =
    discovery.board;

  const mutation =
    applyBlackboardStorytellingV34(
      board
    );

  if (
    !mutation.applied
  ) {
    throw new Error(
      "V34 could not mutate canonical blackboard texture"
    );
  }

  let disposed =
    false;

  function getSnapshot() {
    const texture =
      mutation.texture;

    return Object.freeze({
      id:
        CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE
          .id,

      boardFound:
        true,

      boardScore:
        discovery.score,

      candidateCount:
        discovery.candidateCount,

      boardTextureWidth:
        mutation.width,

      boardTextureHeight:
        mutation.height,

      pixelWriteCount:
        mutation.pixelWriteCount,

      baseScale:
        mutation.baseScale,

      teachingFragmentCount:
        CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE
          .teachingFragments
          .length,

      eraserResidue:
        true,

      addedMeshes:
        0,

      addedMaterials:
        0,

      addedTextures:
        0,

      addedDrawCalls:
        0,

      textureMutationCount:
        1,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversal:
        false,

      runtimeTick:
        false,

      runtimeTexturePainting:
        false,

      textureMagFilterPreserved:
        texture.magFilter ===
        mutation.originalSampling
          .magFilter,

      textureMinFilterPreserved:
        texture.minFilter ===
        mutation.originalSampling
          .minFilter,

      textureMipmapsPreserved:
        texture.generateMipmaps ===
        mutation.originalSampling
          .generateMipmaps,

      textureColorSpacePreserved:
        texture.colorSpace ===
        mutation.originalSampling
          .colorSpace,

      textureAnisotropyPreserved:
        texture.anisotropy ===
        mutation.originalSampling
          .anisotropy,

      interactionAuthority:
        "preserved",

      collisionAuthority:
        "preserved",

      locomotionAuthority:
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

    restoreBlackboardStorytellingV34(
      mutation
    );
  }

  return Object.freeze({
    board,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE,
  PIXEL_FONT_V34,
  applyBlackboardStorytellingV34,
  createClassroomBlackboardStorytellingV34,
  drawPixelTextV34,
  findBlackboardCandidateV34,
  paintBlackboardTeachingStoryV34,
  resolvePixelDataV34,
  restoreBlackboardStorytellingV34,
  scoreBlackboardCandidateV34
};
