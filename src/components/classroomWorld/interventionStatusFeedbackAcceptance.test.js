import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource =
  fs.readFileSync(
    new URL(
      "../../App.jsx",
      import.meta.url,
    ),
    "utf8",
  );

const worldSource =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url,
    ),
    "utf8",
  );

const statusSource =
  fs.readFileSync(
    new URL(
      "./teacherInterventionStatus.js",
      import.meta.url,
    ),
    "utf8",
  );

const cssSource =
  fs.readFileSync(
    new URL(
      "./classroomWorld.css",
      import.meta.url,
    ),
    "utf8",
  );

test(
  "CW06 A5.3 intervention status feedback",
  async (t) => {
    await t.test(
      "App owns intervention request status",
      () => {
        assert.match(
          appSource,
          /teacherInterventionStatus/u,
        );

        assert.match(
          appSource,
          /setTeacherInterventionStatus/u,
        );

        assert.match(
          appSource,
          /createPendingTeacherInterventionStatus/u,
        );

        assert.match(
          appSource,
          /createSuccessTeacherInterventionStatus/u,
        );

        assert.match(
          appSource,
          /createFailureTeacherInterventionStatus/u,
        );
      },
    );

    await t.test(
      "existing synchronous orchestrator remains intact",
      () => {
        assert.match(
          appSource,
          /onTeacherIntervention=\{handleTeacherIntervention\}/u,
        );

        assert.doesNotMatch(
          appSource,
          /handleTeacherIntervention\s*=\s*async/u,
        );
      },
    );

    await t.test(
      "status is passed to ClassroomWorld",
      () => {
        assert.match(
          appSource,
          /teacherInterventionStatus=\{teacherInterventionStatus\}/u,
        );
      },
    );

    await t.test(
      "pending phase prevents duplicate trigger",
      () => {
        assert.match(
          worldSource,
          /disabled=\{teacherInterventionStatus\?\.phase === "pending"\}/u,
        );

        assert.match(
          worldSource,
          /aria-busy=\{teacherInterventionStatus\?\.phase === "pending"\}/u,
        );

        assert.match(
          worldSource,
          /SAVING\.\.\./u,
        );
      },
    );

    await t.test(
      "feedback surface is accessible",
      () => {
        assert.match(
          worldSource,
          /role="status"/u,
        );

        assert.match(
          worldSource,
          /aria-live="polite"/u,
        );
      },
    );

    await t.test(
      "ClassroomWorld remains network free",
      () => {
        assert.doesNotMatch(
          worldSource,
          /\bfetch\s*\(/u,
        );

        assert.doesNotMatch(
          worldSource,
          /postgresql:\/\//u,
        );
      },
    );

    await t.test(
      "status model never forwards raw error message",
      () => {
        assert.match(
          statusSource,
          /INTERVENTION SAVED/u,
        );

        assert.match(
          statusSource,
          /INTERVENTION CONFLICT/u,
        );

        assert.match(
          statusSource,
          /INTERVENTION FAILED/u,
        );

        assert.doesNotMatch(
          statusSource,
          /error\?\.message/u,
        );
      },
    );

    await t.test(
      "feedback preserves pixel UI language",
      () => {
        assert.match(
          cssSource,
          /\.classroom-world__teacher-intervention-status/u,
        );

        assert.match(
          cssSource,
          /image-rendering:\s*pixelated/u,
        );
      },
    );
  },
);