import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

const source = fs.readFileSync(
  new URL("./classroomPixelArtGradeV23.js", import.meta.url),
  "utf8"
);

test("R50 E3 HD target uses capability-guarded 2x MSAA", () => {
  const target = source.match(
    /const renderTarget\s*=\s*new THREE\.WebGLRenderTarget[\s\S]*?renderTarget\.texture\.name/u
  )?.[0];

  assert.ok(target, "Render target missing");

  assert.match(
    target,
    /samples:\s*presentationMode\s*===\s*"hd"\s*&&/u
  );

  assert.match(
    target,
    /renderer\.capabilities\?\.maxSamples\s*\?\?\s*0/u
  );

  assert.match(
    target,
    />=\s*2\s*\?\s*2\s*:\s*0/u
  );
});

test("R50 E3 preserves retro and HD sampling contracts", () => {
  assert.match(
    source,
    /const sceneSamplingFilter\s*=\s*presentationMode\s*===\s*"hd"/u
  );

  assert.match(source, /THREE\.LinearFilter/u);
  assert.match(source, /THREE\.NearestFilter/u);
});

test("Three.js render target supports explicit MSAA samples", () => {
  const hd = new THREE.WebGLRenderTarget(16, 16, {
    samples: 2
  });

  const retro = new THREE.WebGLRenderTarget(16, 16, {
    samples: 0
  });

  try {
    assert.equal(hd.samples, 2);
    assert.equal(retro.samples, 0);
  } finally {
    hd.dispose();
    retro.dispose();
  }
});
