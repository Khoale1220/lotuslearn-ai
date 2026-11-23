import {
  canonicalNumber,
  canonicalValue,
  deterministicFingerprint,
  stableStringify
} from "./classroomInteractionReplayAuditV12.js";

const CLASSROOM_INPUT_STATE_TIMELINE_V13_PROFILE =
  Object.freeze({
    schemaVersion: 1,
    authority: "CW06_INPUT_STATE_TIMELINE_V13",
    maximumInputEvents: 512,
    maximumStateCheckpoints: 512,

    observedKeys: Object.freeze([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyE"
    ])
  });

function isEditableTarget(target) {
  if (!target) {
    return false;
  }

  if (target.isContentEditable === true) {
    return true;
  }

  const tagName =
    typeof target.tagName === "string"
      ? target.tagName.toUpperCase()
      : "";

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

function normalizeActiveKeys(keys) {
  return [...keys]
    .filter((value) => typeof value === "string")
    .sort();
}

function canonicalCameraState(camera) {
  return canonicalValue({
    position: {
      x: canonicalNumber(camera?.position?.x),
      y: canonicalNumber(camera?.position?.y),
      z: canonicalNumber(camera?.position?.z)
    },

    quaternion: {
      x: canonicalNumber(camera?.quaternion?.x),
      y: canonicalNumber(camera?.quaternion?.y),
      z: canonicalNumber(camera?.quaternion?.z),
      w: canonicalNumber(camera?.quaternion?.w)
    }
  });
}

function createInputFingerprint(
  previousFingerprint,
  event
) {
  return deterministicFingerprint({
    previousFingerprint,
    event
  });
}

function createStateFingerprint(
  previousFingerprint,
  checkpoint
) {
  return deterministicFingerprint({
    previousFingerprint,
    checkpoint
  });
}

function validateInputStateTimeline(trace) {
  const issues = [];

  const inputEvents =
    Array.isArray(trace?.inputEvents)
      ? trace.inputEvents
      : [];

  const stateCheckpoints =
    Array.isArray(trace?.stateCheckpoints)
      ? trace.stateCheckpoints
      : [];

  if (
    trace?.schemaVersion !==
    CLASSROOM_INPUT_STATE_TIMELINE_V13_PROFILE.schemaVersion
  ) {
    issues.push("INVALID_SCHEMA_VERSION");
  }

  let previousInputFingerprint =
    "00000000";

  for (
    let index = 0;
    index < inputEvents.length;
    index += 1
  ) {
    const event =
      inputEvents[index];

    if (
      event.sequence !==
      index + 1
    ) {
      issues.push(
        `INPUT_SEQUENCE_MISMATCH:${index + 1}`
      );
    }

    const canonicalEvent = {
      sequence: event.sequence,
      type: event.type,
      code: event.code,
      activeKeys: event.activeKeys
    };

    const expected =
      createInputFingerprint(
        previousInputFingerprint,
        canonicalEvent
      );

    if (event.fingerprint !== expected) {
      issues.push(
        `INPUT_FINGERPRINT_MISMATCH:${event.sequence}`
      );
    }

    previousInputFingerprint =
      expected;
  }

  if (
    trace?.finalInputFingerprint !==
    previousInputFingerprint
  ) {
    issues.push(
      "FINAL_INPUT_FINGERPRINT_MISMATCH"
    );
  }

  let previousStateFingerprint =
    "00000000";

  let previousInputSequence =
    0;

  for (
    let index = 0;
    index < stateCheckpoints.length;
    index += 1
  ) {
    const checkpoint =
      stateCheckpoints[index];

    if (
      checkpoint.sequence !==
      index + 1
    ) {
      issues.push(
        `STATE_SEQUENCE_MISMATCH:${index + 1}`
      );
    }

    if (
      !Number.isInteger(
        checkpoint.inputSequence
      ) ||
      checkpoint.inputSequence <
        previousInputSequence
    ) {
      issues.push(
        `STATE_INPUT_SEQUENCE_REGRESSION:${checkpoint.sequence}`
      );
    }

    previousInputSequence =
      checkpoint.inputSequence;

    if (
      checkpoint.inputSequence >
      inputEvents.length
    ) {
      issues.push(
        `STATE_REFERENCES_FUTURE_INPUT:${checkpoint.sequence}`
      );
    }

    const canonicalCheckpoint = {
      sequence: checkpoint.sequence,
      inputSequence: checkpoint.inputSequence,
      state: checkpoint.state
    };

    const expected =
      createStateFingerprint(
        previousStateFingerprint,
        canonicalCheckpoint
      );

    if (
      checkpoint.fingerprint !==
      expected
    ) {
      issues.push(
        `STATE_FINGERPRINT_MISMATCH:${checkpoint.sequence}`
      );
    }

    previousStateFingerprint =
      expected;
  }

  if (
    trace?.finalStateFingerprint !==
    previousStateFingerprint
  ) {
    issues.push(
      "FINAL_STATE_FINGERPRINT_MISMATCH"
    );
  }

  return {
    valid: issues.length === 0,
    inputEventCount: inputEvents.length,
    stateCheckpointCount: stateCheckpoints.length,
    finalInputFingerprint: previousInputFingerprint,
    finalStateFingerprint: previousStateFingerprint,
    issues: Object.freeze([...issues])
  };
}

function compareInputStateTimelines(left, right) {
  const leftValidation =
    validateInputStateTimeline(left);

  const rightValidation =
    validateInputStateTimeline(right);

  return {
    same:
      leftValidation.valid &&
      rightValidation.valid &&
      stableStringify(left) ===
        stableStringify(right),

    leftValidation,
    rightValidation
  };
}

function createClassroomInputStateTimelineV13({
  windowObject,
  camera,
  controls,
  readInteractionFingerprint = () => null
}) {
  if (
    !windowObject ||
    typeof windowObject.addEventListener !== "function" ||
    typeof windowObject.removeEventListener !== "function"
  ) {
    throw new TypeError(
      "windowObject event API is required"
    );
  }

  if (!camera) {
    throw new TypeError(
      "camera is required"
    );
  }

  if (
    typeof readInteractionFingerprint !==
    "function"
  ) {
    throw new TypeError(
      "readInteractionFingerprint must be a function"
    );
  }

  const profile =
    CLASSROOM_INPUT_STATE_TIMELINE_V13_PROFILE;

  const observedKeys =
    new Set(profile.observedKeys);

  const activeKeys =
    new Set();

  const inputEvents = [];
  const stateCheckpoints = [];

  let inputSequence = 0;
  let stateSequence = 0;

  let previousInputFingerprint =
    "00000000";

  let previousStateFingerprint =
    "00000000";

  let previousCanonicalStateFingerprint =
    null;

  let interactionFingerprintReadFailures =
    0;

  let disposed =
    false;

  function appendInputEvent(
    type,
    code
  ) {
    if (
      disposed ||
      inputEvents.length >=
        profile.maximumInputEvents
    ) {
      return false;
    }

    inputSequence += 1;

    const event = {
      sequence: inputSequence,
      type,
      code: code ?? null,
      activeKeys:
        normalizeActiveKeys(activeKeys)
    };

    const fingerprint =
      createInputFingerprint(
        previousInputFingerprint,
        event
      );

    inputEvents.push(
      Object.freeze({
        ...event,
        fingerprint
      })
    );

    previousInputFingerprint =
      fingerprint;

    return true;
  }

  function onKeyDown(event) {
    if (
      disposed ||
      event?.repeat === true ||
      isEditableTarget(event?.target) ||
      !observedKeys.has(event?.code) ||
      activeKeys.has(event.code)
    ) {
      return;
    }

    activeKeys.add(event.code);

    appendInputEvent(
      "down",
      event.code
    );
  }

  function onKeyUp(event) {
    if (
      disposed ||
      isEditableTarget(event?.target) ||
      !observedKeys.has(event?.code) ||
      !activeKeys.has(event.code)
    ) {
      return;
    }

    activeKeys.delete(event.code);

    appendInputEvent(
      "up",
      event.code
    );
  }

  function onBlur() {
    if (
      disposed ||
      activeKeys.size === 0
    ) {
      return;
    }

    activeKeys.clear();

    appendInputEvent(
      "reset",
      null
    );
  }

  function safeInteractionFingerprint() {
    try {
      const value =
        readInteractionFingerprint();

      return typeof value === "string"
        ? value
        : null;
    }
    catch {
      interactionFingerprintReadFailures += 1;
      return null;
    }
  }

  function createState() {
    return canonicalValue({
      camera:
        canonicalCameraState(camera),

      controlsLocked:
        controls?.isLocked === true,

      activeKeys:
        normalizeActiveKeys(activeKeys),

      interactionFingerprint:
        safeInteractionFingerprint()
    });
  }

  function observeState() {
    if (
      disposed ||
      stateCheckpoints.length >=
        profile.maximumStateCheckpoints
    ) {
      return false;
    }

    const state =
      createState();

    const canonicalStateFingerprint =
      deterministicFingerprint(state);

    if (
      canonicalStateFingerprint ===
      previousCanonicalStateFingerprint
    ) {
      return false;
    }

    previousCanonicalStateFingerprint =
      canonicalStateFingerprint;

    stateSequence += 1;

    const checkpoint = {
      sequence: stateSequence,
      inputSequence,
      state
    };

    const fingerprint =
      createStateFingerprint(
        previousStateFingerprint,
        checkpoint
      );

    stateCheckpoints.push(
      Object.freeze({
        ...checkpoint,
        fingerprint
      })
    );

    previousStateFingerprint =
      fingerprint;

    return true;
  }

  function exportTimeline() {
    return canonicalValue({
      schemaVersion:
        profile.schemaVersion,

      authority:
        profile.authority,

      observedKeys:
        profile.observedKeys,

      inputEvents:
        inputEvents.map(
          (event) => ({
            ...event
          })
        ),

      stateCheckpoints:
        stateCheckpoints.map(
          (checkpoint) => ({
            ...checkpoint
          })
        ),

      finalInputFingerprint:
        previousInputFingerprint,

      finalStateFingerprint:
        previousStateFingerprint
    });
  }

  function verifySelf() {
    return validateInputStateTimeline(
      exportTimeline()
    );
  }

  function getSnapshot() {
    return {
      authority:
        profile.authority,

      inputSequence,
      stateSequence,

      activeKeys:
        normalizeActiveKeys(activeKeys),

      finalInputFingerprint:
        previousInputFingerprint,

      finalStateFingerprint:
        previousStateFingerprint,

      interactionFingerprintReadFailures,
      disposed
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    windowObject.removeEventListener(
      "keydown",
      onKeyDown,
      true
    );

    windowObject.removeEventListener(
      "keyup",
      onKeyUp,
      true
    );

    windowObject.removeEventListener(
      "blur",
      onBlur,
      true
    );

    activeKeys.clear();
  }

  windowObject.addEventListener(
    "keydown",
    onKeyDown,
    true
  );

  windowObject.addEventListener(
    "keyup",
    onKeyUp,
    true
  );

  windowObject.addEventListener(
    "blur",
    onBlur,
    true
  );

  return {
    observeState,
    exportTimeline,
    verifySelf,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_INPUT_STATE_TIMELINE_V13_PROFILE,
  canonicalCameraState,
  compareInputStateTimelines,
  createClassroomInputStateTimelineV13,
  isEditableTarget,
  normalizeActiveKeys,
  validateInputStateTimeline
};