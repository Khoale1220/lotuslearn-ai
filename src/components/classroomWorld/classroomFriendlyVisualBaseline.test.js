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

    const toRgb =
      (hex) => ({
        red:
          (hex >> 16) & 0xff,

        green:
          (hex >> 8) & 0xff,

        blue:
          hex & 0xff
      });

    const luminance =
      (hex) => {
        const {
          red,
          green,
          blue
        } =
          toRgb(
            hex
          );

        return (
          0.2126 * red +
          0.7152 * green +
          0.0722 * blue
        ) / 255;
      };

    const fog =
      toRgb(
        profile.palette.fog
      );

    const sky =
      toRgb(
        profile.palette.hemisphereSky
      );

    const ground =
      toRgb(
        profile.palette.hemisphereGround
      );

    const key =
      toRgb(
        profile.palette.directionalKey
      );

    /*
     * Semantic friendly-daylight contract.
     *
     * Do not lock the entire visual system to one historical
     * hex code. The requirement is visual character:
     *
     * - fog is blue-gray rather than deep purple
     * - sky is brighter than atmospheric fog
     * - ground bounce stays neutral/warm
     * - directional key remains warm daylight
     * - directional modeling exceeds ambient fill
     */

    assert.notEqual(
      profile.palette.fog,
      0x252338
    );

    assert.ok(
      fog.blue >
        fog.red
    );

    assert.ok(
      fog.green >
        fog.red
    );

    assert.ok(
      luminance(
        profile.palette.fog
      ) > 0.45
    );

    assert.ok(
      luminance(
        profile.palette.hemisphereSky
      ) >
      luminance(
        profile.palette.fog
      )
    );

    assert.ok(
      sky.blue >=
        sky.green
    );

    assert.ok(
      Math.max(
        ground.red,
        ground.green,
        ground.blue
      ) -
      Math.min(
        ground.red,
        ground.green,
        ground.blue
      ) < 32
    );

    assert.ok(
      key.red >
        key.green
    );

    assert.ok(
      key.green >
        key.blue
    );

    assert.ok(
      profile.lighting
        .directionalIntensityMultiplier >
      profile.lighting
        .hemisphereIntensityMultiplier
    );

    assert.ok(
      profile.depth
        .atmosphericFar >
      profile.depth
        .foregroundClearUntil
    );

    assert.ok(
      profile.depth
        .atmosphericFar >= 30
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

    assert.match(
      source,
      /const\s+CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56\s*;/u
    );

    assert.match(
      source,
      /new\s+THREE\.PerspectiveCamera\(\s*CLASSROOM_CAMERA_VERTICAL_FOV\s*,\s*16\s*\/\s*9\s*,\s*0\.1\s*,\s*50\s*\)/u
    );
  }
);
