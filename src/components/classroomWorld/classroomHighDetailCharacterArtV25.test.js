import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import {
  fileURLToPath
} from "node:url";

import {
  CHARACTER_ART_V25_PROFILE,
  enhanceCharacterAtlasV25,
  hasCharacterPixelReadbackV25
} from "./classroomHighDetailCharacterArtV25.js";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

function createFullContext() {
  const width =
    64;

  const height =
    96;

  const data =
    new Uint8ClampedArray(
      width *
      height *
      4
    );

  for (
    let y = 8;
    y < 84;
    y += 1
  ) {
    const half =
      y < 38
        ? 10
        : 14;

    for (
      let x =
        32 - half;
      x <=
        32 + half;
      x += 1
    ) {
      const offset =
        (
          y * width +
          x
        ) * 4;

      data[offset] =
        188;

      data[offset + 1] =
        130;

      data[offset + 2] =
        96;

      data[offset + 3] =
        255;
    }
  }

  const calls =
    [];

  return {
    calls,

    context:
      {
        fillStyle:
          "#000000",

        imageSmoothingEnabled:
          true,

        getImageData(
          x,
          y,
          requestWidth,
          requestHeight
        ) {
          assert.equal(
            requestWidth,
            width
          );

          assert.equal(
            requestHeight,
            height
          );

          assert.equal(
            x % width,
            0
          );

          assert.equal(
            y % height,
            0
          );

          return {
            data
          };
        },

        fillRect(
          x,
          y,
          drawWidth,
          drawHeight
        ) {
          calls.push({
            x,
            y,
            drawWidth,
            drawHeight,

            color:
              this.fillStyle
          });
        }
      }
  };
}

test(
  "V25 preserves canonical V9 atlas topology",
  () => {
    assert.deepEqual(
      {
        frame:
          [
            CHARACTER_ART_V25_PROFILE
              .frameWidth,

            CHARACTER_ART_V25_PROFILE
              .frameHeight
          ],

        directions:
          CHARACTER_ART_V25_PROFILE
            .directionCount,

        idle:
          CHARACTER_ART_V25_PROFILE
            .idleFrameCount,

        atlas:
          [
            CHARACTER_ART_V25_PROFILE
              .atlasWidth,

            CHARACTER_ART_V25_PROFILE
              .atlasHeight
          ],

        frames:
          CHARACTER_ART_V25_PROFILE
            .atlasFrameCount,

        runtimeRedraw:
          CHARACTER_ART_V25_PROFILE
            .runtimeAtlasRedraw
      },
      {
        frame:
          [
            64,
            96
          ],

        directions:
          8,

        idle:
          4,

        atlas:
          [
            512,
            384
          ],

        frames:
          32,

        runtimeRedraw:
          0
      }
    );
  }
);

test(
  "V25 detects full and minimal canvas capabilities",
  () => {
    assert.equal(
      hasCharacterPixelReadbackV25({
        getImageData() {},
        fillRect() {}
      }),
      true
    );

    assert.equal(
      hasCharacterPixelReadbackV25({
        fillRect() {}
      }),
      false
    );

    assert.equal(
      hasCharacterPixelReadbackV25(
        null
      ),
      false
    );
  }
);

test(
  "V25 enhances every frame when browser-style pixel readback exists",
  () => {
    const {
      context,
      calls
    } =
      createFullContext();

    const result =
      enhanceCharacterAtlasV25({
        context,

        canvas:
          {
            width:
              512,

            height:
              384
          }
      });

    assert.equal(
      result.skipped,
      false
    );

    assert.equal(
      result.enhancedFrames,
      32
    );

    assert.equal(
      result.runtimeAtlasRedraw,
      0
    );

    assert.ok(
      result.outlinePixels >
        0
    );

    assert.ok(
      result.detailPixels >
        0
    );

    assert.ok(
      calls.length >
        100
    );
  }
);

test(
  "V25 safely skips minimal headless canvas doubles",
  () => {
    const result =
      enhanceCharacterAtlasV25({
        context:
          {
            fillRect() {}
          },

        canvas:
          {
            width:
              512,

            height:
              384
          }
      });

    assert.equal(
      result.skipped,
      true
    );

    assert.equal(
      result.reason,
      "pixel-readback-unavailable"
    );

    assert.equal(
      result.enhancedFrames,
      0
    );

    assert.equal(
      result.runtimeAtlasRedraw,
      0
    );
  }
);

test(
  "V25 atlas integration does not mutate drawStudentFrame",
  () => {
    const source =
      readSource(
        "classroomCharacterSpriteV9.js"
      );

    const drawStart =
      source.indexOf(
        "function drawStudentFrame({"
      );

    const atlasStart =
      source.indexOf(
        "function createProceduralStudentAtlasV9({"
      );

    const enhancement =
      source.indexOf(
        "enhanceCharacterAtlasV25({"
      );

    const auditStart =
      source.indexOf(
        "function auditStudentCharacterSpriteV9("
      );

    assert.ok(
      drawStart >= 0 &&
      drawStart <
        atlasStart &&
      atlasStart <
        enhancement &&
      enhancement <
        auditStart
    );

    assert.equal(
      source
        .slice(
          drawStart,
          atlasStart
        )
        .includes(
          "enhanceCharacterAtlasV25"
        ),
      false
    );
  }
);

test(
  "V25 does not acquire texture gameplay or collision authority",
  () => {
    const source =
      readSource(
        "classroomHighDetailCharacterArtV25.js"
      );

    for (
      const forbidden
      of [
        /NearestFilter/gu,
        /LinearFilter/gu,
        /magFilter/gu,
        /minFilter/gu,
        /generateMipmaps/gu,
        /SRGBColorSpace/gu,
        /Raycaster/gu,
        /PointerLockControls/gu,
        /AudioListener/gu,
        /emitTeacherInterventionCommand/gu,
        /collisionObstacles/gu,
        /Math\.random/gu
      ]
    ) {
      assert.equal(
        forbidden.test(
          source
        ),
        false
      );
    }
  }
);
