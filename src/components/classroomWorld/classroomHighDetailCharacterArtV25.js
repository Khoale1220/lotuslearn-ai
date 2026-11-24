const CHARACTER_ART_V25_PROFILE =
  Object.freeze({
    id:
      "cw06-high-detail-character-v25",

    artDirection:
      "high-detail-1990s-vga-character",

    frameWidth:
      64,

    frameHeight:
      96,

    directionCount:
      8,

    idleFrameCount:
      4,

    atlasWidth:
      512,

    atlasHeight:
      384,

    atlasFrameCount:
      32,

    runtimeAtlasRedraw:
      0,

    progressiveEnhancement:
      true,

    visualOnly:
      true,

    deterministic:
      true
  });

const CHARACTER_ART_V25_PALETTE =
  Object.freeze({
    ink:
      "#080615",

    deepPlum:
      "#24152d",

    hairHighlight:
      "#9d6859",

    skinShadow:
      "#985444",

    skinHighlight:
      "#efbf86",

    eyeHighlight:
      "#ffe7b0",

    mouth:
      "#813d45",

    clothShadow:
      "#342139",

    clothHighlight:
      "#cb8a67"
  });

const FACE_MODE_BY_DIRECTION_V25 =
  Object.freeze([
    "front",
    "front-three-quarter",
    "side",
    "back-three-quarter",
    "back",
    "back-three-quarter",
    "side",
    "front-three-quarter"
  ]);

function hasCharacterPixelReadbackV25(
  context
) {
  return Boolean(
    context &&
    typeof context.getImageData ===
      "function" &&
    typeof context.fillRect ===
      "function"
  );
}

function isOpaqueV25({
  data,
  width,
  height,
  x,
  y
}) {
  if (
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height
  ) {
    return false;
  }

  const index =
    (
      y * width +
      x
    ) * 4;

  return (
    data[index + 3] >
    48
  );
}

function findBoundsV25({
  data,
  width,
  height
}) {
  let minX =
    width;

  let minY =
    height;

  let maxX =
    -1;

  let maxY =
    -1;

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      if (
        !isOpaqueV25({
          data,
          width,
          height,
          x,
          y
        })
      ) {
        continue;
      }

      minX =
        Math.min(
          minX,
          x
        );

      minY =
        Math.min(
          minY,
          y
        );

      maxX =
        Math.max(
          maxX,
          x
        );

      maxY =
        Math.max(
          maxY,
          y
        );
    }
  }

  if (
    maxX < minX ||
    maxY < minY
  ) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,

    width:
      maxX -
      minX +
      1,

    height:
      maxY -
      minY +
      1
  };
}

function paintOpaquePixelV25({
  context,
  data,
  width,
  height,
  originX,
  originY,
  x,
  y,
  color
}) {
  const px =
    Math.round(
      x
    );

  const py =
    Math.round(
      y
    );

  if (
    !isOpaqueV25({
      data,
      width,
      height,
      x:
        px,
      y:
        py
    })
  ) {
    return 0;
  }

  context.fillStyle =
    color;

  context.fillRect(
    originX + px,
    originY + py,
    1,
    1
  );

  return 1;
}

function paintOpaqueClusterV25({
  context,
  data,
  width,
  height,
  originX,
  originY,
  x,
  y,
  clusterWidth,
  clusterHeight,
  color
}) {
  let count =
    0;

  for (
    let row = 0;
    row < clusterHeight;
    row += 1
  ) {
    for (
      let column = 0;
      column < clusterWidth;
      column += 1
    ) {
      count +=
        paintOpaquePixelV25({
          context,
          data,
          width,
          height,
          originX,
          originY,

          x:
            x + column,

          y:
            y + row,

          color
        });
    }
  }

  return count;
}

function paintOutlineV25({
  context,
  data,
  width,
  height,
  originX,
  originY
}) {
  const pixels =
    [];

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      if (
        isOpaqueV25({
          data,
          width,
          height,
          x,
          y
        })
      ) {
        continue;
      }

      const adjacent =
        isOpaqueV25({
          data,
          width,
          height,
          x:
            x - 1,
          y
        }) ||
        isOpaqueV25({
          data,
          width,
          height,
          x:
            x + 1,
          y
        }) ||
        isOpaqueV25({
          data,
          width,
          height,
          x,
          y:
            y - 1
        }) ||
        isOpaqueV25({
          data,
          width,
          height,
          x,
          y:
            y + 1
        });

      if (adjacent) {
        pixels.push([
          x,
          y
        ]);
      }
    }
  }

  context.fillStyle =
    CHARACTER_ART_V25_PALETTE
      .ink;

  for (
    const [
      x,
      y
    ]
    of pixels
  ) {
    context.fillRect(
      originX + x,
      originY + y,
      1,
      1
    );
  }

  return pixels.length;
}

