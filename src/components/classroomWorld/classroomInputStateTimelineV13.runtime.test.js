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

const timelineSource =
  fs.readFileSync(
    new URL(
      "./classroomInputStateTimelineV13.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 V13 runtime architecture",
  async (t) => {
    await t.test(
      "orders V12 then V13 then V11",
      () => {
        const v12 =
          worldSource.indexOf(
            "const classroomInteractionReplayAuditV12 ="
          );

        const v13 =
          worldSource.indexOf(
            "const classroomInputStateTimelineV13 ="
          );

        const v11 =
          worldSource.indexOf(
            "const classroomInteractionAuthorityV11 ="
          );

        assert.ok(v12 >= 0);
        assert.ok(v13 > v12);
        assert.ok(v11 > v13);
      }
    );

    await t.test(
      "captures state before V7 telemetry",
      () => {
        const checkpoint =
          worldSource.indexOf(
            "classroomInputStateTimelineV13.observeState();"
          );

        const telemetry =
          worldSource.indexOf(
            "classroomRuntimeObservabilityV7.observeFrame({"
          );

        assert.ok(checkpoint >= 0);
        assert.ok(telemetry > checkpoint);
      }
    );

    await t.test(
      "uses capture phase listeners",
      () => {
        assert.match(
          timelineSource,
          /addEventListener\(\s*"keydown"[\s\S]*?true\s*\)/u
        );

        assert.match(
          timelineSource,
          /addEventListener\(\s*"keyup"[\s\S]*?true\s*\)/u
        );
      }
    );

    await t.test(
      "does not consume browser events",
      () => {
        assert.doesNotMatch(
          timelineSource,
          /\.\s*preventDefault\s*\(/u
        );

        assert.doesNotMatch(
          timelineSource,
          /\.\s*stopPropagation\s*\(/u
        );

        assert.doesNotMatch(
          timelineSource,
          /\.\s*stopImmediatePropagation\s*\(/u
        );
      }
    );

    await t.test(
      "contains no wall-clock dependency",
      () => {
        assert.doesNotMatch(
          timelineSource,
          /\bDate\.now\s*\(/u
        );

        assert.doesNotMatch(
          timelineSource,
          /\bperformance\.now\s*\(/u
        );

        assert.doesNotMatch(
          timelineSource,
          /\bevent\.timeStamp\b/u
        );
      }
    );

    await t.test(
      "contains no random source",
      () => {
        assert.doesNotMatch(
          timelineSource,
          /\bMath\.random\s*\(/u
        );

        assert.doesNotMatch(
          timelineSource,
          /\brandomUUID\s*\(/u
        );
      }
    );

    await t.test(
      "links V13 checkpoint to V12 fingerprint",
      () => {
        assert.match(
          worldSource,
          /readInteractionFingerprint:/u
        );

        assert.match(
          worldSource,
          /classroomInteractionReplayAuditV12[\s\S]*?getSnapshot\(\)[\s\S]*?finalFingerprint/u
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
      "preserves V11 authority",
      () => {
        assert.match(
          worldSource,
          /createClassroomInteractionAuthorityV11/u
        );
      }
    );

    await t.test(
      "preserves V12 authority",
      () => {
        assert.match(
          worldSource,
          /createClassroomInteractionReplayAuditV12/u
        );
      }
    );

    await t.test(
      "disposes V13 after V11",
      () => {
        const v11 =
          worldSource.indexOf(
            "classroomInteractionAuthorityV11.dispose();"
          );

        const v13 =
          worldSource.indexOf(
            "classroomInputStateTimelineV13.dispose();"
          );

        assert.ok(v11 >= 0);
        assert.ok(v13 > v11);
      }
    );
  }
);