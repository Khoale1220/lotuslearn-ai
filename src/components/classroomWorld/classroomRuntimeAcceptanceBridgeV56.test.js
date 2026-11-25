import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  CLASSROOM_RUNTIME_ACCEPTANCE_V56,
  createClassroomRuntimeAcceptanceBridgeV56,
  createClassroomRuntimeAcceptanceSnapshotV56
} from "./classroomRuntimeAcceptanceBridgeV56.js";


function createFakeTarget() {
  const listeners =
    new Map();

  return {
    addEventListener(
      type,
      listener
    ) {
      const current =
        listeners.get(
          type
        ) ?? [];

      current.push(
        listener
      );

      listeners.set(
        type,
        current
      );
    },

    removeEventListener(
      type,
      listener
    ) {
      const current =
        listeners.get(
          type
        ) ?? [];

      listeners.set(
        type,
        current.filter(
          (candidate) =>
            candidate !==
            listener
        )
      );
    },

    dispatchEvent(
      event
    ) {
      const current =
        listeners.get(
          event.type
        ) ?? [];

      for (
        const listener
        of current
      ) {
        listener(
          event
        );
      }

      return true;
    }
  };
}


function createFakeEvent(
  type,
  detail
) {
  return {
    type,
    detail
  };
}


describe(
  "CW07 V56 runtime acceptance bridge",
  () => {
    it(
      "creates a stable acceptance snapshot",
      () => {
        const snapshot =
          createClassroomRuntimeAcceptanceSnapshotV56({
            sequence:
              4,

            runtimeSnapshot: {
              version:
                "CW06_RUNTIME_OBSERVABILITY_V7",

              frameCount:
                120
            },

            interactionSnapshot: {
              mode:
                "PLAYING_LOCKED",

              gameplayActive:
                true,

              pointerLocked:
                true
            }
          });

        assert.equal(
          snapshot.version,
          "CW07_RUNTIME_ACCEPTANCE_V56"
        );

        assert.equal(
          snapshot.sequence,
          4
        );

        assert.equal(
          snapshot.runtime.frameCount,
          120
        );

        assert.deepEqual(
          snapshot.interaction,
          {
            mode:
              "PLAYING_LOCKED",

            gameplayActive:
              true,

            pointerLocked:
              true
          }
        );

        assert.equal(
          Object.isFrozen(
            snapshot
          ),
          true
        );

        assert.equal(
          Object.isFrozen(
            snapshot.interaction
          ),
          true
        );
      }
    );


    it(
      "publishes on demand without a timer or render loop",
      () => {
        const target =
          createFakeTarget();

        const received =
          [];

        target.addEventListener(
          CLASSROOM_RUNTIME_ACCEPTANCE_V56
            .snapshotEvent,

          (event) => {
            received.push(
              event.detail
            );
          }
        );

        const bridge =
          createClassroomRuntimeAcceptanceBridgeV56({
            target,

            readRuntimeSnapshot:
              () => ({
                frameCount:
                  88
              }),

            readInteractionSnapshot:
              () => ({
                mode:
                  "PLAYING_UNLOCKED",

                gameplayActive:
                  false,

                pointerLocked:
                  false
              }),

            createEvent:
              createFakeEvent
          });

        target.dispatchEvent({
          type:
            CLASSROOM_RUNTIME_ACCEPTANCE_V56
              .requestEvent
        });

        assert.equal(
          received.length,
          1
        );

        assert.equal(
          received[0].sequence,
          1
        );

        assert.equal(
          received[0].runtime.frameCount,
          88
        );

        assert.equal(
          received[0].interaction.mode,
          "PLAYING_UNLOCKED"
        );
      }
    );


    it(
      "increments publication sequence deterministically",
      () => {
        const target =
          createFakeTarget();

        const bridge =
          createClassroomRuntimeAcceptanceBridgeV56({
            target,

            readRuntimeSnapshot:
              () => ({
                frameCount:
                  1
              }),

            readInteractionSnapshot:
              () => ({
                mode:
                  "ENTRY_GATE"
              }),

            createEvent:
              createFakeEvent
          });

        const first =
          bridge.publish();

        const second =
          bridge.publish();

        assert.equal(
          first.sequence,
          1
        );

        assert.equal(
          second.sequence,
          2
        );
      }
    );


    it(
      "removes request authority on dispose",
      () => {
        const target =
          createFakeTarget();

        const received =
          [];

        target.addEventListener(
          CLASSROOM_RUNTIME_ACCEPTANCE_V56
            .snapshotEvent,

          (event) => {
            received.push(
              event.detail
            );
          }
        );

        const bridge =
          createClassroomRuntimeAcceptanceBridgeV56({
            target,

            readRuntimeSnapshot:
              () => ({}),

            readInteractionSnapshot:
              () => ({}),

            createEvent:
              createFakeEvent
          });

        bridge.dispose();

        target.dispatchEvent({
          type:
            CLASSROOM_RUNTIME_ACCEPTANCE_V56
              .requestEvent
        });

        assert.equal(
          received.length,
          0
        );

        assert.equal(
          bridge.getSnapshot(),
          null
        );

        assert.equal(
          bridge.publish(),
          null
        );
      }
    );
  }
);