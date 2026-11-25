import assert from "node:assert/strict";

import test from "node:test";

import {
  CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE,
  createPixelArtGradeShaderV23
} from "./classroomPixelArtGradeV23.js";


test(
  "V23 friendly baseline keeps pixel identity without horror grading",
  () => {
    const profile =
      CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE;

    assert.equal(
      profile.referenceIntent,
      "friendly-warm-readable-64-bit-classroom"
    );

    assert.deepEqual(
      profile.posterizeLevels,
      {
        red: 18,
        green: 18,
        blue: 16
      }
    );

    assert.equal(
      profile.saturation,
      1
    );

    assert.equal(
      profile.contrast,
      1
    );

    assert.ok(
      profile.edgeStrength <=
        0.08
    );

    assert.ok(
      profile.ditherStrength <=
        0.0015
    );
  }
);


test(
  "V23 keeps core pixel techniques but with a softer shader",
  () => {
    const fragment =
      createPixelArtGradeShaderV23()
        .fragmentShader;

    for (
      const token
      of [
        "bayer4",
        "posterize",
        "detectInkEdge",
        "cw06LuminanceV23",
        "colorspace_fragment"
      ]
    ) {
      assert.equal(
        fragment.includes(token),
        true,
        token
      );
    }

    assert.equal(
      fragment.includes(
        "18.0"
      ),
      true
    );
  }
);
