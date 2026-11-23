import assert from "node:assert/strict";
import test from "node:test";

import {
  createDynamicStudentRoster
} from "./studentRoster.js";

function createStore(records, keys = null) {
  const byKey = new Map(
    records.map((record) => [
      record.studentKey,
      Object.freeze({ ...record })
    ])
  );

  const orderedKeys =
    keys ??
    records.map((record) => record.studentKey);

  return Object.freeze({
    keys() {
      return [...orderedKeys];
    },

    requireStudent(studentKey) {
      if (!byKey.has(studentKey)) {
        throw new Error(
          `unknown studentKey: ${studentKey}`
        );
      }

      return byKey.get(studentKey);
    }
  });
}

test(
  "CW05 C2B1 dynamic student roster",
  async (t) => {
    await t.test(
      "creates one deterministic spatial identity per runtime student",
      () => {
        const store = createStore([
          {
            studentKey: "student-02",
            displayLabel: "Student 02",
            learningState: "needs-support"
          },
          {
            studentKey: "student-01",
            displayLabel: "Student 01",
            learningState: "on-track"
          }
        ]);

        const roster =
          createDynamicStudentRoster(store);

        assert.equal(roster.length, 2);

        assert.deepEqual(
          roster.map((student) => student.studentKey),
          ["student-02", "student-01"]
        );

        assert.deepEqual(
          roster.map((student) => student.seatIndex),
          [0, 1]
        );

        assert.equal(
          roster[0].displayLabel,
          "Student 02"
        );

        assert.equal(
          roster[1].displayLabel,
          "Student 01"
        );

        for (const student of roster) {
          assert.ok(
            Number.isFinite(student.position.x)
          );

          assert.ok(
            Number.isFinite(student.position.y)
          );

          assert.ok(
            Number.isFinite(student.position.z)
          );
        }
      }
    );

    await t.test(
      "does not copy intelligence payload into scene roster records",
      () => {
        const store = createStore([
          {
            studentKey: "student-01",
            displayLabel: "Student 01",
            learningState: "needs-review",
            priority: "high",
            confidence: 0.91,
            provenance: {
              sourceType: "analysis"
            },
            misconceptions: [
              "example"
            ],
            interventions: [
              "example"
            ]
          }
        ]);

        const roster =
          createDynamicStudentRoster(store);

        assert.deepEqual(
          Object.keys(roster[0]).sort(),
          [
            "displayLabel",
            "position",
            "seatIndex",
            "studentKey"
          ]
        );

        assert.equal(
          "learningState" in roster[0],
          false
        );

        assert.equal(
          "priority" in roster[0],
          false
        );

        assert.equal(
          "confidence" in roster[0],
          false
        );

        assert.equal(
          "provenance" in roster[0],
          false
        );

        assert.equal(
          "misconceptions" in roster[0],
          false
        );

        assert.equal(
          "interventions" in roster[0],
          false
        );
      }
    );

    await t.test(
      "falls back to studentKey when displayLabel is absent",
      () => {
        const store = createStore([
          {
            studentKey: "student-77"
          }
        ]);

        const roster =
          createDynamicStudentRoster(store);

        assert.equal(
          roster[0].displayLabel,
          "student-77"
        );
      }
    );

    await t.test(
      "fails closed on duplicate runtime keys",
      () => {
        const store = createStore(
          [
            {
              studentKey: "student-01",
              displayLabel: "Student 01"
            }
          ],
          [
            "student-01",
            "student-01"
          ]
        );

        assert.throws(
          () => createDynamicStudentRoster(store),
          /duplicate studentKey/
        );
      }
    );

    await t.test(
      "fails closed when runtime identity does not match lookup key",
      () => {
        const store = Object.freeze({
          keys() {
            return ["student-01"];
          },

          requireStudent() {
            return Object.freeze({
              studentKey: "student-99",
              displayLabel: "Student 99"
            });
          }
        });

        assert.throws(
          () => createDynamicStudentRoster(store),
          /identity mismatch/
        );
      }
    );

    await t.test(
      "returns immutable roster records",
      () => {
        const store = createStore([
          {
            studentKey: "student-01",
            displayLabel: "Student 01"
          }
        ]);

        const roster =
          createDynamicStudentRoster(store);

        assert.equal(
          Object.isFrozen(roster),
          true
        );

        assert.equal(
          Object.isFrozen(roster[0]),
          true
        );

        assert.equal(
          Object.isFrozen(roster[0].position),
          true
        );
      }
    );

    await t.test(
      "fails closed on invalid runtime store",
      () => {
        assert.throws(
          () => createDynamicStudentRoster(null),
          /intelligenceStore is required/
        );

        assert.throws(
          () =>
            createDynamicStudentRoster({
              keys() {
                return [];
              }
            }),
          /requireStudent/
        );
      }
    );
  }
);