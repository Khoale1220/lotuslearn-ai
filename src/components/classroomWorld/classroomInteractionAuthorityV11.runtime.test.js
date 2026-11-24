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

const authoritySource =
  fs.readFileSync(
    new URL(
      "./classroomInteractionAuthorityV11.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Interaction Authority V11 runtime contract",
  async (t) => {
    await t.test(
      "constructs one V11 authority",
      () => {
        const matches =
          worldSource.match(
            /const classroomInteractionAuthorityV11\s*=/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "constructs after both V6 and V10",
      () => {
        const v6 =
          worldSource.indexOf(
            "const classroomFinalContentV6 ="
          );

        const v10 =
          worldSource.indexOf(
            "const classroomCharacterVisualIntegrationV10 ="
          );

        const v11 =
          worldSource.indexOf(
            "const classroomInteractionAuthorityV11 ="
          );

        assert.ok(
          v6 >=
          0
        );

        assert.ok(
          v10 >=
          0
        );

        assert.ok(
          v11 >
          v6
        );

        assert.ok(
          v11 >
          v10
        );
      }
    );

    await t.test(
      "routes students through canonical intervention command",
      () => {
        assert.match(
          worldSource,
          /emitTeacherInterventionCommand/u
        );

        assert.match(
          authoritySource,
          /actionType:\s*"probe_understanding"/u
        );
      }
    );

    await t.test(
      "owns a single center-screen Raycaster",
      () => {
        assert.match(
          authoritySource,
          /new THREE\.Raycaster\(\)/u
        );

        assert.match(
          authoritySource,
          /centerNdc/u
        );

        assert.match(
          authoritySource,
          /raycaster\.setFromCamera/u
        );
      }
    );

    await t.test(
      "isolates raycasting to legacy interaction layer zero",
      () => {
        assert.match(
          authoritySource,
          /raycastLayer:\s*0/u
        );

        assert.match(
          authoritySource,
          /raycaster\.layers\.set/u
        );
      }
    );

    await t.test(
      "arbitrates student and window shade providers",
      () => {
        assert.match(
          authoritySource,
          /provider:\s*"student"/u
        );

        assert.match(
          authoritySource,
          /provider:\s*"window-shade"/u
        );

        assert.match(
          authoritySource,
          /sortInteractionCandidates/u
        );
      }
    );

    await t.test(
      "student priority only resolves near-distance ties",
      () => {
        assert.match(
          authoritySource,
          /distanceTieEpsilon/u
        );

        assert.match(
          authoritySource,
          /studentPriority:\s*200/u
        );

        assert.match(
          authoritySource,
          /windowShadePriority:\s*100/u
        );
      }
    );

    await t.test(
      "preserves V6 legacy delegation fallback",
      () => {
        assert.match(
          authoritySource,
          /delegated:\s*true/u
        );

        assert.match(
          authoritySource,
          /findSystemWindowShadeInvoker/u
        );
      }
    );

    await t.test(
      "suppresses legacy listeners only after successful handling",
      () => {
        assert.match(
          authoritySource,
          /if\s*\(\s*result\.handled\s*\)/u
        );

        assert.match(
          authoritySource,
          /stopImmediatePropagation/u
        );
      }
    );

    await t.test(
      "disposes V11 before V10",
      () => {
        const v11Dispose =
          worldSource.indexOf(
            "classroomInteractionAuthorityV11.dispose();"
          );

        const v10Dispose =
          worldSource.indexOf(
            "classroomCharacterVisualIntegrationV10.dispose();"
          );

        assert.ok(
          v11Dispose >=
          0
        );

        assert.ok(
          v10Dispose >
          v11Dispose
        );
      }
    );

    await t.test(
      "preserves Locomotion V2 authority",
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
      "preserves V7 observability",
      () => {
        assert.match(
          worldSource,
          /classroomRuntimeObservabilityV7\.observeFrame\(\{/u
        );
      }
    );
  }
);