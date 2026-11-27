import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

import {
  createClassroomFurnitureV2
} from "./classroomFurnitureV2.js";

import {
  createClassroomMaterialLibrary
} from "./classroomVisualSystem.js";

test("C3 preserves meshes and instancing while applying HD finishes", () => {
  const materials = createClassroomMaterialLibrary();

  const texture = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
    THREE.RGBAFormat
  );

  const retroScene = new THREE.Scene();
  const hdScene = new THREE.Scene();

  const retro = createClassroomFurnitureV2({
    scene: retroScene,
    materials
  });

  const hd = createClassroomFurnitureV2({
    scene: hdScene,
    materials,
    presentationMode: "hd"
  });

  const specs = [
    ["wood", "teacher-desk-top", 0xb89470, 0.86, 0.01],
    ["woodDark", "teacher-desk-drawers", 0x87674f, 0.90, 0.01],
    ["metal", "teacher-chair-leg", 0x829091, 0.72, 0.18]
  ];

  const disposed = new Set();

  try {
    const retroChildren = retro.group.children.slice();
    const hdChildren = hd.group.children.slice();

    assert.equal(retroChildren.length, hdChildren.length);
    assert.equal(retro.storageInstanceCount, 9);
    assert.equal(hd.storageInstanceCount, 9);

    for (let i = 0; i < retroChildren.length; i++) {
      assert.equal(retroChildren[i].name, hdChildren[i].name);
      assert.deepEqual(
        retroChildren[i].position.toArray(),
        hdChildren[i].position.toArray()
      );
      assert.equal(retroChildren[i].castShadow, hdChildren[i].castShadow);
      assert.equal(retroChildren[i].receiveShadow, hdChildren[i].receiveShadow);
    }

    const cubbies = hd.group.getObjectByName(
      "storage-cubbies-instanced"
    );

    assert.equal(cubbies?.isInstancedMesh, true);
    assert.equal(cubbies.count, 9);

    // Simulate V64 installing shared textures before the HD finish.
    for (const [key] of specs) {
      materials[key].map = texture;
      materials[key].flatShading = false;
    }

    assert.equal(retro.applyHdMaterialFinish(), false);
    assert.equal(hd.applyHdMaterialFinish(), true);
    assert.equal(hd.applyHdMaterialFinish(), false);

    for (const [key, name, color, roughness, metalness] of specs) {
      const mesh = hd.group.getObjectByName(name);
      const finish = mesh.material;

      assert.notEqual(finish, materials[key]);
      assert.equal(finish.map, texture);
      assert.equal(finish.color.getHex(), color);
      assert.equal(finish.roughness, roughness);
      assert.equal(finish.metalness, metalness);
      assert.equal(finish.flatShading, false);

      finish.addEventListener("dispose", () => {
        disposed.add(finish);
      });
    }

    assert.equal(
      hd.group.getObjectByName("storage-cubbies-instanced").material,
      hd.group.getObjectByName("teacher-desk-drawers").material
    );

    assert.equal(
      retro.group.getObjectByName("teacher-desk-top").material,
      materials.wood
    );

    assert.equal(hd.group.children.length, retroChildren.length);
    assert.equal(hdScene.children.length, 1);
  } finally {
    retro.dispose();
    hd.dispose();
    hd.dispose();

    assert.equal(disposed.size, 3);
    assert.equal(retroScene.children.length, 0);
    assert.equal(hdScene.children.length, 0);

    for (const material of Object.values(materials)) {
      material.dispose();
    }

    texture.dispose();
  }
});

test("C3 rejects invalid mode without creating scene objects", () => {
  const scene = new THREE.Scene();
  const materials = createClassroomMaterialLibrary();

  try {
    assert.throws(
      () => createClassroomFurnitureV2({
        scene,
        materials,
        presentationMode: "unknown"
      }),
      RangeError
    );

    assert.equal(scene.children.length, 0);
  } finally {
    for (const material of Object.values(materials)) {
      material.dispose();
    }
  }
});

test("C3 production applies furniture finish after V64", () => {
  const world = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  const upgrade = world.indexOf(
    "const classroom64BitVisualUpgrade ="
  );

  const finish = world.indexOf(
    "classroomFurnitureV2.applyHdMaterialFinish();"
  );

  const room = world.indexOf(
    "const classroomRoomGeometryV3 ="
  );

  assert.ok(upgrade >= 0 && upgrade < finish && finish < room);

  assert.match(world, /yaw:\s*movementYaw/u);
  assert.match(world, /CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56/u);
});
