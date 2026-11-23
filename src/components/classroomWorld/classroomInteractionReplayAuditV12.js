const CLASSROOM_INTERACTION_REPLAY_AUDIT_V12_PROFILE =
  Object.freeze({
    schemaVersion:
      1,

    authority:
      "CW06_DETERMINISTIC_REPLAY_AUDIT_V12",

    maximumEvents:
      256,

    numericPrecision:
      6,

    fingerprintAlgorithm:
      "FNV1A32_CHAIN"
  });

function canonicalNumber(
  value
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return null;
  }

  const precision =
    CLASSROOM_INTERACTION_REPLAY_AUDIT_V12_PROFILE
      .numericPrecision;

  const normalized =
    Number(
      value.toFixed(
        precision
      )
    );

  return (
    Object.is(
      normalized,
      -0
    )
      ? 0
      : normalized
  );
}

function canonicalValue(
  value
) {
  if (
    value === null ||
    typeof value ===
      "string" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
      "number"
  ) {
    return canonicalNumber(
      value
    );
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      canonicalValue
    );
  }

  if (
    typeof value ===
      "object"
  ) {
    const result =
      {};

    const keys =
      Object.keys(
        value
      ).sort();

    for (
      const key
      of keys
    ) {
      const child =
        value[
          key
        ];

      if (
        child === undefined ||
        typeof child ===
          "function"
      ) {
        continue;
      }

      result[
        key
      ] =
        canonicalValue(
          child
        );
    }

    return result;
  }

  return null;
}

function stableStringify(
  value
) {
  return JSON.stringify(
    canonicalValue(
      value
    )
  );
}

function fnv1a32(
  text
) {
  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        0x01000193
      ) >>> 0;
  }

  return hash
    .toString(16)
    .padStart(
      8,
      "0"
    );
}

function deterministicFingerprint(
  value
) {
  return fnv1a32(
    stableStringify(
      value
    )
  );
}

function canonicalCandidate(
  candidate
) {
  if (!candidate) {
    return null;
  }

  const result = {
    provider:
      candidate.provider ??
      null,

    interactionType:
      candidate.interactionType ??
      null,

    interactionKey:
      candidate.interactionKey ??
      null,

    priority:
      Number.isFinite(
        candidate.priority
      )
        ? candidate.priority
        : null,

    distance:
      canonicalNumber(
        candidate.distance
      ),

    instanceId:
      Number.isInteger(
        candidate.instanceId
      )
        ? candidate.instanceId
        : null
  };

  if (
    typeof candidate.studentKey ===
      "string"
  ) {
    result.studentKey =
      candidate.studentKey;
  }

  if (
    typeof candidate.windowShadeId ===
      "string"
  ) {
    result.windowShadeId =
      candidate.windowShadeId;
  }

  return canonicalValue(
    result
  );
}

function canonicalActivationResult(
  result
) {
  if (!result) {
    return null;
  }

  const canonical = {
    handled:
      result.handled ===
      true,

    delegated:
      result.delegated ===
      true,

    interactionType:
      result.interactionType ??
      null,

    interactionKey:
      result.interactionKey ??
      null,

    invoker:
      result.invoker ??
      null
  };

  if (
    result.command &&
    typeof result.command ===
      "object"
  ) {
    canonical.command =
      canonicalValue(
        result.command
      );
  }

  return canonicalValue(
    canonical
  );
}

function looksLikeRuntimeUuid(
  value
) {
  return (
    typeof value ===
      "string" &&
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
      .test(
        value
      )
  );
}

function validateReplayTrace(
  trace
) {
  const issues =
    [];

  if (
    !trace ||
    trace.schemaVersion !==
      CLASSROOM_INTERACTION_REPLAY_AUDIT_V12_PROFILE
        .schemaVersion
  ) {
    issues.push(
      "INVALID_SCHEMA_VERSION"
    );
  }

  const events =
    Array.isArray(
      trace?.events
    )
      ? trace.events
      : [];

  let previousFingerprint =
    "00000000";

  const decisionPicks =
    new Set();

  const handledActivations =
    new Map();

  for (
    let index = 0;
    index < events.length;
    index += 1
  ) {
    const event =
      events[
        index
      ];

    if (
      event.sequence !==
      index + 1
    ) {
      issues.push(
        `NON_MONOTONIC_SEQUENCE:${index + 1}`
      );
    }

    const eventWithoutFingerprint = {
      sequence:
        event.sequence,

      type:
        event.type,

      pickSequence:
        event.pickSequence,

      payload:
        event.payload
    };

    const expectedFingerprint =
      deterministicFingerprint({
        previousFingerprint,
        event:
          eventWithoutFingerprint
      });

    if (
      event.fingerprint !==
      expectedFingerprint
    ) {
      issues.push(
        `FINGERPRINT_MISMATCH:${event.sequence}`
      );
    }

    previousFingerprint =
      expectedFingerprint;

    const interactionKey =
      event?.payload
        ?.candidate
        ?.interactionKey ??
      event?.payload
        ?.result
        ?.interactionKey ??
      null;

    if (
      looksLikeRuntimeUuid(
        interactionKey
      )
    ) {
      issues.push(
        `NONDETERMINISTIC_RUNTIME_UUID:${event.sequence}`
      );
    }

    if (
      event.type ===
        "decision"
    ) {
      if (
        decisionPicks.has(
          event.pickSequence
        )
      ) {
        issues.push(
          `DUPLICATE_DECISION:${event.pickSequence}`
        );
      }

      decisionPicks.add(
        event.pickSequence
      );
    }

    if (
      event.type ===
        "activation"
    ) {
      if (
        !decisionPicks.has(
          event.pickSequence
        )
      ) {
        issues.push(
          `ACTIVATION_WITHOUT_DECISION:${event.pickSequence}`
        );
      }

      if (
        event?.payload
          ?.result
          ?.handled ===
        true
      ) {
        const count =
          (
            handledActivations.get(
              event.pickSequence
            ) ??
            0
          ) + 1;

        handledActivations.set(
          event.pickSequence,
          count
        );

        if (
          count >
          1
        ) {
          issues.push(
            `DOUBLE_FIRE:${event.pickSequence}`
          );
        }
      }
    }
  }

  const finalFingerprint =
    events.length >
      0
      ? events[
          events.length - 1
        ].fingerprint
      : "00000000";

  if (
    trace?.finalFingerprint !==
    finalFingerprint
  ) {
    issues.push(
      "FINAL_FINGERPRINT_MISMATCH"
    );
  }

  return {
    valid:
      issues.length ===
      0,

    eventCount:
      events.length,

    finalFingerprint,

    issues:
      Object.freeze([
        ...issues
      ])
  };
}

