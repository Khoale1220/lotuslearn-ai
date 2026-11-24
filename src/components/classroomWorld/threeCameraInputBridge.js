/*
 * Three.js cameras look down local -Z by default.
 *
 * The existing deterministic locomotion primitive uses
 * the opposite local longitudinal sign. This adapter is
 * the explicit coordinate-system boundary between browser
 * keyboard semantics and the pure locomotion module.
 *
 * User-visible contract:
 *   W = move toward camera look direction
 *   S = move away from camera look direction
 *   A = strafe left
 *   D = strafe right
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

  /*
   * W must become negative longitudinal input because
   * Three.js camera-forward is local -Z.
   *
   * S becomes positive longitudinal input.
   */
  const longitudinalAxis =
    (keys.has("KeyS") ? 1 : 0) -
    (keys.has("KeyW") ? 1 : 0);

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