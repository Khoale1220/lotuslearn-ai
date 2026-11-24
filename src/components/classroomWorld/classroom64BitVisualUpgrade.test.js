import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  get64BitVisualProfile
} from "./classroom64BitVisualUpgrade.js";

describe(
  "CW06 64-bit-era visual profile",
  () => {
    it(
      "raises texture resolution above the 32-bit foundation",
      () => {
        const profile =
          get64BitVisualProfile();

        assert.equal(
          profile.name,
          "64-bit-era-high-fidelity"
        );

        assert.equal(
          profile.literalFramebufferMode,
          false
        );

        assert.ok(
          profile.surfaceTextureResolution >=
          256
        );

        assert.ok(
          profile.floorTextureResolution >=
          512
        );

        assert.ok(
          profile.exteriorTextureWidth >=
          512
        );

        assert.ok(
          profile.exteriorTextureHeight >=
          256
        );
      }
    );

    it(
      "uses a bounded texture and shadow quality profile",
      () => {
        const profile =
          get64BitVisualProfile();

        assert.ok(
          profile.maximumAnisotropy >=
          2
        );

        assert.ok(
          profile.maximumAnisotropy <=
          8
        );

        assert.equal(
          profile.shadowMapSize,
          2048
        );
      }
    );
  }
);