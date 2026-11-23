const DEFAULT_PLAYER_COLLISION_CONFIG = Object.freeze({
  radius: 0.35
});

function requireFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function validatePosition(position, name) {
  if (!position || typeof position !== "object") {
    throw new TypeError(`${name} is required`);
  }

  requireFiniteNumber(position.x, `${name}.x`);
  requireFiniteNumber(position.z, `${name}.z`);
}

function validateBounds(bounds, radius) {
  if (!bounds || typeof bounds !== "object") {
    throw new TypeError("bounds are required");
  }

  for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
    requireFiniteNumber(bounds[key], `bounds.${key}`);
  }

  if (bounds.minX >= bounds.maxX) {
    throw new RangeError("bounds.minX must be less than bounds.maxX");
  }

  if (bounds.minZ >= bounds.maxZ) {
    throw new RangeError("bounds.minZ must be less than bounds.maxZ");
  }

  if (bounds.maxX - bounds.minX < radius * 2) {
    throw new RangeError("bounds are too narrow for player radius");
  }

  if (bounds.maxZ - bounds.minZ < radius * 2) {
    throw new RangeError("bounds are too shallow for player radius");
  }
}

function validateObstacle(obstacle, index) {
  if (!obstacle || typeof obstacle !== "object") {
    throw new TypeError(`obstacles[${index}] must be an object`);
  }

  for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
    requireFiniteNumber(
      obstacle[key],
      `obstacles[${index}].${key}`
    );
  }

  if (obstacle.minX >= obstacle.maxX) {
    throw new RangeError(
      `obstacles[${index}].minX must be less than maxX`
    );
  }

  if (obstacle.minZ >= obstacle.maxZ) {
    throw new RangeError(
      `obstacles[${index}].minZ must be less than maxZ`
    );
  }
}

function validateRadius(radius) {
  requireFiniteNumber(radius, "radius");

  if (radius <= 0) {
    throw new RangeError("radius must be greater than zero");
  }
}

function isCenterWithinBounds(position, bounds, radius) {
  return (
    position.x >= bounds.minX + radius &&
    position.x <= bounds.maxX - radius &&
    position.z >= bounds.minZ + radius &&
    position.z <= bounds.maxZ - radius
  );
}

function intersectsExpandedObstacle(position, obstacle, radius) {
  return (
    position.x > obstacle.minX - radius &&
    position.x < obstacle.maxX + radius &&
    position.z > obstacle.minZ - radius &&
    position.z < obstacle.maxZ + radius
  );
}

function collidesWithAnyObstacle(position, obstacles, radius) {
  return obstacles.some((obstacle) =>
    intersectsExpandedObstacle(
      position,
      obstacle,
      radius
    )
  );
}

function clampToBounds(position, bounds, radius) {
  return {
    ...position,
    x: Math.min(
      bounds.maxX - radius,
      Math.max(bounds.minX + radius, position.x)
    ),
    z: Math.min(
      bounds.maxZ - radius,
      Math.max(bounds.minZ + radius, position.z)
    )
  };
}

function resolveAxisMovement(
  start,
  candidate,
  axis,
  obstacles,
  radius
) {
  const delta = candidate[axis] - start[axis];

  if (delta === 0) {
    return candidate[axis];
  }

  const otherAxis = axis === "x" ? "z" : "x";
  const minAxisKey = axis === "x" ? "minX" : "minZ";
  const maxAxisKey = axis === "x" ? "maxX" : "maxZ";
  const minOtherKey = otherAxis === "x" ? "minX" : "minZ";
  const maxOtherKey = otherAxis === "x" ? "maxX" : "maxZ";

  const startAxis = start[axis];
  const otherValue = candidate[otherAxis];

  let resolved = candidate[axis];

  for (const obstacle of obstacles) {
    const overlapsOtherAxis =
      otherValue > obstacle[minOtherKey] - radius &&
      otherValue < obstacle[maxOtherKey] + radius;

    if (!overlapsOtherAxis) {
      continue;
    }

    if (delta > 0) {
      const boundary = obstacle[minAxisKey] - radius;

      if (
        startAxis <= boundary &&
        resolved > boundary
      ) {
        resolved = Math.min(resolved, boundary);
      }
    } else {
      const boundary = obstacle[maxAxisKey] + radius;

      if (
        startAxis >= boundary &&
        resolved < boundary
      ) {
        resolved = Math.max(resolved, boundary);
      }
    }
  }

  return resolved;
}

function resolvePlayerCollision({
  previousPosition,
  proposedPosition,
  bounds,
  obstacles = [],
  radius = DEFAULT_PLAYER_COLLISION_CONFIG.radius
}) {
  validateRadius(radius);
  validatePosition(previousPosition, "previousPosition");
  validatePosition(proposedPosition, "proposedPosition");
  validateBounds(bounds, radius);

  if (!Array.isArray(obstacles)) {
    throw new TypeError("obstacles must be an array");
  }

  obstacles.forEach(validateObstacle);

  if (
    !isCenterWithinBounds(
      previousPosition,
      bounds,
      radius
    )
  ) {
    throw new RangeError(
      "previousPosition must begin inside playable bounds"
    );
  }

  if (
    collidesWithAnyObstacle(
      previousPosition,
      obstacles,
      radius
    )
  ) {
    throw new RangeError(
      "previousPosition must begin collision-free"
    );
  }

  const boundedProposal = clampToBounds(
    proposedPosition,
    bounds,
    radius
  );

  const xCandidate = {
    ...previousPosition,
    x: boundedProposal.x
  };

  const resolvedX = resolveAxisMovement(
    previousPosition,
    xCandidate,
    "x",
    obstacles,
    radius
  );

  const afterX = {
    ...previousPosition,
    x: resolvedX
  };

  const zCandidate = {
    ...afterX,
    z: boundedProposal.z
  };

  const resolvedZ = resolveAxisMovement(
    afterX,
    zCandidate,
    "z",
    obstacles,
    radius
  );

  const result = {
    ...proposedPosition,
    x: resolvedX,
    z: resolvedZ
  };

  if (
    !isCenterWithinBounds(
      result,
      bounds,
      radius
    )
  ) {
    throw new Error(
      "collision resolution produced an out-of-bounds position"
    );
  }

  if (
    collidesWithAnyObstacle(
      result,
      obstacles,
      radius
    )
  ) {
    throw new Error(
      "collision resolution produced an obstacle overlap"
    );
  }

  return result;
}

export {
  DEFAULT_PLAYER_COLLISION_CONFIG,
  clampToBounds,
  collidesWithAnyObstacle,
  intersectsExpandedObstacle,
  isCenterWithinBounds,
  resolvePlayerCollision
};