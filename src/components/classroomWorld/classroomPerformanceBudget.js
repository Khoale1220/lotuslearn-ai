const DEFAULT_CLASSROOM_PERFORMANCE_BUDGET =
  Object.freeze({
    drawCalls: 180,
    triangles: 160000,
    geometries: 280,
    textures: 72
  });

function createClassroomPerformanceBudget({
  renderer,
  maxPixelRatio = 1.5,
  sampleIntervalFrames = 120,
  budget =
    DEFAULT_CLASSROOM_PERFORMANCE_BUDGET
}) {
  if (
    !renderer ||
    !renderer.info
  ) {
    throw new TypeError(
      "renderer.info is required"
    );
  }

  if (
    !Number.isFinite(
      maxPixelRatio
    ) ||
    maxPixelRatio <= 0
  ) {
    throw new RangeError(
      "maxPixelRatio must be positive"
    );
  }

  if (
    !Number.isInteger(
      sampleIntervalFrames
    ) ||
    sampleIntervalFrames < 1
  ) {
    throw new RangeError(
      "sampleIntervalFrames must be a positive integer"
    );
  }

  const canManagePixelRatio =
    typeof renderer
      .getPixelRatio ===
      "function" &&
    typeof renderer
      .setPixelRatio ===
      "function";

  const previousPixelRatio =
    canManagePixelRatio
      ? renderer.getPixelRatio()
      : null;

  const appliedPixelRatio =
    previousPixelRatio === null
      ? null
      : Math.min(
          previousPixelRatio,
          maxPixelRatio
        );

  if (
    appliedPixelRatio !== null &&
    appliedPixelRatio !==
      previousPixelRatio
  ) {
    renderer.setPixelRatio(
      appliedPixelRatio
    );
  }

  let frame =
    0;

  let lastSnapshot =
    null;

  let disposed =
    false;

  function readSnapshot() {
    const render =
      renderer.info.render ?? {};

    const memory =
      renderer.info.memory ?? {};

    const snapshot = {
      drawCalls:
        Number(
          render.calls ?? 0
        ),

      triangles:
        Number(
          render.triangles ?? 0
        ),

      geometries:
        Number(
          memory.geometries ?? 0
        ),

      textures:
        Number(
          memory.textures ?? 0
        )
    };

    snapshot.overBudget = {
      drawCalls:
        snapshot.drawCalls >
        budget.drawCalls,

      triangles:
        snapshot.triangles >
        budget.triangles,

      geometries:
        snapshot.geometries >
        budget.geometries,

      textures:
        snapshot.textures >
        budget.textures
    };

    snapshot.healthy =
      !Object.values(
        snapshot.overBudget
      ).some(Boolean);

    return snapshot;
  }

  function sample({
    force = false
  } = {}) {
    if (disposed) {
      return lastSnapshot;
    }

    frame += 1;

    if (
      !force &&
      frame %
        sampleIntervalFrames !==
        0
    ) {
      return lastSnapshot;
    }

    lastSnapshot =
      readSnapshot();

    return lastSnapshot;
  }

  return {
    sample,

    getSnapshot() {
      return lastSnapshot;
    },

    getAppliedPixelRatio() {
      return appliedPixelRatio;
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      if (
        canManagePixelRatio &&
        previousPixelRatio !==
          null &&
        renderer.getPixelRatio() !==
          previousPixelRatio
      ) {
        renderer.setPixelRatio(
          previousPixelRatio
        );
      }
    }
  };
}

export {
  DEFAULT_CLASSROOM_PERFORMANCE_BUDGET,
  createClassroomPerformanceBudget
};