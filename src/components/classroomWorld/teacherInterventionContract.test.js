import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_FIELDS,
  ALLOWED_PROVENANCE_FIELDS,
  INTERVENTION_ACTIONS,
  INTERVENTION_SOURCES,
  createTeacherIntervention
} from "./teacherInterventionContract.js";

const VALID_INPUT = Object.freeze({
  interventionKey: "intervention-001",
  studentKey: "student-001",
  actionType: "probe_understanding",
  createdAt: "2026-11-23T07:45:00.000Z",
  provenance: Object.freeze({
    source: "classroom-world",
    analysisKey: "analysis-001"
  })
});

function createInput(overrides = {}) {
  return {
    ...VALID_INPUT,
    provenance: {
      ...VALID_INPUT.provenance
    },
    ...overrides
  };
}

test(
  "CW06 A1 teacher intervention contract",
  async (t) => {
    await t.test(
      "exposes a frozen finite action vocabulary",
      () => {
        assert.ok(
          Object.isFrozen(
            INTERVENTION_ACTIONS
          )
        );

        assert.deepEqual(
          INTERVENTION_ACTIONS,
          [
            "probe_understanding",
            "provide_hint",
            "reteach_concept",
            "assign_targeted_practice",
            "schedule_follow_up",
            "record_observation"
          ]
        );
      }
    );

    await t.test(
      "exposes a frozen provenance vocabulary",
      () => {
        assert.ok(
          Object.isFrozen(
            INTERVENTION_SOURCES
          )
        );

        assert.deepEqual(
          INTERVENTION_SOURCES,
          ["classroom-world"]
        );
      }
    );

    await t.test(
      "publishes explicit allowlists",
      () => {
        assert.ok(
          Object.isFrozen(ALLOWED_FIELDS)
        );

        assert.ok(
          Object.isFrozen(
            ALLOWED_PROVENANCE_FIELDS
          )
        );

        assert.deepEqual(
          ALLOWED_FIELDS,
          [
            "interventionKey",
            "studentKey",
            "actionType",
            "createdAt",
            "provenance"
          ]
        );
      }
    );

    await t.test(
      "creates an immutable canonical intervention",
      () => {
        const result =
          createTeacherIntervention(
            createInput()
          );

        assert.deepEqual(
          result,
          VALID_INPUT
        );

        assert.ok(
          Object.isFrozen(result)
        );

        assert.ok(
          Object.isFrozen(
            result.provenance
          )
        );
      }
    );

    await t.test(
      "normalizes opaque identity strings",
      () => {
        const result =
          createTeacherIntervention(
            createInput({
              interventionKey:
                "  intervention-001  ",
              studentKey:
                "  student-001  "
            })
          );

        assert.equal(
          result.interventionKey,
          "intervention-001"
        );

        assert.equal(
          result.studentKey,
          "student-001"
        );
      }
    );

    await t.test(
      "allows provenance without an analysis key",
      () => {
        const result =
          createTeacherIntervention(
            createInput({
              provenance: {
                source: "classroom-world"
              }
            })
          );

        assert.deepEqual(
          result.provenance,
          {
            source: "classroom-world"
          }
        );
      }
    );

    await t.test(
      "fails closed on unknown top-level fields",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention({
              ...createInput(),
              unexpectedField: true
            }),
          /Unsupported teacher intervention field/
        );
      }
    );

    await t.test(
      "rejects raw submission material",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention({
              ...createInput(),
              rawSubmission: {
                answer: "secret"
              }
            }),
          /Unsupported teacher intervention field: rawSubmission/
        );
      }
    );

    await t.test(
      "rejects direct student names",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention({
              ...createInput(),
              studentName: "Student Example"
            }),
          /Unsupported teacher intervention field: studentName/
        );
      }
    );

    await t.test(
      "rejects email addresses as contract fields",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention({
              ...createInput(),
              email: "student@example.invalid"
            }),
          /Unsupported teacher intervention field: email/
        );
      }
    );

    await t.test(
      "fails closed on provenance expansion",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention(
              createInput({
                provenance: {
                  source:
                    "classroom-world",
                  rawAnalysis: {
                    hidden: true
                  }
                }
              })
            ),
          /Unsupported provenance field: rawAnalysis/
        );
      }
    );

    await t.test(
      "rejects unsupported intervention actions",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention(
              createInput({
                actionType:
                  "invented_action"
              })
            ),
          /Unsupported intervention action/
        );
      }
    );

    await t.test(
      "rejects missing student identity",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention(
              createInput({
                studentKey: ""
              })
            ),
          /studentKey must not be empty/
        );
      }
    );

    await t.test(
      "rejects non-canonical timestamps",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention(
              createInput({
                createdAt:
                  "2026-11-23 07:45:00"
              })
            ),
          /canonical ISO-8601 UTC format/
        );
      }
    );

    await t.test(
      "rejects unsupported provenance sources",
      () => {
        assert.throws(
          () =>
            createTeacherIntervention(
              createInput({
                provenance: {
                  source:
                    "threejs-direct-write"
                }
              })
            ),
          /Unsupported provenance source/
        );
      }
    );

    await t.test(
      "does not retain caller-owned mutable provenance",
      () => {
        const provenance = {
          source: "classroom-world",
          analysisKey: "analysis-001"
        };

        const result =
          createTeacherIntervention(
            createInput({
              provenance
            })
          );

        provenance.analysisKey =
          "mutated-analysis";

        assert.equal(
          result.provenance.analysisKey,
          "analysis-001"
        );
      }
    );
  }
);
