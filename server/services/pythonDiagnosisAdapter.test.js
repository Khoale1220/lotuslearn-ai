import assert from "node:assert";
import { test } from "node:test";
import { runDiagnosisCli } from "./pythonDiagnosisAdapter.js";

function createRequest() {
  return {
    context: {
      learningObjective: "Distinguish past simple from present perfect"
    },
    observations: [
      {
        studentId: "S-01"
      }
    ],
    providerResult: {
      text: JSON.stringify({
        classSnapshot: {
          strongestConcept: "Experience",
          highestPriorityNeed: "Finished time",
          overallRecommendation: "Contrast time markers"
        },
        misconceptionClusters: [
          {
            clusterId: "cluster-1",
            misconceptionTitle: "Finished time",
            explanation: "Confuses completed and ongoing time",
            affectedStudentIds: ["S-01"],
            evidenceExamples: [],
            recommendedInstructionalResponse: "Model the contrast"
          }
        ]
      }),
      modelUsed: "offline-fixture",
      durationMs: 18,
      telemetry: {
        stage: "Stage 2: Diagnosis",
        latencyMs: 18
      }
    }
  };
}

test("Python Diagnosis adapter preserves the Stage 3 cross-language contract", async () => {
  const result = await runDiagnosisCli(createRequest());

  assert.deepStrictEqual(result, {
    classSnapshot: {
      totalSubmissions: 1,
      misconceptionCount: 1,
      strongestConcept: "Experience",
      highestPriorityNeed: "Finished time",
      overallRecommendation: "Contrast time markers"
    },
    misconceptionClusters: [
      {
        clusterId: "cluster-1",
        misconceptionTitle: "Finished time",
        explanation: "Confuses completed and ongoing time",
        affectedStudentIds: ["S-01"],
        studentCount: 1,
        percentageAffected: 100,
        evidenceExamples: [],
        teachingPriority: "high",
        confidence: 0.9,
        recommendedInstructionalResponse: "Model the contrast",
        status: "pending",
        teacherDecision: "pending"
      }
    ],
    modelUsed: "offline-fixture",
    durationMs: 18,
    telemetry: {
      stage: "Stage 2: Diagnosis",
      latencyMs: 18
    }
  });
});

test("Python Diagnosis adapter fails closed on malformed provider output", async () => {
  const request = createRequest();
  request.providerResult.text = "{broken";

  await assert.rejects(
    () => runDiagnosisCli(request),
    (error) => {
      assert.match(
        error.message,
        /Python Diagnosis CLI failed/
      );

      assert.match(
        error.message,
        /malformed JSON/
      );

      return true;
    }
  );
});

test("Python Diagnosis adapter fails closed when the Stage 3 request is invalid", async () => {
  const request = createRequest();
  request.observations = "invalid";

  await assert.rejects(
    () => runDiagnosisCli(request),
    (error) => {
      assert.match(
        error.message,
        /Python Diagnosis CLI failed/
      );

      assert.match(
        error.message,
        /observations must be an array/
      );

      return true;
    }
  );
});
