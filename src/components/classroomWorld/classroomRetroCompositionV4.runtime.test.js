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

const compositionSource =
  fs.readFileSync(
    new URL(
      "./classroomRetroCompositionV4.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Retro Composition V4 runtime ownership",
  async (t) => {
    await t.test(
      "composition initializes after Retro FPS pipeline",
      () => {
        const pipelineIndex =
          worldSource.indexOf(
            "createClassroomRetroFpsPipeline({"
          );

        const compositionIndex =
          worldSource.indexOf(
            "createClassroomRetroCompositionV4({"
          );

        assert.ok(
          pipelineIndex >= 0
        );

        assert.ok(
          compositionIndex >
          pipelineIndex
        );
      }
    );

    await t.test(
      "composition follows Character and Student Visual source updates",
      () => {
        const studentIndex =
          worldSource.indexOf(
            "classroomStudentVisualV2.tick();"
          );

        const characterIndex =
          worldSource.indexOf(
            "classroomCharacterV3.tick();"
          );

        const compositionIndex =
          worldSource.indexOf(
            "classroomRetroCompositionV4.tick(camera);"
          );

        assert.ok(
          studentIndex >= 0
        );

        assert.ok(
          characterIndex >
          studentIndex
        );

        assert.ok(
          compositionIndex >
          characterIndex
        );
      }
    );

    await t.test(
      "retro composition owns visible character replacement only",
      () => {
        assert.match(
          compositionSource,
          /classroom-character-v3/u
        );

        assert.match(
          compositionSource,
          /classroom-student-visual-v2/u
        );

        assert.doesNotMatch(
          compositionSource,
          /onTeacherIntervention/u
        );

        assert.doesNotMatch(
          compositionSource,
          /persistTeacherInterventionCommand/u
        );
      }
    );

    await t.test(
      "retro textures use nearest sampling and repeat wrapping",
      () => {
        assert.match(
          compositionSource,
          /THREE\.NearestFilter/u
        );

        assert.match(
          compositionSource,
          /THREE\.RepeatWrapping/u
        );

        assert.match(
          compositionSource,
          /generateMipmaps\s*=\s*false/u
        );
      }
    );

    await t.test(
      "composition disposes before Retro FPS pipeline",
      () => {
        const compositionDispose =
          worldSource.indexOf(
            "classroomRetroCompositionV4.dispose();"
          );

        const pipelineDispose =
          worldSource.indexOf(
            "classroomRetroFpsPipeline.dispose();"
          );

        assert.ok(
          compositionDispose >= 0
        );

        assert.ok(
          pipelineDispose >
          compositionDispose
        );
      }
    );

    await t.test(
      "camera axis and Locomotion V2 remain authoritative",
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