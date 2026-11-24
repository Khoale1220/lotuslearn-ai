import assert from "node:assert/strict";
import test from "node:test";

import {
  TEACHER_INTERVENTION_ENDPOINT,
  persistTeacherInterventionCommand,
} from "./teacherInterventionClient.js";

const command = Object.freeze({
  interventionKey:
    "11111111-1111-4111-8111-111111111111",

  studentKey:
    "student-demo-001",

  actionType:
    "teacher_intervention",

  analysisKey:
    "analysis-demo-001",

  createdAt:
    "2026-11-23T08:00:00.000Z",

  provenance: Object.freeze({
    source:
      "classroom-world",
  }),
});

test(
  "uses canonical teacher intervention endpoint",
  () => {
    assert.equal(
      TEACHER_INTERVENTION_ENDPOINT,
      "/api/teacher-interventions",
    );
  },
);

test(
  "posts canonical command as JSON",
  async () => {
    let requestUrl = null;
    let requestOptions = null;

    const fetchImpl =
      async (url, options) => {
        requestUrl = url;
        requestOptions = options;

        return {
          ok: true,
          status: 201,

          async json() {
            return {
              created: true,
              intervention: command,
            };
          },
        };
      };

    const result =
      await persistTeacherInterventionCommand(
        command,
        {
          fetchImpl,
        },
      );

    assert.equal(
      requestUrl,
      "/api/teacher-interventions",
    );

    assert.equal(
      requestOptions.method,
      "POST",
    );

    assert.equal(
      requestOptions.headers[
        "Content-Type"
      ],
      "application/json",
    );

    assert.deepEqual(
      JSON.parse(
        requestOptions.body,
      ),
      command,
    );

    assert.equal(
      result.created,
      true,
    );
  },
);

test(
  "preserves server conflict semantics",
  async () => {
    const fetchImpl =
      async () => ({
        ok: false,
        status: 409,

        async json() {
          return {
            error: {
              code:
                "INTERVENTION_CONFLICT",

              message:
                "conflicting replay",
            },
          };
        },
      });

    await assert.rejects(
      () =>
        persistTeacherInterventionCommand(
          command,
          {
            fetchImpl,
          },
        ),

      (error) => {
        assert.equal(
          error.code,
          "INTERVENTION_CONFLICT",
        );

        assert.equal(
          error.status,
          409,
        );

        return true;
      },
    );
  },
);

test(
  "sanitizes transport failure message",
  async () => {
    const fetchImpl =
      async () => {
        throw new Error(
          "secret transport detail",
        );
      };

    await assert.rejects(
      () =>
        persistTeacherInterventionCommand(
          command,
          {
            fetchImpl,
          },
        ),

      (error) => {
        assert.equal(
          error.code,
          "NETWORK_ERROR",
        );

        assert.equal(
          error.message,
          "teacher intervention request failed",
        );

        assert.equal(
          error.message.includes(
            "secret",
          ),
          false,
        );

        return true;
      },
    );
  },
);