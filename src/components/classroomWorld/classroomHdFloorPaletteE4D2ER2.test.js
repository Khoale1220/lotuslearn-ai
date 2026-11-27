import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./classroom64BitVisualUpgrade.js", import.meta.url),
  "utf8"
);

const start = source.indexOf("function createFloorTexture(");
const end = source.indexOf("function createExteriorTexture(", start);

test("E4D2E-R2 uses the refined floor palette", () => {
  assert.ok(start >= 0);
  assert.ok(end > start);

  const floor = source.slice(start, end);

  for (const color of [
    "#c2bbb0",
    "#c6bfb4",
    "#bdb6ab",
    "rgba(91,85,76,0.025)",
    "rgba(255,245,232,0.02)",
    "rgba(92,89,82,0.015)"
  ]) {
    assert.ok(floor.includes(color), `Missing palette: ${color}`);
  }
});

test("E4D2E-R2 preserves existing floor contracts", () => {
  const floor = source.slice(start, end);

  assert.match(floor, /const\s+tile\s*=\s*128\s*;/);
  assert.match(floor, /repeatX:\s*2\b/);
  assert.match(floor, /repeatY:\s*2\b/);

  assert.match(
    source,
    /const\s+floorMaterial[\s\S]{0,520}?roughness:\s*0\.68\b/
  );

  assert.match(
    source,
    /floor\.position\.y\s*=\s*0\.008/
  );
});