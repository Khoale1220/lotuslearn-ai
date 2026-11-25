import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  createThreeCameraMovementInput
} from "./threeCameraInputBridge.js";

import {
  stepPlayerLocomotion
} from "./playerLocomotion.js";


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
      "maps W to forward intent",
      () => {
        assert.deepEqual(
          createThreeCameraMovementInput(
            keys("KeyW")
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
      "maps S to backward intent",
      () => {
        assert.deepEqual(
          createThreeCameraMovementInput(
            keys("KeyS")
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
      "maps A and D to left and right",
      () => {
        assert.equal(
          createThreeCameraMovementInput(
            keys("KeyA")
          ).left,
          true
        );

        assert.equal(
          createThreeCameraMovementInput(
            keys("KeyD")
          ).right,
          true
        );
      }
    );


    it(
      "supports normalized forward-right intent",
      () => {
        const input =
          createThreeCameraMovementInput(
            keys(
              "KeyW",
              "KeyD"
            )
          );

        assert.equal(
          input.forward,
          true
        );

        assert.equal(
          input.right,
          true
        );

        assert.equal(
          input.backward,
          false
        );
      }
    );


    it(
      "cancels W and S together",
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


    it(
      "moves toward camera forward when W is passed through locomotion",
      () => {
        const input =
          createThreeCameraMovementInput(
            keys("KeyW")
          );

        const result =
          stepPlayerLocomotion({
            position: {
              x: 0,
              z: 0
            },

            velocity: {
              x: 0,
              z: 0
            },

            input,

            yaw: 0,

            deltaSeconds:
              0.05
          });

        /*
         * Three.js camera at yaw=0 looks toward -Z.
         */
        assert.ok(
          result.position.z <
            0
        );
      }
    );


    it(
      "moves away from camera forward when S is passed through locomotion",
      () => {
        const input =
          createThreeCameraMovementInput(
            keys("KeyS")
          );

        const result =
          stepPlayerLocomotion({
            position: {
              x: 0,
              z: 0
            },

            velocity: {
              x: 0,
              z: 0
            },

            input,

            yaw: 0,

            deltaSeconds:
              0.05
          });

        assert.ok(
          result.position.z >
            0
        );
      }
    );
  }
);
