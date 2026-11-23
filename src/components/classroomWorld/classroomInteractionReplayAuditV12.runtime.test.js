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

const v11Source =
  fs.readFileSync(
    new URL(
      "./classroomInteractionAuthorityV11.js",
      import.meta.url
    ),
    "utf8"
  );

const v12Source =
  fs.readFileSync(
    new URL(
      "./classroomInteractionReplayAuditV12.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 deterministic replay audit V12 runtime contract",
  async (t) => {
    await t.test(
      "constructs V12 before V11 authority",
      () => {
        const v12 =
          worldSource.indexOf(
            "const classroomInteractionReplayAuditV12 ="
          );

        const v11 =
          worldSource.indexOf(
            "const classroomInteractionAuthorityV11 ="
          );

        assert.ok(
          v12 >=
          0
        );

        assert.ok(
          v11 >
          v12
        );
      }
    );

    await t.test(
      "injects V12 as V11 audit observer",
      () => {
        assert.match(
          worldSource,
          /auditObserver:\s*classroomInteractionReplayAuditV12/u
        );
      }
    );

    await t.test(
      "records both decisions and activations",
      () => {
        assert.match(
          v11Source,
          /"recordDecision"/u
        );

        assert.match(
          v11Source,
          /"recordActivation"/u
        );
      }
    );

    await t.test(
      "does not allow audit exceptions to mutate gameplay",
      () => {
        assert.match(
          v11Source,
          /catch\s*\(error\)/u
        );

        assert.match(
          v11Source,
          /auditFailureCount/u
        );
      }
    );

    await t.test(
      "removes runtime UUID fallback from window shade authority",
      () => {
        assert.doesNotMatch(
          v11Source,
          /object\?\.uuid\s*\?\?/u
        );

        assert.match(
          v11Source,
          /if\s*\(!identity\)/u
        );
      }
    );

    await t.test(
      "V12 has no wall-clock dependency",
      () => {
        assert.doesNotMatch(
          v12Source,
          /\bDate\.now\b/u
        );

        assert.doesNotMatch(
          v12Source,
          /\bperformance\.now\b/u
        );

        assert.doesNotMatch(
          v12Source,
          /\bnew Date\b/u
        );
      }
    );

    await t.test(
      "V12 has no random dependency",
      () => {
        assert.doesNotMatch(
          v12Source,
          /\bMath\.random\b/u
        );

        assert.doesNotMatch(
          v12Source,
          /\brandomUUID\b/u
        );
      }
    );

    await t.test(
      "V12 uses a chained deterministic fingerprint",
      () => {
        assert.match(
          v12Source,
          /previousFingerprint/u
        );

        assert.match(
          v12Source,
          /fnv1a32/u
        );

        assert.match(
          v12Source,
          /stableStringify/u
        );
      }
    );

    await t.test(
      "V12 detects replay double-fire",
      () => {
        assert.match(
          v12Source,
          /DOUBLE_FIRE/u
        );
      }
    );

    await t.test(
      "V12 detects nondeterministic runtime UUID identity",
      () => {
        assert.match(
          v12Source,
          /NONDETERMINISTIC_RUNTIME_UUID/u
        );
      }
    );

    await t.test(
      "preserves interaction authority V11",
      () => {
        assert.match(
          worldSource,
          /createClassroomInteractionAuthorityV11/u
        );

        assert.match(
          v11Source,
          /raycaster\.setFromCamera/u
        );

        assert.match(
          v11Source,
          /stopImmediatePropagation/u
        );
      }
    );

    await t.test(
      "preserves V10 presentation authority",
      () => {
        assert.match(
          worldSource,
          /classroomCharacterVisualIntegrationV10/u
        );
      }
    );

    await t.test(
      "preserves V6 window shades",
      () => {
        assert.match(
          worldSource,
          /classroomFinalContentV6/u
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
      "disposes authority before audit",
      () => {
        const authorityDispose =
          worldSource.indexOf(
            "classroomInteractionAuthorityV11.dispose();"
          );

        const auditDispose =
          worldSource.indexOf(
            "classroomInteractionReplayAuditV12.dispose();"
          );

        assert.ok(
          authorityDispose >=
          0
        );

        assert.ok(
          auditDispose >
          authorityDispose
        );
      }
    );
  }
);