import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import {
  fileURLToPath
} from "node:url";

import {
  CHARACTER_ATLAS_HEIGHT_V31,
  CHARACTER_ATLAS_WIDTH_V31,
  CHARACTER_DIRECTION_COUNT_V31,
  CHARACTER_FRAME_HEIGHT_V31,
  CHARACTER_FRAME_WIDTH_V31,
  CHARACTER_IDLE_FRAME_COUNT_V31,
  CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE,
  buildCharacterAtlasDecorationCommandsV31,
  createClassroomCharacterSilhouettePolishV31,
  deriveStudentSilhouetteProfileV31,
  isV9StudentSpriteV31
} from "./classroomCharacterSilhouettePolishV31.js";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

test(
  "V31 preserves canonical V9 atlas architecture",
  () => {
    assert.equal(
      CHARACTER_FRAME_WIDTH_V31,
      64
    );

    assert.equal(
      CHARACTER_FRAME_HEIGHT_V31,
      96
    );

    assert.equal(
      CHARACTER_DIRECTION_COUNT_V31,
      8
    );

    assert.equal(
      CHARACTER_IDLE_FRAME_COUNT_V31,
      4
    );

    assert.equal(
      CHARACTER_ATLAS_WIDTH_V31,
      512
    );

    assert.equal(
      CHARACTER_ATLAS_HEIGHT_V31,
      384
    );

    assert.equal(
      CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE
        .atlasFrameCount,
      32
    );
  }
);

test(
  "V31 profile adds zero rendering systems and zero runtime redraws",
  () => {
    const profile =
      CLASSROOM_CHARACTER_SILHOUETTE_V31_PROFILE;

    assert.equal(
      profile.addedSprites,
      0
    );

    assert.equal(
      profile.addedMeshes,
      0
    );

    assert.equal(
      profile.addedMaterials,
      0
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.atlasRedrawPerRuntimeFrame,
      0
    );

    assert.equal(
      profile.constructionSceneTraversalCount,
      1
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeAnimation,
      false
    );
  }
);

test(
  "V31 silhouette profiles are deterministic and bounded",
  () => {
    const first =
      deriveStudentSilhouetteProfileV31(
        "student-01"
      );

    const second =
      deriveStudentSilhouetteProfileV31(
        "student-01"
      );

    const other =
      deriveStudentSilhouetteProfileV31(
        "student-02"
      );

    assert.deepEqual(
      first,
      second
    );

    assert.notEqual(
      first.hash,
      other.hash
    );

    assert.ok(
      first.hairStyle >= 0 &&
      first.hairStyle < 6
    );

    assert.ok(
      first.shoulderScale >=
        0.955 &&
      first.shoulderScale <=
        1.045
    );

    assert.ok(
      first.statureScale >=
        0.970 &&
      first.statureScale <=
        1.040
    );

    assert.ok(
      first.anchorY >=
        0.475 &&
      first.anchorY <=
        0.525
    );

    assert.ok(
      Math.abs(
        first.verticalOffset
      ) <=
        0.026
    );
  }
);

test(
  "V31 creates decoration commands for all 32 atlas frames without escaping bounds",
  () => {
    const commands =
      buildCharacterAtlasDecorationCommandsV31(
        "student-01"
      );

    assert.ok(
      commands.length >
        32
    );

    const frameIndices =
      new Set(
        commands.map(
          (command) =>
            command.frameIndex
        )
      );

    assert.equal(
      frameIndices.size,
      32
    );

    for (
      const command
      of commands
    ) {
      assert.ok(
        command.x >= 0
      );

      assert.ok(
        command.y >= 0
      );

      assert.ok(
        command.width > 0
      );

      assert.ok(
        command.height > 0
      );

      assert.ok(
        command.x +
          command.width <=
          512
      );

      assert.ok(
        command.y +
          command.height <=
          384
      );
    }
  }
);

test(
  "V31 positively identifies only canonical 512x384 student sprite atlases",
  () => {
    const student =
      {
        isSprite:
          true,

        name:
          "student-character-test",

        userData:
          {
            studentKey:
              "student-test"
          },

        material:
          {
            map:
              {
                image:
                  {
                    width:
                      512,

                    height:
                      384
                  }
              }
          }
      };

    const wrongAtlas =
      {
        ...student,

        material:
          {
            map:
              {
                image:
                  {
                    width:
                      64,

                    height:
                      64
                  }
              }
          }
      };

    const environmentalSprite =
      {
        isSprite:
          true,

        name:
          "cw06-v18-seagull-0",

        userData:
          {
            visualOnly:
              true
          },

        material:
          {
            map:
              {
                image:
                  {
                    width:
                      512,

                    height:
                      384
                  }
              }
          }
      };

    assert.equal(
      isV9StudentSpriteV31(
        student
      ),
      true
    );

    assert.equal(
      isV9StudentSpriteV31(
        wrongAtlas
      ),
      false
    );

    assert.equal(
      isV9StudentSpriteV31(
        environmentalSprite
      ),
      false
    );
  }
);

