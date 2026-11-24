import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_PIXEL_ART_V8_PROFILE,
  auditPixelSpriteMaterial,
  auditPixelTexture,
  computePixelPresentation,
  configurePixelTexture,
  createPixelArtContractSnapshot,
  createPixelCanvasTexture,
  createPixelSpriteMaterial,
  quantizeNormalizedChannel,
  quantizeRgb
} from "./classroomPixelArtDirectionV8.js";

describe(
  "CW06 Pixel Art Direction System V8",
  () => {
    it(
      "locks the final visual identity",
      () => {
        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .identity,
          "LOTUSLEARN_1990S_VGA_CLASSROOM"
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .render
            .internalWidth,
          426
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .render
            .internalHeight,
          240
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .render
            .cssImageRendering,
          "pixelated"
        );
      }
    );

    it(
      "raises gameplay student sprites to 64x96",
      () => {
        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .sprites
            .studentWidth,
          64
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .sprites
            .studentHeight,
          96
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .sprites
            .directionalViews,
          8
        );

        assert.equal(
          CLASSROOM_PIXEL_ART_V8_PROFILE
            .sprites
            .idleFrames,
          4
        );
      }
    );

    it(
      "configures color textures for hard pixel sampling",
      () => {
        const texture =
          new THREE.Texture();

        configurePixelTexture(
          texture,
          {
            colorTexture:
              true,

            name:
              "student-test"
          }
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

        assert.equal(
          texture.colorSpace,
          THREE.SRGBColorSpace
        );

        assert.equal(
          texture.name,
          "student-test"
        );

        texture.dispose();
      }
    );

    it(
      "preserves no-color-space for data textures",
      () => {
        const texture =
          new THREE.Texture();

        configurePixelTexture(
          texture,
          {
            colorTexture:
              false
          }
        );

        assert.equal(
          texture.colorSpace,
          THREE.NoColorSpace
        );

        assert.equal(
          auditPixelTexture(
            texture,
            {
              colorTexture:
                false
            }
          ).pass,
          true
        );

        texture.dispose();
      }
    );

    it(
      "detects default Three.js texture filtering as non-pixel-art",
      () => {
        const texture =
          new THREE.Texture();

        const audit =
          auditPixelTexture(
            texture
          );

        assert.equal(
          audit.pass,
          false
        );

        assert.ok(
          audit.violations.includes(
            "MAG_FILTER_NOT_NEAREST"
          )
        );

        assert.ok(
          audit.violations.includes(
            "MIN_FILTER_NOT_NEAREST"
          )
        );

        assert.ok(
          audit.violations.includes(
            "MIPMAPS_ENABLED"
          )
        );

        texture.dispose();
      }
    );

    it(
      "creates cutout sprite materials instead of smooth alpha blending",
      () => {
        const texture =
          new THREE.Texture();

        const material =
          createPixelSpriteMaterial({
            texture
          });

        assert.equal(
          material.isSpriteMaterial,
          true
        );

        assert.equal(
          material.transparent,
          false
        );

        assert.equal(
          material.alphaTest,
          0.5
        );

        assert.equal(
          material.depthWrite,
          true
        );

        assert.equal(
          material.depthTest,
          true
        );

        assert.equal(
          material.toneMapped,
          false
        );

        assert.equal(
          auditPixelSpriteMaterial(
            material
          ).pass,
          true
        );

        material.dispose();

        texture.dispose();
      }
    );

    it(
      "creates CanvasTexture assets with the same policy",
      () => {
        const canvasLike = {
          width: 16,
          height: 16
        };

        const texture =
          createPixelCanvasTexture({
            canvas:
              canvasLike,

            name:
              "runtime-pixel-art"
          });

        const audit =
          auditPixelTexture(
            texture
          );

        assert.equal(
          audit.pass,
          true
        );

        assert.equal(
          texture.name,
          "runtime-pixel-art"
        );

        texture.dispose();
      }
    );

    it(
      "quantizes channels into deterministic palette steps",
      () => {
        assert.equal(
          quantizeNormalizedChannel(
            0,
            8
          ),
          0
        );

        assert.equal(
          quantizeNormalizedChannel(
            1,
            8
          ),
          1
        );

        const color =
          quantizeRgb(
            {
              r: 0.13,
              g: 0.54,
              b: 0.91
            },
            8
          );

        for (
          const channel
          of [
            color.r,
            color.g,
            color.b
          ]
        ) {
          const stepped =
            channel *
            7;

          assert.ok(
            Math.abs(
              stepped -
              Math.round(
                stepped
              )
            ) <
            1e-10
          );
        }
      }
    );

    it(
      "uses integer presentation scaling whenever the host permits it",
      () => {
        const result =
          computePixelPresentation({
            hostWidth:
              1920,

            hostHeight:
              1080
          });

        assert.equal(
          result.internalWidth,
          426
        );

        assert.equal(
          result.internalHeight,
          240
        );

        assert.equal(
          result.integerScaleAvailable,
          true
        );

        assert.equal(
          Number.isInteger(
            result.presentationScale
          ),
          true
        );

        assert.ok(
          result.presentationScale >=
          1
        );
      }
    );

    it(
      "degrades predictably when viewport is smaller than the internal buffer",
      () => {
        const result =
          computePixelPresentation({
            hostWidth:
              320,

            hostHeight:
              180
          });

        assert.equal(
          result.integerScaleAvailable,
          false
        );

        assert.ok(
          result.presentationScale <
          1
        );

        assert.ok(
          result.presentationWidth <=
          320
        );

        assert.ok(
          result.presentationHeight <=
          180
        );
      }
    );

    it(
      "exports a stable visual contract snapshot",
      () => {
        const snapshot =
          createPixelArtContractSnapshot();

        assert.equal(
          snapshot.identity,
          "LOTUSLEARN_1990S_VGA_CLASSROOM"
        );

        assert.deepEqual(
          snapshot.sprites,
          {
            studentWidth: 64,
            studentHeight: 96,
            portraitWidth: 128,
            portraitHeight: 160,
            directionalViews: 8,
            idleFrames: 4
          }
        );

        assert.equal(
          snapshot.filtering.mipmaps,
          false
        );

        assert.equal(
          snapshot.filtering.anisotropy,
          1
        );
      }
    );
  }
);