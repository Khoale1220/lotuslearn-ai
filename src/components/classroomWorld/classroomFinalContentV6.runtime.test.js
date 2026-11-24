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

const v6Source =
  fs.readFileSync(
    new URL(
      "./classroomFinalContentV6.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Final Content V6 runtime contract",
  async (t) => {
    await t.test(
      "is constructed exactly once",
      () => {
        const matches =
          worldSource.match(
            /const classroomFinalContentV6\s*=/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "is ticked from the animation loop",
      () => {
        const matches =
          worldSource.match(
            /classroomFinalContentV6\.tick\(\{/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );

        assert.match(
          worldSource,
          /controlsLocked:\s*[\r\n\s]*controls\.isLocked/u
        );
      }
    );

    await t.test(
      "is disposed exactly once",
      () => {
        const matches =
          worldSource.match(
            /classroomFinalContentV6\.dispose\(\);/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "uses exactly one environmental interaction raycaster",
      () => {
        const matches =
          v6Source.match(
            /new THREE\.Raycaster\(\)/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "discovers windows from scene geometry",
      () => {
        assert.match(
          v6Source,
          /discoverWindowDescriptors/u
        );

        assert.match(
          v6Source,
          /new THREE\.Box3\(\)/u
        );

        assert.match(
          v6Source,
          /\.setFromObject\(/u
        );
      }
    );

    await t.test(
      "window shades expose explicit interaction metadata",
      () => {
        assert.match(
          v6Source,
          /interactionType:\s*[\r\n\s]*"window-shade"/u
        );

        assert.match(
          v6Source,
          /shadeIndex/u
        );

        assert.match(
          v6Source,
          /shadeId/u
        );
      }
    );

    await t.test(
      "supports keyboard interaction",
      () => {
        assert.match(
          v6Source,
          /"KeyE"/u
        );

        assert.match(
          v6Source,
          /"OPEN SHADE"/u
        );

        assert.match(
          v6Source,
          /"CLOSE SHADE"/u
        );
      }
    );

    await t.test(
      "uses delta-time shade travel",
      () => {
        assert.match(
          v6Source,
          /deltaSeconds/u
        );

        assert.match(
          v6Source,
          /advanceWindowShadeFraction/u
        );

        assert.match(
          worldSource,
          /classroomFinalContentV6\.tick\(\{[\s\S]*timestamp/u
        );
      }
    );

    await t.test(
      "keeps retro texture sampling crisp",
      () => {
        assert.match(
          v6Source,
          /THREE\.NearestFilter/u
        );

        assert.match(
          v6Source,
          /generateMipmaps\s*=\s*false/u
        );
      }
    );

    await t.test(
      "owns cleanup lifecycle",
      () => {
        assert.match(
          v6Source,
          /removeEventListener/u
        );

        assert.match(
          v6Source,
          /disposeOwnedGraph/u
        );

        assert.match(
          v6Source,
          /prompt\.remove\(\)/u
        );
      }
    );

    await t.test(
      "preserves teacher intervention authority",
      () => {
        assert.match(
          worldSource,
          /RETRO_TEACHER_INTERVENTION_UI_EVENT/u
        );

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
      "preserves Locomotion V2",
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