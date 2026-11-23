import assert from "node:assert/strict";

import {
  createHash
} from "node:crypto";

import {
  describe,
  it
} from "node:test";

import {
  canonicalCandidate,
  canonicalNumber,
  compareReplayTraces,
  createClassroomInteractionReplayAuditV12,
  deterministicFingerprint,
  stableStringify,
  validateReplayTrace
} from "./classroomInteractionReplayAuditV12.js";

function sha256(
  value
) {
  return createHash(
    "sha256"
  )
    .update(
      stableStringify(
        value
      )
    )
    .digest(
      "hex"
    );
}

function recordReferenceTrace() {
  const audit =
    createClassroomInteractionReplayAuditV12();

  audit.recordDecision({
    pickSequence:
      1,

    candidate: {
      provider:
        "student",

      interactionType:
        "student",

      interactionKey:
        "student:student-alpha",

      studentKey:
        "student-alpha",

      priority:
        200,

      distance:
        1.23456789,

      instanceId:
        2
    }
  });

  audit.recordActivation({
    pickSequence:
      1,

    candidate: {
      provider:
        "student",

      interactionType:
        "student",

      interactionKey:
        "student:student-alpha",

      studentKey:
        "student-alpha",

      priority:
        200,

      distance:
        1.23456789,

      instanceId:
        2
    },

    result: {
      handled:
        true,

      delegated:
        false,

      interactionType:
        "student",

      interactionKey:
        "student:student-alpha",

      command: {
        studentKey:
          "student-alpha",

        actionType:
          "probe_understanding"
      }
    }
  });

  return {
    audit,
    trace:
      audit.exportTrace()
  };
}

describe(
  "CW06 deterministic replay audit V12",
  () => {
    it(
      "canonicalizes numeric noise",
      () => {
        assert.equal(
          canonicalNumber(
            1.23456789
          ),
          1.234568
        );

        assert.equal(
          canonicalNumber(
            -0
          ),
          0
        );
      }
    );

    it(
      "stable stringify is key-order independent",
      () => {
        const left = {
          z:
            2,

          a: {
            y:
              4,

            x:
              3
          }
        };

        const right = {
          a: {
            x:
              3,

            y:
              4
          },

          z:
            2
        };

        assert.equal(
          stableStringify(
            left
          ),
          stableStringify(
            right
          )
        );
      }
    );

    it(
      "removes runtime object identity from candidates",
      () => {
        const candidate =
          canonicalCandidate({
            interactionKey:
              "student:alpha",

            distance:
              2,

            object: {
              uuid:
                "runtime-only"
            },

            hitObject: {
              uuid:
                "runtime-hit"
            },

            intersection: {
              faceIndex:
                4
            }
          });

        assert.equal(
          Object.hasOwn(
            candidate,
            "object"
          ),
          false
        );

        assert.equal(
          Object.hasOwn(
            candidate,
            "hitObject"
          ),
          false
        );

        assert.equal(
          Object.hasOwn(
            candidate,
            "intersection"
          ),
          false
        );
      }
    );

    it(
      "produces identical event streams across independent runs",
      () => {
        const first =
          recordReferenceTrace();

        const second =
          recordReferenceTrace();

        assert.deepEqual(
          first.trace,
          second.trace
        );

        assert.equal(
          first.trace.finalFingerprint,
          second.trace.finalFingerprint
        );
      }
    );

    it(
      "produces identical SHA-256 evidence for identical canonical traces",
      () => {
        const first =
          recordReferenceTrace();

        const second =
          recordReferenceTrace();

        assert.equal(
          sha256(
            first.trace
          ),
          sha256(
            second.trace
          )
        );
      }
    );

    it(
      "detects trace tampering",
      () => {
        const {
          trace
        } =
          recordReferenceTrace();

        const mutated =
          structuredClone(
            trace
          );

        mutated.events[
          0
        ].payload.candidate.studentKey =
          "student-tampered";

        const validation =
          validateReplayTrace(
            mutated
          );

        assert.equal(
          validation.valid,
          false
        );

        assert.ok(
          validation.issues.some(
            (issue) =>
              issue.startsWith(
                "FINGERPRINT_MISMATCH:"
              )
          )
        );
      }
    );

    it(
      "detects handled activation double-fire",
      () => {
        const {
          audit
        } =
          recordReferenceTrace();

        audit.recordActivation({
          pickSequence:
            1,

          candidate: {
            interactionType:
              "student",

            interactionKey:
              "student:student-alpha"
          },

          result: {
            handled:
              true,

            delegated:
              false,

            interactionType:
              "student",

            interactionKey:
              "student:student-alpha"
          }
        });

        const verification =
          audit.verifySelf();

        assert.equal(
          verification.valid,
          false
        );

        assert.ok(
          verification.issues.includes(
            "DOUBLE_FIRE:1"
          )
        );
      }
    );

    it(
      "rejects runtime UUID identity in replay traces",
      () => {
        const audit =
          createClassroomInteractionReplayAuditV12();

        audit.recordDecision({
          pickSequence:
            1,

          candidate: {
            interactionType:
              "window-shade",

            interactionKey:
              "window-shade:550e8400-e29b-41d4-a716-446655440000"
          }
        });

        const verification =
          audit.verifySelf();

        assert.equal(
          verification.valid,
          false
        );

        assert.ok(
          verification.issues.some(
            (issue) =>
              issue.startsWith(
                "NONDETERMINISTIC_RUNTIME_UUID:"
              )
          )
        );
      }
    );

    it(
      "compares valid traces deterministically",
      () => {
        const first =
          recordReferenceTrace();

        const second =
          recordReferenceTrace();

        const comparison =
          compareReplayTraces(
            first.trace,
            second.trace
          );

        assert.equal(
          comparison.same,
          true
        );
      }
    );

    it(
      "fingerprint changes when canonical event content changes",
      () => {
        assert.notEqual(
          deterministicFingerprint({
            action:
              "a"
          }),
          deterministicFingerprint({
            action:
              "b"
          })
        );
      }
    );
  }
);