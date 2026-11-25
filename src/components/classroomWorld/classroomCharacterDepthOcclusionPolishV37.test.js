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
  CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE,
  createClassroomCharacterDepthOcclusionPolishV37,
  discoverV9CharacterSpritesV37,
  resolveDepthBandV37
} from "./classroomCharacterDepthOcclusionPolishV37.js";

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

function createStudentSprite({
  key,
  x,
  y = 1.55,
  z
}) {
  const atlasData =
    new Uint8Array(
      512 *
      384 *
      4
    );

  const texture =
    new THREE.DataTexture(
      atlasData,
      512,
      384,
      THREE.RGBAFormat
    );

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      color:
        0xffffff,

      transparent:
        true,

      alphaTest:
        0.1,

      depthTest:
        false,

      depthWrite:
        false,

      fog:
        false,

      sizeAttenuation:
        false
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    `student-character-${key}`;

  sprite.userData = {
    studentKey:
      key
  };

  sprite.position.set(
    x,
    y,
    z
  );

  sprite.scale.set(
    1.12,
    1.68,
    1
  );

  sprite.layers.set(
    30
  );

  return {
    sprite,
    material,
    texture
  };
}

function createFixture() {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  camera.position.set(
    0,
    1.6,
    0
  );

  const near =
    createStudentSprite({
      key:
        "near",
      x:
        0,
      z:
        -2
    });

  const mid =
    createStudentSprite({
      key:
        "mid",
      x:
        0.5,
      z:
        -7
    });

  const far =
    createStudentSprite({
      key:
        "far",
      x:
        -0.4,
      z:
        -12
    });

  scene.add(
    camera
  );

  scene.add(
    near.sprite
  );

  scene.add(
    mid.sprite
  );

  scene.add(
    far.sprite
  );

  scene.updateMatrixWorld(
    true
  );

  camera.updateMatrixWorld(
    true
  );

  return {
    scene,
    camera,
    students:
      [
        near,
        mid,
        far
      ]
  };
}

function disposeFixture(
  fixture
) {
  for (
    const student
    of fixture.students
  ) {
    student.material.dispose();
    student.texture.dispose();
  }
}

test(
  "V37 adds zero rendering resources",
  () => {
    const profile =
      CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE;

    assert.equal(
      profile.addedMeshes,
      0
    );

    assert.equal(
      profile.addedGeometries,
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
      profile.addedLights,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.addedShadowMaps,
      0
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeAllocationsPerFrame,
      0
    );

    assert.equal(
      profile.atlasRedrawPerFrame,
      0
    );
  }
);

test(
  "V37 depth-band selection includes hysteresis",
  () => {
    assert.equal(
      resolveDepthBandV37(
        2,
        null
      ),
      "near"
    );

    assert.equal(
      resolveDepthBandV37(
        7,
        null
      ),
      "mid"
    );

    assert.equal(
      resolveDepthBandV37(
        12,
        null
      ),
      "far"
    );

    assert.equal(
      resolveDepthBandV37(
        5.3,
        "near"
      ),
      "near"
    );

    assert.equal(
      resolveDepthBandV37(
        9.3,
        "mid"
      ),
      "mid"
    );
  }
);

test(
  "V37 discovers only V9-compatible student sprites",
  () => {
    const fixture =
      createFixture();

    const sprites =
      discoverV9CharacterSpritesV37(
        fixture.scene
      );

    assert.equal(
      sprites.length,
      3
    );

    for (
      const student
      of fixture.students
    ) {
      assert.ok(
        sprites.includes(
          student.sprite
        )
      );
    }

    disposeFixture(
      fixture
    );
  }
);

