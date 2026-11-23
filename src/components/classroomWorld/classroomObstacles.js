import {
  CLASSROOM_WORLD_FIXTURE,
  seatToWorld,
} from "./classroomWorldContract.js";

const DEFAULT_DESK_COLLISION_CONFIG = Object.freeze({
  halfWidth: 0.72,
  halfDepth: 0.52,
});

function requireFinitePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`);
  }

  return value;
}

function freezeObstacle(obstacle) {
  return Object.freeze({
    obstacleKey: obstacle.obstacleKey,
    kind: obstacle.kind,
    studentKey: obstacle.studentKey ?? null,
    seatIndex: obstacle.seatIndex ?? null,
    minX: obstacle.minX,
    maxX: obstacle.maxX,
    minZ: obstacle.minZ,
    maxZ: obstacle.maxZ,
  });
}

function createDeskObstacle(
  student,
  config = DEFAULT_DESK_COLLISION_CONFIG
) {
  if (!student || typeof student !== "object") {
    throw new TypeError("student is required");
  }

  if (
    typeof student.studentKey !== "string" ||
    student.studentKey.length === 0
  ) {
    throw new TypeError("student.studentKey must be a non-empty string");
  }

  if (!Number.isInteger(student.seatIndex) || student.seatIndex < 0) {
    throw new RangeError(
      "student.seatIndex must be a non-negative integer"
    );
  }

  const halfWidth = requireFinitePositiveNumber(
    config.halfWidth,
    "config.halfWidth"
  );

  const halfDepth = requireFinitePositiveNumber(
    config.halfDepth,
    "config.halfDepth"
  );

  const seat = seatToWorld(student.seatIndex);

  return freezeObstacle({
    obstacleKey: `desk:${student.studentKey}`,
    kind: "desk",
    studentKey: student.studentKey,
    seatIndex: student.seatIndex,
    minX: seat.x - halfWidth,
    maxX: seat.x + halfWidth,
    minZ: seat.z - halfDepth,
    maxZ: seat.z + halfDepth,
  });
}

function createClassroomObstacles({
  fixture = CLASSROOM_WORLD_FIXTURE,
  deskConfig = DEFAULT_DESK_COLLISION_CONFIG,
} = {}) {
  if (!fixture || typeof fixture !== "object") {
    throw new TypeError("fixture must be an object");
  }

  if (!Array.isArray(fixture.students)) {
    throw new TypeError("fixture.students must be an array");
  }

  const obstacleKeys = new Set();

  const obstacles = fixture.students.map((student) => {
    const obstacle = createDeskObstacle(student, deskConfig);

    if (obstacleKeys.has(obstacle.obstacleKey)) {
      throw new Error(
        `duplicate obstacle key: ${obstacle.obstacleKey}`
      );
    }

    obstacleKeys.add(obstacle.obstacleKey);

    return obstacle;
  });

  return Object.freeze(obstacles);
}

export {
  DEFAULT_DESK_COLLISION_CONFIG,
  createDeskObstacle,
  createClassroomObstacles,
};