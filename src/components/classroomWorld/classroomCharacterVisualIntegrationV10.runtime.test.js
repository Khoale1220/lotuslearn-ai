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

const integrationSource =
  fs.readFileSync(
    new URL(
      "./classroomCharacterVisualIntegrationV10.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Character Visual Integration V10 runtime contract",
  async (t) => {
    await t.test(
      "constructs V10 exactly once",
      () => {
        const matches =
          worldSource.match(
            /const classroomCharacterVisualIntegrationV10\s*=/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "constructs after Character V3 authority",
      () => {
        const legacyIndex =
          worldSource.indexOf(
            "const classroomCharacterV3 ="
          );

        const visualIndex =
          worldSource.indexOf(
            "const classroomCharacterVisualIntegrationV10 ="
          );

        assert.ok(
          legacyIndex >=
          0
        );

        assert.ok(
          visualIndex >
          legacyIndex
        );
      }
    );

    await t.test(
      "ticks sprites before rendering",
      () => {
        const tickIndex =
          worldSource.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({"
          );

        const renderIndex =
          worldSource.indexOf(
            "renderer.render(scene, camera);"
          );

        assert.ok(
          tickIndex >=
          0
        );

        assert.ok(
          renderIndex >
          tickIndex
        );
      }
    );

    await t.test(
      "disposes V10 exactly once",
      () => {
        const matches =
          worldSource.match(
            /classroomCharacterVisualIntegrationV10\.dispose\(\);/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "uses dedicated visual layer isolation",
      () => {
        assert.match(
          integrationSource,
          /visualLayer:\s*30/u
        );

        assert.match(
          integrationSource,
          /controller\.sprite\.layers\.set/u
        );

        assert.match(
          integrationSource,
          /camera\.layers\.enable/u
        );
      }
    );

    await t.test(
      "hides rather than destroys Character V3 visuals",
      () => {
        assert.match(
          integrationSource,
          /descriptor\.mesh\.visible\s*=\s*false/u
        );

        assert.doesNotMatch(
          integrationSource,
          /descriptor\.mesh\.removeFromParent/u
        );
      }
    );

    await t.test(
      "restores V3 visibility on disposal",
      () => {
        assert.match(
          integrationSource,
          /originalVisibility/u
        );

        assert.match(
          integrationSource,
          /originalVisibility\.get/u
        );
      }
    );

    await t.test(
      "preserves Locomotion V2",
      () => {
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

    await t.test(
      "preserves V5 teacher intervention authority",
      () => {
        assert.match(
          worldSource,
          /emitTeacherInterventionCommand/u
        );

        assert.match(
          worldSource,
          /probe_understanding/u
        );
      }
    );

    await t.test(
      "preserves V6 window shade runtime",
      () => {
        assert.match(
          worldSource,
          /classroomFinalContentV6\.tick\(\{/u
        );
      }
    );

    await t.test(
      "preserves V7 observability runtime",
      () => {
        assert.match(
          worldSource,
          /classroomRuntimeObservabilityV7\.observeFrame\(\{/u
        );
      }
    );
  }
);