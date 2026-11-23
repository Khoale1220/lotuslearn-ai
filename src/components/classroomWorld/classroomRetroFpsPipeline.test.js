import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  RETRO_FPS_PROFILE,
  applyRetroTextureSampling,
  computeRetroRenderSize,
  getRetroFpsProfile
} from "./classroomRetroFpsPipeline.js";

describe(
  "CW06 Retro FPS render pipeline",
  () => {
    it(
      "renders a widescreen classroom near 426x240 internally",
      () => {
        const result =
          computeRetroRenderSize({
            displayWidth: 1366,
            displayHeight: 768
          });

        assert.equal(
          result.height,
          240
        );

        assert.ok(
          result.width >= 424 &&
          result.width <= 428
        );

        assert.ok(
          Math.abs(
            result.aspect -
            1366 / 768
          ) < 0.001
        );
      }
    );

    it(
      "preserves aspect for a 16:9 viewport",
      () => {
        const result =
          computeRetroRenderSize({
            displayWidth: 1920,
            displayHeight: 1080
          });

        assert.equal(
          result.width,
          426
        );

        assert.equal(
          result.height,
          240
        );
      }
    );

    it(
      "uses nearest-neighbor sampling without mipmaps",
      () => {
        const texture =
          new THREE.Texture();

        applyRetroTextureSampling(
          texture
        );

        assert.equal(
          texture.magFilter,
          THREE.NearestFilter
        );

        assert.equal(
          texture.minFilter,
          THREE.NearestFilter
        );

        assert.equal(
          texture.generateMipmaps,
          false
        );

        assert.equal(
          texture.anisotropy,
          1
        );

        texture.dispose();
      }
    );

    it(
      "defines the intended DOS FPS visual profile",
      () => {
        const profile =
          getRetroFpsProfile();

        assert.equal(
          profile.name,
          "lotuslearn-retro-fps"
        );

        assert.equal(
          profile.internalHeight,
          240
        );

        assert.equal(
          profile.textureFilter,
          "nearest"
        );

        assert.equal(
          profile.shadowStyle,
          "hard"
        );

        assert.equal(
          profile.hudStyle,
          "dos-fps"
        );

        assert.equal(
          RETRO_FPS_PROFILE
            .mipmaps,
          false
        );
      }
    );
  }
);