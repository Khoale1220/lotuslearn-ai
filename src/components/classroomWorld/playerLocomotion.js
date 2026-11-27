import {
  clampDeltaSeconds,
  getMovementIntent
} from "./playerMovement.js";

const DEFAULT_LOCOMOTION_CONFIG = Object.freeze({
  maxSpeed: 3.5,
  acceleration: 10,
  deceleration: 14,
  maxDeltaSeconds: 0.05
});

function requireFiniteNumber(
  value,
  name
) {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `${name} must be a finite number`
    );
  }
}

function requireVector(
  value,
  name
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new TypeError(
      `${name} is required`
    );
  }

  requireFiniteNumber(
    value.x,
    `${name}.x`
  );

  requireFiniteNumber(
    value.z,
    `${name}.z`
  );
}

function getWorldDirection({
  intent,
  yaw
}) {
  requireFiniteNumber(
    yaw,
    "yaw"
  );

  const sinYaw =
    Math.sin(yaw);

  const cosYaw =
    Math.cos(yaw);

  /*
   * Three.js first-person camera basis:
   *
   * local forward = -Z
   * local right   = +X
   *
   * Keep locomotion aligned with the actual camera
   * orientation convention used by PointerLockControls.
   */
  return {
    x:
      -sinYaw * intent.forward +
      cosYaw * intent.right,

    z:
      -cosYaw * intent.forward -
      sinYaw * intent.right
  };
}

function integrateTowardTarget({
  velocity,
  targetVelocity,
  rate,
  deltaSeconds
}) {
  requireVector(
    velocity,
    "velocity"
  );

  requireVector(
    targetVelocity,
    "targetVelocity"
  );

  requireFiniteNumber(
    rate,
    "rate"
  );

  requireFiniteNumber(
    deltaSeconds,
    "deltaSeconds"
  );

  if (rate <= 0) {
    throw new RangeError(
      "rate must be greater than zero"
    );
  }

  const difference = {
    x:
      targetVelocity.x -
      velocity.x,

    z:
      targetVelocity.z -
      velocity.z
  };

  const distance =
    Math.hypot(
      difference.x,
      difference.z
    );

  if (
    distance === 0 ||
    deltaSeconds === 0
  ) {
    return {
      velocity: {
        ...velocity
      },

      displacement: {
        x:
          velocity.x *
          deltaSeconds,

        z:
          velocity.z *
          deltaSeconds
      }
    };
  }

  const direction = {
    x:
      difference.x /
      distance,

    z:
      difference.z /
      distance
  };

  const acceleration = {
    x:
      direction.x *
      rate,

    z:
      direction.z *
      rate
  };

  const timeToTarget =
    distance / rate;

  if (
    timeToTarget <=
    deltaSeconds
  ) {
    const accelerated = {
      x:
        velocity.x *
          timeToTarget +
        0.5 *
          acceleration.x *
          timeToTarget *
          timeToTarget,

      z:
        velocity.z *
          timeToTarget +
        0.5 *
          acceleration.z *
          timeToTarget *
          timeToTarget
    };

    const remaining =
      deltaSeconds -
      timeToTarget;

    return {
      velocity: {
        ...targetVelocity
      },

      displacement: {
        x:
          accelerated.x +
          targetVelocity.x *
            remaining,

        z:
          accelerated.z +
          targetVelocity.z *
            remaining
      }
    };
  }

  return {
    velocity: {
      x:
        velocity.x +
        acceleration.x *
          deltaSeconds,

      z:
        velocity.z +
        acceleration.z *
          deltaSeconds
    },

    displacement: {
      x:
        velocity.x *
          deltaSeconds +
        0.5 *
          acceleration.x *
          deltaSeconds *
          deltaSeconds,

      z:
        velocity.z *
          deltaSeconds +
        0.5 *
          acceleration.z *
          deltaSeconds *
          deltaSeconds
    }
  };
}

function removeOpposingAxisMomentum({ velocity, intent, yaw, input }) {
  // Prevent forward drift when a reverse key is pressed.
  // Preserve lateral momentum for diagonal movement.
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  const forward = { x: -sinYaw, z: -cosYaw };
  const right = { x: cosYaw, z: -sinYaw };

  const forwardSpeed =
    velocity.x * forward.x + velocity.z * forward.z;

  const rightSpeed =
    velocity.x * right.x + velocity.z * right.z;

  const reverseForward =
    Boolean(input.opposingForward) ||
    (intent.forward !== 0 &&
      forwardSpeed * intent.forward < -1e-9);

  const reverseRight =
    Boolean(input.opposingRight) ||
    (intent.right !== 0 &&
      rightSpeed * intent.right < -1e-9);

  if (!reverseForward && !reverseRight) {
    return velocity;
  }

  const nextForward = reverseForward ? 0 : forwardSpeed;
  const nextRight = reverseRight ? 0 : rightSpeed;

  return {
    x: nextForward * forward.x + nextRight * right.x,
    z: nextForward * forward.z + nextRight * right.z
  };
}

function stepPlayerLocomotion({
  position,
  velocity = {
    x: 0,
    z: 0
  },
  input = {},
  yaw = 0,
  deltaSeconds,
  config =
    DEFAULT_LOCOMOTION_CONFIG
}) {
  requireVector(
    position,
    "position"
  );

  requireVector(
    velocity,
    "velocity"
  );

  const delta =
    clampDeltaSeconds(
      deltaSeconds,
      config.maxDeltaSeconds
    );

  const intent =
    getMovementIntent(input);

  const hasIntent =
    intent.forward !== 0 ||
    intent.right !== 0;

  const direction =
    getWorldDirection({
      intent,
      yaw
    });

  const targetVelocity = {
    x:
      direction.x *
      config.maxSpeed,

    z:
      direction.z *
      config.maxSpeed
  };

  const directionalVelocity = removeOpposingAxisMomentum({
    velocity,
    intent,
    yaw,
    input
  });
  const integration =
    integrateTowardTarget({
      velocity: directionalVelocity,
      targetVelocity,

      rate:
        hasIntent
          ? config.acceleration
          : config.deceleration,

      deltaSeconds:
        delta
    });

  return {
    position: {
      ...position,

      x:
        position.x +
        integration.displacement.x,

      z:
        position.z +
        integration.displacement.z
    },

    velocity:
      integration.velocity,

    deltaSeconds:
      delta
  };
}

function resolveVelocityAfterCollision({
  previousPosition,
  proposedPosition,
  resolvedPosition,
  velocity,
  epsilon = 1e-9
}) {
  requireVector(
    previousPosition,
    "previousPosition"
  );

  requireVector(
    proposedPosition,
    "proposedPosition"
  );

  requireVector(
    resolvedPosition,
    "resolvedPosition"
  );

  requireVector(
    velocity,
    "velocity"
  );

  const blockedX =
    Math.abs(
      proposedPosition.x -
      previousPosition.x
    ) > epsilon &&
    Math.abs(
      proposedPosition.x -
      resolvedPosition.x
    ) > epsilon;

  const blockedZ =
    Math.abs(
      proposedPosition.z -
      previousPosition.z
    ) > epsilon &&
    Math.abs(
      proposedPosition.z -
      resolvedPosition.z
    ) > epsilon;

  return {
    x:
      blockedX
        ? 0
        : velocity.x,

    z:
      blockedZ
        ? 0
        : velocity.z
  };
}

export {
  DEFAULT_LOCOMOTION_CONFIG,
  resolveVelocityAfterCollision,
  stepPlayerLocomotion
};
