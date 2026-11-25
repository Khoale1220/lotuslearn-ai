import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  stepPlayerLocomotion
} from "./playerLocomotion.js";

import {
  createThreeCameraMovementInput
} from "./threeCameraInputBridge.js";


function approximatelyEqual(
  actual,
  expected,
  epsilon = 1e-8
) {
  assert.ok(
    Math.abs(
      actual -
      expected
    ) <= epsilon,

    `Expected ${actual} ~= ${expected}`
  );
}


function normalizedPlanarDisplacement(
  result
) {
  const length =
    Math.hypot(
      result.position.x,
      result.position.z
    );

  assert.ok(
    length > 0
  );

  return {
    x:
      result.position.x /
      length,

    z:
      result.position.z /
      length
  };
}


function runMovement({
  yaw,
  codes
}) {
  const input =
    createThreeCameraMovementInput(
      new Set(
        codes
      )
    );

  return stepPlayerLocomotion({
    position: {
      x: 0,
      z: 0
    },

    velocity: {
      x: 0,
      z: 0
    },

    input,
    yaw,
    deltaSeconds:
      0.05
  });
}


function cameraBasis(
  yaw
) {
  const camera =
    new THREE.PerspectiveCamera();

  camera.rotation.order =
    "YXZ";

  camera.rotation.set(
    0,
    yaw,
    0
  );

  camera.updateMatrixWorld(
    true
  );

  const forward =
    new THREE.Vector3();

  camera.getWorldDirection(
    forward
  );

  forward.y =
    0;

  forward.normalize();

  const right =
    new THREE.Vector3(
      1,
      0,
      0
    )
      .applyQuaternion(
        camera.quaternion
      );

  right.y =
    0;

  right.normalize();

  return {
    forward,
    right
  };
}


function expectDirection(
  result,
  expected
) {
  const actual =
    normalizedPlanarDisplacement(
      result
    );

  approximatelyEqual(
    actual.x,
    expected.x
  );

  approximatelyEqual(
    actual.z,
    expected.z
  );
}


describe(
  "CW07 camera-relative movement contract V52",
  () => {
    const yawCases = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      -Math.PI / 2,
      Math.PI
    ];


    for (
      const yaw
      of yawCases
    ) {
      it(
        `W follows Three.js camera forward at yaw=${yaw}`,
        () => {
          const {
            forward
          } =
            cameraBasis(
              yaw
            );

          expectDirection(
            runMovement({
              yaw,
              codes: [
                "KeyW"
              ]
            }),
            forward
          );
        }
      );


      it(
        `S opposes Three.js camera forward at yaw=${yaw}`,
        () => {
          const {
            forward
          } =
            cameraBasis(
              yaw
            );

          expectDirection(
            runMovement({
              yaw,
              codes: [
                "KeyS"
              ]
            }),
            {
              x:
                -forward.x,

              z:
                -forward.z
            }
          );
        }
      );


      it(
        `D follows Three.js camera right at yaw=${yaw}`,
        () => {
          const {
            right
          } =
            cameraBasis(
              yaw
            );

          expectDirection(
            runMovement({
              yaw,
              codes: [
                "KeyD"
              ]
            }),
            right
          );
        }
      );


      it(
        `A opposes Three.js camera right at yaw=${yaw}`,
        () => {
          const {
            right
          } =
            cameraBasis(
              yaw
            );

          expectDirection(
            runMovement({
              yaw,
              codes: [
                "KeyA"
              ]
            }),
            {
              x:
                -right.x,

              z:
                -right.z
            }
          );
        }
      );
    }


    it(
      "keeps diagonal input normalized after camera rotation",
      () => {
        const result =
          runMovement({
            yaw:
              Math.PI / 3,

            codes: [
              "KeyW",
              "KeyD"
            ]
          });

        const magnitude =
          Math.hypot(
            result.velocity.x,
            result.velocity.z
          );

        approximatelyEqual(
          magnitude,
          0.5
        );
      }
    );
  }
);
