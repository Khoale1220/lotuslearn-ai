const CLASSROOM_RUNTIME_OBSERVABILITY_V7_PROFILE =
  Object.freeze({
    sampleCapacity: 240,
    auditEveryFrames: 120,
    snapshotEveryFrames: 60,
    longFrameThresholdMs: 1000 / 30,
    severeFrameThresholdMs: 50,
    maximumRecordedDeltaMs: 250,
    eventName:
      "lotuslearn:classroom-runtime-snapshot"
  });

function finiteOrZero(
  value
) {
  return Number.isFinite(
    value
  )
    ? value
    : 0;
}

function roundMetric(
  value,
  digits = 3
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 ** digits;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}

function pushBoundedSample({
  samples,
  value,
  capacity
}) {
  if (
    !Array.isArray(
      samples
    )
  ) {
    throw new TypeError(
      "samples must be an array"
    );
  }

  const safeCapacity =
    Math.max(
      1,
      Math.trunc(
        finiteOrZero(
          capacity
        )
      )
    );

  samples.push(
    finiteOrZero(
      value
    )
  );

  const overflow =
    samples.length -
    safeCapacity;

  if (
    overflow > 0
  ) {
    samples.splice(
      0,
      overflow
    );
  }

  return samples;
}

function percentile(
  sortedValues,
  percentileValue
) {
  if (
    sortedValues.length ===
    0
  ) {
    return 0;
  }

  const safePercentile =
    Math.min(
      1,
      Math.max(
        0,
        percentileValue
      )
    );

  const index =
    (
      sortedValues.length -
      1
    ) *
    safePercentile;

  const lowerIndex =
    Math.floor(
      index
    );

  const upperIndex =
    Math.ceil(
      index
    );

  if (
    lowerIndex ===
    upperIndex
  ) {
    return sortedValues[
      lowerIndex
    ];
  }

  const weight =
    index -
    lowerIndex;

  return (
    sortedValues[
      lowerIndex
    ] *
      (
        1 -
        weight
      ) +
    sortedValues[
      upperIndex
    ] *
      weight
  );
}

function summarizeFrameTimes(
  samples,
  {
    longFrameThresholdMs =
      CLASSROOM_RUNTIME_OBSERVABILITY_V7_PROFILE
        .longFrameThresholdMs,

    severeFrameThresholdMs =
      CLASSROOM_RUNTIME_OBSERVABILITY_V7_PROFILE
        .severeFrameThresholdMs
  } = {}
) {
  const finiteSamples =
    samples.filter(
      Number.isFinite
    );

  if (
    finiteSamples.length ===
    0
  ) {
    return {
      count: 0,
      averageMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maximumMs: 0,
      estimatedFps: 0,
      longFrameCount: 0,
      severeFrameCount: 0
    };
  }

  const sorted =
    [
      ...finiteSamples
    ].sort(
      (left, right) =>
        left -
        right
    );

  const total =
    finiteSamples.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );

  const averageMs =
    total /
    finiteSamples.length;

  return {
    count:
      finiteSamples.length,

    averageMs:
      roundMetric(
        averageMs
      ),

    p50Ms:
      roundMetric(
        percentile(
          sorted,
          0.5
        )
      ),

    p95Ms:
      roundMetric(
        percentile(
          sorted,
          0.95
        )
      ),

    p99Ms:
      roundMetric(
        percentile(
          sorted,
          0.99
        )
      ),

    maximumMs:
      roundMetric(
        sorted[
          sorted.length -
          1
        ]
      ),

    estimatedFps:
      averageMs > 0
        ? roundMetric(
            1000 /
            averageMs,
            1
          )
        : 0,

    longFrameCount:
      finiteSamples.filter(
        (value) =>
          value >
          longFrameThresholdMs
      ).length,

    severeFrameCount:
      finiteSamples.filter(
        (value) =>
          value >
          severeFrameThresholdMs
      ).length
  };
}

function snapshotRendererInfo(
  renderer
) {
  const info =
    renderer?.info ?? {};

  const render =
    info.render ?? {};

  const memory =
    info.memory ?? {};

  return {
    frame:
      finiteOrZero(
        render.frame
      ),

    calls:
      finiteOrZero(
        render.calls
      ),

    triangles:
      finiteOrZero(
        render.triangles
      ),

    points:
      finiteOrZero(
        render.points
      ),

    lines:
      finiteOrZero(
        render.lines
      ),

    geometries:
      finiteOrZero(
        memory.geometries
      ),

    textures:
      finiteOrZero(
        memory.textures
      ),

    programs:
      Array.isArray(
        info.programs
      )
        ? info.programs.length
        : 0
  };
}

function vectorIsFinite(
  vector,
  keys
) {
  if (!vector) {
    return true;
  }

  return keys.every(
    (key) =>
      Number.isFinite(
        vector[
          key
        ]
      )
  );
}

