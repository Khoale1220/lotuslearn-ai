const SUPPORTED_PHASES =
  new Set([
    "pending",
    "success",
    "conflict",
    "error"
  ]);


function normalizeStudentKey(
  value
) {
  if (
    typeof value !==
      "string" ||
    value.trim() ===
      ""
  ) {
    return null;
  }

  return value.trim();
}


function normalizeStudentLabel(
  student
) {
  const candidates = [
    student?.safeLabel,
    student?.displayLabel,
    student?.label,
    student?.studentKey
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim() !==
        ""
    ) {
      return candidate.trim();
    }
  }

  return "SELECTED STUDENT";
}


function captureTeacherInterventionFeedbackTargetV53(
  student
) {
  const studentKey =
    normalizeStudentKey(
      student?.studentKey
    );

  if (!studentKey) {
    return null;
  }

  return Object.freeze({
    studentKey,

    label:
      normalizeStudentLabel(
        student
      )
  });
}


function createPhasePresentation(
  phase,
  statusMessage
) {
  const message =
    typeof statusMessage ===
      "string" &&
    statusMessage.trim() !==
      ""
      ? statusMessage.trim()
      : null;

  if (
    phase ===
      "pending"
  ) {
    return Object.freeze({
      title:
        "INTERVENTION IN PROGRESS",

      detail:
        message ??
        "SAVING INTERVENTION...",

      buttonLabel:
        "SAVING...",

      role:
        "status",

      ariaLive:
        "polite"
    });
  }

  if (
    phase ===
      "success"
  ) {
    return Object.freeze({
      title:
        "INTERVENTION APPLIED",

      detail:
        message ??
        "INTERVENTION SAVED",

      buttonLabel:
        "APPLIED",

      role:
        "status",

      ariaLive:
        "polite"
    });
  }

  if (
    phase ===
      "conflict"
  ) {
    return Object.freeze({
      title:
        "INTERVENTION NEEDS REVIEW",

      detail:
        message ??
        "INTERVENTION CONFLICT",

      buttonLabel:
        "REVIEW CONFLICT",

      role:
        "alert",

      ariaLive:
        "assertive"
    });
  }

  return Object.freeze({
    title:
      "INTERVENTION FAILED",

    detail:
      message ??
      "INTERVENTION FAILED",

    buttonLabel:
      "RETRY INTERVENTION",

    role:
      "alert",

    ariaLive:
      "assertive"
  });
}


function createClassroomInterventionFeedbackV53({
  status,
  selectedStudent,
  target
}) {
  const phase =
    typeof status?.phase ===
      "string"
      ? status.phase.trim()
      : "";

  if (
    !SUPPORTED_PHASES.has(
      phase
    )
  ) {
    return null;
  }

  const selectedStudentKey =
    normalizeStudentKey(
      selectedStudent
        ?.studentKey
    );

  const targetStudentKey =
    normalizeStudentKey(
      target?.studentKey
    );

  /*
   * Fail closed.
   *
   * Never project intervention feedback onto
   * a different student HUD.
   */
  if (
    !selectedStudentKey ||
    !targetStudentKey ||
    selectedStudentKey !==
      targetStudentKey
  ) {
    return null;
  }

  const presentation =
    createPhasePresentation(
      phase,
      status?.message
    );

  return Object.freeze({
    version:
      53,

    phase,

    studentKey:
      targetStudentKey,

    studentLabel:
      target?.label ??
      normalizeStudentLabel(
        selectedStudent
      ),

    title:
      presentation.title,

    detail:
      presentation.detail,

    buttonLabel:
      presentation.buttonLabel,

    role:
      presentation.role,

    ariaLive:
      presentation.ariaLive
  });
}


export {
  captureTeacherInterventionFeedbackTargetV53,
  createClassroomInterventionFeedbackV53
};