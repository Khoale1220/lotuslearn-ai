import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  computeHdRenderSize,
  computeRetroRenderSize
} from "./classroomRetroFpsPipeline.js";

test("CW-HD renders small viewports at native resolution", () => {
  assert.deepEqual(
    computeHdRenderSize({ displayWidth: 960, displayHeight: 540 }),
    { width: 960, height: 540, aspect: 960 / 540 }
  );
});

test("CW-HD caps a Full HD viewport at 720p", () => {
  assert.deepEqual(
    computeHdRenderSize({ displayWidth: 1920, displayHeight: 1080 }),
    { width: 1280, height: 720, aspect: 1920 / 1080 }
  );
});

test("CW-HD preserves aspect ratio for 4:3", () => {
  assert.deepEqual(
    computeHdRenderSize({ displayWidth: 1920, displayHeight: 1440 }),
    { width: 960, height: 720, aspect: 1920 / 1440 }
  );
});

test("CW-HD rejects invalid viewport dimensions", () => {
  for (const width of [0, -2, NaN, Infinity]) {
    assert.throws(
      () => computeHdRenderSize({
        displayWidth: width,
        displayHeight: 720
      }),
      RangeError
    );
  }
});

test("CW-HD preserves the legacy retro contract", () => {
  const retro = computeRetroRenderSize({
    displayWidth: 1920,
    displayHeight: 1080
  });

  assert.equal(retro.width, 426);
  assert.equal(retro.height, 240);
});

test("CW-HD production authority preserves locomotion", () => {
  const world = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  const pipeline = fs.readFileSync(
    new URL("./classroomRetroFpsPipeline.js", import.meta.url),
    "utf8"
  );

  assert.match(world, /presentationMode:\s*"hd"/u);
  assert.match(world, /classroomRetroFpsPipeline\.resize\(\{/u);
  assert.match(world, /yaw:\s*movementYaw/u);

  assert.match(
    pipeline,
    /canvas\.style\.imageRendering\s*=\s*"auto"/u
  );

  assert.match(
    pipeline,
    /if\s*\(!hdMode\)\s*\{\s*applyRetroTextureSampling\(/u
  );
});

test("R74B11Q8 HD resize uses canonical 720p", () => {
  const source = fs.readFileSync(
    new URL("./classroomRetroFpsPipeline.js", import.meta.url),
    "utf8"
  );

  const start = source.indexOf("const renderSize = hdMode");
  const end = source.indexOf("nativeSetSize(", start);

  assert.ok(start >= 0 && end > start);

  const block = source.slice(start, end + 150);

  assert.match(block, /computeHdRenderSize\(/u);
  assert.doesNotMatch(block, /900\s*\/\s*displayHeight/u);
  assert.doesNotMatch(
    block,
    /renderSize\.(?:width|height)\s*=/u
  );

  assert.match(
    block,
    /nativeSetSize\(\s*renderSize\.width,\s*renderSize\.height,\s*false/u
  );

  assert.deepEqual(
    computeHdRenderSize({
      displayWidth: 1200,
      displayHeight: 900
    }),
    { width: 960, height: 720, aspect: 4 / 3 }
  );
});
