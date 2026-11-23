const TEACHER_INTERVENTION_PHASE = Object.freeze({
  IDLE: "idle",
  PENDING: "pending",
  SUCCESS: "success",
  CONFLICT: "conflict",
  ERROR: "error",
});

function createStatus(
  phase,
  message,
) {
  return Object.freeze({
    phase,
    message,
  });
}

function createIdleTeacherInterventionStatus() {
  return createStatus(
    TEACHER_INTERVENTION_PHASE.IDLE,
    null,
  );
}

function createPendingTeacherInterventionStatus() {
  return createStatus(
    TEACHER_INTERVENTION_PHASE.PENDING,
    "SAVING INTERVENTION...",
  );
}

function createSuccessTeacherInterventionStatus() {
  return createStatus(
    TEACHER_INTERVENTION_PHASE.SUCCESS,
    "INTERVENTION SAVED",
  );
}

function createFailureTeacherInterventionStatus(
  error,
) {
  const code =
    typeof error?.code === "string"
      ? error.code.toUpperCase()
      : "";

  const conflict =
    error?.status === 409 ||
    code.includes("CONFLICT");

  if (conflict) {
    return createStatus(
      TEACHER_INTERVENTION_PHASE.CONFLICT,
      "INTERVENTION CONFLICT",
    );
  }

  return createStatus(
    TEACHER_INTERVENTION_PHASE.ERROR,
    "INTERVENTION FAILED",
  );
}

export {
  TEACHER_INTERVENTION_PHASE,
  createFailureTeacherInterventionStatus,
  createIdleTeacherInterventionStatus,
  createPendingTeacherInterventionStatus,
  createSuccessTeacherInterventionStatus,
};