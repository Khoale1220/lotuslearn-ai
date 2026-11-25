/*
 * Three.js first-person movement input boundary.
 *
 * User-visible contract:
 *
 *   W = move toward camera look direction
 *   S = move away from camera look direction
 *   A = strafe left
 *   D = strafe right
 *
 * playerLocomotion.js already converts forward/right
 * intent into world-space movement using camera yaw.
 * No additional longitudinal sign inversion belongs
 * in this keyboard adapter.
 */

function createThreeCameraMovementInput(
  keys
) {
  if (
    !keys ||
    typeof keys.has !== "function"
  ) {
    throw new TypeError(
      "keys must provide Set-like has() semantics"
    );
  }

  const longitudinalAxis =
    (keys.has("KeyW") ? 1 : 0) -
    (keys.has("KeyS") ? 1 : 0);

  const lateralAxis =
    (keys.has("KeyD") ? 1 : 0) -
    (keys.has("KeyA") ? 1 : 0);

  return {
    forward:
      longitudinalAxis > 0,

    backward:
      longitudinalAxis < 0,

    right:
      lateralAxis > 0,

    left:
      lateralAxis < 0
  };
}

export {
  createThreeCameraMovementInput
};
