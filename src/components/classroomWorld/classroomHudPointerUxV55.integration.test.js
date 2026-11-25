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


const css =
  fs.readFileSync(
    new URL(
      "../../index.css",
      import.meta.url
    ),
    "utf8"
  );


describe(
  "CW07 V55 HUD pointer UX",
  () => {
    it(
      "uses V54 for entry presentation",
      () => {
        assert.match(
          world,
          /interactionStateV54\.showEntryGate/
        );

        assert.equal(
          /\{\s*!hasEntered\s*(?:\?|&&)/u
            .test(
              world
            ),
          false
        );
      }
    );


    it(
      "limits passive HUD to playing states",
      () => {
        assert.match(
          world,
          /CW07_V55_HUD_GUARD[\s\S]*?interactionStateV54\.canMove[\s\S]*?interactionStateV54\.canAcquirePointerLock[\s\S]*?cw-world__hud/
        );
      }
    );


    it(
      "renders crosshair only while gameplay is locked",
      () => {
        assert.match(
          world,
          /interactionStateV54\.canMove\s*\?[\s\S]*?cw-world__crosshair/
        );
      }
    );


    it(
      "renders one resume affordance only when relock is legal",
      () => {
        const count =
          world
            .split(
              'className="cw-world__resume-hint"'
            )
            .length -
          1;

        assert.equal(
          count,
          1
        );

        assert.match(
          world,
          /interactionStateV54\.canAcquirePointerLock\s*\?[\s\S]*?CLICK VIEW TO RESUME/
        );
      }
    );


    it(
      "exposes gameplay activity from V54",
      () => {
        assert.match(
          world,
          /data-gameplay-active=\{[\s\S]*?interactionStateV54\.canMove/
        );
      }
    );


    it(
      "does not create duplicate HUD state",
      () => {
        assert.equal(
          world.includes(
            "setHudPointer"
          ),
          false
        );

        assert.equal(
          world.includes(
            "setGameplayActive"
          ),
          false
        );
      }
    );


    it(
      "passive FPS overlays do not intercept viewport input",
      () => {
        assert.match(
          css,
          /\.cw-world__hud,[\s\S]*?\.cw-world__crosshair,[\s\S]*?\.cw-world__resume-hint\s*\{[\s\S]*?pointer-events:\s*none/
        );
      }
    );


    it(
      "student intelligence remains interactive",
      () => {
        assert.match(
          css,
          /\.cw-world__student-hud,[\s\S]*?\.classroom-world__teacher-intervention-trigger\s*\{[\s\S]*?pointer-events:\s*auto/
        );
      }
    );
  }
);
