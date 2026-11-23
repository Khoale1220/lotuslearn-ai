import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLASSROOM_WORLD_FIXTURE,
  seatToWorld,
  PIXEL_RENDER_CONFIG,
  INTERACTION_DISTANCE
} from "./classroomWorldContract.js";

describe("CW03 Classroom World rendering contract", () => {
  it("defines a minimal classroom fixture without raw student submissions", () => {
    assert.ok(CLASSROOM_WORLD_FIXTURE);
    assert.ok(Array.isArray(CLASSROOM_WORLD_FIXTURE.students));
    assert.ok(CLASSROOM_WORLD_FIXTURE.students.length >= 1);

    const student = CLASSROOM_WORLD_FIXTURE.students[0];

    assert.equal(typeof student.studentKey, "string");
    assert.equal(typeof student.seatIndex, "number");

    assert.equal("studentText" in student, false);
    assert.equal("rawSubmission" in student, false);
  });

  it("maps a seat deterministically to a finite 3D world coordinate", () => {
    const first = seatToWorld(0);
    const replay = seatToWorld(0);

    assert.deepEqual(first, replay);

    for (const axis of ["x", "y", "z"]) {
      assert.equal(Number.isFinite(first[axis]), true);
    }
  });

  it("defines an intentionally low-resolution pixel render budget", () => {
    assert.equal(Number.isInteger(PIXEL_RENDER_CONFIG.internalWidth), true);
    assert.equal(Number.isInteger(PIXEL_RENDER_CONFIG.internalHeight), true);

    assert.ok(PIXEL_RENDER_CONFIG.internalWidth > 0);
    assert.ok(PIXEL_RENDER_CONFIG.internalHeight > 0);

    assert.ok(PIXEL_RENDER_CONFIG.internalWidth <= 640);
    assert.ok(PIXEL_RENDER_CONFIG.internalHeight <= 360);

    assert.equal(PIXEL_RENDER_CONFIG.textureFilter, "nearest");
  });

  it("defines a bounded student interaction distance", () => {
    assert.equal(Number.isFinite(INTERACTION_DISTANCE), true);
    assert.ok(INTERACTION_DISTANCE > 0);
    assert.ok(INTERACTION_DISTANCE <= 4);
  });
});
