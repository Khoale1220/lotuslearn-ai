import assert from "node:assert/strict";
import test from "node:test";
import { stepPlayerLocomotion } from "./playerLocomotion.js";
import { createThreeCameraMovementInput } from "./threeCameraInputBridge.js";

const keys = (...codes) =>
  createThreeCameraMovementInput(new Set(codes));

function step(state, input, yaw, fps) {
  return stepPlayerLocomotion({
    ...state,
    input,
    yaw,
    deltaSeconds: 1 / fps
  });
}

function accelerate(input, yaw, fps) {
  let state = {
    position: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 }
  };

  for (let i = 0; i < fps; i += 1) {
    state = step(state, input, yaw, fps);
  }

  return state;
}

function project(previous, next, yaw) {
  const dx = next.position.x - previous.position.x;
  const dz = next.position.z - previous.position.z;

  return {
    forward: dx * -Math.sin(yaw) + dz * -Math.cos(yaw),
    right: dx * Math.cos(yaw) - dz * Math.sin(yaw)
  };
}

for (const fps of [30, 60, 120]) {
  for (const yaw of [
    0,
    Math.PI / 4,
    Math.PI / 2,
    Math.PI,
    -Math.PI / 2
  ]) {
    test("W to S reverses at fps=" + fps + " yaw=" + yaw, () => {
      const initial = accelerate(keys("KeyW"), yaw, fps);
      const reversed = step(initial, keys("KeyS"), yaw, fps);

      assert.ok(
        project(initial, reversed, yaw).forward < -1e-8,
        "S must move backward immediately"
      );
    });

    test("S to W reverses at fps=" + fps + " yaw=" + yaw, () => {
      const initial = accelerate(keys("KeyS"), yaw, fps);
      const reversed = step(initial, keys("KeyW"), yaw, fps);

      assert.ok(
        project(initial, reversed, yaw).forward > 1e-8,
        "W must move forward immediately"
      );
    });

    test("W+D to S+D preserves right strafe at fps=" +
      fps + " yaw=" + yaw, () => {
        const initial = accelerate(
          keys("KeyW", "KeyD"), yaw, fps
        );

        const reversed = step(
          initial, keys("KeyS", "KeyD"), yaw, fps
        );

        const displacement = project(initial, reversed, yaw);

        assert.ok(
          displacement.forward < -1e-8,
          "S must reverse diagonal longitudinal movement"
        );

        assert.ok(
          displacement.right > 0,
          "D right strafe must continue"
        );
      });

    test("D to A reverses at fps=" + fps + " yaw=" + yaw, () => {
      const initial = accelerate(keys("KeyD"), yaw, fps);
      const reversed = step(initial, keys("KeyA"), yaw, fps);

      assert.ok(
        project(initial, reversed, yaw).right < -1e-8,
        "A must move left immediately"
      );
    });
  }
}