function auditSceneGraph(
  scene
) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "scene.traverse is required"
    );
  }

  const interactionTypeCounts =
    Object.create(
      null
    );

  let objectCount = 0;
  let visibleObjectCount = 0;
  let meshCount = 0;
  let interactiveObjectCount = 0;
  let unnamedInteractiveCount = 0;
  let invalidTransformCount = 0;

  scene.traverse(
    (object) => {
      objectCount += 1;

      if (
        object.visible !==
        false
      ) {
        visibleObjectCount +=
          1;
      }

      if (
        object.isMesh
      ) {
        meshCount += 1;
      }

      const validPosition =
        vectorIsFinite(
          object.position,
          [
            "x",
            "y",
            "z"
          ]
        );

      const validRotation =
        vectorIsFinite(
          object.rotation,
          [
            "x",
            "y",
            "z"
          ]
        );

      const validScale =
        vectorIsFinite(
          object.scale,
          [
            "x",
            "y",
            "z"
          ]
        );

      if (
        !validPosition ||
        !validRotation ||
        !validScale
      ) {
        invalidTransformCount +=
          1;
      }

      const interactionType =
        object.userData
          ?.interactionType;

      if (
        typeof interactionType ===
          "string" &&
        interactionType.length >
          0
      ) {
        interactiveObjectCount +=
          1;

        interactionTypeCounts[
          interactionType
        ] =
          (
            interactionTypeCounts[
              interactionType
            ] ??
            0
          ) +
          1;

        if (
          typeof object.name !==
            "string" ||
          object.name.length ===
            0
        ) {
          unnamedInteractiveCount +=
            1;
        }
      }
    }
  );

  return {
    objectCount,
    visibleObjectCount,
    meshCount,
    interactiveObjectCount,
    unnamedInteractiveCount,
    invalidTransformCount,

    interactionTypeCounts: {
      ...interactionTypeCounts
    }
  };
}

function createRuntimeSnapshot({
  frameCount,
  frameTimes,
  renderer,
  sceneAudit
}) {
  return {
    version:
      "CW06_RUNTIME_OBSERVABILITY_V7",

    frameCount,

    frameTiming:
      summarizeFrameTimes(
        frameTimes
      ),

    renderer:
      snapshotRendererInfo(
        renderer
      ),

    scene:
      sceneAudit
  };
}

function dispatchRuntimeSnapshot({
  host,
  snapshot,
  eventName
}) {
  if (
    !host ||
    typeof host.dispatchEvent !==
      "function" ||
    typeof globalThis.CustomEvent !==
      "function"
  ) {
    return false;
  }

  host.dispatchEvent(
    new globalThis.CustomEvent(
      eventName,
      {
        detail:
          snapshot
      }
    )
  );

  return true;
}

function createClassroomRuntimeObservabilityV7({
  renderer,
  scene,
  host = null,
  profile =
    CLASSROOM_RUNTIME_OBSERVABILITY_V7_PROFILE
}) {
  if (
    !renderer?.info
  ) {
    throw new TypeError(
      "renderer.info is required"
    );
  }

  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "scene.traverse is required"
    );
  }

  const sampleCapacity =
    Math.max(
      1,
      Math.trunc(
        finiteOrZero(
          profile.sampleCapacity
        )
      )
    );

  const auditEveryFrames =
    Math.max(
      1,
      Math.trunc(
        finiteOrZero(
          profile.auditEveryFrames
        )
      )
    );

  const snapshotEveryFrames =
    Math.max(
      1,
      Math.trunc(
        finiteOrZero(
          profile.snapshotEveryFrames
        )
      )
    );

  const maximumRecordedDeltaMs =
    Math.max(
      1,
      finiteOrZero(
        profile.maximumRecordedDeltaMs
      )
    );

  const frameTimes = [];

  let frameCount = 0;
  let lastTimestamp = null;

  let latestSceneAudit =
    auditSceneGraph(
      scene
    );

  let latestSnapshot =
    createRuntimeSnapshot({
      frameCount,
      frameTimes,
      renderer,
      sceneAudit:
        latestSceneAudit
    });

  let disposed =
    false;

  function observeFrame({
    timestamp
  } = {}) {
    if (disposed) {
      return latestSnapshot;
    }

    const safeTimestamp =
      Number.isFinite(
        timestamp
      )
        ? timestamp
        : (
            globalThis.performance
              ?.now
              ?.() ??
            Date.now()
          );

    if (
      lastTimestamp !==
      null
    ) {
      const rawDeltaMs =
        Math.max(
          0,
          safeTimestamp -
          lastTimestamp
        );

      pushBoundedSample({
        samples:
          frameTimes,

        value:
          Math.min(
            maximumRecordedDeltaMs,
            rawDeltaMs
          ),

        capacity:
          sampleCapacity
      });
    }

    lastTimestamp =
      safeTimestamp;

    frameCount += 1;

    if (
      frameCount %
        auditEveryFrames ===
      0
    ) {
      latestSceneAudit =
        auditSceneGraph(
          scene
        );
    }

    latestSnapshot =
      createRuntimeSnapshot({
        frameCount,
        frameTimes,
        renderer,
        sceneAudit:
          latestSceneAudit
      });

    if (
      frameCount %
        snapshotEveryFrames ===
      0
    ) {
      dispatchRuntimeSnapshot({
        host,
        snapshot:
          latestSnapshot,

        eventName:
          profile.eventName
      });
    }

    return latestSnapshot;
  }

  function getSnapshot() {
    return {
      ...latestSnapshot,

      frameTiming: {
        ...latestSnapshot
          .frameTiming
      },

      renderer: {
        ...latestSnapshot
          .renderer
      },

      scene: {
        ...latestSnapshot
          .scene,

        interactionTypeCounts: {
          ...latestSnapshot
            .scene
            .interactionTypeCounts
        }
      }
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    frameTimes.length =
      0;

    lastTimestamp =
      null;
  }

  return {
    observeFrame,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_RUNTIME_OBSERVABILITY_V7_PROFILE,
  auditSceneGraph,
  createClassroomRuntimeObservabilityV7,
  createRuntimeSnapshot,
  dispatchRuntimeSnapshot,
  percentile,
  pushBoundedSample,
  snapshotRendererInfo,
  summarizeFrameTimes
};