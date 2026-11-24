import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Classroom Environment V2 runtime ownership",
  async (t) => {
    await t.test(
      "environment layers build in deterministic order",
      () => {
        const visualIndex =
          source.indexOf(
            "createClassroomVisualSystem({"
          );

        const architectureIndex =
          source.indexOf(
            "createClassroomArchitectureV2({"
          );

        const furnitureIndex =
          source.indexOf(
            "createClassroomFurnitureV2({"
          );

        const lightingIndex =
          source.indexOf(
            "createClassroomLightingV2({"
          );

        assert.ok(
          visualIndex >= 0
        );

        assert.ok(
          architectureIndex >
          visualIndex
        );

        assert.ok(
          furnitureIndex >
          architectureIndex
        );

        assert.ok(
          lightingIndex >
          furnitureIndex
        );
      }
    );

    await t.test(
      "environment resources dispose before visual system and renderer",
      () => {
        const furnitureDispose =
          source.indexOf(
            "classroomFurnitureV2.dispose();"
          );

        const lightingDispose =
          source.indexOf(
            "classroomLightingV2.dispose();"
          );

        const architectureDispose =
          source.indexOf(
            "classroomArchitectureV2.dispose();"
          );

        const visualDispose =
          source.indexOf(
            "classroomVisualSystem.dispose();"
          );

        const rendererDispose =
          source.indexOf(
            "renderer.dispose();"
          );

        assert.ok(
          furnitureDispose >= 0
        );

        assert.ok(
          lightingDispose >
          furnitureDispose
        );

        assert.ok(
          architectureDispose >
          lightingDispose
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
      "Locomotion V2 remains authoritative",
      () => {
        assert.match(
          source,
          /stepPlayerLocomotion\(\{/u
        );

        assert.match(
          source,
          /resolveVelocityAfterCollision\(\{/u
        );

        assert.doesNotMatch(
          source,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);