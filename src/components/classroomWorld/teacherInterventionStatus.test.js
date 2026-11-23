import assert from "node:assert/strict";
import test from "node:test";

import {
  TEACHER_INTERVENTION_PHASE,
  createFailureTeacherInterventionStatus,
  createIdleTeacherInterventionStatus,
  createPendingTeacherInterventionStatus,
  createSuccessTeacherInterventionStatus,
} from "./teacherInterventionStatus.js";

test(
  "teacher intervention lifecycle states are deterministic and immutable",
  () => {
    const idle =
      createIdleTeacherInterventionStatus();

    const pending =
      createPendingTeacherInterventionStatus();

    const success =
      createSuccessTeacherInterventionStatus();

    assert.equal(
      idle.phase,
      TEACHER_INTERVENTION_PHASE.IDLE,
    );

    assert.equal(
      pending.phase,
      TEACHER_INTERVENTION_PHASE.PENDING,
    );

    assert.equal(
      pending.message,
      "SAVING INTERVENTION...",
    );

    assert.equal(
      success.phase,
      TEACHER_INTERVENTION_PHASE.SUCCESS,
    );

    assert.equal(
      success.message,
      "INTERVENTION SAVED",
    );

    assert.equal(Object.isFrozen(idle), true);
    assert.equal(Object.isFrozen(pending), true);
    assert.equal(Object.isFrozen(success), true);
  },
);

test(
  "HTTP 409 maps to sanitized conflict feedback",
  () => {
    const result =
      createFailureTeacherInterventionStatus({
        status: 409,
        message:
          "private database information",
      });

    assert.equal(
      result.phase,
      TEACHER_INTERVENTION_PHASE.CONFLICT,
    );

    assert.equal(
      result.message,
      "INTERVENTION CONFLICT",
    );

    assert.equal(
      JSON.stringify(result).includes(
        "database",
      ),
      false,
    );
  },
);

test(
  "conflict code maps to conflict feedback",
  () => {
    const result =
      createFailureTeacherInterventionStatus({
        code:
          "INTERVENTION_CONFLICT",
      });

    assert.equal(
      result.phase,
      TEACHER_INTERVENTION_PHASE.CONFLICT,
    );
  },
);

test(
  "unknown error maps to safe generic feedback",
  () => {
    const result =
      createFailureTeacherInterventionStatus(
        new Error(
          "secret database password",
        ),
      );

    assert.equal(
      result.phase,
      TEACHER_INTERVENTION_PHASE.ERROR,
    );

    assert.equal(
      result.message,
      "INTERVENTION FAILED",
    );

    assert.equal(
      JSON.stringify(result).includes(
        "password",
      ),
      false,
    );

    assert.equal(
      Object.isFrozen(result),
      true,
    );
  },
);