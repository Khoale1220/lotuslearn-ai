import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { randomUUID } from "node:crypto";

import {
  createTeacherInterventionController,
} from "./teacherInterventionController.js";

function command(overrides = {}) {
  return {
    interventionKey: randomUUID(),
    studentKey: "student-demo-001",
    actionType: "reteach",
    analysisKey: "analysis-demo-001",
    createdAt: "2026-11-23T08:00:00Z",
    provenance: {
      source: "classroom-world",
      policy: "teacher-confirmed",
    },
    ...overrides,
  };
}

function responseRecorder() {
  return {
    statusCode: null,
    payload: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test(
  "valid command is revalidated before persistence",
  async () => {
    let captured = null;

    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async (payload) => {
            captured = payload;

            return {
              created: true,
              intervention: payload,
            };
          },
      });

    const input = command();
    const res = responseRecorder();

    await handler(
      { body: input },
      res,
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.ok, true);
    assert.equal(
      captured.interventionKey,
      input.interventionKey,
    );
  },
);

test(
  "idempotent replay returns 200",
  async () => {
    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async (payload) => ({
            created: false,
            intervention: payload,
          }),
      });

    const res = responseRecorder();

    await handler(
      { body: command() },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
      res.payload.created,
      false,
    );
  },
);

test(
  "unknown fields fail closed",
  async () => {
    let called = false;

    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async () => {
            called = true;
          },
      });

    const res = responseRecorder();

    await handler(
      {
        body: command({
          unexpectedField: "forbidden",
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  },
);

test(
  "privacy-bearing provenance fails closed",
  async () => {
    let called = false;

    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async () => {
            called = true;
          },
      });

    const res = responseRecorder();

    await handler(
      {
        body: command({
          provenance: {
            source: "classroom-world",
            studentName: "forbidden",
          },
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  },
);

test(
  "conflicting replay maps to 409",
  async () => {
    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async () => {
            const error =
              new Error("conflict");

            error.code =
              "INTERVENTION_CONFLICT";

            throw error;
          },
      });

    const res = responseRecorder();

    await handler(
      { body: command() },
      res,
    );

    assert.equal(res.statusCode, 409);
  },
);

test(
  "infrastructure detail is not exposed",
  async () => {
    const handler =
      createTeacherInterventionController({
        persistIntervention:
          async () => {
            const error =
              new Error(
                "postgresql://secret:password@host/db",
              );

            error.code =
              "PERSISTENCE_ERROR";

            throw error;
          },
      });

    const res = responseRecorder();

    await handler(
      { body: command() },
      res,
    );

    assert.equal(res.statusCode, 503);

    assert.equal(
      JSON.stringify(res.payload).includes(
        "password",
      ),
      false,
    );
  },
);

test(
  "router wires rate-limited teacher intervention endpoint",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../routes/api.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /router\.post\(\s*["']\/teacher-interventions["']/u,
    );

    assert.match(
      source,
      /inferenceRateLimiter/u,
    );

    assert.match(
      source,
      /handleTeacherIntervention/u,
    );
  },
);