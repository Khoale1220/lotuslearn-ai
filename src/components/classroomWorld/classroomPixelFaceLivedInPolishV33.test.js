import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import * as THREE from "three";

import {
  fileURLToPath
} from "node:url";

import {
  CLASSROOM_PIXEL_FACE_LIVED_IN_V33_PROFILE,
  buildPixelFaceExpressionCommandsV33,
  createClassroomPixelFaceLivedInPolishV33,
  deriveDeskLivedInBlueprintsV33,
  derivePixelExpressionProfileV33
} from "./classroomPixelFaceLivedInPolishV33.js";

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
  "V33 preserves canonical atlas and adds only one static lived-in draw layer",
  () => {
    const profile =
      CLASSROOM_PIXEL_FACE_LIVED_IN_V33_PROFILE;

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
      profile.atlasWidth,
      512
    );

    assert.equal(
      profile.atlasHeight,
      384
    );

    assert.equal(
      profile.expressionStyleCount,
      6
    );

    assert.equal(
      profile.visibleFaceDirectionCount,
      5
    );

    assert.equal(
      profile.backFaceDirectionCount,
      3
    );

    assert.equal(
      profile.addedStaticDrawCalls,
      1
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedCharacterSystems,
      0
    );

    assert.equal(
      profile.atlasRedrawPerRuntimeFrame,
      0
    );
  }
);

test(
  "V33 facial expression profile is deterministic and includes desynchronized blink frame",
  () => {
    const first =
      derivePixelExpressionProfileV33(
        "student-01"
      );

    const second =
      derivePixelExpressionProfileV33(
        "student-01"
      );

    const other =
      derivePixelExpressionProfileV33(
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
      first.expressionStyle >= 0 &&
      first.expressionStyle < 6
    );

    assert.ok(
      first.blinkFrame >= 0 &&
      first.blinkFrame < 4
    );
  }
);

