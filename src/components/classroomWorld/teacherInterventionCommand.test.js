import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_ALLOWED_FIELDS,
  MATERIALIZER_ALLOWED_DEPENDENCIES,
  createTeacherInterventionCommand,
  materializeTeacherIntervention
} from "./teacherInterventionCommand.js";

const VALID_COMMAND = Object.freeze({
  studentKey: "student-001",
  actionType: "probe_understanding",
  analysisKey: "analysis-001"
});

function createCommand(overrides = {}) {
  return {
    ...VALID_COMMAND,
    ...overrides
  };
}

const deterministicDependencies =
  Object.freeze({
    createInterventionKey: () =>
      "intervention-001",

    nowIso: () =>
      "2026-11-23T08:00:00.000Z"
  });

test(
  "CW06 A2 teacher intervention command model",
  async (t) => {
    await t.test(
      "publishes a frozen command allowlist",
      () => {
        assert.ok(
          Object.isFrozen(
            COMMAND_ALLOWED_FIELDS
          )
        );

        assert.deepEqual(
          COMMAND_ALLOWED_FIELDS,
          [
            "studentKey",
            "actionType",
            "analysisKey"
          ]
        );
      }
    );

    await t.test(
      "publishes a frozen dependency allowlist",
      () => {
        assert.ok(
          Object.isFrozen(
            MATERIALIZER_ALLOWED_DEPENDENCIES
          )
        );

        assert.deepEqual(
          MATERIALIZER_ALLOWED_DEPENDENCIES,
          [
            "createInterventionKey",
            "nowIso"
          ]
        );
      }
    );

    await t.test(
      "creates an immutable canonical command",
      () => {
        const command =
          createTeacherInterventionCommand(
            createCommand()
          );

        assert.deepEqual(
          command,
          VALID_COMMAND
        );

        assert.ok(
          Object.isFrozen(command)
        );
      }
    );

    await t.test(
      "normalizes opaque command identity",
      () => {
        const command =
          createTeacherInterventionCommand(
            createCommand({
              studentKey:
                "  student-001  ",
              analysisKey:
                "  analysis-001  "
            })
          );

        assert.equal(
          command.studentKey,
          "student-001"
        );

        assert.equal(
          command.analysisKey,
          "analysis-001"
        );
      }
    );

    await t.test(
      "supports command without analysis identity",
      () => {
        const command =
          createTeacherInterventionCommand({
            studentKey: "student-001",
            actionType:
              "record_observation"
          });

        assert.deepEqual(
          command,
          {
            studentKey: "student-001",
            actionType:
              "record_observation"
          }
        );
      }
    );

    await t.test(
      "fails closed on unknown command fields",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              unexpectedField: true
            }),
          /Unsupported teacher intervention command field/
        );
      }
    );

    await t.test(
      "rejects command-supplied provenance",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              provenance: {
                source: "forged"
              }
            }),
          /Unsupported teacher intervention command field: provenance/
        );
      }
    );

    await t.test(
      "rejects command-supplied timestamps",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              createdAt:
                "2026-11-23T08:00:00.000Z"
            }),
          /Unsupported teacher intervention command field: createdAt/
        );
      }
    );

    await t.test(
      "rejects command-supplied intervention identity",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              interventionKey:
                "forged-key"
            }),
          /Unsupported teacher intervention command field: interventionKey/
        );
      }
    );

    await t.test(
      "rejects raw submission payloads",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              rawSubmission: {
                answer: "hidden"
              }
            }),
          /Unsupported teacher intervention command field: rawSubmission/
        );
      }
    );

    await t.test(
      "rejects direct student names",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              studentName:
                "Student Example"
            }),
          /Unsupported teacher intervention command field: studentName/
        );
      }
    );

    await t.test(
      "rejects email fields",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand({
              ...createCommand(),
              email:
                "student@example.invalid"
            }),
          /Unsupported teacher intervention command field: email/
        );
      }
    );

    await t.test(
      "rejects unsupported action types",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand(
              createCommand({
                actionType:
                  "delete_student"
              })
            ),
          /Unsupported intervention action/
        );
      }
    );

    await t.test(
      "requires student identity",
      () => {
        assert.throws(
          () =>
            createTeacherInterventionCommand(
              createCommand({
                studentKey: ""
              })
            ),
          /studentKey must not be empty/
        );
      }
    );

    await t.test(
      "materializes deterministic canonical intervention",
      () => {
        const intervention =
          materializeTeacherIntervention(
            createCommand(),
            deterministicDependencies
          );

        assert.deepEqual(
          intervention,
          {
            interventionKey:
              "intervention-001",

            studentKey:
              "student-001",

            actionType:
              "probe_understanding",

            createdAt:
              "2026-11-23T08:00:00.000Z",

            provenance: {
              source:
                "classroom-world",
              analysisKey:
                "analysis-001"
            }
          }
        );

        assert.ok(
          Object.isFrozen(intervention)
        );

        assert.ok(
          Object.isFrozen(
            intervention.provenance
          )
        );
      }
    );

    await t.test(
      "materialization is deterministic with deterministic dependencies",
      () => {
        const first =
          materializeTeacherIntervention(
            createCommand(),
            deterministicDependencies
          );

        const second =
          materializeTeacherIntervention(
            createCommand(),
            deterministicDependencies
          );

        assert.deepEqual(
          first,
          second
        );
      }
    );

    await t.test(
      "passes canonical command to key generator",
      () => {
        let observed;

        materializeTeacherIntervention(
          createCommand({
            studentKey:
              "  student-001  "
          }),
          {
            createInterventionKey:
              (command) => {
                observed = command;

                return "intervention-001";
              },

            nowIso: () =>
              "2026-11-23T08:00:00.000Z"
          }
        );

        assert.equal(
          observed.studentKey,
          "student-001"
        );

        assert.ok(
          Object.isFrozen(observed)
        );
      }
    );

    await t.test(
      "requires intervention-key dependency",
      () => {
        assert.throws(
          () =>
            materializeTeacherIntervention(
              createCommand(),
              {
                nowIso: () =>
                  "2026-11-23T08:00:00.000Z"
              }
            ),
          /createInterventionKey must be a function/
        );
      }
    );

    await t.test(
      "requires clock dependency",
      () => {
        assert.throws(
          () =>
            materializeTeacherIntervention(
              createCommand(),
              {
                createInterventionKey:
                  () =>
                    "intervention-001"
              }
            ),
          /nowIso must be a function/
        );
      }
    );

    await t.test(
      "rejects unknown materializer dependencies",
      () => {
        assert.throws(
          () =>
            materializeTeacherIntervention(
              createCommand(),
              {
                ...deterministicDependencies,
                networkClient: {}
              }
            ),
          /Unsupported materializer dependency field: networkClient/
        );
      }
    );

    await t.test(
      "rejects invalid generated intervention identity",
      () => {
        assert.throws(
          () =>
            materializeTeacherIntervention(
              createCommand(),
              {
                createInterventionKey:
                  () => "   ",

                nowIso: () =>
                  "2026-11-23T08:00:00.000Z"
              }
            ),
          /generated interventionKey must not be empty/
        );
      }
    );

    await t.test(
      "rejects invalid clock output through canonical contract",
      () => {
        assert.throws(
          () =>
            materializeTeacherIntervention(
              createCommand(),
              {
                createInterventionKey:
                  () =>
                    "intervention-001",

                nowIso: () =>
                  "not-a-timestamp"
              }
            ),
          /createdAt must be a valid ISO timestamp/
        );
      }
    );

    await t.test(
      "materializer owns provenance source",
      () => {
        const intervention =
          materializeTeacherIntervention(
            {
              studentKey:
                "student-001",

              actionType:
                "provide_hint"
            },
            deterministicDependencies
          );

        assert.deepEqual(
          intervention.provenance,
          {
            source:
              "classroom-world"
          }
        );
      }
    );

    await t.test(
      "does not retain caller-owned command object",
      () => {
        const input = {
          studentKey:
            "student-001",

          actionType:
            "provide_hint",

          analysisKey:
            "analysis-001"
        };

        const command =
          createTeacherInterventionCommand(
            input
          );

        input.studentKey =
          "mutated-student";

        input.analysisKey =
          "mutated-analysis";

        assert.equal(
          command.studentKey,
          "student-001"
        );

        assert.equal(
          command.analysisKey,
          "analysis-001"
        );
      }
    );
  }
);
