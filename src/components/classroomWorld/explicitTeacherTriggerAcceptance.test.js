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

const clientSource =
  fs.readFileSync(
    new URL(
      "./teacherInterventionClient.js",
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
  "CW06 A5.2 explicit teacher intervention trigger",
  async (t) => {
    await t.test(
      "world exposes explicit teacher action",
      () => {
        assert.match(
          worldSource,
          /APPLY INTERVENTION/u,
        );

        assert.match(
          worldSource,
          /classroom-world__teacher-intervention-trigger/u,
        );

        assert.match(
          worldSource,
          /onClick=\{\(\.\.\.eventArgs\)\s*=>\s*\{[\s\S]*?RETRO_TEACHER_INTERVENTION_UI_EVENT[\s\S]*?originalOnClick[\s\S]*?emitTeacherInterventionCommand\([\s\S]*?probe_understanding/u,
        );
      },
    );

    await t.test(
      "world emits selected student identity",
      () => {
        assert.match(
          worldSource,
          /studentKey:\s*selectedStudent(?:\?\.)?\.studentKey[\s\S]*?actionType:\s*"probe_understanding"/u,
        );
      },
    );

    await t.test(
      "world remains network free",
      () => {
        assert.doesNotMatch(
          worldSource,
          /\bfetch\s*\(/u,
        );

        assert.doesNotMatch(
          worldSource,
          /\bXMLHttpRequest\b/u,
        );

        assert.doesNotMatch(
          worldSource,
          /postgresql:\/\//u,
        );
      },
    );

    await t.test(
      "App retains existing callback seam",
      () => {
        const matches =
          appSource.match(
            /onTeacherIntervention=\{handleTeacherIntervention\}/gu,
          ) ?? [];

        assert.equal(
          matches.length,
          1,
        );
      },
    );

    await t.test(
      "App owns intervention persistence side effect",
      () => {
        assert.match(
          appSource,
          /persistTeacherInterventionCommand/u,
        );

        assert.match(
          appSource,
          /void\s+persistTeacherInterventionCommand\(/u,
        );
      },
    );

    await t.test(
      "HTTP transport owns canonical endpoint",
      () => {
        assert.match(
          clientSource,
          /\/api\/teacher-interventions/u,
        );

        assert.match(
          clientSource,
          /method:\s*"POST"/u,
        );

        assert.match(
          clientSource,
          /JSON\.stringify\(command\)/u,
        );
      },
    );

    await t.test(
      "trigger preserves pixel presentation language",
      () => {
        assert.match(
          cssSource,
          /\.classroom-world__teacher-intervention-trigger/u,
        );

        assert.match(
          cssSource,
          /image-rendering:\s*pixelated/u,
        );
      },
    );
  },
);