const CLASSROOM_INTERACTION_MODE =
  Object.freeze({
    ENTRY_GATE:
      "ENTRY_GATE",

    PLAYING_LOCKED:
      "PLAYING_LOCKED",

    PLAYING_UNLOCKED:
      "PLAYING_UNLOCKED",

    INSPECTING_STUDENT:
      "INSPECTING_STUDENT",

    INTERVENTION_PENDING:
      "INTERVENTION_PENDING",

    INTERVENTION_SUCCESS:
      "INTERVENTION_SUCCESS",

    INTERVENTION_CONFLICT:
      "INTERVENTION_CONFLICT",

    INTERVENTION_ERROR:
      "INTERVENTION_ERROR"
  });


const HUD_MODES =
  new Set([
    CLASSROOM_INTERACTION_MODE
      .INSPECTING_STUDENT,

    CLASSROOM_INTERACTION_MODE
      .INTERVENTION_PENDING,

    CLASSROOM_INTERACTION_MODE
      .INTERVENTION_SUCCESS,

    CLASSROOM_INTERACTION_MODE
      .INTERVENTION_CONFLICT,

    CLASSROOM_INTERACTION_MODE
      .INTERVENTION_ERROR
  ]);


function normalizeStudentKey(
  student
) {
  const value =
    student?.studentKey;

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


function normalizeFeedbackPhase(
  feedback
) {
  const phase =
    feedback?.phase;

  if (
    typeof phase !==
      "string"
  ) {
    return null;
  }

  switch (
    phase.trim()
  ) {
    case "pending":
    case "success":
    case "conflict":
    case "error":
      return phase.trim();

    default:
      return null;
  }
}


function resolveHudMode(
  phase
) {
  switch (phase) {
    case "pending":
      return (
        CLASSROOM_INTERACTION_MODE
          .INTERVENTION_PENDING
      );

    case "success":
      return (
        CLASSROOM_INTERACTION_MODE
          .INTERVENTION_SUCCESS
      );

    case "conflict":
      return (
        CLASSROOM_INTERACTION_MODE
          .INTERVENTION_CONFLICT
      );

    case "error":
      return (
        CLASSROOM_INTERACTION_MODE
          .INTERVENTION_ERROR
      );

    default:
      return (
        CLASSROOM_INTERACTION_MODE
          .INSPECTING_STUDENT
      );
  }
}


function deriveClassroomInteractionStateV54({
  hasEntered = false,
  isLocked = false,
  selectedStudent = null,
  interventionFeedback = null
} = {}) {
  const entered =
    hasEntered ===
    true;

  const locked =
    isLocked ===
    true;

  const studentKey =
    normalizeStudentKey(
      selectedStudent
    );

  const feedbackPhase =
    normalizeFeedbackPhase(
      interventionFeedback
    );

  let mode;

  /*
   * ENTRY_GATE has absolute precedence.
   *
   * Even if an impossible stale snapshot somehow
   * reaches this function, student UI / gameplay
   * authority never wins over the entry gate.
   */
  if (!entered) {
    mode =
      CLASSROOM_INTERACTION_MODE
        .ENTRY_GATE;
  } else if (studentKey) {
    mode =
      resolveHudMode(
        feedbackPhase
      );
  } else if (locked) {
    mode =
      CLASSROOM_INTERACTION_MODE
        .PLAYING_LOCKED;
  } else {
    mode =
      CLASSROOM_INTERACTION_MODE
        .PLAYING_UNLOCKED;
  }

  const hudActive =
    HUD_MODES.has(
      mode
    );

  return Object.freeze({
    version:
      54,

    mode,

    entered,

    locked,

    studentKey,

    feedbackPhase,

    showEntryGate:
      mode ===
      CLASSROOM_INTERACTION_MODE
        .ENTRY_GATE,

    showStudentHud:
      hudActive,

    canAcquirePointerLock:
      mode ===
      CLASSROOM_INTERACTION_MODE
        .PLAYING_UNLOCKED,

    canMove:
      mode ===
      CLASSROOM_INTERACTION_MODE
        .PLAYING_LOCKED,

    canInspectStudent:
      mode ===
      CLASSROOM_INTERACTION_MODE
        .PLAYING_LOCKED,

    escapeClosesHud:
      hudActive,

    interventionBusy:
      mode ===
      CLASSROOM_INTERACTION_MODE
        .INTERVENTION_PENDING
  });
}


export {
  CLASSROOM_INTERACTION_MODE,
  deriveClassroomInteractionStateV54
};