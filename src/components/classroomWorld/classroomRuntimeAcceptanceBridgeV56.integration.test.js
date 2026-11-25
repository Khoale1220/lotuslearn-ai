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


const bridge =
  fs.readFileSync(
    new URL(
      "./classroomRuntimeAcceptanceBridgeV56.js",
      import.meta.url
    ),
    "utf8"
  );


describe(
  "CW07 V56 runtime acceptance integration",
  () => {
    it(
      "reuses the existing V7 runtime snapshot",
      () => {
        assert.match(
          world,
          /createClassroomRuntimeAcceptanceBridgeV56\([\s\S]*?classroomRuntimeObservabilityV7[\s\S]*?\.getSnapshot\(\)/
        );
      }
    );


    it(
      "reads V54 V55 state at request time",
      () => {
        assert.match(
          world,
          /dataset[\s\S]*?interactionMode/
        );

        assert.match(
          world,
          /dataset[\s\S]*?gameplayActive/
        );

        assert.match(
          world,
          /controls\.isLocked/
        );
      }
    );


    it(
      "uses CustomEvent detail for response payload",
      () => {
        assert.match(
          world,
          /new CustomEvent\([\s\S]*?detail/
        );
      }
    );


    it(
      "disposes V56 before V7",
      () => {
        const v56Dispose =
          world.indexOf(
            "classroomRuntimeAcceptanceBridgeV56.dispose();"
          );

        const v7Dispose =
          world.indexOf(
            "classroomRuntimeObservabilityV7.dispose();"
          );

        assert.ok(
          v56Dispose >= 0
        );

        assert.ok(
          v7Dispose >
            v56Dispose
        );
      }
    );


    it(
      "does not create a second renderer or animation loop",
      () => {
        for (
          const forbidden
          of [
            "WebGLRenderer",
            "requestAnimationFrame",
            "setAnimationLoop",
            "setInterval(",
            "setTimeout(",
            "renderer.info",
            "new THREE."
          ]
        ) {
          assert.equal(
            bridge.includes(
              forbidden
            ),
            false,
            forbidden
          );
        }
      }
    );


    it(
      "remains network and persistence authority free",
      () => {
        for (
          const forbidden
          of [
            "fetch(",
            "XMLHttpRequest",
            "WebSocket",
            "localStorage",
            "sessionStorage"
          ]
        ) {
          assert.equal(
            bridge.includes(
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
