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

test(
  "CW06 Retro FPS runtime ownership",
  async (t) => {
    await t.test(
      "retro pipeline initializes after Room and Character V3",
      () => {
        const roomIndex =
          worldSource.indexOf(
            "createClassroomRoomGeometryV3({"
          );

        const characterIndex =
          worldSource.indexOf(
            "createClassroomCharacterV3({"
          );

        const retroIndex =
          worldSource.indexOf(
            "createClassroomRetroFpsPipeline({"
          );

        assert.ok(
          roomIndex >= 0
        );

        assert.ok(
          characterIndex >
          roomIndex
        );

        assert.ok(
          retroIndex >
          characterIndex
        );
      }
    );

    await t.test(
      "retro HUD follows current interaction target",
      () => {
        assert.match(
          worldSource,
          /classroomRetroFpsPipeline\.updateHud\(\{/u
        );

        assert.match(
          worldSource,
          /classroomInteractionFeedbackV2\.getCurrentIdentity\(\)/u
        );
      }
    );

    await t.test(
      "pipeline disposes before Character V3",
      () => {
        const retroDispose =
          worldSource.indexOf(
            "classroomRetroFpsPipeline.dispose();"
          );

        const characterDispose =
          worldSource.indexOf(
            "classroomCharacterV3.dispose();"
          );

        assert.ok(
          retroDispose >= 0
        );

        assert.ok(
          characterDispose >
          retroDispose
        );
      }
    );

    await t.test(
      "pipeline enforces low-resolution nearest-neighbor rendering",
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
          pipelineSource,
          /imageRendering\s*=\s*"pixelated"/u
        );

        assert.match(
          pipelineSource,
          /THREE\.BasicShadowMap/u
        );

        assert.match(
          pipelineSource,
          /THREE\.NoToneMapping/u
        );
      }
    );

    await t.test(
      "camera-axis and Locomotion V2 remain authoritative",
      () => {
        assert.match(
          worldSource,
          /createThreeCameraMovementInput/u
        );

        assert.match(
          worldSource,
          /stepPlayerLocomotion\(\{/u
        );

        assert.doesNotMatch(
          worldSource,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);