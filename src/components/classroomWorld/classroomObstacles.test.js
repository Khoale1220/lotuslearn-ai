import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSROOM_WORLD_FIXTURE,
  seatToWorld,
} from "./classroomWorldContract.js";

import {
  DEFAULT_DESK_COLLISION_CONFIG,
  createClassroomObstacles,
  createDeskObstacle,
} from "./classroomObstacles.js";

test("CW04 classroom obstacle model", async (t) => {
  await t.test(
    "creates deterministic desk bounds from a student seat",
    () => {
      const student = {
        studentKey: "student-test",
        seatIndex: 0,
      };

      const seat = seatToWorld(student.seatIndex);
      const obstacle = createDeskObstacle(student);

      assert.equal(obstacle.obstacleKey, "desk:student-test");
      assert.equal(obstacle.kind, "desk");
      assert.equal(obstacle.studentKey, "student-test");
      assert.equal(obstacle.seatIndex, 0);

      assert.equal(
        obstacle.minX,
        seat.x - DEFAULT_DESK_COLLISION_CONFIG.halfWidth
      );

      assert.equal(
        obstacle.maxX,
        seat.x + DEFAULT_DESK_COLLISION_CONFIG.halfWidth
      );

      assert.equal(
        obstacle.minZ,
        seat.z - DEFAULT_DESK_COLLISION_CONFIG.halfDepth
      );

      assert.equal(
        obstacle.maxZ,
        seat.z + DEFAULT_DESK_COLLISION_CONFIG.halfDepth
      );
    }
  );

  await t.test(
    "creates one deterministic obstacle per fixture student",
    () => {
      const obstacles = createClassroomObstacles();

      assert.equal(
        obstacles.length,
        CLASSROOM_WORLD_FIXTURE.students.length
      );

      assert.deepEqual(
        obstacles.map((obstacle) => obstacle.studentKey),
        CLASSROOM_WORLD_FIXTURE.students.map(
          (student) => student.studentKey
        )
      );
    }
  );

  await t.test(
    "returns immutable obstacle descriptors",
    () => {
      const obstacles = createClassroomObstacles();

      assert.ok(Object.isFrozen(obstacles));

      for (const obstacle of obstacles) {
        assert.ok(Object.isFrozen(obstacle));
      }
    }
  );

  await t.test(
    "produces valid axis-aligned collision bounds",
    () => {
      const obstacles = createClassroomObstacles();

      for (const obstacle of obstacles) {
        assert.ok(Number.isFinite(obstacle.minX));
        assert.ok(Number.isFinite(obstacle.maxX));
        assert.ok(Number.isFinite(obstacle.minZ));
        assert.ok(Number.isFinite(obstacle.maxZ));

        assert.ok(obstacle.minX < obstacle.maxX);
        assert.ok(obstacle.minZ < obstacle.maxZ);
      }
    }
  );

  await t.test(
    "fails closed on malformed student input",
    () => {
      assert.throws(
        () =>
          createDeskObstacle({
            studentKey: "",
            seatIndex: 0,
          }),
        TypeError
      );

      assert.throws(
        () =>
          createDeskObstacle({
            studentKey: "student-test",
            seatIndex: -1,
          }),
        RangeError
      );
    }
  );

  await t.test(
    "rejects duplicate deterministic obstacle identities",
    () => {
      assert.throws(
        () =>
          createClassroomObstacles({
            fixture: {
              students: [
                {
                  studentKey: "duplicate",
                  seatIndex: 0,
                },
                {
                  studentKey: "duplicate",
                  seatIndex: 1,
                },
              ],
            },
          }),
        /duplicate obstacle key/
      );
    }
  );
});