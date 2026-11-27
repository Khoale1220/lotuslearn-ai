import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createClassroomPixelArtGradeV23
} from "./classroomPixelArtGradeV23.js";

function rendererStub() {
  return {
    render() {},
    setRenderTarget() {},
    getDrawingBufferSize(vector) {
      return vector.set(1280, 720);
    }
  };
}

test("V23 defaults to nearest for retro callers", () => {
  const grade = createClassroomPixelArtGradeV23({
    renderer: rendererStub()
  });

  try {
    const snapshot = grade.getSnapshot();
    assert.equal(snapshot.nearestSceneSampling, true);
    assert.equal(snapshot.linearSceneSampling, false);
    assert.equal(snapshot.mipmaps, false);
    assert.equal(snapshot.width, 1280);
    assert.equal(snapshot.height, 720);
  } finally {
    grade.dispose();
  }
});

test("V23 HD selects linear scene sampling", () => {
  const grade = createClassroomPixelArtGradeV23({
    renderer: rendererStub(),
    presentationMode: "hd"
  });

  try {
    const snapshot = grade.getSnapshot();
    assert.equal(snapshot.nearestSceneSampling, false);
    assert.equal(snapshot.linearSceneSampling, true);
    assert.equal(snapshot.mipmaps, false);
  } finally {
    grade.dispose();
  }
});

test("V23 rejects unsupported modes", () => {
  assert.throws(
    () => createClassroomPixelArtGradeV23({
      renderer: rendererStub(),
      presentationMode: "invalid"
    }),
    RangeError
  );
});

test("Production HD preserves WASD and FOV", () => {
  const world = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  assert.match(
    world,
    /createClassroomPixelArtGradeV23\(\{\s*renderer,\s*presentationMode:\s*"hd"/u
  );
  assert.match(world, /yaw:\s*movementYaw/u);
  assert.match(
    world,
    /CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56/u
  );
});
