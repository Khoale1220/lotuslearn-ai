import assert from "node:assert/strict";

import test from "node:test";

import {
  createPixelArtGradeShaderV23
} from "./classroomPixelArtGradeV23.js";


test(
  "V23 uses a namespaced luminance helper and does not collide with Three WebGLProgram",
  () => {
    const shader =
      createPixelArtGradeShaderV23();

    const fragment =
      shader.fragmentShader;

    assert.equal(
      /\bfloat\s+luminance\s*\(/u.test(
        fragment
      ),
      false
    );

    assert.equal(
      fragment.includes(
        "float cw06LuminanceV23("
      ),
      true
    );

    const references =
      fragment.match(
        /\bcw06LuminanceV23\s*\(/gu
      ) ?? [];

    assert.ok(
      references.length >= 2
    );
  }
);


test(
  "V23 keeps the existing pixel-grade pipeline after namespace repair",
  () => {
    const shader =
      createPixelArtGradeShaderV23();

    for (
      const token
      of [
        "bayer4",
        "posterize",
        "applyReferenceSplitTone",
        "detectInkEdge",
        "colorspace_fragment"
      ]
    ) {
      assert.equal(
        shader.fragmentShader.includes(
          token
        ),
        true,
        token
      );
    }
  }
);