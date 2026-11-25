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

const model =
  fs.readFileSync(
    new URL(
      "./classroomInteractionStateV54.js",
      import.meta.url
    ),
    "utf8"
  );


describe(
  "CW07 V54 interaction state integration",
  () => {
    it(
      "derives interaction state instead of duplicating it",
      () => {
        assert.match(
          world,
          /deriveClassroomInteractionStateV54\(\{[\s\S]*?hasEntered[\s\S]*?isLocked[\s\S]*?selectedStudent[\s\S]*?interventionFeedback/
        );

        assert.equal(
          /useState\([^)]*ENTRY_GATE/u
            .test(
              world
            ),
          false
        );

        assert.equal(
          /useReducer/u
            .test(
              model
            ),
          false
        );
      }
    );


    it(
      "uses V54 as the pointer reacquisition guard",
      () => {
        assert.match(
          world,
          /interactionStateV54[\s\S]*?canAcquirePointerLock[\s\S]*?controlsRef\.current\?\.lock\(\)/
        );

        assert.equal(
          /hasEntered\s*&&\s*!selectedStudent\s*&&\s*!isLocked/u
            .test(
              world
            ),
          false
        );
      }
    );


    it(
      "clears intervention correlation when Escape closes inspection",
      () => {
        assert.match(
          world,
          /event\.code === "Escape"[\s\S]*?setInterventionFeedbackTarget\([\s\S]*?null[\s\S]*?setSelectedStudent\([\s\S]*?null/
        );
      }
    );


    it(
      "clears stale feedback before inspecting another student",
      () => {
        assert.match(
          world,
          /setInterventionFeedbackTarget\([\s\S]*?null[\s\S]*?setSelectedStudent\([\s\S]*?store\.requireStudent\(activeStudent\.studentKey\)/
        );
      }
    );


    it(
      "normalizes presentation state on entry",
      () => {
        assert.match(
          world,
          /ENTER CLASSROOM/
        );

        assert.match(
          world,
          /setInterventionFeedbackTarget\([\s\S]*?null[\s\S]*?setSelectedStudent\([\s\S]*?null[\s\S]*?setHasEntered\([\s\S]*?true[\s\S]*?controlsRef\.current\?\.lock\(\)/
        );
      }
    );


    it(
      "exposes canonical mode for observability",
      () => {
        assert.match(
          world,
          /data-interaction-mode=\{[\s\S]*?interactionStateV54\.mode/
        );
      }
    );


    it(
      "keeps V54 pure and authority-free",
      () => {
        for (
          const forbidden
          of [
            "react",
            "three",
            "fetch(",
            "XMLHttpRequest",
            "WebSocket",
            "setTimeout(",
            "setInterval(",
            "requestAnimationFrame",
            "localStorage",
            "sessionStorage"
          ]
        ) {
          assert.equal(
            model.includes(
              forbidden
            ),
            false,
            forbidden
          );
        }
      }
    );
  }
);
