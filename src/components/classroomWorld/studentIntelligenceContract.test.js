import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_FIELDS,
  LEARNING_STATES,
  PRIORITIES,
  createStudentIntelligence
} from "./studentIntelligenceContract.js";

function validFixture() {
  return {
    studentKey: "student-demo-01",
    safeLabel: "Student 01",
    learningState: "needs-review",
    strengths: [
      "identifies main ideas"
    ],
    misconceptions: [
      "confuses past simple and present perfect"
    ],
    interventionPriority: "medium",
    recommendedActions: [
      "review timeline contrast examples"
    ],
    confidence: 0.87,
    provenance: {
      analysisVersion: "cw05-demo-v1",
      sourceType: "sanitized-analysis"
    }
  };
}

test("CW05 student intelligence contract", async (t) => {
  await t.test(
    "exports stable contract metadata",
    () => {
      assert.deepEqual(
        ALLOWED_FIELDS,
        [
          "studentKey",
          "safeLabel",
          "learningState",
          "strengths",
          "misconceptions",
          "interventionPriority",
          "recommendedActions",
          "confidence",
          "provenance"
        ]
      );

      assert.deepEqual(
        LEARNING_STATES,
        [
          "on-track",
          "needs-review",
          "needs-intervention"
        ]
      );

      assert.deepEqual(
        PRIORITIES,
        [
          "low",
          "medium",
          "high"
        ]
      );
    }
  );

  await t.test(
    "creates an immutable sanitized DTO",
    () => {
      const result = createStudentIntelligence(
        validFixture()
      );

      assert.equal(
        result.studentKey,
        "student-demo-01"
      );

      assert.equal(
        result.interventionPriority,
        "medium"
      );

      assert.equal(
        result.confidence,
        0.87
      );

      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.strengths));
      assert.ok(
        Object.isFrozen(result.misconceptions)
      );
      assert.ok(
        Object.isFrozen(result.recommendedActions)
      );
      assert.ok(Object.isFrozen(result.provenance));
    }
  );

  await t.test(
    "rejects unknown top-level fields fail-closed",
    () => {
      const fixture = validFixture();

      fixture.email = "student@example.invalid";

      assert.throws(
        () => createStudentIntelligence(fixture),
        /Unsupported student intelligence field: email/
      );
    }
  );

  await t.test(
    "rejects raw submission material",
    () => {
      const fixture = validFixture();

      fixture.rawSubmission =
        "raw student response";

      assert.throws(
        () => createStudentIntelligence(fixture),
        /Unsupported student intelligence field: rawSubmission/
      );
    }
  );

  await t.test(
    "rejects unsupported provenance fields",
    () => {
      const fixture = validFixture();

      fixture.provenance.studentName =
        "Real Student Name";

      assert.throws(
        () => createStudentIntelligence(fixture),
        /Unsupported provenance field: studentName/
      );
    }
  );

  await t.test(
    "rejects invalid confidence",
    () => {
      const fixture = validFixture();

      fixture.confidence = 1.01;

      assert.throws(
        () => createStudentIntelligence(fixture),
        /confidence must be a finite number between 0 and 1/
      );
    }
  );

  await t.test(
    "rejects invalid intervention priority",
    () => {
      const fixture = validFixture();

      fixture.interventionPriority = "critical";

      assert.throws(
        () => createStudentIntelligence(fixture),
        /interventionPriority must be one of/
      );
    }
  );

  await t.test(
    "rejects invalid learning state",
    () => {
      const fixture = validFixture();

      fixture.learningState = "unknown";

      assert.throws(
        () => createStudentIntelligence(fixture),
        /learningState must be one of/
      );
    }
  );

  await t.test(
    "does not retain caller array references",
    () => {
      const fixture = validFixture();

      const result = createStudentIntelligence(
        fixture
      );

      assert.notStrictEqual(
        result.strengths,
        fixture.strengths
      );

      assert.notStrictEqual(
        result.misconceptions,
        fixture.misconceptions
      );

      assert.notStrictEqual(
        result.recommendedActions,
        fixture.recommendedActions
      );
    }
  );
});
test("CW05 A1 prototype hardening", async (t) => {
  await t.test(
    "rejects objects with custom prototypes",
    () => {
      const inherited = Object.create(
        validFixture()
      );

      assert.throws(
        () => createStudentIntelligence(inherited),
        /input must be a plain object/
      );
    }
  );

  await t.test(
    "rejects non-plain provenance objects",
    () => {
      const fixture = validFixture();

      fixture.provenance = Object.create({
        analysisVersion: "cw05-demo-v1",
        sourceType: "sanitized-analysis"
      });

      assert.throws(
        () => createStudentIntelligence(fixture),
        /provenance must be a plain object/
      );
    }
  );

  await t.test(
    "exposes exactly the allowed DTO surface",
    () => {
      const result = createStudentIntelligence(
        validFixture()
      );

      assert.deepEqual(
        Object.keys(result),
        [...ALLOWED_FIELDS]
      );
    }
  );
});