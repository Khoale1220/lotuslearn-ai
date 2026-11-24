import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  persistTeacherInterventionViaPython,
} from "./teacherInterventionBridge.js";

function command({
  interventionKey = randomUUID(),
  actionType = "reteach",
} = {}) {
  return {
    interventionKey,
    studentKey:
      "student-server-bridge-test",
    actionType,
    analysisKey:
      "analysis-server-bridge-test",
    createdAt:
      new Date().toISOString(),
    provenance: {
      source:
        "server-bridge-integration-test",
      policy:
        "teacher-confirmed",
    },
  };
}

test(
  "Node -> Python -> PostgreSQL round trip is idempotent",
  async () => {
    assert.ok(
      process.env.LOTUSLEARN_DATABASE_URL,
    );

    const input = command();

    const first =
      await persistTeacherInterventionViaPython(
        input,
      );

    assert.equal(first.created, true);

    const replay =
      await persistTeacherInterventionViaPython(
        input,
      );

    assert.equal(
      replay.created,
      false,
    );

    assert.deepEqual(
      replay.intervention,
      first.intervention,
    );
  },
);

test(
  "conflicting replay fails closed across process boundary",
  async () => {
    const interventionKey =
      randomUUID();

    await persistTeacherInterventionViaPython(
      command({
        interventionKey,
        actionType: "reteach",
      }),
    );

    await assert.rejects(
      () =>
        persistTeacherInterventionViaPython(
          command({
            interventionKey,
            actionType: "conference",
          }),
        ),
      (error) => {
        assert.equal(
          error.code,
          "INTERVENTION_CONFLICT",
        );

        return true;
      },
    );
  },
);