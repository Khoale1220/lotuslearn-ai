import assert from "node:assert/strict";
import test from "node:test";

import {
  stepPlayerMovement
} from "./playerMovement.js";

import {
  resolvePlayerCollision
} from "./playerCollision.js";

const ROOM_BOUNDS = Object.freeze({
  minX: -7.2,
  maxX: 7.2,
  minZ: -7.2,
  maxZ: 7.2
});

function resolveMovement({
  previousPosition,
  input,
  yaw = 0,
  deltaSeconds = 0.1,
  speed = 4,
  obstacles = [],
  radius = 0.35
}) {
  const proposedPosition = stepPlayerMovement({
    position: previousPosition,
    input,
    yaw,
    deltaSeconds,
    config: {
      speed,
      maxDeltaSeconds: 0.1
    }
  });

  return resolvePlayerCollision({
    previousPosition,
    proposedPosition,
    bounds: ROOM_BOUNDS,
    obstacles,
    radius
  });
}

test("CW04 D1.4 collision runtime behavior", async (t) => {
  await t.test(
    "free-space movement advances the player deterministically",
    () => {
      const previousPosition = {
        x: 0,
        z: 0
      };

      const result = resolveMovement({
        previousPosition,
        input: {
          forward: true
        }
      });

      assert.ok(
        Number.isFinite(result.x),
        "resolved x must be finite"
      );

      assert.ok(
        Number.isFinite(result.z),
        "resolved z must be finite"
      );

      assert.equal(
        result.x,
        0,
        "yaw=0 forward movement must not drift on x"
      );

      assert.ok(
        result.z < previousPosition.z,
        "yaw=0 forward movement must advance toward negative z"
      );
    }
  );

  await t.test(
    "collision resolver prevents penetration into a classroom obstacle",
    () => {
      const obstacle = Object.freeze({
        minX: -1,
        maxX: 1,
        minZ: -2,
        maxZ: -1
      });

      const previousPosition = {
        x: 0,
        z: -0.5
      };

      const result = resolveMovement({
        previousPosition,
        input: {
          forward: true
        },
        speed: 10,
        obstacles: [obstacle],
        radius: 0.35
      });

      assert.ok(
        result.z >= obstacle.maxZ + 0.35 ||
        result.z <= obstacle.minZ - 0.35 ||
        result.x <= obstacle.minX - 0.35 ||
        result.x >= obstacle.maxX + 0.35,
        "resolved position must remain outside expanded obstacle bounds"
      );
    }
  );

  await t.test(
    "room bounds prevent the player center from escaping the classroom",
    () => {
      const previousPosition = {
        x: 6.7,
        z: 0
      };

      const result = resolveMovement({
        previousPosition,
        input: {
          right: true
        },
        speed: 20,
        radius: 0.35
      });

      assert.ok(
        result.x <= ROOM_BOUNDS.maxX - 0.35,
        "player must remain inside maximum x boundary"
      );

      assert.ok(
        result.x >= ROOM_BOUNDS.minX + 0.35,
        "player must remain inside minimum x boundary"
      );

      assert.ok(
        result.z <= ROOM_BOUNDS.maxZ - 0.35,
        "player must remain inside maximum z boundary"
      );

      assert.ok(
        result.z >= ROOM_BOUNDS.minZ + 0.35,
        "player must remain inside minimum z boundary"
      );
    }
  );

  await t.test(
    "collision resolution is deterministic for identical inputs",
    () => {
      const obstacle = Object.freeze({
        minX: -0.75,
        maxX: 0.75,
        minZ: -2,
        maxZ: -1
      });

      const request = {
        previousPosition: {
          x: 0,
          z: 0
        },
        input: {
          forward: true,
          right: true
        },
        yaw: 0,
        deltaSeconds: 0.1,
        speed: 8,
        obstacles: [obstacle],
        radius: 0.35
      };

      const first = resolveMovement(request);
      const second = resolveMovement(request);

      assert.deepEqual(
        first,
        second,
        "identical runtime inputs must produce identical resolved positions"
      );
    }
  );

  await t.test(
    "resolved position never contains NaN or Infinity",
    () => {
      const obstacle = Object.freeze({
        minX: 1,
        maxX: 2,
        minZ: -2,
        maxZ: -1
      });

      const result = resolveMovement({
        previousPosition: {
          x: 0,
          z: 0
        },
        input: {
          forward: true,
          right: true
        },
        yaw: Math.PI / 4,
        deltaSeconds: 0.1,
        speed: 5,
        obstacles: [obstacle]
      });

      assert.ok(Number.isFinite(result.x));
      assert.ok(Number.isFinite(result.z));
    }
  );
});