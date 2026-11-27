
import assert from "node:assert/strict";
import test from "node:test";
import {
  createThreeCameraMovementInput as bridge
} from "./threeCameraInputBridge.js";
import {
  stepPlayerLocomotion as stepMotion
} from "./playerLocomotion.js";

const keys = (...codes) => bridge(new Set(codes));

function frame(state, codes, yaw, fps) {
  return stepMotion({
    position: state.position,
    velocity: state.velocity,
    input: keys(...codes),
    yaw,
    deltaSeconds: 1 / fps
  });
}

function runUp(codes, yaw, fps) {
  let state = {
    position: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 }
  };

  for (let t = 0; t < fps; t += 1) {
    state = frame(state, codes, yaw, fps);
  }
  return state;
}

function delta(from, to, yaw) {
  const x = to.position.x - from.position.x;
  const z = to.position.z - from.position.z;
  return {
    forward: -Math.sin(yaw) * x - Math.cos(yaw) * z,
    right: Math.cos(yaw) * x - Math.sin(yaw) * z
  };
}

test("R47 single-key contract remains unchanged", () => {
  assert.deepEqual(keys("KeyW"), {
    forward: true,
    backward: false,
    right: false,
    left: false
  });

  assert.deepEqual(keys(), {
    forward: false,
    backward: false,
    right: false,
    left: false
  });
});

test("R47 conflict metadata", () => {
  assert.equal(
    keys("KeyW", "KeyS").opposingForward, true
  );
  assert.equal(
    keys("KeyA", "KeyD").opposingRight, true
  );
});

for (const fps of [30, 60, 120]) {
  for (const yaw of [
    0, Math.PI / 4, Math.PI / 2,
    Math.PI, -Math.PI / 2
  ]) {
    for (const [name, prior, current, axis] of [
      ["W+S", ["KeyW"], ["KeyW", "KeyS"], "forward"],
      ["S+W", ["KeyS"], ["KeyS", "KeyW"], "forward"],
      ["A+D", ["KeyA"], ["KeyA", "KeyD"], "right"],
      ["D+A", ["KeyD"], ["KeyD", "KeyA"], "right"]
    ]) {
      test("R47 " + name + " no drift " + fps + " " + yaw, () => {
        const from = runUp(prior, yaw, fps);
        const to = frame(from, current, yaw, fps);
        assert.ok(
          Math.abs(delta(from, to, yaw)[axis]) < 1e-8
        );
      });
    }

    test("R47 W+S keeps D strafe " + fps + " " + yaw, () => {
      const from = runUp(["KeyW", "KeyD"], yaw, fps);
      const to = frame(
        from, ["KeyW", "KeyS", "KeyD"], yaw, fps
      );
      const change = delta(from, to, yaw);
      assert.ok(Math.abs(change.forward) < 1e-8);
      assert.ok(change.right > 0);
    });

    test("R47 release keeps smooth braking " + fps + " " + yaw, () => {
      const from = runUp(["KeyW"], yaw, fps);
      assert.ok(
        delta(from, frame(from, [], yaw, fps), yaw).forward > 0
      );
    });

    test("R47 W to S has no forward drift " + fps + " " + yaw, () => {
      const from = runUp(["KeyW"], yaw, fps);
      assert.ok(
        delta(from, frame(from, ["KeyS"], yaw, fps), yaw)
          .forward <= 1e-8
      );
    });
  }
}
