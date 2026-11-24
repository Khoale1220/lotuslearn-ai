import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const WORLD_PATH = new URL(
  "./ClassroomWorld.jsx",
  import.meta.url,
);

const worldSource = fs.readFileSync(
  WORLD_PATH,
  "utf8",
);

test(
  "CW06 interaction lifecycle acceptance",
  async (t) => {
    await t.test(
      "entry gate has independent ownership",
      () => {
        assert.match(
          worldSource,
          /const\s+\[hasEntered,\s*setHasEntered\]\s*=\s*useState\(false\)/u,
        );

        assert.match(
          worldSource,
          /\{!hasEntered\s*&&\s*\(/u,
        );

        assert.doesNotMatch(
          worldSource,
          /\{!isLocked\s*&&\s*\(\s*<div\s+className="cw-world__entry"/u,
        );
      },
    );

    await t.test(
      "enter action records entry before requesting pointer lock",
      () => {
        assert.match(
          worldSource,
          /setHasEntered\(true\);[\s\S]*?controlsRef\.current\?\.lock\(\)/u,
        );
      },
    );

    await t.test(
      "student inspection intentionally releases pointer lock",
      () => {
        assert.match(
          worldSource,
          /controls\.unlock\(\);[\s\S]*?keys\.clear\(\);[\s\S]*?setSelectedStudent\(/u,
        );
      },
    );

    await t.test(
      "world click resumes only outside inspection",
      () => {
        assert.match(
          worldSource,
          /hasEntered\s*&&[\s\S]*?!selectedStudent\s*&&[\s\S]*?!isLocked[\s\S]*?controlsRef\.current\?\.lock\(\)/u,
        );
      },
    );

    await t.test(
      "teacher trigger uses sanitized command seam",
      () => {
        assert.match(
          worldSource,
          /emitTeacherInterventionCommand\(\{\s*studentKey:\s*selectedStudent\.studentKey,\s*actionType:\s*"probe_understanding"/u,
        );

        assert.doesNotMatch(
          worldSource,
          /onClick=\{\(\)\s*=>\s*onTeacherIntervention\(/u,
        );
      },
    );
  },
);
