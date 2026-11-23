import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSROOM_WORLD_FIXTURE,
  INTERACTION_DISTANCE,
  seatToWorld
} from "./classroomWorldContract.js";

import {
  createClassroomObstacles
} from "./classroomObstacles.js";

import {
  resolvePlayerCollision
} from "./playerCollision.js";

const ROOM_BOUNDS = Object.freeze({
  minX: -7.2,
  maxX: 7.2,
  minZ: -7.2,
  maxZ: 7.2
});

const PLAYER_RADIUS = 0.35;

function containsPoint(obstacle, point) {
  return (
    point.x >= obstacle.minX &&
    point.x <= obstacle.maxX &&
    point.z >= obstacle.minZ &&
    point.z <= obstacle.maxZ
  );
}

function distance2D(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.z - b.z
  );
}

function centerOf(obstacle) {
  return {
    x: (obstacle.minX + obstacle.maxX) / 2,
    z: (obstacle.minZ + obstacle.maxZ) / 2
  };
}

test("CW04 D1.5 scene collision acceptance", async (t) => {
  const obstacles = createClassroomObstacles({
    fixture: CLASSROOM_WORLD_FIXTURE
  });

  await t.test(
    "scene fixture produces deterministic collision geometry",
    () => {
      const second = createClassroomObstacles({
        fixture: CLASSROOM_WORLD_FIXTURE
      });

      assert.deepEqual(
        second,
        obstacles,
        "same classroom fixture must produce identical obstacle geometry"
      );
    }
  );

  await t.test(
    "every classroom obstacle has a valid finite AABB",
    () => {
      assert.ok(
        obstacles.length > 0,
        "classroom must expose at least one collision obstacle"
      );

      for (const obstacle of obstacles) {
        assert.ok(Number.isFinite(obstacle.minX));
        assert.ok(Number.isFinite(obstacle.maxX));
        assert.ok(Number.isFinite(obstacle.minZ));
        assert.ok(Number.isFinite(obstacle.maxZ));

        assert.ok(
          obstacle.minX < obstacle.maxX,
          "obstacle minX must be smaller than maxX"
        );

        assert.ok(
          obstacle.minZ < obstacle.maxZ,
          "obstacle minZ must be smaller than maxZ"
        );
      }
    }
  );

  await t.test(
    "collision geometry remains inside classroom world bounds",
    () => {
      for (const obstacle of obstacles) {
        assert.ok(
          obstacle.minX >= ROOM_BOUNDS.minX,
          "obstacle must not escape minimum x classroom bound"
        );

        assert.ok(
          obstacle.maxX <= ROOM_BOUNDS.maxX,
          "obstacle must not escape maximum x classroom bound"
        );

        assert.ok(
          obstacle.minZ >= ROOM_BOUNDS.minZ,
          "obstacle must not escape minimum z classroom bound"
        );

        assert.ok(
          obstacle.maxZ <= ROOM_BOUNDS.maxZ,
          "obstacle must not escape maximum z classroom bound"
        );
      }
    }
  );

  await t.test(
    "student scene anchors have corresponding collision geometry",
    () => {
      for (const student of CLASSROOM_WORLD_FIXTURE.students) {
        const seat = seatToWorld(student.seatIndex);

        const nearestObstacle = obstacles
          .map((obstacle) => ({
            obstacle,
            distance: distance2D(
              seat,
              centerOf(obstacle)
            )
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        assert.ok(
          nearestObstacle,
          `student ${student.studentKey} must have collision geometry`
        );

        assert.ok(
          nearestObstacle.distance <= INTERACTION_DISTANCE,
          `collision geometry for ${student.studentKey} must remain spatially aligned with its scene seat`
        );
      }
    }
  );

  await t.test(
    "player cannot resolve into the center of any rendered classroom obstacle",
    () => {
      for (const obstacle of obstacles) {
        const center = centerOf(obstacle);

        const previousPosition = {
          x: obstacle.minX - PLAYER_RADIUS - 0.05,
          z: center.z
        };

        const proposedPosition = {
          x: center.x,
          z: center.z
        };

        const resolved = resolvePlayerCollision({
          previousPosition,
          proposedPosition,
          bounds: ROOM_BOUNDS,
          obstacles,
          radius: PLAYER_RADIUS
        });

        assert.equal(
          containsPoint(obstacle, resolved),
          false,
          "resolved player position must never remain inside classroom obstacle geometry"
        );

        assert.ok(Number.isFinite(resolved.x));
        assert.ok(Number.isFinite(resolved.z));
      }
    }
  );

  await t.test(
    "student interaction anchors stay within the configured interaction envelope",
    () => {
      for (const student of CLASSROOM_WORLD_FIXTURE.students) {
        const seat = seatToWorld(student.seatIndex);

        const candidate = obstacles
          .map((obstacle) => ({
            obstacle,
            distance: distance2D(
              seat,
              centerOf(obstacle)
            )
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        assert.ok(candidate);

        assert.ok(
          candidate.distance <= INTERACTION_DISTANCE,
          `student ${student.studentKey} must remain reachable from its collision/scene anchor`
        );
      }
    }
  );
});