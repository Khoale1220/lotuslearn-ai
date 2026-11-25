import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  MODE,
  assertStrictlyIncreasingSequence,
  buildPointerLockCapabilityExpression,
  buildTextControlCenterExpression,
  buildViewportCenterExpression,
  createKeyEventPayload
} from "./probe_classroom_state_matrix.js";


describe(
  "CW07.7B real input state matrix helpers",
  () => {
    it(
      "defines exact V54 gameplay modes",
      () => {
        assert.equal(
          MODE.ENTRY_GATE,
          "ENTRY_GATE"
        );

        assert.equal(
          MODE.PLAYING_UNLOCKED,
          "PLAYING_UNLOCKED"
        );

        assert.equal(
          MODE.PLAYING_LOCKED,
          "PLAYING_LOCKED"
        );
      }
    );


    it(
      "builds a browser-native pointer lock capability probe",
      () => {
        const source =
          buildPointerLockCapabilityExpression();

        assert.match(
          source,
          /requestPointerLock/
        );

        assert.match(
          source,
          /pointerlockchange/
        );

        assert.match(
          source,
          /pointerlockerror/
        );

        assert.match(
          source,
          /userActivation/
        );

        assert.equal(
          source.includes(
            "setIsLocked"
          ),
          false
        );

        assert.equal(
          source.includes(
            "interactionState"
          ),
          false
        );
      }
    );


    it(
      "builds physical W key CDP payload",
      () => {
        assert.deepEqual(
          createKeyEventPayload({
            type:
              "keyDown",

            key:
              "w",

            code:
              "KeyW",

            windowsVirtualKeyCode:
              87
          }),

          {
            type:
              "keyDown",

            key:
              "w",

            code:
              "KeyW",

            windowsVirtualKeyCode:
              87,

            nativeVirtualKeyCode:
              87
          }
        );
      }
    );


    it(
      "builds semantic text-control locator",
      () => {
        const source =
          buildTextControlCenterExpression(
            "enter\\s+classroom"
          );

        assert.match(
          source,
          /getBoundingClientRect/
        );

        assert.match(
          source,
          /new RegExp/
        );

        assert.match(
          source,
          /enter/
        );
      }
    );


    it(
      "builds viewport locator",
      () => {
        const source =
          buildViewportCenterExpression();

        assert.match(
          source,
          /cw-world__viewport/
        );

        assert.match(
          source,
          /getBoundingClientRect/
        );
      }
    );


    it(
      "accepts strictly increasing V56 sequences",
      () => {
        const snapshots =
          [
            1,
            2,
            8,
            12
          ].map(
            (sequence) => ({
              summary: {
                sequence
              }
            })
          );

        assert.equal(
          assertStrictlyIncreasingSequence(
            snapshots
          ),
          true
        );
      }
    );


    it(
      "fails closed on duplicated V56 sequence",
      () => {
        assert.throws(
          () =>
            assertStrictlyIncreasingSequence([
              {
                summary: {
                  sequence:
                    2
                }
              },

              {
                summary: {
                  sequence:
                    2
                }
              }
            ]),

          /NON_MONOTONIC_ACCEPTANCE_SEQUENCE/
        );
      }
    );
  }
);