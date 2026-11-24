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
  CLASSROOM_REFERENCE_CHARACTER_DESK_V32_PROFILE,
  buildCharacterClothingCommandsV32,
  createClassroomReferenceCharacterDeskMicrodetailV32,
  deriveCharacterClothingProfileV32,
  deriveDeskMicrodetailBlueprintsV32
} from "./classroomReferenceCharacterDeskMicrodetailV32.js";

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
  "V32 preserves V9 atlas architecture and adds one static desk draw call",
  () => {
    const profile =
      CLASSROOM_REFERENCE_CHARACTER_DESK_V32_PROFILE;

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
      profile.addedStaticDrawCalls,
      1
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedSpriteSystems,
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

    assert.equal(
      profile.v27BooksAndPapers,
      "untouched"
    );
  }
);

test(
  "V32 clothing profiles are deterministic",
  () => {
    const first =
      deriveCharacterClothingProfileV32(
        "student-01"
      );

    const second =
      deriveCharacterClothingProfileV32(
        "student-01"
      );

    const other =
      deriveCharacterClothingProfileV32(
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
      first.clothingStyle >= 0 &&
      first.clothingStyle < 6
    );

    assert.ok(
      first.foldVariant >= 0 &&
      first.foldVariant < 4
    );
  }
);

test(
  "V32 clothing commands cover all 32 canonical atlas frames",
  () => {
    const commands =
      buildCharacterClothingCommandsV32(
        "student-01"
      );

    const frames =
      new Set(
        commands.map(
          (command) =>
            command.frameIndex
        )
      );

    assert.equal(
      frames.size,
      32
    );

    assert.ok(
      commands.length >
        100
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
  "V32 desk blueprint contains pencil case pencil ruler and eraser",
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
      deriveDeskMicrodetailBlueprintsV32({
        sprite,
        studentKey:
          "student-01",
        studentIndex:
          0
      });

    assert.equal(
      blueprint.length,
      4
    );

    assert.deepEqual(
      blueprint.map(
        (item) =>
          item.type
      ),
      [
        "pencil-case",
        "pencil",
        "ruler",
        "eraser"
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
  "V32 decorates existing atlas and creates one instanced stationery draw layer",
  () => {
    const fillRects =
      [];

    const restored =
      [];

    const backup =
      {
        original:
          true
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
      "student-character-test";

    sprite.userData = {
      studentKey:
        "student-test"
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
      createClassroomReferenceCharacterDeskMicrodetailV32({
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
      snapshot.deskMicrodetailInstanceCount,
      4
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
        100
    );

    const mesh =
      runtime.root.getObjectByName(
        "cw06-v32-student-desk-stationery"
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
      4
    );

    assert.equal(
      mesh.layers.test(
        (() => {
          const layers =
            new THREE.Layers();

          layers.set(
            30
          );

          return layers;
        })()
      ),
      true
    );

    assert.ok(
      mesh.boundingBox
    );

    assert.ok(
      mesh.boundingSphere
    );

    assert.equal(
      mesh.castShadow,
      false
    );

    assert.equal(
      mesh.receiveShadow,
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
        "classroom-reference-character-desk-microdetail-v32"
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
  "V32 does not create competing character or gameplay authority",
  () => {
    const source =
      readSource(
        "classroomReferenceCharacterDeskMicrodetailV32.js"
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
  "V32 world integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomReferenceCharacterDeskMicrodetailV32({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomReferenceCharacterDeskMicrodetailV32.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomReferenceCharacterDeskMicrodetailV32.tick("
      ),
      false
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
