import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  new URL("./ClassroomWorld.jsx", import.meta.url),
  "utf8"
);

describe("CW04 deterministic runtime integration contract", () => {
  it("routes runtime movement through the deterministic movement model", () => {
    assert.match(source, /stepPlayerMovement\s*\(\s*\{/);
    assert.match(source, /deltaSeconds:\s*delta/);
    assert.match(source, /yaw:\s*camera\.rotation\.y/);
  });

  it("routes proposed movement through collision resolution", () => {
    assert.match(source, /resolvePlayerCollision\s*\(\s*\{/);
    assert.match(source, /previousPosition/);
    assert.match(source, /proposedPosition/);
    assert.match(source, /bounds:\s*\{/);
    assert.match(source, /obstacles:/);
  });

  it("writes collision-resolved position back to the camera", () => {
    assert.match(
      source,
      /camera\.position\.x\s*=\s*resolvedPosition\.x/
    );
    assert.match(
      source,
      /camera\.position\.z\s*=\s*resolvedPosition\.z/
    );
    assert.match(
      source,
      /camera\.position\.y\s*=\s*PLAYER_HEIGHT/
    );
  });

  it("removes PointerLockControls as movement authority", () => {
    assert.doesNotMatch(source, /controls\.moveForward\s*\(/);
    assert.doesNotMatch(source, /controls\.moveRight\s*\(/);
  });

  it("preserves PointerLockControls for orientation and pointer lock", () => {
    assert.match(source, /PointerLockControls/);
    assert.match(source, /controlsRef\.current\?\.lock\s*\(/);
  });

  it("executes movement before collision resolution", () => {
    const movementIndex = source.indexOf("stepPlayerMovement({");
    const collisionIndex = source.indexOf("resolvePlayerCollision({");

    assert.ok(movementIndex >= 0);
    assert.ok(collisionIndex > movementIndex);
  });
});
