import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeRuntimeStudentIntelligence,
  createStudentIntelligenceRuntimeStore
} from "./studentIntelligenceRuntime.js";

function canonicalizeFixture(input) {
  return {
    studentKey: input.studentKey,
    displayLabel: input.displayLabel ?? input.studentKey,
    status: input.status ?? "ready",
    signals: input.signals ?? [],
    summary: input.summary ?? {
      confidence: 0.8
    }
  };
}

test("CW05 A2.3.1B runtime intelligence store", async (t) => {
  await t.test(
    "creates immutable deterministic snapshots",
    () => {
      const store =
        createStudentIntelligenceRuntimeStore(
          [
            {
              studentKey: "student-02",
              displayLabel: "Student 02"
            },
            {
              studentKey: "student-01",
              displayLabel: "Student 01"
            }
          ],
          {
            canonicalize: canonicalizeFixture
          }
        );

      assert.equal(store.size, 2);
      assert.ok(Object.isFrozen(store));

      assert.deepEqual(
        store.keys(),
        ["student-01", "student-02"]
      );

      assert.ok(Object.isFrozen(store.keys()));
      assert.ok(Object.isFrozen(store.snapshot()));

      const snapshot = store.snapshot();

      assert.equal(snapshot.length, 2);
      assert.equal(
        snapshot[0].studentKey,
        "student-01"
      );
      assert.equal(
        snapshot[1].studentKey,
        "student-02"
      );

      assert.ok(Object.isFrozen(snapshot[0]));
      assert.ok(Object.isFrozen(snapshot[0].signals));
      assert.ok(Object.isFrozen(snapshot[0].summary));
    }
  );

  await t.test(
    "performs deterministic key lookup",
    () => {
      const store =
        createStudentIntelligenceRuntimeStore(
          [
            {
              studentKey: "student-01",
              displayLabel: "Student 01"
            }
          ],
          {
            canonicalize: canonicalizeFixture
          }
        );

      assert.equal(
        store.has("student-01"),
        true
      );

      assert.equal(
        store.has(" student-01 "),
        true
      );

      assert.equal(
        store.has("student-99"),
        false
      );

      assert.equal(
        store.get("student-01").displayLabel,
        "Student 01"
      );

      assert.equal(
        store.get("student-99"),
        null
      );
    }
  );

  await t.test(
    "fails closed when requiring an unknown student",
    () => {
      const store =
        createStudentIntelligenceRuntimeStore(
          [],
          {
            canonicalize: canonicalizeFixture
          }
        );

      assert.throws(
        () => store.requireStudent("student-404"),
        /unknown studentKey/
      );
    }
  );

  await t.test(
    "rejects duplicate student keys after normalization",
    () => {
      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [
              {
                studentKey: "student-01"
              },
              {
                studentKey: " student-01 "
              }
            ],
            {
              canonicalize: canonicalizeFixture
            }
          ),
        /duplicate studentKey/
      );
    }
  );

  await t.test(
    "rejects invalid record collections",
    () => {
      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            null
          ),
        /records must be an array/
      );

      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            {}
          ),
        /records must be an array/
      );
    }
  );

  await t.test(
    "rejects invalid canonicalizer configuration",
    () => {
      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [],
            {
              canonicalize: "invalid"
            }
          ),
        /canonicalize must be a function/
      );
    }
  );

  await t.test(
    "rejects malformed canonicalizer output",
    () => {
      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [{}],
            {
              canonicalize: () => null
            }
          ),
        /canonical record/
      );

      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [{}],
            {
              canonicalize: () => ({
                studentKey: ""
              })
            }
          ),
        /studentKey/
      );
    }
  );

  await t.test(
    "canonicalizes each record exactly once",
    () => {
      let callCount = 0;

      const store =
        createStudentIntelligenceRuntimeStore(
          [
            {
              studentKey: "student-01"
            },
            {
              studentKey: "student-02"
            },
            {
              studentKey: "student-03"
            }
          ],
          {
            canonicalize(input) {
              callCount += 1;
              return canonicalizeFixture(input);
            }
          }
        );

      assert.equal(callCount, 3);
      assert.equal(store.size, 3);
    }
  );

  await t.test(
    "rejects forbidden raw student data surfaces",
    () => {
      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [
              {
                studentKey: "student-01"
              }
            ],
            {
              canonicalize() {
                return {
                  studentKey: "student-01",
                  rawSubmission: "raw answer"
                };
              }
            }
          ),
        /forbidden raw student data field/
      );

      assert.throws(
        () =>
          createStudentIntelligenceRuntimeStore(
            [
              {
                studentKey: "student-01"
              }
            ],
            {
              canonicalize() {
                return {
                  studentKey: "student-01",
                  metadata: {
                    email: "student@example.invalid"
                  }
                };
              }
            }
          ),
        /forbidden raw student data field/
      );
    }
  );

  await t.test(
    "does not expose mutable caller-owned objects",
    () => {
      const source = {
        studentKey: "student-01",
        displayLabel: "Student 01",
        signals: [
          "signal-a"
        ]
      };

      const store =
        createStudentIntelligenceRuntimeStore(
          [source],
          {
            canonicalize: canonicalizeFixture
          }
        );

      source.displayLabel = "MUTATED";
      source.signals.push("signal-b");

      const stored = store.requireStudent(
        "student-01"
      );

      assert.equal(
        stored.displayLabel,
        "Student 01"
      );

      assert.deepEqual(
        stored.signals,
        ["signal-a"]
      );
    }
  );

  await t.test(
    "keeps the production canonicalizer wired to the contract",
    () => {
      assert.equal(
        typeof canonicalizeRuntimeStudentIntelligence,
        "function"
      );

      assert.throws(
        () =>
          canonicalizeRuntimeStudentIntelligence({
            studentKey: "",
            rawSubmission: "invalid"
          })
      );
    }
  );
});