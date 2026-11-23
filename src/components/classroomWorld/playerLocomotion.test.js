import assert from "node:assert/strict";
import fs from "node:fs";

import {
  describe,
  it
} from "node:test";

import {
  DEFAULT_LOCOMOTION_CONFIG,
  resolveVelocityAfterCollision,
  stepPlayerLocomotion
} from "./playerLocomotion.js";

function approximatelyEqual(
  actual,
  expected,
  epsilon = 1e-8
) {
  assert.ok(
    Math.abs(
      actual - expected
    ) <= epsilon,

    `Expected ${actual} ~= ${expected}`
  );
}

function simulate({
  fps,
  seconds,
  input
}) {
  let state = {
    position: {
      x: 0,
      z: 0
    },

    velocity: {
      x: 0,
      z: 0
    }
  };

  const frameCount =
    Math.round(
      fps * seconds
    );

  for (
    let frame = 0;
    frame < frameCount;
    frame += 1
  ) {
    state =
      stepPlayerLocomotion({
        position:
          state.position,

        velocity:
          state.velocity,

        input,
        yaw: 0,

        deltaSeconds:
          1 / fps
      });
  }

  return state;
}

describe(
  "CW06 Locomotion V2",
  () => {
    it(
      "accelerates instead of snapping",
      () => {
        const state =
          stepPlayerLocomotion({
            position: {
              x: 0,
              z: 0
            },

            velocity: {
              x: 0,
              z: 0
            },

            input: {
              forward: true
            },

            yaw: 0,
            deltaSeconds: 0.05
          });

        approximatelyEqual(
          state.velocity.z,
          -0.5
        );

        approximatelyEqual(
          state.position.z,
          -0.0125
        );

        assert.ok(
          Math.abs(
            state.velocity.z
          ) <
          DEFAULT_LOCOMOTION_CONFIG.maxSpeed
        );
      }
    );

    it(
      "decelerates to zero",
      () => {
        let state = {
          position: {
            x: 0,
            z: 0
          },

          velocity: {
            x: 0,
            z: -3.5
          }
        };

        for (
          let frame = 0;
          frame < 20;
          frame += 1
        ) {
          state =
            stepPlayerLocomotion({
              position:
                state.position,

              velocity:
                state.velocity,

              input: {},
              yaw: 0,
              deltaSeconds: 0.05
            });
        }

        approximatelyEqual(
          state.velocity.x,
          0
        );

        approximatelyEqual(
          state.velocity.z,
          0
        );
      }
    );

    it(
      "normalizes diagonal movement",
      () => {
        const state =
          simulate({
            fps: 60,
            seconds: 1,

            input: {
              forward: true,
              right: true
            }
          });

        approximatelyEqual(
          Math.hypot(
            state.velocity.x,
            state.velocity.z
          ),

          DEFAULT_LOCOMOTION_CONFIG.maxSpeed
        );
      }
    );

    it(
      "matches 30 60 and 120 FPS",
      () => {
        const thirty =
          simulate({
            fps: 30,
            seconds: 1,

            input: {
              forward: true
            }
          });

        const sixty =
          simulate({
            fps: 60,
            seconds: 1,

            input: {
              forward: true
            }
          });

        const oneTwenty =
          simulate({
            fps: 120,
            seconds: 1,

            input: {
              forward: true
            }
          });

        for (
          const candidate
          of [sixty, oneTwenty]
        ) {
          approximatelyEqual(
            candidate.position.z,
            thirty.position.z
          );

          approximatelyEqual(
            candidate.velocity.z,
            thirty.velocity.z
          );
        }
      }
    );

    it(
      "clamps large frame delta",
      () => {
        const state =
          stepPlayerLocomotion({
            position: {
              x: 0,
              z: 0
            },

            velocity: {
              x: 0,
              z: 0
            },

            input: {
              forward: true
            },

            yaw: 0,
            deltaSeconds: 10
          });

        assert.equal(
          state.deltaSeconds,
          DEFAULT_LOCOMOTION_CONFIG.maxDeltaSeconds
        );
      }
    );

    it(
      "preserves sliding-axis velocity",
      () => {
        assert.deepEqual(
          resolveVelocityAfterCollision({
            previousPosition: {
              x: 0,
              z: 0
            },

            proposedPosition: {
              x: 1,
              z: 1
            },

            resolvedPosition: {
              x: 0.4,
              z: 1
            },

            velocity: {
              x: 2,
              z: 2
            }
          }),

          {
            x: 0,
            z: 2
          }
        );
      }
    );

    it(
      "wires Timer lifecycle into ClassroomWorld",
      () => {
        const source =
          fs.readFileSync(
            new URL(
              "./ClassroomWorld.jsx",
              import.meta.url
            ),
            "utf8"
          );

        assert.match(
          source,
          /new THREE\.Timer\(\)/u
        );

        assert.match(
          source,
          /timer\.connect\(document\)/u
        );

        assert.match(
          source,
          /timer\.update\(timestamp\)/u
        );

        assert.match(
          source,
          /timer\.getDelta\(\)/u
        );

        assert.match(
          source,
          /timer\.dispose\(\)/u
        );

        assert.match(
          source,
          /stepPlayerLocomotion/u
        );

        assert.doesNotMatch(
          source,
          /new THREE\.Clock\(\)/u
        );
      }
    );
  }
);
