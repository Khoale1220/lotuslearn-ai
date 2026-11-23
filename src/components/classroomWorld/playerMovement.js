const DEFAULT_MOVEMENT_CONFIG = Object.freeze({
  speed: 4,
  maxDeltaSeconds: 0.05
});

function requireFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function normalizeInputAxis(positive, negative) {
  return Number(Boolean(positive)) - Number(Boolean(negative));
}

function getMovementIntent(input = {}) {
  const forward = normalizeInputAxis(input.forward, input.backward);
  const right = normalizeInputAxis(input.right, input.left);

  const magnitude = Math.hypot(forward, right);

  if (magnitude === 0) {
    return Object.freeze({
      forward: 0,
      right: 0
    });
  }

  return Object.freeze({
    forward: forward / magnitude,
    right: right / magnitude
  });
}

function clampDeltaSeconds(deltaSeconds, maxDeltaSeconds) {
  requireFiniteNumber(deltaSeconds, "deltaSeconds");
  requireFiniteNumber(maxDeltaSeconds, "maxDeltaSeconds");

  if (deltaSeconds < 0) {
    throw new RangeError("deltaSeconds must be non-negative");
  }

  if (maxDeltaSeconds <= 0) {
    throw new RangeError("maxDeltaSeconds must be greater than zero");
  }

  return Math.min(deltaSeconds, maxDeltaSeconds);
}

function stepPlayerMovement({
  position,
  input = {},
  yaw = 0,
  deltaSeconds,
  config = DEFAULT_MOVEMENT_CONFIG
}) {
  if (!position || typeof position !== "object") {
    throw new TypeError("position is required");
  }

  requireFiniteNumber(position.x, "position.x");
  requireFiniteNumber(position.z, "position.z");
  requireFiniteNumber(yaw, "yaw");
  requireFiniteNumber(config.speed, "config.speed");

  if (config.speed < 0) {
    throw new RangeError("config.speed must be non-negative");
  }

  const dt = clampDeltaSeconds(
    deltaSeconds,
    config.maxDeltaSeconds
  );

  const intent = getMovementIntent(input);

  if (intent.forward === 0 && intent.right === 0) {
    return {
      ...position
    };
  }

  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  const forwardX = sinYaw;
  const forwardZ = -cosYaw;

  const rightX = cosYaw;
  const rightZ = sinYaw;

  const distance = config.speed * dt;

  const deltaX =
    (
      forwardX * intent.forward +
      rightX * intent.right
    ) * distance;

  const deltaZ =
    (
      forwardZ * intent.forward +
      rightZ * intent.right
    ) * distance;

  return {
    ...position,
    x: position.x + deltaX,
    z: position.z + deltaZ
  };
}

export {
  DEFAULT_MOVEMENT_CONFIG,
  clampDeltaSeconds,
  getMovementIntent,
  stepPlayerMovement
};