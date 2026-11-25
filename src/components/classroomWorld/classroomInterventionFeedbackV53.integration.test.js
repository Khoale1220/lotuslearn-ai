import assert from "node:assert/strict";

import fs from "node:fs";

import {
  describe,
  it
} from "node:test";


const world =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

const feedbackModule =
  fs.readFileSync(
    new URL(
      "./classroomInterventionFeedbackV53.js",
      import.meta.url
    ),
    "utf8"
  );

const css =
  fs.readFileSync(
    new URL(
      "../../index.css",
      import.meta.url
    ),
    "utf8"
  );


describe(
  "CW07 V53 interaction feedback integration",
  () => {
    it(
      "captures feedback at the existing intervention command boundary",
      () => {
        assert.match(
          world,
          /setInterventionFeedbackTarget\([\s\S]*?captureTeacherInterventionFeedbackTargetV53/
        );

        const capture =
          world.indexOf(
            "setInterventionFeedbackTarget("
          );

        const callback =
          world.indexOf(
            "return onTeacherIntervention(",
            capture
          );

        assert.ok(
          capture >= 0
        );

        assert.ok(
          callback >
            capture
        );
      }
    );


    it(
      "keeps App-owned intervention lifecycle status as input",
      () => {
        assert.match(
          world,
          /createClassroomInterventionFeedbackV53\(\{[\s\S]*?status:[\s\S]*?teacherInterventionStatus/
        );

        assert.match(
          world,
          /disabled=\{teacherInterventionStatus\?\.phase === "pending"\}/
        );

        assert.match(
          world,
          /aria-busy=\{teacherInterventionStatus\?\.phase === "pending"\}/
        );
      }
    );


    it(
      "renders correlated accessible feedback",
      () => {
        assert.match(
          world,
          /className="cw-world__intervention-feedback"/
        );

        assert.match(
          world,
          /role=\{interventionFeedback\.role\}/
        );

        assert.match(
          world,
          /aria-live=\{interventionFeedback\.ariaLive\}/
        );

        assert.match(
          world,
          /data-student-key=\{interventionFeedback\.studentKey\}/
        );

        assert.match(
          world,
          /interventionFeedback\.title/
        );

        assert.match(
          world,
          /interventionFeedback\.detail/
        );
      }
    );


    it(
      "preserves the established legacy A5.3 status contract",
      () => {
        assert.match(
          world,
          /classroom-world__teacher-intervention-status/
        );

        assert.match(
          world,
          /teacherInterventionStatus\.message/
        );
      }
    );


    it(
      "keeps V53 presentation-only",
      () => {
        for (
          const forbidden
          of [
            "fetch(",
            "XMLHttpRequest",
            "WebSocket",
            "persistTeacherIntervention",
            "/api/teacher-interventions",
            "new THREE.",
            "Raycaster",
            "setTimeout(",
            "setInterval("
          ]
        ) {
          assert.equal(
            feedbackModule.includes(
              forbidden
            ),
            false,
            forbidden
          );
        }
      }
    );


    it(
      "uses compact phase-aware styling without another overlay authority",
      () => {
        assert.match(
          css,
          /CW07_V53_INTERVENTION_FEEDBACK/
        );

        assert.match(
          css,
          /cw-world__intervention-feedback\[data-phase="success"\]/
        );

        assert.match(
          css,
          /cw-world__intervention-feedback\s*\+\s*\.classroom-world__teacher-intervention-status/
        );
      }
    );
  }
);
