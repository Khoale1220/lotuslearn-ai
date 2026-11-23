import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collidesWithAnyObstacle,
  resolvePlayerCollision
} from "./playerCollision.js";

const BOUNDS = Object.freeze({
  minX: -5,
  maxX: 5,
  minZ: -5,
  maxZ: 5
});

const DESK = Object.freeze({
  minX: 0,
  maxX: 1,
  minZ: -2,
  maxZ: 2
});

const RADIUS = 0.5;

function approximatelyEqual(actual, expected, epsilon = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to approximately equal ${expected}`
  );
}

describe("CW04 deterministic player collision", () => {
  it("clamps player center to classroom boundaries", () => {
    const result = resolvePlayerCollision({
      previousPosition: {
        x: -2,
        y: 1.7,
        z: 2
      },
      proposedPosition: {
        x: 100,
        y: 1.7,
        z: -100
      },
      bounds: BOUNDS,
      radius: RADIUS
    });

    approximatelyEqual(result.x, 4.5);
    approximatelyEqual(result.z, -4.5);
  });

  it("stops before an obstacle instead of tunneling through it", () => {
    const result = resolvePlayerCollision({
      previousPosition: {
        x: -2,
        y: 1.7,
        z: 0
      },
      proposedPosition: {
        x: 2,
        y: 1.7,
        z: 0
      },
      bounds: BOUNDS,
      obstacles: [DESK],
      radius: RADIUS
    });

    approximatelyEqual(result.x, -0.5);
    approximatelyEqual(result.z, 0);

    assert.equal(
      collidesWithAnyObstacle(
        result,
        [DESK],
        RADIUS
      ),
      false
    );
  });

  it("allows deterministic sliding along an obstacle", () => {
    const result = resolvePlayerCollision({
      previousPosition: {
        x: -2,
        y: 1.7,
        z: 0
      },
      proposedPosition: {
        x: 2,
        y: 1.7,
        z: 1
      },
      bounds: BOUNDS,
      obstacles: [DESK],
      radius: RADIUS
    });

    approximatelyEqual(result.x, -0.5);
    approximatelyEqual(result.z, 1);
  });

  it("leaves collision-free movement unchanged", () => {
    const proposed = {
      x: -3,
      y: 1.7,
      z: -3
    };

    const result = resolvePlayerCollision({
      previousPosition: {
        x: -4,
        y: 1.7,
        z: -4
      },
      proposedPosition: proposed,
      bounds: BOUNDS,
      obstacles: [DESK],
      radius: RADIUS
    });

    assert.deepEqual(result, proposed);
  });

  it("returns identical results for identical inputs", () => {
    const input = {
      previousPosition: {
        x: -2,
        y: 1.7,
        z: 0
      },
      proposedPosition: {
        x: 2,
        y: 1.7,
        z: 1
      },
      bounds: BOUNDS,
      obstacles: [DESK],
      radius: RADIUS
    };

    const first = resolvePlayerCollision(input);
    const replay = resolvePlayerCollision(input);

    assert.deepEqual(first, replay);
  });

  it("fails closed when the starting position overlaps an obstacle", () => {
    assert.throws(
      () =>
        resolvePlayerCollision({
          previousPosition: {
            x: 0.5,
            y: 1.7,
            z: 0
          },
          proposedPosition: {
            x: -2,
            y: 1.7,
            z: 0
          },
          bounds: BOUNDS,
          obstacles: [DESK],
          radius: RADIUS
        }),
      RangeError
    );
  });

  it("rejects malformed collision geometry", () => {
    assert.throws(
      () =>
        resolvePlayerCollision({
          previousPosition: {
            x: -2,
            y: 1.7,
            z: 0
          },
          proposedPosition: {
            x: -1,
            y: 1.7,
            z: 0
          },
          bounds: BOUNDS,
          obstacles: [
            {
              minX: 1,
              maxX: 1,
              minZ: -1,
              maxZ: 1
            }
          ],
          radius: RADIUS
        }),
      RangeError
    );
  });
});