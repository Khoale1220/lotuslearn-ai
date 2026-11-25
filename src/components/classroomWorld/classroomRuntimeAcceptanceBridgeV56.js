const CLASSROOM_RUNTIME_ACCEPTANCE_V56 =
  Object.freeze({
    version:
      "CW07_RUNTIME_ACCEPTANCE_V56",

    requestEvent:
      "lotuslearn:classroom-runtime-acceptance-request",

    snapshotEvent:
      "lotuslearn:classroom-runtime-acceptance-snapshot"
  });


function normalizeInteractionSnapshot(
  value
) {
  const source =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  return Object.freeze({
    mode:
      typeof source.mode ===
        "string" &&
      source.mode.trim() !==
        ""
        ? source.mode.trim()
        : null,

    gameplayActive:
      source.gameplayActive ===
      true,

    pointerLocked:
      source.pointerLocked ===
      true
  });
}


function createClassroomRuntimeAcceptanceSnapshotV56({
  sequence,
  runtimeSnapshot,
  interactionSnapshot
}) {
  if (
    !Number.isInteger(
      sequence
    ) ||
    sequence < 0
  ) {
    throw new TypeError(
      "sequence must be a non-negative integer"
    );
  }

  return Object.freeze({
    version:
      CLASSROOM_RUNTIME_ACCEPTANCE_V56
        .version,

    sequence,

    runtime:
      runtimeSnapshot ??
      null,

    interaction:
      normalizeInteractionSnapshot(
        interactionSnapshot
      )
  });
}


function createClassroomRuntimeAcceptanceBridgeV56({
  target,
  readRuntimeSnapshot,
  readInteractionSnapshot,
  createEvent,
  requestEventName =
    CLASSROOM_RUNTIME_ACCEPTANCE_V56
      .requestEvent,
  snapshotEventName =
    CLASSROOM_RUNTIME_ACCEPTANCE_V56
      .snapshotEvent
}) {
  if (
    !target ||
    typeof target.addEventListener !==
      "function" ||
    typeof target.removeEventListener !==
      "function" ||
    typeof target.dispatchEvent !==
      "function"
  ) {
    throw new TypeError(
      "event target is required"
    );
  }

  if (
    typeof readRuntimeSnapshot !==
      "function"
  ) {
    throw new TypeError(
      "readRuntimeSnapshot must be a function"
    );
  }

  if (
    typeof readInteractionSnapshot !==
      "function"
  ) {
    throw new TypeError(
      "readInteractionSnapshot must be a function"
    );
  }

  if (
    typeof createEvent !==
      "function"
  ) {
    throw new TypeError(
      "createEvent must be a function"
    );
  }

  let disposed =
    false;

  let sequence =
    0;


  function getSnapshot() {
    if (disposed) {
      return null;
    }

    return (
      createClassroomRuntimeAcceptanceSnapshotV56({
        sequence,

        runtimeSnapshot:
          readRuntimeSnapshot(),

        interactionSnapshot:
          readInteractionSnapshot()
      })
    );
  }


  function publish() {
    if (disposed) {
      return null;
    }

    sequence +=
      1;

    const snapshot =
      createClassroomRuntimeAcceptanceSnapshotV56({
        sequence,

        runtimeSnapshot:
          readRuntimeSnapshot(),

        interactionSnapshot:
          readInteractionSnapshot()
      });

    target.dispatchEvent(
      createEvent(
        snapshotEventName,
        snapshot
      )
    );

    return snapshot;
  }


  function onRequest() {
    publish();
  }


  target.addEventListener(
    requestEventName,
    onRequest
  );


  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    target.removeEventListener(
      requestEventName,
      onRequest
    );
  }


  return Object.freeze({
    getSnapshot,
    publish,
    dispose,

    requestEventName,
    snapshotEventName
  });
}


export {
  CLASSROOM_RUNTIME_ACCEPTANCE_V56,
  createClassroomRuntimeAcceptanceBridgeV56,
  createClassroomRuntimeAcceptanceSnapshotV56
};