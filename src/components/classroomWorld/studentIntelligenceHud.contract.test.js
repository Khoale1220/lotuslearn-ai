import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const worldSource = readFileSync(
  new URL("./ClassroomWorld.jsx", import.meta.url),
  "utf8"
);

const cssSource = readFileSync(
  new URL("./classroomWorld.css", import.meta.url),
  "utf8"
);

test(
  "CW05 C2C3B sanitized student intelligence HUD",
  async (t) => {
    await t.test(
      "presentation is driven by sanitized contract fields",
      () => {
        assert.match(
          worldSource,
          /ALLOWED_FIELDS/
        );

        assert.match(
          worldSource,
          /createStudentHudRows\(selectedStudent\)/
        );

        assert.match(
          worldSource,
          /selectedStudentHudRows\.map/
        );
      }
    );

    await t.test(
      "runtime lookup remains studentKey based",
      () => {
        assert.match(
          worldSource,
          /requireStudent/
        );

        assert.match(
          worldSource,
          /studentKey/
        );

        assert.match(
          worldSource,
          /event\.code === "KeyE"/
        );
      }
    );

    await t.test(
      "raw analysis remains outside ClassroomWorld",
      () => {
        assert.doesNotMatch(
          worldSource,
          /\brawSubmission\b/
        );

        assert.doesNotMatch(
          worldSource,
          /\brawSubmissions\b/
        );

        assert.doesNotMatch(
          worldSource,
          /\bstudentName\b/
        );

        assert.doesNotMatch(
          worldSource,
          /\bemail\b/
        );
      }
    );

    await t.test(
      "HUD exposes student identity and sanitized rows",
      () => {
        assert.match(
          worldSource,
          /LOTUSLEARN \/\/ STUDENT INTELLIGENCE/
        );

        assert.match(
          worldSource,
          /selectedStudent\.displayLabel/
        );

        assert.match(
          worldSource,
          /selectedStudent\.studentKey/
        );

        assert.match(
          worldSource,
          /cw-world__student-hud/
        );
      }
    );

    await t.test(
      "HUD supports explicit dismissal",
      () => {
        assert.match(
          worldSource,
          /event\.code === "Escape"/
        );

        assert.match(
          worldSource,
          /setSelectedStudent\(null\)/
        );
      }
    );

    await t.test(
      "presentation retains explicit pixel HUD contract",
      () => {
        assert.match(
          cssSource,
          /CW05-C2C3B-STUDENT-HUD/
        );

        assert.match(
          cssSource,
          /image-rendering:\s*pixelated/
        );

        assert.match(
          cssSource,
          /cw-world__student-hud-row/
        );
      }
    );
  }
);