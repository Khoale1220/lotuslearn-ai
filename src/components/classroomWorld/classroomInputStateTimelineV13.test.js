import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

import {
  compareInputStateTimelines,
  createClassroomInputStateTimelineV13,
  validateInputStateTimeline
} from "./classroomInputStateTimelineV13.js";

function createWindowFixture() {
  const listeners =
    new Map();

  function listenersFor(type) {
    return listeners.get(type) ?? [];
  }

  return {
    addEventListener(type, listener) {
      listeners.set(
        type,
        [
          ...listenersFor(type),
          listener
        ]
      );
    },

    removeEventListener(type, listener) {
      listeners.set(
        type,
        listenersFor(type).filter(
          (current) =>
            current !== listener
        )
      );
    },

    dispatch(type, properties = {}) {
      const event = {
        code: undefined,
        repeat: false,
        target: null,
        ...properties
      };

      for (
        const listener
        of [...listenersFor(type)]
      ) {
        listener(event);
      }
    },

    listenerCount(type) {
      return listenersFor(type).length;
    }
  };
}

function createCameraFixture() {
  return {
    position: {
      x: 0,
      y: 1.6,
      z: 5
    },

    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1
    }
  };
}

function createRun() {
  const windowObject =
    createWindowFixture();

  const camera =
    createCameraFixture();

  const timeline =
    createClassroomInputStateTimelineV13({
      windowObject,
      camera,

      controls: {
        isLocked: true
      },

      readInteractionFingerprint:
        () => "abcdef12"
    });

  timeline.observeState();

  windowObject.dispatch(
    "keydown",
    {
      code: "KeyW"
    }
  );

  camera.position.z =
    4.75;

  timeline.observeState();

  windowObject.dispatch(
    "keyup",
    {
      code: "KeyW"
    }
  );

  timeline.observeState();

  return {
    windowObject,
    camera,
    timeline,
    trace:
      timeline.exportTimeline()
  };
}

describe(
  "CW06 V13 deterministic input timeline",
  () => {
    it(
      "records W down and up",
      () => {
        const fixture =
          createRun();

        assert.equal(
          fixture.trace.inputEvents.length,
          2
        );

        assert.equal(
          fixture.trace.inputEvents[0].code,
          "KeyW"
        );

        assert.equal(
          fixture.trace.inputEvents[0].type,
          "down"
        );

        assert.equal(
          fixture.trace.inputEvents[1].type,
          "up"
        );

        fixture.timeline.dispose();
      }
    );

    it(
      "suppresses repeated keydown",
      () => {
        const windowObject =
          createWindowFixture();

        const timeline =
          createClassroomInputStateTimelineV13({
            windowObject,
            camera:
              createCameraFixture(),

            controls: {
              isLocked: true
            }
          });

        windowObject.dispatch(
          "keydown",
          {
            code: "KeyW",
            repeat: true
          }
        );

        assert.equal(
          timeline.exportTimeline()
            .inputEvents.length,
          0
        );

        timeline.dispose();
      }
    );

    it(
      "ignores unsupported keys",
      () => {
        const windowObject =
          createWindowFixture();

        const timeline =
          createClassroomInputStateTimelineV13({
            windowObject,
            camera:
              createCameraFixture(),

            controls: {
              isLocked: true
            }
          });

        windowObject.dispatch(
          "keydown",
          {
            code: "KeyQ"
          }
        );

        assert.equal(
          timeline.exportTimeline()
            .inputEvents.length,
          0
        );

        timeline.dispose();
      }
    );

    it(
      "resets active keys on blur",
      () => {
        const windowObject =
          createWindowFixture();

        const timeline =
          createClassroomInputStateTimelineV13({
            windowObject,
            camera:
              createCameraFixture(),

            controls: {
              isLocked: true
            }
          });

        windowObject.dispatch(
          "keydown",
          {
            code: "KeyW"
          }
        );

        windowObject.dispatch(
          "blur"
        );

        const events =
          timeline.exportTimeline()
            .inputEvents;

        assert.equal(
          events.at(-1).type,
          "reset"
        );

        assert.deepEqual(
          events.at(-1).activeKeys,
          []
        );

        timeline.dispose();
      }
    );

    it(
      "deduplicates identical state",
      () => {
        const windowObject =
          createWindowFixture();

        const camera =
          createCameraFixture();

        const timeline =
          createClassroomInputStateTimelineV13({
            windowObject,
            camera,

            controls: {
              isLocked: true
            }
          });

        assert.equal(
          timeline.observeState(),
          true
        );

        assert.equal(
          timeline.observeState(),
          false
        );

        camera.position.x =
          0.25;

        assert.equal(
          timeline.observeState(),
          true
        );

        timeline.dispose();
      }
    );

    it(
      "is reproducible across identical logical runs",
      () => {
        const first =
          createRun();

        const second =
          createRun();

        const comparison =
          compareInputStateTimelines(
            first.trace,
            second.trace
          );

        assert.equal(
          comparison.same,
          true
        );

        first.timeline.dispose();
        second.timeline.dispose();
      }
    );

    it(
      "detects input mutation",
      () => {
        const fixture =
          createRun();

        const trace =
          structuredClone(
            fixture.trace
          );

        trace.inputEvents[0].code =
          "KeyS";

        const validation =
          validateInputStateTimeline(
            trace
          );

        assert.equal(
          validation.valid,
          false
        );

        fixture.timeline.dispose();
      }
    );

    it(
      "detects checkpoint mutation",
      () => {
        const fixture =
          createRun();

        const trace =
          structuredClone(
            fixture.trace
          );

        trace.stateCheckpoints[0]
          .state.camera.position.x =
          999;

        const validation =
          validateInputStateTimeline(
            trace
          );

        assert.equal(
          validation.valid,
          false
        );

        fixture.timeline.dispose();
      }
    );

    it(
      "cleans all registered listeners",
      () => {
        const windowObject =
          createWindowFixture();

        const timeline =
          createClassroomInputStateTimelineV13({
            windowObject,
            camera:
              createCameraFixture(),

            controls: {
              isLocked: true
            }
          });

        assert.equal(
          windowObject.listenerCount(
            "keydown"
          ),
          1
        );

        assert.equal(
          windowObject.listenerCount(
            "keyup"
          ),
          1
        );

        assert.equal(
          windowObject.listenerCount(
            "blur"
          ),
          1
        );

        timeline.dispose();

        assert.equal(
          windowObject.listenerCount(
            "keydown"
          ),
          0
        );

        assert.equal(
          windowObject.listenerCount(
            "keyup"
          ),
          0
        );

        assert.equal(
          windowObject.listenerCount(
            "blur"
          ),
          0
        );
      }
    );
  }
);