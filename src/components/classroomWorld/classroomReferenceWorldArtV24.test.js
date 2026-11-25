import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE,
  CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE,
  classifyReferenceWorldRoleV24,
  createClassroomReferenceWorldArtV24
} from "./classroomReferenceWorldArtV24.js";

import {
  fileURLToPath
} from "node:url";

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

function countMatches(
  source,
  pattern
) {
  return Array.from(
    source.matchAll(
      pattern
    )
  ).length;
}

test(
  "V24 locks cinematic reference palette",
  () => {
    assert.equal(
      CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE
        .artDirection,
      "bright-warm-readable-64-bit-classroom"
    );

    assert.equal(
      CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE
        .ink,
      0x30343a
    );

    assert.equal(
      CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE
        .cyan,
      0x75b7cc
    );

    assert.equal(
      CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE
        .sunOrange,
      0xe3ad69
    );

    assert.equal(
      CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE
        .cream,
      0xffefcf
    );
  }
);

test(
  "V24 semantic precedence distinguishes ocean and sky horizons",
  () => {
    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "ocean-horizon"
      }),
      "ocean"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "sea-horizon"
      }),
      "ocean"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "ocean-vista"
      }),
      "ocean"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "sky-horizon"
      }),
      "sky"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "distant-horizon"
      }),
      "sky"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "cloud-layer"
      }),
      "sky"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "student-12"
      }),
      "preserve"
    );

    assert.equal(
      classifyReferenceWorldRoleV24({
        objectName:
          "teacher-desk"
      }),
      "wood"
    );
  }
);

test(
  "V24 mutates owned styling while preserving global atmosphere",
  () => {
    const scene =
      new THREE.Scene();

    scene.background =
      new THREE.Color(
        0x222222
      );

    scene.fog =
      new THREE.Fog(
        0x333333,
        1,
        20
      );

    const light =
      new THREE.HemisphereLight(
        0xffffff,
        0x111111,
        1
      );

    scene.add(
      light
    );

    const geometry =
      new THREE.BoxGeometry(
        1,
        1,
        1
      );

    const material =
      new THREE.MeshBasicMaterial({
        color:
          0x886644
      });

    const originalColor =
      material.color.clone();

    const originalBackground =
      scene.background.clone();

    const originalFogColor =
      scene.fog.color.clone();

    const originalFogNear =
      scene.fog.near;

    const originalFogFar =
      scene.fog.far;

    const desk =
      new THREE.Mesh(
        geometry,
        material
      );

    desk.name =
      "teacher-desk";

    scene.add(
      desk
    );

    const runtime =
      createClassroomReferenceWorldArtV24({
        scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.windowCount,
      3
    );

    assert.equal(
      snapshot.verticalFrameCount,
      9
    );

    assert.equal(
      snapshot.horizontalFrameCount,
      6
    );

    assert.equal(
      material.color.equals(
        originalColor
      ),
      false
    );

    assert.equal(
      scene.background.equals(
        originalBackground
      ),
      true
    );

    assert.equal(
      scene.fog.color.equals(
        originalFogColor
      ),
      true
    );

    assert.equal(
      scene.fog.near,
      originalFogNear
    );

    assert.equal(
      scene.fog.far,
      originalFogFar
    );

    runtime.dispose();

    assert.equal(
      material.color.equals(
        originalColor
      ),
      true
    );

    assert.equal(
      scene.background.equals(
        originalBackground
      ),
      true
    );

    assert.equal(
      scene.fog.color.equals(
        originalFogColor
      ),
      true
    );

    assert.equal(
      scene.fog.near,
      originalFogNear
    );

    assert.equal(
      scene.fog.far,
      originalFogFar
    );

    geometry.dispose();
    material.dispose();
  }
);

test(
  "V24 uses instanced visual silhouettes",
  () => {
    const source =
      readSource(
        "classroomReferenceWorldArtV24.js"
      );

    assert.match(
      source,
      /new\s+THREE\.InstancedMesh\s*\(/u
    );

    assert.match(
      source,
      /computeBoundingSphere/u
    );

    assert.match(
      source,
      /window-ink-verticals/u
    );

    assert.match(
      source,
      /room-ink-plinth/u
    );
  }
);

test(
  "V24 remains visual-only",
  () => {
    const source =
      readSource(
        "classroomReferenceWorldArtV24.js"
      );

    for (
      const forbidden
      of [
        /addEventListener\s*\(/gu,
        /PointerLockControls/gu,
        /Raycaster/gu,
        /AudioListener/gu,
        /emitTeacherInterventionCommand/gu,
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
  "V24 integrates once while preserving V23 render seam",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      countMatches(
        world,
        /createClassroomReferenceWorldArtV24\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomReferenceWorldArtV24\.dispose\s*\(\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /renderer\.render\s*\(\s*scene\s*,\s*camera\s*\)/gu
      ),
      1
    );

    const begin =
      world.indexOf(
        "classroomPixelArtGradeV23.beginFrame();"
      );

    const render =
      world.indexOf(
        "renderer.render(scene, camera);"
      );

    const present =
      world.indexOf(
        "classroomPixelArtGradeV23.presentFrame();"
      );

    assert.ok(
      begin <
        render &&
      render <
        present
    );
  }
);