function enhanceFrameV25({
  context,
  originX,
  originY,
  directionIndex,
  idleFrame
}) {
  const width =
    CHARACTER_ART_V25_PROFILE
      .frameWidth;

  const height =
    CHARACTER_ART_V25_PROFILE
      .frameHeight;

  const image =
    context.getImageData(
      originX,
      originY,
      width,
      height
    );

  const data =
    image.data;

  const bounds =
    findBoundsV25({
      data,
      width,
      height
    });

  if (!bounds) {
    return {
      enhanced:
        false,

      outlinePixels:
        0,

      detailPixels:
        0
    };
  }

  const previousSmoothing =
    context.imageSmoothingEnabled;

  context.imageSmoothingEnabled =
    false;

  const outlinePixels =
    paintOutlineV25({
      context,
      data,
      width,
      height,
      originX,
      originY
    });

  const faceMode =
    FACE_MODE_BY_DIRECTION_V25[
      directionIndex %
        FACE_MODE_BY_DIRECTION_V25.length
    ];

  const centerX =
    Math.round(
      (
        bounds.minX +
        bounds.maxX
      ) / 2
    );

  const headTop =
    Math.max(
      bounds.minY + 2,
      2
    );

  const headHeight =
    Math.max(
      17,
      Math.round(
        bounds.height *
          0.27
      )
    );

  const eyeY =
    Math.min(
      bounds.maxY - 8,
      headTop +
        Math.round(
          headHeight *
            0.49
        )
    );

  const browY =
    eyeY - 2;

  const noseY =
    eyeY + 3;

  const mouthY =
    eyeY +
    7 +
    (
      idleFrame % 2
    );

  let detailPixels =
    0;

  /*
   * Hair clusters.
   */

  detailPixels +=
    paintOpaqueClusterV25({
      context,
      data,
      width,
      height,
      originX,
      originY,

      x:
        centerX - 8,

      y:
        headTop,

      clusterWidth:
        5,

      clusterHeight:
        2,

      color:
        CHARACTER_ART_V25_PALETTE
          .deepPlum
    });

  detailPixels +=
    paintOpaqueClusterV25({
      context,
      data,
      width,
      height,
      originX,
      originY,

      x:
        centerX + 2,

      y:
        headTop + 2,

      clusterWidth:
        4,

      clusterHeight:
        2,

      color:
        CHARACTER_ART_V25_PALETTE
          .hairHighlight
    });

  if (
    faceMode ===
      "front" ||
    faceMode ===
      "front-three-quarter"
  ) {
    /*
     * Eyebrows.
     */

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX - 7,

        y:
          browY,

        clusterWidth:
          4,

        clusterHeight:
          1,

        color:
          CHARACTER_ART_V25_PALETTE
            .ink
      });

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX + 3,

        y:
          browY,

        clusterWidth:
          4,

        clusterHeight:
          1,

        color:
          CHARACTER_ART_V25_PALETTE
            .ink
      });

    /*
     * Eyes + tiny highlights.
     */

    for (
      const eyeX
      of [
        centerX - 5,
        centerX + 4
      ]
    ) {
      detailPixels +=
        paintOpaqueClusterV25({
          context,
          data,
          width,
          height,
          originX,
          originY,

          x:
            eyeX,

          y:
            eyeY,

          clusterWidth:
            2,

          clusterHeight:
            2,

          color:
            CHARACTER_ART_V25_PALETTE
              .ink
        });

      detailPixels +=
        paintOpaquePixelV25({
          context,
          data,
          width,
          height,
          originX,
          originY,

          x:
            eyeX + 1,

          y:
            eyeY,

          color:
            CHARACTER_ART_V25_PALETTE
              .eyeHighlight
        });
    }

    /*
     * Nose plane.
     */

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX,

        y:
          noseY,

        clusterWidth:
          2,

        clusterHeight:
          4,

        color:
          CHARACTER_ART_V25_PALETTE
            .skinShadow
      });

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX - 1,

        y:
          noseY,

        clusterWidth:
          1,

        clusterHeight:
          2,

        color:
          CHARACTER_ART_V25_PALETTE
            .skinHighlight
      });

    /*
     * Mouth cluster.
     */

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX - 3,

        y:
          mouthY,

        clusterWidth:
          6,

        clusterHeight:
          1,

        color:
          CHARACTER_ART_V25_PALETTE
            .mouth
      });

    /*
     * Cheek / face light.
     */

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX - 7,

        y:
          noseY + 2,

        clusterWidth:
          3,

        clusterHeight:
          2,

        color:
          CHARACTER_ART_V25_PALETTE
            .skinHighlight
      });
  }
  else if (
    faceMode ===
    "side"
  ) {
    const sign =
      directionIndex === 6
        ? -1
        : 1;

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX +
          sign * 4,

        y:
          eyeY,

        clusterWidth:
          2,

        clusterHeight:
          2,

        color:
          CHARACTER_ART_V25_PALETTE
            .ink
      });

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX +
          sign * 6,

        y:
          noseY,

        clusterWidth:
          2,

        clusterHeight:
          3,

        color:
          CHARACTER_ART_V25_PALETTE
            .skinShadow
      });
  }
  else {
    /*
     * Back-facing hair depth.
     */

    detailPixels +=
      paintOpaqueClusterV25({
        context,
        data,
        width,
        height,
        originX,
        originY,

        x:
          centerX - 5,

        y:
          headTop + 6,

        clusterWidth:
          4,

        clusterHeight:
          2,

        color:
          CHARACTER_ART_V25_PALETTE
            .deepPlum
      });
  }

  /*
   * Clothing fold clusters.
   */

  const torsoY =
    Math.min(
      bounds.maxY - 18,
      headTop +
        headHeight +
        5
    );

  detailPixels +=
    paintOpaqueClusterV25({
      context,
      data,
      width,
      height,
      originX,
      originY,

      x:
        centerX,

      y:
        torsoY,

      clusterWidth:
        1,

      clusterHeight:
        12,

      color:
        CHARACTER_ART_V25_PALETTE
          .clothShadow
    });

  detailPixels +=
    paintOpaqueClusterV25({
      context,
      data,
      width,
      height,
      originX,
      originY,

      x:
        centerX - 7,

      y:
        torsoY + 3,

      clusterWidth:
        4,

      clusterHeight:
        2,

      color:
        CHARACTER_ART_V25_PALETTE
          .clothHighlight
    });

  detailPixels +=
    paintOpaqueClusterV25({
      context,
      data,
      width,
      height,
      originX,
      originY,

      x:
        centerX + 4,

      y:
        torsoY + 7,

      clusterWidth:
        4,

      clusterHeight:
        2,

      color:
        CHARACTER_ART_V25_PALETTE
          .clothShadow
    });

  context.imageSmoothingEnabled =
    previousSmoothing;

  return {
    enhanced:
      true,

    faceMode,

    outlinePixels,
    detailPixels
  };
}

