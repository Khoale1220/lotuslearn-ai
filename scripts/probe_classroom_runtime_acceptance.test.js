import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  buildClassroomNavigationExpression,
  buildSnapshotExpression,
  validateAcceptanceResultV56
} from "./probe_classroom_runtime_acceptance.js";


describe(
  "CW07 V57 terminal acceptance probe",
  () => {
    it(
      "validates a coherent V56 runtime snapshot",
      () => {
        const summary =
          validateAcceptanceResultV56({
            ok:
              true,

            dom: {
              interactionMode:
                "ENTRY_GATE",

              gameplayActive:
                false
            },

            snapshot: {
              version:
                "CW07_RUNTIME_ACCEPTANCE_V56",

              sequence:
                1,

              runtime: {
                version:
                  "CW06_RUNTIME_OBSERVABILITY_V7",

                frameCount:
                  42
              },

              interaction: {
                mode:
                  "ENTRY_GATE",

                gameplayActive:
                  false,

                pointerLocked:
                  false
              }
            }
          });

        assert.equal(
          summary.interactionMode,
          "ENTRY_GATE"
        );

        assert.equal(
          summary.gameplayActive,
          false
        );

        assert.equal(
          summary.pointerLocked,
          false
        );

        assert.equal(
          summary.frameCount,
          42
        );
      }
    );


    it(
      "fails closed on interaction mode disagreement",
      () => {
        assert.throws(
          () =>
            validateAcceptanceResultV56({
              ok:
                true,

              dom: {
                interactionMode:
                  "PLAYING_UNLOCKED",

                gameplayActive:
                  false
              },

              snapshot: {
                version:
                  "CW07_RUNTIME_ACCEPTANCE_V56",

                sequence:
                  1,

                runtime: {},

                interaction: {
                  mode:
                    "ENTRY_GATE",

                  gameplayActive:
                    false,

                  pointerLocked:
                    false
                }
              }
            }),

          /INTERACTION_MODE_MISMATCH/
        );
      }
    );


    it(
      "fails closed on missing V7 runtime snapshot",
      () => {
        assert.throws(
          () =>
            validateAcceptanceResultV56({
              ok:
                true,

              dom: {
                interactionMode:
                  "ENTRY_GATE",

                gameplayActive:
                  false
              },

              snapshot: {
                version:
                  "CW07_RUNTIME_ACCEPTANCE_V56",

                sequence:
                  1,

                runtime:
                  null,

                interaction: {
                  mode:
                    "ENTRY_GATE",

                  gameplayActive:
                    false,

                  pointerLocked:
                    false
                }
              }
            }),

          /V7_RUNTIME_SNAPSHOT_MISSING/
        );
      }
    );


    it(
      "builds a classroom navigation probe without product mutation",
      () => {
        const source =
          buildClassroomNavigationExpression();

        assert.match(
          source,
          /classroom\\s\+world/i
        );

        assert.match(
          source,
          /cw-world__viewport/
        );

        assert.equal(
          source.includes(
            "localStorage"
          ),
          false
        );

        assert.equal(
          source.includes(
            "fetch("
          ),
          false
        );
      }
    );


    it(
      "requests the V56 snapshot event contract",
      () => {
        const source =
          buildSnapshotExpression();

        assert.match(
          source,
          /lotuslearn:classroom-runtime-acceptance-request/
        );

        assert.match(
          source,
          /lotuslearn:classroom-runtime-acceptance-snapshot/
        );

        assert.match(
          source,
          /cw-world__viewport/
        );
      }
    );
  }
);