function compareReplayTraces(
  left,
  right
) {
  const leftValidation =
    validateReplayTrace(
      left
    );

  const rightValidation =
    validateReplayTrace(
      right
    );

  const same =
    leftValidation.valid &&
    rightValidation.valid &&
    stableStringify(
      left
    ) ===
    stableStringify(
      right
    );

  return {
    same,
    leftValidation,
    rightValidation,

    leftFingerprint:
      leftValidation
        .finalFingerprint,

    rightFingerprint:
      rightValidation
        .finalFingerprint
  };
}

function createClassroomInteractionReplayAuditV12() {
  const profile =
    CLASSROOM_INTERACTION_REPLAY_AUDIT_V12_PROFILE;

  const events =
    [];

  const issues =
    [];

  let previousFingerprint =
    "00000000";

  let disposed =
    false;

  const handledActivationPicks =
    new Set();

  function appendEvent({
    type,
    pickSequence,
    payload
  }) {
    if (disposed) {
      return null;
    }

    if (
      events.length >=
      profile.maximumEvents
    ) {
      issues.push(
        "EVENT_CAPACITY_REACHED"
      );

      return null;
    }

    if (
      !Number.isInteger(
        pickSequence
      ) ||
      pickSequence <
        1
    ) {
      issues.push(
        "INVALID_PICK_SEQUENCE"
      );

      return null;
    }

    const eventWithoutFingerprint = {
      sequence:
        events.length +
        1,

      type,

      pickSequence,

      payload:
        canonicalValue(
          payload
        )
    };

    const fingerprint =
      deterministicFingerprint({
        previousFingerprint,
        event:
          eventWithoutFingerprint
      });

    const event =
      Object.freeze({
        ...eventWithoutFingerprint,
        fingerprint
      });

    events.push(
      event
    );

    previousFingerprint =
      fingerprint;

    return event;
  }

  function recordDecision({
    pickSequence,
    candidate
  }) {
    const canonical =
      canonicalCandidate(
        candidate
      );

    if (
      looksLikeRuntimeUuid(
        canonical
          ?.interactionKey
      )
    ) {
      issues.push(
        `NONDETERMINISTIC_RUNTIME_UUID:${pickSequence}`
      );
    }

    return appendEvent({
      type:
        "decision",

      pickSequence,

      payload: {
        candidate:
          canonical
      }
    });
  }

  function recordActivation({
    pickSequence,
    candidate,
    result
  }) {
    const canonicalResult =
      canonicalActivationResult(
        result
      );

    if (
      canonicalResult
        ?.handled ===
        true
    ) {
      if (
        handledActivationPicks.has(
          pickSequence
        )
      ) {
        issues.push(
          `DOUBLE_FIRE:${pickSequence}`
        );
      }

      handledActivationPicks.add(
        pickSequence
      );
    }

    return appendEvent({
      type:
        "activation",

      pickSequence,

      payload: {
        candidate:
          canonicalCandidate(
            candidate
          ),

        result:
          canonicalResult
      }
    });
  }

  function exportTrace() {
    const trace = {
      schemaVersion:
        profile.schemaVersion,

      authority:
        profile.authority,

      fingerprintAlgorithm:
        profile.fingerprintAlgorithm,

      events:
        events.map(
          (event) => ({
            ...event
          })
        ),

      finalFingerprint:
        previousFingerprint
    };

    return canonicalValue(
      trace
    );
  }

  function verifySelf() {
    const validation =
      validateReplayTrace(
        exportTrace()
      );

    const combinedIssues =
      [
        ...issues,
        ...validation.issues
      ];

    return {
      ...validation,

      valid:
        validation.valid &&
        issues.length ===
          0,

      issues:
        Object.freeze(
          combinedIssues
        )
    };
  }

  function getSnapshot() {
    return {
      authority:
        profile.authority,

      eventCount:
        events.length,

      finalFingerprint:
        previousFingerprint,

      issueCount:
        issues.length,

      issues:
        Object.freeze([
          ...issues
        ]),

      disposed
    };
  }

  function dispose() {
    disposed =
      true;
  }

  return {
    recordDecision,
    recordActivation,
    exportTrace,
    verifySelf,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_INTERACTION_REPLAY_AUDIT_V12_PROFILE,
  canonicalActivationResult,
  canonicalCandidate,
  canonicalNumber,
  canonicalValue,
  compareReplayTraces,
  createClassroomInteractionReplayAuditV12,
  deterministicFingerprint,
  fnv1a32,
  looksLikeRuntimeUuid,
  stableStringify,
  validateReplayTrace
};