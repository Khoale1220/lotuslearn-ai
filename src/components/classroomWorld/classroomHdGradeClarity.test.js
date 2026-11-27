import assert from "node:assert/strict";
import test from "node:test";

import {
  createPixelArtGradeShaderV23,
  createClassroomPixelArtGradeV23
} from "./classroomPixelArtGradeV23.js";

test("HD disables forced V23 posterization", () => {
  const shader = createPixelArtGradeShaderV23({
    presentationMode: "hd"
  });

  assert.equal(shader.uniforms.uPosterizeStrength.value, 0);

  assert.match(
    shader.fragmentShader,
    /if\s*\(uPosterizeStrength\s*>\s*0\.0\)/u
  );

  assert.match(
    shader.fragmentShader,
    /#include <colorspace_fragment>/u
  );
});

test("Retro retains original posterization", () => {
  const shader = createPixelArtGradeShaderV23();

  assert.equal(shader.uniforms.uPosterizeStrength.value, 1);
  assert.match(shader.fragmentShader, /posterize\(/u);
  assert.match(shader.fragmentShader, /bayer4\(/u);
});

test("Zero edge strength bypasses edge sampling", () => {
  const shader = createPixelArtGradeShaderV23({
    presentationMode: "hd"
  });

  assert.equal(shader.uniforms.uEdgeStrength.value, 0);

  assert.match(
    shader.fragmentShader,
    /if\s*\(uEdgeStrength\s*>\s*0\.0\)/u
  );

  assert.match(
    shader.fragmentShader,
    /float edge = detectInkEdge\(\);/u
  );
});

function exerciseMode(presentationMode) {
  const observed = {
    shaderUniform: null,
    presentationCalls: 0
  };

  const renderer = {
    autoClear: true,
    info: {
      autoReset: true,
      reset() {}
    },
    getDrawingBufferSize(vector) {
      return vector.set(1280, 720);
    },
    getRenderTarget() {
      return null;
    },
    setRenderTarget() {},
    clear() {},
    render(scene) {
      observed.presentationCalls += 1;

      const quad = scene.children.find(child =>
        child.material?.uniforms?.uPosterizeStrength
      );

      if (quad) {
        observed.shaderUniform =
          quad.material.uniforms.uPosterizeStrength.value;
      }
    }
  };

  const grade = createClassroomPixelArtGradeV23({
    renderer,
    presentationMode
  });

  try {
    assert.equal(grade.beginFrame(), true);
    grade.presentFrame();
  } finally {
    grade.dispose();
  }

  return observed;
}

test("V23 runtime wires retro and HD uniforms correctly", () => {
  assert.deepEqual(exerciseMode("retro"), {
    shaderUniform: 1,
    presentationCalls: 1
  });

  assert.deepEqual(exerciseMode("hd"), {
    shaderUniform: 0,
    presentationCalls: 1
  });
});

test("Invalid shader mode is rejected", () => {
  assert.throws(
    () => createPixelArtGradeShaderV23({
      presentationMode: "unknown"
    }),
    RangeError
  );
});
