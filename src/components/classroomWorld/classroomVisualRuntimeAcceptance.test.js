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

const architectureSource =
  fs.readFileSync(
    new URL(
      "./classroomArchitectureV2.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 32-bit visual runtime ownership",
  async (t) => {
    await t.test(
      "ClassroomWorld delegates visual ownership",
      () => {
        assert.match(
          worldSource,
          /createClassroomVisualSystem/u
        );

        assert.match(
          worldSource,
          /createClassroomArchitectureV2/u
        );

        const mountIndex =
          worldSource.indexOf(
            "appendChild(renderer.domElement)"
          );

        const visualIndex =
          worldSource.indexOf(
            "createClassroomVisualSystem({"
          );

        const architectureIndex =
          worldSource.indexOf(
            "createClassroomArchitectureV2({"
          );

        assert.ok(
          mountIndex >= 0
        );

        assert.ok(
          visualIndex > mountIndex
        );

        assert.ok(
          architectureIndex >
          visualIndex
        );
      }
    );

    await t.test(
      "visual resources dispose before renderer teardown",
      () => {
        const architectureDispose =
          worldSource.indexOf(
            "classroomArchitectureV2.dispose();"
          );

        const visualDispose =
          worldSource.indexOf(
            "classroomVisualSystem.dispose();"
          );

        const rendererDispose =
          worldSource.indexOf(
            "renderer.dispose();"
          );

        assert.ok(
          architectureDispose >= 0
        );

        assert.ok(
          visualDispose >
          architectureDispose
        );

        assert.ok(
          rendererDispose >
          visualDispose
        );
      }
    );

    await t.test(
      "outside view uses pixel-preserving texture sampling",
      () => {
        assert.match(
          architectureSource,
          /new THREE\.CanvasTexture/u
        );

        assert.match(
          architectureSource,
          /THREE\.NearestFilter/u
        );

        assert.match(
          architectureSource,
          /generateMipmaps\s*=\s*false/u
        );

        assert.match(
          architectureSource,
          /THREE\.SRGBColorSpace/u
        );
      }
    );
  }
);