test(
  "V31 decorates existing atlas once and restores transform lifecycle state",
  () => {
    const fillRects =
      [];

    const restoredPixels =
      [];

    const fakeBackup =
      {
        tag:
          "original-atlas"
      };

    const context =
      {
        fillStyle:
          "",

        fillRect(
          x,
          y,
          width,
          height
        ) {
          fillRects.push({
            x,
            y,
            width,
            height,
            color:
              this.fillStyle
          });
        },

        getImageData() {
          return fakeBackup;
        },

        putImageData(
          imageData,
          x,
          y
        ) {
          restoredPixels.push({
            imageData,
            x,
            y
          });
        }
      };

    const texture =
      {
        image:
          {
            width:
              512,

            height:
              384,

            getContext() {
              return context;
            }
          },

        needsUpdate:
          false
      };

    const center =
      {
        x:
          0.5,

        y:
          0.5,

        set(
          x,
          y
        ) {
          this.x =
            x;

          this.y =
            y;
        }
      };

    const sprite =
      {
        isSprite:
          true,

        name:
          "student-character-test",

        userData:
          {
            studentKey:
              "student-test"
          },

        material:
          {
            map:
              texture
          },

        scale:
          {
            x:
              1,

            y:
              2,

            z:
              1
          },

        center,

        position:
          {
            y:
              1
          }
      };

    const scene =
      {
        traverse(callback) {
          callback(
            sprite
          );
        }
      };

    const original =
      {
        scaleX:
          sprite.scale.x,

        scaleY:
          sprite.scale.y,

        centerY:
          sprite.center.y,

        positionY:
          sprite.position.y
      };

    const runtime =
      createClassroomCharacterSilhouettePolishV31({
        scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.studentSpriteCount,
      1
    );

    assert.equal(
      snapshot.decoratedAtlasCount,
      1
    );

    assert.equal(
      snapshot.addedDrawCalls,
      0
    );

    assert.ok(
      snapshot.atlasDecorationCommandCount >
        32
    );

    assert.ok(
      fillRects.length >
        32
    );

    assert.equal(
      texture.needsUpdate,
      true
    );

    assert.notEqual(
      sprite.scale.x,
      original.scaleX
    );

    runtime.dispose();

    assert.equal(
      sprite.scale.x,
      original.scaleX
    );

    assert.equal(
      sprite.scale.y,
      original.scaleY
    );

    assert.equal(
      sprite.center.y,
      original.centerY
    );

    assert.equal(
      sprite.position.y,
      original.positionY
    );

    assert.equal(
      restoredPixels.length,
      1
    );

    assert.equal(
      restoredPixels[0]
        .imageData,
      fakeBackup
    );
  }
);

test(
  "V31 does not create competing character gameplay or rendering authority",
  () => {
    const source =
      readSource(
        "classroomCharacterSilhouettePolishV31.js"
      );

    for (
      const forbidden
      of [
        /new THREE\.Sprite/gu,
        /new THREE\.Mesh/gu,
        /new THREE\.SpriteMaterial/gu,
        /new THREE\.Texture/gu,
        /new THREE\.CanvasTexture/gu,
        /new THREE\.Raycaster/gu,
        /PointerLockControls/gu,
        /requestAnimationFrame/gu,
        /setInterval/gu,
        /setTimeout/gu,
        /emitTeacherInterventionCommand/gu,
        /resolvePlayerCollision/gu,
        /stepPlayerLocomotion/gu,
        /collisionObstacles/gu,
        /Math\.random/gu
      ]
    ) {
      assert.equal(
        forbidden.test(
          source
        ),
        false
      );
    }
  }
);

test(
  "V31 world integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomCharacterSilhouettePolishV31({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomCharacterSilhouettePolishV31.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomCharacterSilhouettePolishV31.tick("
      ),
      false
    );

    const cw06V10TickCount =
      world
        .split(
          "classroomCharacterVisualIntegrationV10.tick({"
        )
        .length - 1;

    assert.equal(
      cw06V10TickCount,
      2
    );

    const cw06InitialRosterSync =
      world.indexOf(
        "sceneRoster.sync(\n      initialRoster"
      );

    const cw06Animate =
      world.indexOf(
        "const animate = (timestamp) => {"
      );

    const cw06InitialV10Tick =
      cw06InitialRosterSync >= 0
        ? world.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            cw06InitialRosterSync
          )
        : -1;

    const cw06RuntimeV10Tick =
      cw06Animate >= 0
        ? world.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            cw06Animate
          )
        : -1;

    assert.ok(
      cw06InitialRosterSync >=
        0
    );

    assert.ok(
      cw06InitialV10Tick >
        cw06InitialRosterSync
    );

    assert.ok(
      cw06Animate >=
        0
    );

    assert.ok(
      cw06RuntimeV10Tick >
        cw06Animate
    );

    assert.notEqual(
      cw06InitialV10Tick,
      cw06RuntimeV10Tick
    );
  }
);