function createSkippedResultV25(
  reason
) {
  return Object.freeze({
    id:
      CHARACTER_ART_V25_PROFILE
        .id,

    skipped:
      true,

    reason,

    enhancedFrames:
      0,

    outlinePixels:
      0,

    detailPixels:
      0,

    runtimeAtlasRedraw:
      0
  });
}

function enhanceCharacterAtlasV25({
  context,
  canvas
} = {}) {
  /*
   * IMPORTANT:
   *
   * V25 is optional visual enhancement.
   *
   * Browser CanvasRenderingContext2D supports pixel readback.
   * Headless/unit-test canvas doubles may intentionally not.
   *
   * Missing readback capability must never break the existing
   * V9/V10 character architecture.
   */

  if (
    !hasCharacterPixelReadbackV25(
      context
    )
  ) {
    return createSkippedResultV25(
      "pixel-readback-unavailable"
    );
  }

  const profile =
    CHARACTER_ART_V25_PROFILE;

  if (
    !canvas ||
    canvas.width !==
      profile.atlasWidth ||
    canvas.height !==
      profile.atlasHeight
  ) {
    return createSkippedResultV25(
      "noncanonical-atlas"
    );
  }

  let enhancedFrames =
    0;

  let outlinePixels =
    0;

  let detailPixels =
    0;

  for (
    let idleFrame = 0;
    idleFrame <
      profile.idleFrameCount;
    idleFrame += 1
  ) {
    for (
      let directionIndex = 0;
      directionIndex <
        profile.directionCount;
      directionIndex += 1
    ) {
      const result =
        enhanceFrameV25({
          context,

          originX:
            directionIndex *
            profile.frameWidth,

          originY:
            idleFrame *
            profile.frameHeight,

          directionIndex,
          idleFrame
        });

      if (
        result.enhanced
      ) {
        enhancedFrames +=
          1;
      }

      outlinePixels +=
        result.outlinePixels;

      detailPixels +=
        result.detailPixels;
    }
  }

  return Object.freeze({
    id:
      profile.id,

    skipped:
      false,

    reason:
      null,

    enhancedFrames,
    outlinePixels,
    detailPixels,

    runtimeAtlasRedraw:
      0
  });
}

export {
  CHARACTER_ART_V25_PALETTE,
  CHARACTER_ART_V25_PROFILE,
  enhanceCharacterAtlasV25,
  hasCharacterPixelReadbackV25
};
