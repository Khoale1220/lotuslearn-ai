import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  WINDOW_SHADE_V6_PROFILE,
  advanceWindowShadeFraction,
  computeWindowShadePose,
  getWindowShadeActionLabel
} from "./classroomFinalContentV6.js";

function assertApproximatelyEqual(
  actual,
  expected,
  tolerance = 1e-10
) {
  assert.ok(
    Math.abs(
      actual -
      expected
    ) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

describe(
  "CW06 Final Content V6",
  () => {
    it(
      "targets three independent window shades",
      () => {
        assert.equal(
          WINDOW_SHADE_V6_PROFILE
            .desiredShadeCount,
          3
        );
      }
    );

    it(
      "moves shade fraction toward its target without overshoot",
      () => {
        const next =
          advanceWindowShadeFraction({
            current: 0.2,
            target: 1,
            deltaSeconds: 0.1,
            speed: 1
          });

        assertApproximatelyEqual(
          next,
          0.3
        );

        assert.equal(
          advanceWindowShadeFraction({
            current: 0.95,
            target: 1,
            deltaSeconds: 1,
            speed: 1
          }),
          1
        );
      }
    );

    it(
      "supports closing as well as opening",
      () => {
        const next =
          advanceWindowShadeFraction({
            current: 0.8,
            target: 0,
            deltaSeconds: 0.2,
            speed: 1
          });

        assertApproximatelyEqual(
          next,
          0.6
        );
      }
    );

    it(
      "is frame-rate independent",
      () => {
        let sixtyFps =
          0;

        for (
          let frame = 0;
          frame < 60;
          frame += 1
        ) {
          sixtyFps =
            advanceWindowShadeFraction({
              current:
                sixtyFps,

              target:
                1,

              deltaSeconds:
                1 / 60,

              speed:
                0.5
            });
        }

        let thirtyFps =
          0;

        for (
          let frame = 0;
          frame < 30;
          frame += 1
        ) {
          thirtyFps =
            advanceWindowShadeFraction({
              current:
                thirtyFps,

              target:
                1,

              deltaSeconds:
                1 / 30,

              speed:
                0.5
            });
        }

        assertApproximatelyEqual(
          sixtyFps,
          thirtyFps
        );

        assertApproximatelyEqual(
          sixtyFps,
          0.5
        );
      }
    );

    it(
      "keeps fabric attached to its top rail",
      () => {
        const closed =
          computeWindowShadePose({
            closedHeight: 2,
            openFraction: 0
          });

        const halfway =
          computeWindowShadePose({
            closedHeight: 2,
            openFraction: 0.5
          });

        const open =
          computeWindowShadePose({
            closedHeight: 2,
            openFraction: 1
          });

        assert.equal(
          closed.visibleHeight,
          2
        );

        assert.ok(
          halfway.visibleHeight <
          closed.visibleHeight
        );

        assert.ok(
          open.visibleHeight <
          halfway.visibleHeight
        );

        assert.ok(
          open.fabricCenterLocalY >
          closed.fabricCenterLocalY
        );

        assert.ok(
          open.bottomRailLocalY >
          closed.bottomRailLocalY
        );
      }
    );

    it(
      "never removes the fabric completely",
      () => {
        const pose =
          computeWindowShadePose({
            closedHeight: 2,
            openFraction: 1
          });

        assert.ok(
          pose.visibleFraction > 0
        );

        assert.ok(
          pose.visibleHeight > 0
        );
      }
    );

    it(
      "uses deterministic interaction labels",
      () => {
        assert.equal(
          getWindowShadeActionLabel(
            0
          ),
          "OPEN SHADE"
        );

        assert.equal(
          getWindowShadeActionLabel(
            1
          ),
          "CLOSE SHADE"
        );
      }
    );
  }
);