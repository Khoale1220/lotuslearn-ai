import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  new URL("./ClassroomWorld.jsx", import.meta.url),
  "utf8"
);

describe("CW06 velocity runtime integration contract", () => {
  it("routes runtime movement through the velocity locomotion model", () => {
    assert.match(
      source,
      /stepPlayerLocomotion\s*\(\s*\{/
    );
    assert.match(
      source,
      /velocity:\s*playerVelocity/
    );
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

  it("executes movement before collision and velocity feedback", () => {
    const movementIndex = source.indexOf("stepPlayerLocomotion({");
    const collisionIndex = source.indexOf("resolvePlayerCollision({");
    const velocityIndex = source.indexOf(
      "resolveVelocityAfterCollision({"
    );

    assert.ok(movementIndex >= 0);
    assert.ok(collisionIndex > movementIndex);
    assert.ok(velocityIndex > collisionIndex);
  });

  it(
    "clears movement intent when pointer lock is released",
    () => {
      assert.match(
        source,
        /const onUnlock = \(\) => \{[\s\S]*?keys\.clear\(\)[\s\S]*?setIsLocked\(false\)/
      );
    }
  );

  it(
    "clears movement intent when the browser window loses focus",
    () => {
      assert.match(
        source,
        /const onWindowBlur = \(\) => \{[\s\S]*?keys\.clear\(\)/
      );

      assert.match(
        source,
        /window\.addEventListener\("blur", onWindowBlur\)/
      );

      assert.match(
        source,
        /window\.removeEventListener\("blur", onWindowBlur\)/
      );
    }
  );

});
