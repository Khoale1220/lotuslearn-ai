import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worldSource =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

const pipelineSource =
  fs.readFileSync(
    new URL(
      "./classroomRetroFpsPipeline.js",
      import.meta.url
    ),
    "utf8"
  );

const compositionSource =
  fs.readFileSync(
    new URL(
      "./classroomRetroCompositionV4.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Retro Interaction V5 runtime contract",
  async (t) => {
    await t.test(
      "animation timestamp reaches composition",
      () => {
        assert.match(
          worldSource,
          /classroomRetroCompositionV4\.tick\(\s*camera,\s*timestamp\s*\);/u
        );
      }
    );

    await t.test(
      "animation timestamp reaches HUD",
      () => {
        const start =
          worldSource.indexOf(
            "classroomRetroFpsPipeline.updateHud({"
          );

        assert.ok(
          start >= 0
        );

        const region =
          worldSource.slice(
            start,
            start + 700
          );

        assert.match(
          region,
          /\btimestamp\b/u
        );
      }
    );

    await t.test(
      "student animation remains visual-only",
      () => {
        assert.match(
          compositionSource,
          /computeRetroStudentIdlePose/u
        );

        assert.match(
          compositionSource,
          /idlePose\.bob/u
        );

        assert.match(
          compositionSource,
          /idlePose\.sway/u
        );

        assert.match(
          compositionSource,
          /idlePose\.scaleY/u
        );

        assert.doesNotMatch(
          compositionSource,
          /emitTeacherInterventionCommand/u
        );
      }
    );

    await t.test(
      "teacher tool feedback remains UI-only",
      () => {
        assert.match(
          pipelineSource,
          /lotuslearn:teacher-intervention-ui/u
        );

        assert.match(
          pipelineSource,
          /REQUESTED:/u
        );

        assert.doesNotMatch(
          pipelineSource,
          /emitTeacherInterventionCommand/u
        );

        assert.doesNotMatch(
          pipelineSource,
          /fetch\(/u
        );
      }
    );

    await t.test(
      "APPLY INTERVENTION preserves its canonical command handler",
      () => {
        const labelIndex =
          worldSource.indexOf(
            "APPLY INTERVENTION"
          );

        assert.ok(
          labelIndex >= 0
        );

        const buttonStart =
          worldSource.lastIndexOf(
            "<button",
            labelIndex
          );

        const buttonEnd =
          worldSource.indexOf(
            "</button>",
            labelIndex
          );

        assert.ok(
          buttonStart >= 0
        );

        assert.ok(
          buttonEnd >
          labelIndex
        );

        const buttonRegion =
          worldSource.slice(
            buttonStart,
            buttonEnd
          );

        assert.match(
          buttonRegion,
          /RETRO_TEACHER_INTERVENTION_UI_EVENT/u
        );

        assert.match(
          buttonRegion,
          /originalOnClick/u
        );

        assert.match(
          buttonRegion,
          /emitTeacherInterventionCommand/u
        );

        assert.match(
          buttonRegion,
          /probe_understanding/u
        );
      }
    );

    await t.test(
      "retro FPS rendering invariants survive V5",
      () => {
        assert.match(
          pipelineSource,
          /internalHeight:\s*240/u
        );

        assert.match(
          pipelineSource,
          /THREE\.NearestFilter/u
        );

        assert.match(
          compositionSource,
          /THREE\.RepeatWrapping/u
        );

        assert.match(
          compositionSource,
          /alphaTest:\s*0\.5/u
        );
      }
    );

    await t.test(
      "Locomotion V2 remains the sole movement authority",
      () => {
        assert.match(
          worldSource,
          /createThreeCameraMovementInput/u
        );

        assert.match(
          worldSource,
          /stepPlayerLocomotion\(\{/u
        );

        assert.match(
          worldSource,
          /resolveVelocityAfterCollision\(\{/u
        );

        assert.doesNotMatch(
          worldSource,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);