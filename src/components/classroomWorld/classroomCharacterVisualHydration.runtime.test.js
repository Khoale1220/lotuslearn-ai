import assert from "node:assert/strict";
import fs from "node:fs";
import {
  describe,
  it
} from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

describe(
  "CW06 character visual hydration lifecycle",
  () => {
    it(
      "keeps V42-V46 dormant until V10 has sprites",
      () => {
        assert.match(
          source,
          /function ensureCharacterVisualPolishV42ToV46\s*\(\)/
        );

        assert.match(
          source,
          /snapshot\.spriteCount\s*<=\s*0/
        );

        assert.match(
          source,
          /let classroomCharacterSceneCohesionV42\s*=\s*null/
        );

        assert.doesNotMatch(
          source,
          /const classroomCharacterSceneCohesionV42\s*=/
        );
      }
    );

    it(
      "hydrates roster then V2 then V3 then V10 then V42-V46",
      () => {
        const rosterSync =
          source.indexOf(
            "sceneRoster.sync(\n      initialRoster"
          );

        const v2Refresh =
          source.indexOf(
            "classroomStudentVisualV2.refresh();",
            rosterSync
          );

        const v3Sync =
          source.indexOf(
            "classroomCharacterV3.sync();",
            v2Refresh
          );

        const v10Tick =
          source.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            v3Sync
          );

        const polish =
          source.indexOf(
            "ensureCharacterVisualPolishV42ToV46();",
            v10Tick
          );

        assert.ok(
          rosterSync >= 0
        );

        assert.ok(
          v2Refresh >
            rosterSync
        );

        assert.ok(
          v3Sync >
            v2Refresh
        );

        assert.ok(
          v10Tick >
            v3Sync
        );

        assert.ok(
          polish >
            v10Tick
        );
      }
    );

    it(
      "checks lazy hydration after runtime V10 tick",
      () => {
        const animate =
          source.indexOf(
            "const animate = (timestamp) => {"
          );

        const v10Tick =
          source.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            animate
          );

        const polish =
          source.indexOf(
            "ensureCharacterVisualPolishV42ToV46();",
            v10Tick
          );

        const v42Tick =
          source.indexOf(
            "classroomCharacterSceneCohesionV42?.tick({",
            polish
          );

        assert.ok(
          animate >= 0
        );

        assert.ok(
          v10Tick >
            animate
        );

        assert.ok(
          polish >
            v10Tick
        );

        assert.ok(
          v42Tick >
            polish
        );
      }
    );

    it(
      "allows cleanup when population never materializes",
      () => {
        for (
          const symbol
          of [
            "classroomCharacterFirstPersonStagingV46?.dispose();",
            "classroomCharacterCastVarietyV45?.dispose();",
            "classroomCharacterBodyClothingFidelityV44?.dispose();",
            "classroomCharacterAtlasFidelityV43?.dispose();",
            "classroomCharacterSceneCohesionV42?.dispose();"
          ]
        ) {
          assert.ok(
            source.includes(
              symbol
            ),
            symbol
          );
        }
      }
    );
  }
);
