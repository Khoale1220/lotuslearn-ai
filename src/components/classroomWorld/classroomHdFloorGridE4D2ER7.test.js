import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./classroom64BitVisualUpgrade.js", import.meta.url),
  "utf8"
);

const start = source.indexOf("function createFloorTexture(");
const end = source.indexOf("function createExteriorTexture(", start);

assert.ok(start >= 0 && end > start);

const floor = source.slice(start, end);

test("R7 HD floor uses 8x8 visible tiles", () => {
  const match = floor.match(/const\s+tile\s*=\s*(\d+)\s*;/);
  assert.ok(match);
  assert.equal(Number(match[1]), 128);
  assert.equal((512 / Number(match[1])) * 2, 8);
  assert.match(floor, /repeatX:\s*2\b/);
  assert.match(floor, /repeatY:\s*2\b/);
});

test("R7 HD floor has subtle one-pixel grout", () => {
  assert.match(
    floor,
    /x\s*\+\s*1,\s*y\s*\+\s*1,\s*tile\s*-\s*2,\s*tile\s*-\s*2/
  );
  assert.match(floor, /rgba\(91,85,76,0\.025\)/);
  assert.match(
    floor,
    /context\.fillRect\(\s*x,\s*y,\s*tile,\s*1\s*\)/
  );
  assert.match(
    floor,
    /context\.fillRect\(\s*x,\s*y,\s*1,\s*tile\s*\)/
  );
});