test(
  "V37 upgrades V9 materials to strict cutout depth-buffer participation",
  () => {
    const fixture =
      createFixture();

    const runtime =
      createClassroomCharacterDepthOcclusionPolishV37({
        scene:
          fixture.scene,

        camera:
          fixture.camera
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.studentSpriteCount,
      3
    );

    assert.equal(
      snapshot.strictCutoutAlpha,
      true
    );

    assert.equal(
      snapshot.depthTestEnabled,
      true
    );

    assert.equal(
      snapshot.depthWriteEnabled,
      true
    );

    assert.equal(
      snapshot.blendedTransparencyDisabled,
      true
    );

    assert.equal(
      snapshot.fogParticipation,
      true
    );

    assert.equal(
      snapshot.perspectiveSizeAttenuation,
      true
    );

    for (
      const student
      of fixture.students
    ) {
      assert.ok(
        student.material.alphaTest >=
          0.5
      );

      assert.equal(
        student.material.depthTest,
        true
      );

      assert.equal(
        student.material.depthWrite,
        true
      );

      assert.equal(
        student.material.transparent,
        false
      );

      assert.equal(
        student.material.fog,
        true
      );

      assert.equal(
        student.material.sizeAttenuation,
        true
      );
    }

    runtime.dispose();

    disposeFixture(
      fixture
    );
  }
);

test(
  "V37 produces near mid far character separation without scale mutation",
  () => {
    const fixture =
      createFixture();

    const originalScale =
      fixture.students.map(
        (student) =>
          student.sprite.scale.clone()
      );

    const originalPosition =
      fixture.students.map(
        (student) =>
          student.sprite.position.clone()
      );

    const originalRenderOrder =
      fixture.students.map(
        (student) =>
          student.sprite.renderOrder
      );

    const originalLayers =
      fixture.students.map(
        (student) =>
          student.sprite.layers.mask
      );

    const originalRaycast =
      fixture.students.map(
        (student) =>
          student.sprite.raycast
      );

    const runtime =
      createClassroomCharacterDepthOcclusionPolishV37({
        scene:
          fixture.scene,

        camera:
          fixture.camera
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.nearCount,
      1
    );

    assert.equal(
      snapshot.midCount,
      1
    );

    assert.equal(
      snapshot.farCount,
      1
    );

    const nearColor =
      fixture.students[
        0
      ].material.color;

    const midColor =
      fixture.students[
        1
      ].material.color;

    const farColor =
      fixture.students[
        2
      ].material.color;

    assert.ok(
      nearColor.r >
        midColor.r
    );

    assert.ok(
      midColor.r >
        farColor.r
    );

    assert.ok(
      farColor.b >
        farColor.r
    );

    fixture.students.forEach(
      (
        student,
        index
      ) => {
        assert.equal(
          student.sprite.scale.equals(
            originalScale[
              index
            ]
          ),
          true
        );

        assert.equal(
          student.sprite.position.equals(
            originalPosition[
              index
            ]
          ),
          true
        );

        assert.equal(
          student.sprite.renderOrder,
          originalRenderOrder[
            index
          ]
        );

        assert.equal(
          student.sprite.layers.mask,
          originalLayers[
            index
          ]
        );

        assert.equal(
          student.sprite.raycast,
          originalRaycast[
            index
          ]
        );
      }
    );

    assert.equal(
      snapshot.positionScaleLayerRaycastAuthorityPreserved,
      true
    );

    runtime.dispose();

    disposeFixture(
      fixture
    );
  }
);

test(
  "V37 updates only when a sprite changes depth band",
  () => {
    const fixture =
      createFixture();

    const runtime =
      createClassroomCharacterDepthOcclusionPolishV37({
        scene:
          fixture.scene,

        camera:
          fixture.camera
      });

    const initial =
      runtime.getSnapshot();

    runtime.tick();

    const stable =
      runtime.getSnapshot();

    assert.equal(
      stable.lastBandMutationCount,
      0
    );

    fixture.camera.position.set(
      0,
      1.6,
      -10.8
    );

    fixture.camera.updateMatrixWorld(
      true
    );

    runtime.tick();

    const moved =
      runtime.getSnapshot();

    assert.ok(
      moved.totalBandMutations >
        initial.totalBandMutations
    );

    assert.ok(
      moved.lastBandMutationCount >
        0
    );

    runtime.dispose();

    disposeFixture(
      fixture
    );
  }
);

test(
  "V37 dispose restores original material contract",
  () => {
    const fixture =
      createFixture();

    const originals =
      fixture.students.map(
        (student) => ({
          color:
            student.material.color.clone(),

          alphaTest:
            student.material.alphaTest,

          depthTest:
            student.material.depthTest,

          depthWrite:
            student.material.depthWrite,

          transparent:
            student.material.transparent,

          fog:
            student.material.fog,

          sizeAttenuation:
            student.material.sizeAttenuation
        })
      );

    const runtime =
      createClassroomCharacterDepthOcclusionPolishV37({
        scene:
          fixture.scene,

        camera:
          fixture.camera
      });

    runtime.dispose();

    fixture.students.forEach(
      (
        student,
        index
      ) => {
        const original =
          originals[
            index
          ];

        assert.equal(
          student.material.color.equals(
            original.color
          ),
          true
        );

        assert.equal(
          student.material.alphaTest,
          original.alphaTest
        );

        assert.equal(
          student.material.depthTest,
          original.depthTest
        );

        assert.equal(
          student.material.depthWrite,
          original.depthWrite
        );

        assert.equal(
          student.material.transparent,
          original.transparent
        );

        assert.equal(
          student.material.fog,
          original.fog
        );

        assert.equal(
          student.material.sizeAttenuation,
          original.sizeAttenuation
        );
      }
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V37 runtime performs no scene traversal or rendering-resource creation",
  () => {
    const source =
      readSource(
        "classroomCharacterDepthOcclusionPolishV37.js"
      );

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/gu
        ) ??
        []
      ).length,
      1
    );

    const forbidden = [
      /new THREE\.Mesh\s*\(/gu,
      /new THREE\.Sprite\s*\(/gu,
      /new THREE\.InstancedMesh\s*\(/gu,
      /new THREE\..*Geometry\s*\(/gu,
      /new THREE\..*Material\s*\(/gu,
      /new THREE\..*Texture\s*\(/gu,
      /new THREE\..*Light\s*\(/gu,
      /new THREE\.Raycaster\s*\(/gu,
      /requestAnimationFrame/gu,
      /setInterval/gu,
      /setTimeout/gu,
      /Math\.random/gu,
      /emitTeacherInterventionCommand/gu,
      /stepPlayerLocomotion/gu,
      /resolvePlayerCollision/gu
    ];

    for (
      const expression
      of forbidden
    ) {
      assert.equal(
        expression.test(
          source
        ),
        false
      );
    }
  }
);

test(
  "V37 leaves atlas and texture authorities untouched",
  () => {
    const source =
      readSource(
        "classroomCharacterDepthOcclusionPolishV37.js"
      );

    const forbidden = [
      /drawImage\s*\(/gu,
      /fillRect\s*\(/gu,
      /getContext\s*\(/gu,
      /material\.map\s*=/gu,
      /texture\.needsUpdate\s*=/gu,
      /texture\.magFilter\s*=/gu,
      /texture\.minFilter\s*=/gu,
      /texture\.generateMipmaps\s*=/gu
    ];

    for (
      const expression
      of forbidden
    ) {
      assert.equal(
        expression.test(
          source
        ),
        false
      );
    }
  }
);

test(
  "V37 world tick runs after canonical V10 character tick",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomCharacterDepthOcclusionPolishV37({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomCharacterDepthOcclusionPolishV37.tick();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomCharacterDepthOcclusionPolishV37.dispose();"
        )
        .length - 1,
      1
    );

    const animate =
      world.indexOf(
        "const animate = (timestamp) => {"
      );

    const v10Tick =
      animate >= 0
        ? world.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            animate
          )
        : -1;

    const v37Tick =
      v10Tick >= 0
        ? world.indexOf(
            "classroomCharacterDepthOcclusionPolishV37.tick();",
            v10Tick
          )
        : -1;

    assert.ok(
      animate >=
        0
    );

    assert.ok(
      v10Tick >
        animate
    );

    assert.ok(
      v37Tick >
        v10Tick
    );

    const v37Dispose =
      world.indexOf(
        "classroomCharacterDepthOcclusionPolishV37.dispose();"
      );

    const v36Dispose =
      world.indexOf(
        "classroomPixelContactGroundingV36.dispose();"
      );

    assert.ok(
      v37Dispose >=
        0
    );

    assert.ok(
      v36Dispose >=
        0
    );

    assert.ok(
      v37Dispose <
        v36Dispose
    );

    assert.equal(
      world
        .split(
          ".intersectObjects(interactiveMeshes, false)"
        )
        .length - 1,
      1
    );
  }
);
