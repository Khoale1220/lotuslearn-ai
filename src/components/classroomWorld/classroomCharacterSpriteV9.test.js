import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  CHARACTER_SPRITE_V9_DIRECTION_NAMES,
  CLASSROOM_CHARACTER_SPRITE_V9_PROFILE,
  auditStudentCharacterSpriteV9,
  computeCharacterAtlasFrameUv,
  computeCharacterViewDirectionIndex,
  computeStudentIdleFrame,
  createProceduralStudentAtlasV9,
  createStudentCharacterSpriteV9,
  deriveStudentSpriteVariant,
  getCharacterDirectionName,
  stableHashString
} from "./classroomCharacterSpriteV9.js";

function createFakeDocument() {
  return {
    createElement(
      tagName
    ) {
      assert.equal(
        tagName,
        "canvas"
      );

      const context = {
        fillStyle:
          "#000000",

        imageSmoothingEnabled:
          true,

        clearRect() {},

        fillRect() {}
      };

      return {
        width:
          0,

        height:
          0,

        getContext(
          contextType
        ) {
          assert.equal(
            contextType,
            "2d"
          );

          return context;
        }
      };
    }
  };
}

describe(
  "CW06 Character Sprite Architecture V9",
  () => {
    it(
      "locks 64x96 frames in an 8-by-4 atlas",
      () => {
        const profile =
          CLASSROOM_CHARACTER_SPRITE_V9_PROFILE;

        assert.equal(
          profile.frameWidth,
          64
        );

        assert.equal(
          profile.frameHeight,
          96
        );

        assert.equal(
          profile.directionCount,
          8
        );

        assert.equal(
          profile.idleFrameCount,
          4
        );

        assert.equal(
          profile.atlasColumns,
          8
        );

        assert.equal(
          profile.atlasRows,
          4
        );

        assert.equal(
          profile.atlasWidth,
          512
        );

        assert.equal(
          profile.atlasHeight,
          384
        );

        assert.equal(
          profile.atlasWidth,
          profile.frameWidth *
            profile.atlasColumns
        );

        assert.equal(
          profile.atlasHeight,
          profile.frameHeight *
            profile.atlasRows
        );
      }
    );

    it(
      "provides all eight directional names",
      () => {
        assert.deepEqual(
          [
            ...CHARACTER_SPRITE_V9_DIRECTION_NAMES
          ],
          [
            "front",
            "front-right",
            "right",
            "back-right",
            "back",
            "back-left",
            "left",
            "front-left"
          ]
        );

        assert.equal(
          getCharacterDirectionName(
            0
          ),
          "front"
        );

        assert.equal(
          getCharacterDirectionName(
            4
          ),
          "back"
        );

        assert.equal(
          getCharacterDirectionName(
            -1
          ),
          "front-left"
        );
      }
    );

    it(
      "resolves front right back and left deterministically",
      () => {
        const characterPosition =
          {
            x: 0,
            y: 0,
            z: 0
          };

        assert.equal(
          computeCharacterViewDirectionIndex({
            cameraPosition: {
              x: 0,
              y: 1,
              z: 10
            },
            characterPosition,
            forwardYaw: 0
          }),
          0
        );

        assert.equal(
          computeCharacterViewDirectionIndex({
            cameraPosition: {
              x: 10,
              y: 1,
              z: 0
            },
            characterPosition,
            forwardYaw: 0
          }),
          2
        );

        assert.equal(
          computeCharacterViewDirectionIndex({
            cameraPosition: {
              x: 0,
              y: 1,
              z: -10
            },
            characterPosition,
            forwardYaw: 0
          }),
          4
        );

        assert.equal(
          computeCharacterViewDirectionIndex({
            cameraPosition: {
              x: -10,
              y: 1,
              z: 0
            },
            characterPosition,
            forwardYaw: 0
          }),
          6
        );
      }
    );

    it(
      "creates deterministic appearance from studentKey",
      () => {
        const first =
          deriveStudentSpriteVariant(
            "student-001"
          );

        const second =
          deriveStudentSpriteVariant(
            "student-001"
          );

        assert.deepEqual(
          first,
          second
        );

        assert.equal(
          first.hash,
          stableHashString(
            "student-001"
          )
        );

        assert.equal(
          first.studentKey,
          "student-001"
        );
      }
    );

    it(
      "desynchronizes idle animation while remaining deterministic",
      () => {
        const key =
          "student-012";

        const first =
          computeStudentIdleFrame({
            timestamp:
              1000,

            studentKey:
              key
          });

        const second =
          computeStudentIdleFrame({
            timestamp:
              1000,

            studentKey:
              key
          });

        assert.equal(
          first,
          second
        );

        assert.ok(
          first >=
          0
        );

        assert.ok(
          first <
          CLASSROOM_CHARACTER_SPRITE_V9_PROFILE
            .idleFrameCount
        );
      }
    );

    it(
      "maps atlas coordinates without interpolation assumptions",
      () => {
        const frame =
          computeCharacterAtlasFrameUv({
            directionIndex:
              2,

            animationFrame:
              1
          });

        assert.equal(
          frame.column,
          2
        );

        assert.equal(
          frame.row,
          1
        );

        assert.equal(
          frame.repeatX,
          1 / 8
        );

        assert.equal(
          frame.repeatY,
          1 / 4
        );

        assert.equal(
          frame.offsetX,
          2 / 8
        );

        assert.equal(
          frame.offsetY,
          1 / 2
        );
      }
    );

    it(
      "builds a 512x384 procedural atlas exactly once",
      () => {
        const texture =
          createProceduralStudentAtlasV9({
            documentObject:
              createFakeDocument(),

            studentKey:
              "student-001"
          });

        assert.equal(
          texture.isTexture,
          true
        );

        assert.equal(
          texture.image.width,
          512
        );

        assert.equal(
          texture.image.height,
          384
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
          texture.colorSpace,
          THREE.SRGBColorSpace
        );

        texture.dispose();
      }
    );

    it(
      "creates a billboard student with preserved identity metadata",
      () => {
        const scene =
          new THREE.Scene();

        const controller =
          createStudentCharacterSpriteV9({
            scene,

            studentKey:
              "student-007",

            position: {
              x: 2,
              y: 0,
              z: -3
            },

            documentObject:
              createFakeDocument()
          });

        const sprite =
          controller.sprite;

        assert.equal(
          sprite.isSprite,
          true
        );

        assert.equal(
          sprite.userData.studentKey,
          "student-007"
        );

        assert.equal(
          sprite.userData.interactionType,
          "student"
        );

        assert.equal(
          sprite.userData.characterVisualAuthority,
          "CW06_CHARACTER_SPRITE_V9"
        );

        assert.equal(
          sprite.userData.raycastRole,
          "student-character"
        );

        assert.equal(
          sprite.parent,
          scene
        );

        assert.equal(
          auditStudentCharacterSpriteV9(
            sprite
          ).pass,
          true
        );

        controller.dispose();

        assert.equal(
          sprite.parent,
          null
        );
      }
    );

    it(
      "updates direction and idle frame without regenerating its atlas",
      () => {
        const controller =
          createStudentCharacterSpriteV9({
            studentKey:
              "student-003",

            position: {
              x: 0,
              y: 0,
              z: 0
            },

            documentObject:
              createFakeDocument()
          });

        const texture =
          controller.texture;

        const originalImage =
          texture.image;

        controller.tick({
          timestamp:
            1000,

          cameraPosition: {
            x: 10,
            y: 1.6,
            z: 0
          }
        });

        const snapshot =
          controller.getSnapshot();

        assert.equal(
          snapshot.directionIndex,
          2
        );

        assert.equal(
          snapshot.directionName,
          "right"
        );

        assert.equal(
          texture.image,
          originalImage
        );

        assert.equal(
          texture.repeat.x,
          1 / 8
        );

        assert.equal(
          texture.repeat.y,
          1 / 4
        );

        controller.dispose();
      }
    );

    it(
      "anchors sprite feet to world position",
      () => {
        const controller =
          createStudentCharacterSpriteV9({
            studentKey:
              "student-005",

            position: {
              x: 1,
              y: 0,
              z: 2
            },

            documentObject:
              createFakeDocument()
          });

        assert.equal(
          controller.sprite.center.x,
          0.5
        );

        assert.equal(
          controller.sprite.center.y,
          0
        );

        assert.equal(
          controller.sprite.position.y,
          0
        );

        assert.equal(
          controller.sprite.scale.x,
          0.95
        );

        assert.equal(
          controller.sprite.scale.y,
          1.86
        );

        controller.dispose();
      }
    );
  }
);