test(
  "V33 facial commands decorate only visible directions and never rear-facing atlas cells",
  () => {
    const commands =
      buildPixelFaceExpressionCommandsV33(
        "student-01"
      );

    assert.ok(
      commands.length >
        80
    );

    const decoratedFrames =
      new Set(
        commands.map(
          (command) =>
            command.frameIndex
        )
      );

    /*
     * 5 visible-face directions × 4 idle frames.
     */

    assert.equal(
      decoratedFrames.size,
      20
    );

    for (
      const command
      of commands
    ) {
      assert.equal(
        [
          3,
          4,
          5
        ].includes(
          command.directionIndex
        ),
        false
      );

      assert.ok(
        command.x >= 0
      );

      assert.ok(
        command.y >= 0
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
  "V33 blink frame is authored into existing idle cells rather than runtime animation",
  () => {
    const studentKey =
      "student-blink-test";

    const profile =
      derivePixelExpressionProfileV33(
        studentKey
      );

    const commands =
      buildPixelFaceExpressionCommandsV33(
        studentKey
      );

    const blinkCommands =
      commands.filter(
        (command) =>
          command.semantic.includes(
            "blink"
          )
      );

    assert.ok(
      blinkCommands.length >
        0
    );

    for (
      const command
      of blinkCommands
    ) {
      assert.equal(
        command.idleFrame,
        profile.blinkFrame
      );
    }
  }
);

test(
  "V33 desk lived-in blueprint creates label tape and edge chip",
  () => {
    const sprite =
      new THREE.Sprite();

    sprite.position.set(
      1,
      1.5,
      2
    );

    sprite.updateMatrixWorld(
      true
    );

    const blueprint =
      deriveDeskLivedInBlueprintsV33({
        sprite,
        studentKey:
          "student-01",
        studentIndex:
          0
      });

    assert.equal(
      blueprint.length,
      3
    );

    assert.deepEqual(
      blueprint.map(
        (item) =>
          item.type
      ),
      [
        "desk-label",
        "tape-tab",
        "desk-edge-chip"
      ]
    );

    for (
      const item
      of blueprint
    ) {
      assert.ok(
        Number.isFinite(
          item.position.x
        )
      );

      assert.ok(
        Number.isFinite(
          item.position.y
        )
      );

      assert.ok(
        Number.isFinite(
          item.position.z
        )
      );
    }
  }
);

test(
  "V33 decorates existing atlas and creates one instanced lived-in mesh",
  () => {
    const fillRects =
      [];

    const restored =
      [];

    const backup =
      {
        state:
          "post-v32"
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
          return backup;
        },

        putImageData(
          value,
          x,
          y
        ) {
          restored.push({
            value,
            x,
            y
          });
        }
      };

    const fakeTexture =
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

    const sprite =
      new THREE.Sprite(
        new THREE.SpriteMaterial()
      );

    sprite.name =
      "student-character-v33-test";

    sprite.userData = {
      studentKey:
        "student-v33-test"
    };

    sprite.material.map =
      fakeTexture;

    sprite.position.set(
      0,
      1.5,
      1.5
    );

    const scene =
      new THREE.Scene();

    scene.add(
      sprite
    );

    const runtime =
      createClassroomPixelFaceLivedInPolishV33({
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
      snapshot.livedInInstanceCount,
      3
    );

    assert.equal(
      snapshot.staticDrawCalls,
      1
    );

    assert.equal(
      snapshot.addedTextures,
      0
    );

    assert.equal(
      snapshot.atlasRedrawPerRuntimeFrame,
      0
    );

    assert.ok(
      fillRects.length >
        80
    );

    const mesh =
      runtime.root.getObjectByName(
        "cw06-v33-student-desk-lived-in-marks"
      );

    assert.ok(
      mesh
    );

    assert.equal(
      mesh.isInstancedMesh,
      true
    );

    assert.equal(
      mesh.count,
      3
    );

    assert.equal(
      mesh.castShadow,
      false
    );

    assert.equal(
      mesh.receiveShadow,
      false
    );

    assert.ok(
      mesh.boundingBox
    );

    assert.ok(
      mesh.boundingSphere
    );

    assert.equal(
      mesh.matrixAutoUpdate,
      false
    );

    assert.equal(
      mesh.userData.visualOnly,
      true
    );

    assert.equal(
      mesh.userData.interactionExcluded,
      true
    );

    runtime.dispose();

    assert.equal(
      scene.getObjectByName(
        "classroom-pixel-face-lived-in-polish-v33"
      ),
      undefined
    );

    assert.equal(
      restored.length,
      1
    );

    assert.equal(
      restored[0].value,
      backup
    );

    sprite.material.dispose();
  }
);

test(
  "V33 does not acquire character gameplay rendering loop or interaction authority",
  () => {
    const source =
      readSource(
        "classroomPixelFaceLivedInPolishV33.js"
      );

    for (
      const forbidden
      of [
        /new THREE\.Sprite\s*\(/gu,
        /new THREE\.CanvasTexture/gu,
        /new THREE\.Texture\s*\(/gu,
        /new THREE\.Raycaster/gu,
        /PointerLockControls/gu,
        /requestAnimationFrame/gu,
        /setInterval/gu,
        /setTimeout/gu,
        /emitTeacherInterventionCommand/gu,
        /stepPlayerLocomotion/gu,
        /resolvePlayerCollision/gu,
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

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/gu
        ) ??
        []
      ).length,
      1
    );
  }
);

test(
  "V33 world integration remains construction-only with reverse atlas restore order",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomPixelFaceLivedInPolishV33({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomPixelFaceLivedInPolishV33.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomPixelFaceLivedInPolishV33.tick("
      ),
      false
    );

    const v33 =
      world.indexOf(
        "classroomPixelFaceLivedInPolishV33.dispose();"
      );

    const v32 =
      world.indexOf(
        "classroomReferenceCharacterDeskMicrodetailV32.dispose();"
      );

    const v31 =
      world.indexOf(
        "classroomCharacterSilhouettePolishV31.dispose();"
      );

    assert.ok(
      v33 >= 0 &&
      v32 >= 0 &&
      v31 >= 0
    );

    assert.ok(
      v33 <
        v32
    );

    assert.ok(
      v32 <
        v31
    );

    assert.equal(
      world
        .split(
          "classroomCharacterVisualIntegrationV10.tick({"
        )
        .length - 1,
      1
    );
  }
);
