import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptStudentIntelligence,
} from "./studentIntelligenceAdapter.js";

function fixture() {
  return {
    observations: [
      {
        studentId: "learner-b",
        demonstratedUnderstanding: [
          "Identifies the main idea",
        ],
        misconceptions: [
          "Confuses supporting detail with main idea",
        ],
        supportingEvidence: [
          "Evidence remains outside Classroom World",
        ],
        rubricAlignment: [],
        confidence: 0.81,
        evidenceStrength: "moderate",
        recommendedSupportLevel: "targeted",
      },
      {
        studentId: "learner-a",
        demonstratedUnderstanding: [
          "Uses context clues",
        ],
        misconceptions: [],
        supportingEvidence: [],
        rubricAlignment: [],
        confidence: 0.94,
        evidenceStrength: "strong",
        recommendedSupportLevel: "low",
      },
    ],

    misconceptionClusters: [
      {
        clusterId: "cluster-1",
        misconceptionTitle:
          "Confuses supporting detail with main idea",
        explanation: "Internal analysis detail",
        affectedStudentIds: ["learner-b"],
        studentCount: 1,
        percentageAffected: 50,
        evidenceExamples: [
          "Evidence text must not enter Classroom World",
        ],
        teachingPriority: "high",
        confidence: 0.9,
        evidenceStrength: "strong",
        recommendedInstructionalResponse:
          "Model main-idea versus detail classification",
      },
    ],

    interventions: [
      {
        interventionId: "intervention-1",
        clusterId: "cluster-1",
        targetMisconceptionTitle:
          "Confuses supporting detail with main idea",
        title: "Main idea sorting mini-lesson",
        supportTier: "targeted",
        rationale: "Internal rationale",
        suggestedActivity:
          "Sort statements into main ideas and details",
        teacherScript:
          "Teacher-only script must not enter Classroom World",
        exampleQuestion:
          "Teacher-only example question",
        exitTicketQuestion:
          "Teacher-only exit ticket",
      },
    ],

    analysisVersion: "cw05-adapter-test-v1",
    sourceType: "lotuslearn-analysis",
  };
}

test("CW05 A2.2C sanitized intelligence adapter", async (t) => {
  await t.test(
    "projects only canonical sanitized student intelligence",
    () => {
      const result = adaptStudentIntelligence(fixture());

      assert.equal(result.length, 2);

      assert.deepEqual(
        result.map((student) => student.studentKey),
        ["student-01", "student-02"]
      );

      assert.deepEqual(
        result.map((student) => student.safeLabel),
        ["Student 01", "Student 02"]
      );

      const studentA = result[0];
      const studentB = result[1];

      assert.equal(studentA.learningState, "on-track");
      assert.equal(studentA.interventionPriority, "low");
      assert.equal(studentA.confidence, 0.94);

      assert.equal(
        studentB.learningState,
        "needs-intervention"
      );

      assert.equal(
        studentB.interventionPriority,
        "high"
      );

      assert.deepEqual(
        studentB.misconceptions,
        ["Confuses supporting detail with main idea"]
      );

      assert.deepEqual(
        studentB.recommendedActions,
        [
          "Model main-idea versus detail classification",
          "Main idea sorting mini-lesson",
          "Sort statements into main ideas and details",
        ]
      );
    }
  );

  await t.test(
    "does not expose source student identifiers or raw evidence surfaces",
    () => {
      const result = adaptStudentIntelligence(fixture());
      const serialized = JSON.stringify(result);

      assert.equal(serialized.includes("learner-a"), false);
      assert.equal(serialized.includes("learner-b"), false);

      assert.equal(
        serialized.includes(
          "Evidence remains outside Classroom World"
        ),
        false
      );

      assert.equal(
        serialized.includes(
          "Evidence text must not enter Classroom World"
        ),
        false
      );

      assert.equal(
        serialized.includes(
          "Teacher-only script must not enter Classroom World"
        ),
        false
      );

      assert.equal(
        serialized.includes(
          "Teacher-only example question"
        ),
        false
      );

      assert.equal(
        serialized.includes(
          "Teacher-only exit ticket"
        ),
        false
      );
    }
  );

  await t.test(
    "is deterministic regardless of observation input ordering",
    () => {
      const firstInput = fixture();
      const secondInput = fixture();

      secondInput.observations.reverse();

      const first = adaptStudentIntelligence(firstInput);
      const second = adaptStudentIntelligence(secondInput);

      assert.deepEqual(second, first);
    }
  );

  await t.test(
    "fails closed when a raw-data field enters an observation",
    () => {
      const input = fixture();

      input.observations[0].rawSubmission =
        "raw student submission";

      assert.throws(
        () => adaptStudentIntelligence(input),
        /forbidden raw-data field: rawSubmission/
      );
    }
  );

  await t.test(
    "fails closed on duplicate source student identifiers",
    () => {
      const input = fixture();

      input.observations[1].studentId =
        input.observations[0].studentId;

      assert.throws(
        () => adaptStudentIntelligence(input),
        /duplicate observation studentId/
      );
    }
  );

  await t.test(
    "fails closed on invalid confidence",
    () => {
      const input = fixture();

      input.observations[0].confidence = 1.5;

      assert.throws(
        () => adaptStudentIntelligence(input),
        /confidence must be between 0 and 1/
      );
    }
  );

  await t.test(
    "returns frozen canonical DTOs",
    () => {
      const result = adaptStudentIntelligence(fixture());

      assert.equal(Object.isFrozen(result), true);
      assert.equal(Object.isFrozen(result[0]), true);
      assert.equal(Object.isFrozen(result[0].strengths), true);
      assert.equal(
        Object.isFrozen(result[0].misconceptions),
        true
      );
      assert.equal(
        Object.isFrozen(result[0].recommendedActions),
        true
      );
      assert.equal(
        Object.isFrozen(result[0].provenance),
        true
      );
    }
  );
});