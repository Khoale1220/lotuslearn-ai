import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  computeRetroStudentIdlePose
} from "./classroomRetroCompositionV4.js";

import {
  RETRO_TEACHER_INTERVENTION_UI_EVENT,
  computeTeacherToolPose
} from "./classroomRetroFpsPipeline.js";

describe(
  "CW06 Retro Interaction V5",
  () => {
    it(
      "keeps student idle motion subtle and bounded",
      () => {
        for (
          let index = 0;
          index < 32;
          index += 1
        ) {
          const pose =
            computeRetroStudentIdlePose({
              timestamp:
                12_345,
              index
            });

          assert.ok(
            Math.abs(
              pose.bob
            ) <= 0.0141
          );

          assert.ok(
            Math.abs(
              pose.sway
            ) <= 0.0061
          );

          assert.ok(
            pose.scaleY >=
              0.9919
          );

          assert.ok(
            pose.scaleY <=
              1.0081
          );
        }
      }
    );

    it(
      "uses deterministic per-student phase offsets",
      () => {
        const first =
          computeRetroStudentIdlePose({
            timestamp: 5000,
            index: 0
          });

        const second =
          computeRetroStudentIdlePose({
            timestamp: 5000,
            index: 1
          });

        assert.notEqual(
          first.bob,
          second.bob
        );
      }
    );

    it(
      "raises the teacher tool for an active target",
      () => {
        const idle =
          computeTeacherToolPose({
            timestamp: 4000,
            targeted: false,
            interventionActive: false
          });

        const targeted =
          computeTeacherToolPose({
            timestamp: 4000,
            targeted: true,
            interventionActive: false
          });

        assert.ok(
          targeted.y <
          idle.y
        );
      }
    );

    it(
      "uses a stronger kick for intervention intent",
      () => {
        const targeted =
          computeTeacherToolPose({
            timestamp: 4000,
            targeted: true,
            interventionActive: false
          });

        const intervention =
          computeTeacherToolPose({
            timestamp: 4000,
            targeted: true,
            interventionActive: true
          });

        assert.ok(
          intervention.y <
          targeted.y
        );

        assert.equal(
          intervention.x,
          5
        );
      }
    );

    it(
      "exposes a stable visual UI-event contract",
      () => {
        assert.equal(
          RETRO_TEACHER_INTERVENTION_UI_EVENT,
          "lotuslearn:teacher-intervention-ui"
        );
      }
    );
  }
);