import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  createThreeCameraMovementInput
} from "./threeCameraInputBridge.js";

function keys(
  ...codes
) {
  return new Set(
    codes
  );
}

describe(
  "CW06 Three.js camera input bridge",
  () => {
    it(
      "maps W toward Three.js camera -Z forward",
      () => {
        assert.deepEqual(
          createThreeCameraMovementInput(
            keys("KeyW")
          ),

          {
            forward: false,
            backward: true,
            right: false,
            left: false
          }
        );
      }
    );

    it(
      "maps S opposite to camera forward",
      () => {
        assert.deepEqual(
          createThreeCameraMovementInput(
            keys("KeyS")
          ),

          {
            forward: true,
            backward: false,
            right: false,
            left: false
          }
        );
      }
    );

    it(
      "preserves right and left strafing",
      () => {
        assert.equal(
          createThreeCameraMovementInput(
            keys("KeyD")
          ).right,
          true
        );

        assert.equal(
          createThreeCameraMovementInput(
            keys("KeyA")
          ).left,
          true
        );
      }
    );

    it(
      "supports diagonal forward-right movement",
      () => {
        const input =
          createThreeCameraMovementInput(
            keys(
              "KeyW",
              "KeyD"
            )
          );

        assert.equal(
          input.backward,
          true
        );

        assert.equal(
          input.right,
          true
        );
      }
    );

    it(
      "cancels opposite longitudinal keys",
      () => {
        const input =
          createThreeCameraMovementInput(
            keys(
              "KeyW",
              "KeyS"
            )
          );

        assert.equal(
          input.forward,
          false
        );

        assert.equal(
          input.backward,
          false
        );
      }
    );
  }
);