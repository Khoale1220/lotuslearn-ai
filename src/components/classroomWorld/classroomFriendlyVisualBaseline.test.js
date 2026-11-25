import assert from "node:assert/strict";

import fs from "node:fs";

import test from "node:test";

import {
  CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE
} from "./classroomDepthAtmospherePixelLightingV35.js";


test(
  "friendly classroom lighting avoids deep-plum fog",
  () => {
    const profile =
      CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE;

    assert.equal(
      profile.palette.fog,
      0xb7c4cc
    );

    assert.equal(
      profile.palette.hemisphereSky,
      0xddebf0
    );

    assert.equal(
      profile.palette.hemisphereGround,
      0x8a8177
    );

    assert.ok(
      profile.lighting
        .hemisphereIntensityMultiplier >
        1
    );
  }
);


test(
  "first-person clipboard no longer dominates the viewport",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomRetroFpsPipeline.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.equal(
      source.includes(
        '"width:176px"'
      ),
      true
    );

    assert.equal(
      source.includes(
        '"height:106px"'
      ),
      true
    );

    assert.equal(
      source.includes(
        '"width:320px"'
      ),
      false
    );
  }
);


test(
  "classroom camera uses a calmer first-person FOV",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./ClassroomWorld.jsx",
          import.meta.url
        ),
        "utf8"
      );

    assert.equal(
      source.includes(
        "new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 50)"
      ),
      true
    );
  }
);
