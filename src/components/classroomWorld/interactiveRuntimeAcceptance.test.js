import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const WORLD_SOURCE_URL = new URL("./ClassroomWorld.jsx", import.meta.url);
const worldSource = fs.readFileSync(WORLD_SOURCE_URL, "utf8");

function assertContains(fragment, message = fragment) {
  assert.ok(
    worldSource.includes(fragment),
    `ClassroomWorld runtime must contain ${message}`
  );
}

function indexOfRequired(fragment) {
  const index = worldSource.indexOf(fragment);

  assert.notEqual(
    index,
    -1,
    `required runtime fragment missing: ${fragment}`
  );

  return index;
}

test("CW04 D1.6 interactive runtime acceptance", async (t) => {
  await t.test(
    "first-person pointer-lock lifecycle is wired",
    () => {
      assertContains("PointerLockControls");

      assert.match(
        worldSource,
        /(?:controlsRef\.current\??\.|controls\.)lock\s*\(\s*\)/,
        "runtime must provide an explicit pointer-lock acquisition path"
      );

      assert.match(
        worldSource,
        /addEventListener\s*\(\s*["']lock["']/,
        "runtime must react to pointer-lock acquisition"
      );

      assert.match(
        worldSource,
        /addEventListener\s*\(\s*["']unlock["']/,
        "runtime must react to pointer-lock release"
      );

      assert.match(
        worldSource,
        /removeEventListener\s*\(\s*["']lock["']/,
        "runtime must clean up pointer-lock acquisition listener"
      );

      assert.match(
        worldSource,
        /removeEventListener\s*\(\s*["']unlock["']/,
        "runtime must clean up pointer-lock release listener"
      );

      assertContains("controls.dispose");
    }
  );

  await t.test(
    "keyboard input lifecycle is installed and cleaned up",
    () => {
      assert.match(
        worldSource,
        /addEventListener\s*\(\s*["']keydown["']/,
        "runtime must install keydown listener"
      );

      assert.match(
        worldSource,
        /addEventListener\s*\(\s*["']keyup["']/,
        "runtime must install keyup listener"
      );

      assert.match(
        worldSource,
        /removeEventListener\s*\(\s*["']keydown["']/,
        "runtime must remove keydown listener"
      );

      assert.match(
        worldSource,
        /removeEventListener\s*\(\s*["']keyup["']/,
        "runtime must remove keyup listener"
      );
    }
  );

  await t.test(
    "deterministic movement proposal precedes collision resolution",
    () => {
      const movementIndex = indexOfRequired("stepPlayerMovement");
      const collisionIndex = indexOfRequired("resolvePlayerCollision");

      assert.ok(
        movementIndex < collisionIndex,
        "movement proposal must be produced before collision resolution"
      );

      assertContains("previousPosition");
      assertContains("proposedPosition");
      assertContains("resolvedPosition");
    }
  );

  await t.test(
    "collision runtime consumes deterministic classroom obstacles",
    () => {
      assertContains("createClassroomObstacles");
      assertContains("classroomObstacles");

      assert.match(
        worldSource,
        /obstacles\s*:\s*classroomObstacles/,
        "collision runtime must consume classroom obstacle geometry"
      );

      assert.doesNotMatch(
        worldSource,
        /obstacles\s*:\s*\[\s*\]/,
        "collision runtime must not regress to an empty obstacle set"
      );
    }
  );

  await t.test(
    "collision-resolved position drives the first-person camera",
    () => {
      assert.match(
        worldSource,
        /camera\.position\.x\s*=\s*resolvedPosition\.x/,
        "resolved x position must drive camera x"
      );

      assert.match(
        worldSource,
        /camera\.position\.z\s*=\s*resolvedPosition\.z/,
        "resolved z position must drive camera z"
      );
    }
  );

  await t.test(
    "student targeting ray originates from the active camera",
    () => {
      assert.match(
        worldSource,
        /raycaster\.setFromCamera\s*\([^,]+,\s*camera\s*\)/,
        "interaction ray must originate from active first-person camera"
      );

      assertContains("intersectObjects");
      assertContains("INTERACTION_DISTANCE");
    }
  );

  await t.test(
    "student interaction remains deterministic demo data only",
    () => {
      assertContains("DEMO STUDENT");
      assertContains("No real student data");

      assert.match(
        worldSource,
        /setSelectedStudent\s*\(/,
        "runtime must retain explicit selected-student state"
      );
    }
  );

  await t.test(
    "animation and renderer resources have teardown paths",
    () => {
      assertContains("requestAnimationFrame");
      assertContains("cancelAnimationFrame");
      assertContains("renderer.dispose");
      assertContains("controls.dispose");

      assert.match(
        worldSource,
        /removeEventListener/,
        "runtime teardown must remove registered listeners"
      );
    }
  );

  await t.test(
    "interactive runtime contains no TypeScript implementation dependency",
    () => {
      assert.doesNotMatch(
        worldSource,
        /from\s+["'][^"']+\.(ts|tsx)["']/i,
        "Classroom World runtime must not import TypeScript source"
      );
    }
  );
});