import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_MOVEMENT_CONFIG,
  clampDeltaSeconds,
  getMovementIntent,
  stepPlayerMovement
} from "./playerMovement.js";

const TEST_CONFIG = Object.freeze({
  speed: 4,
  maxDeltaSeconds: 1
});

function approximatelyEqual(actual, expected, epsilon = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to approximately equal ${expected}`
  );
}

describe("CW04 deterministic player movement", () => {
  it("keeps the player stationary when there is no movement input", () => {
    const start = {
      x: 2,
      y: 1.7,
      z: -3
    };

    const next = stepPlayerMovement({
      position: start,
      input: {},
      yaw: 0,
      deltaSeconds: 0.25,
      config: TEST_CONFIG
    });

    assert.deepEqual(next, start);
    assert.notEqual(next, start);
  });

  it("moves forward along negative Z when yaw is zero", () => {
    const next = stepPlayerMovement({
      position: {
        x: 0,
        y: 1.7,
        z: 0
      },
      input: {
        forward: true
      },
      yaw: 0,
      deltaSeconds: 0.25,
      config: TEST_CONFIG
    });

    approximatelyEqual(next.x, 0);
    approximatelyEqual(next.z, -1);
  });

  it("rotates movement deterministically with player yaw", () => {
    const next = stepPlayerMovement({
      position: {
        x: 0,
        y: 1.7,
        z: 0
      },
      input: {
        forward: true
      },
      yaw: Math.PI / 2,
      deltaSeconds: 0.25,
      config: TEST_CONFIG
    });

    approximatelyEqual(next.x, 1);
    approximatelyEqual(next.z, 0);
  });

  it("normalizes diagonal movement so it is not faster", () => {
    const next = stepPlayerMovement({
      position: {
        x: 0,
        y: 1.7,
        z: 0
      },
      input: {
        forward: true,
        right: true
      },
      yaw: 0,
      deltaSeconds: 0.25,
      config: TEST_CONFIG
    });

    const distance = Math.hypot(next.x, next.z);

    approximatelyEqual(distance, 1);
  });

  it("cancels opposing input on the same axis", () => {
    const intent = getMovementIntent({
      forward: true,
      backward: true,
      left: true,
      right: true
    });

    assert.deepEqual(intent, {
      forward: 0,
      right: 0
    });
  });

  it("clamps oversized frame delta to the configured safety bound", () => {
    assert.equal(
      clampDeltaSeconds(
        10,
        DEFAULT_MOVEMENT_CONFIG.maxDeltaSeconds
      ),
      DEFAULT_MOVEMENT_CONFIG.maxDeltaSeconds
    );

    const next = stepPlayerMovement({
      position: {
        x: 0,
        y: 1.7,
        z: 0
      },
      input: {
        forward: true
      },
      yaw: 0,
      deltaSeconds: 10
    });

    approximatelyEqual(
      next.z,
      -DEFAULT_MOVEMENT_CONFIG.speed *
        DEFAULT_MOVEMENT_CONFIG.maxDeltaSeconds
    );
  });

  it("fails closed on invalid movement timing", () => {
    assert.throws(
      () =>
        stepPlayerMovement({
          position: {
            x: 0,
            y: 1.7,
            z: 0
          },
          input: {
            forward: true
          },
          yaw: 0,
          deltaSeconds: -0.1
        }),
      RangeError
    );
  });
});