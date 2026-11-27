import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

import {
  createClassroomRoomGeometryV3
} from "./classroomRoomGeometryV3.js";

function makeMaterials() {
  return Object.fromEntries(
    ["wall", "wallShadow", "wood", "woodDark", "metal", "trim"]
      .map(name => [name, new THREE.MeshStandardMaterial()])
  );
}

test("C2 HD softens rails without changing geometry or instances", () => {
  const scene = new THREE.Scene();
  const materials = makeMaterials();

  const retro = createClassroomRoomGeometryV3({
    scene,
    materials
  });

  const hd = createClassroomRoomGeometryV3({
    scene,
    materials,
    presentationMode: "hd"
  });

  try {
    const rails = group => group.children.filter(mesh =>
      mesh.name.startsWith("ceiling-rail-")
    );

    const retroRails = rails(retro.group);
    const hdRails = rails(hd.group);

    assert.equal(retro.ceilingTileCount, 25);
    assert.equal(hd.ceilingTileCount, 25);

    assert.equal(
      retro.group.children.length,
      hd.group.children.length
    );

    assert.equal(retroRails.length, 8);
    assert.equal(hdRails.length, 8);

    assert.equal(
      hd.group.getObjectByName("ceiling-tiles-v3-instanced").count,
      25
    );

    assert.equal(
      retro.group.getObjectByName("ceiling-tiles-v3-instanced").count,
      25
    );

    for (let i = 0; i < hdRails.length; i++) {
      assert.equal(retroRails[i].material, materials.metal);
      assert.equal(retroRails[i].castShadow, true);

      assert.equal(hdRails[i].castShadow, false);
      assert.equal(hdRails[i].receiveShadow, true);

      assert.equal(
        hdRails[i].material.isMeshStandardMaterial,
        true
      );

      assert.equal(
        hdRails[i].material.color.getHex(),
        0xece9df
      );

      assert.equal(hdRails[i].material.roughness, 0.95);
      assert.equal(hdRails[i].material.metalness, 0.0);

      assert.notEqual(
        hdRails[i].material,
        materials.metal
      );

      assert.deepEqual(
        hdRails[i].position.toArray(),
        retroRails[i].position.toArray()
      );
    }

    assert.equal(
      new Set(hdRails.map(rail => rail.material)).size,
      1
    );

    assert.equal(
      hd.group.children.filter(child => child.isLight).length,
      0
    );
  } finally {
    retro.dispose();
    hd.dispose();

    for (const material of Object.values(materials)) {
      material.dispose();
    }
  }

  assert.equal(scene.children.length, 0);
});

test("C2 invalid mode does not mutate the scene", () => {
  const scene = new THREE.Scene();
  const materials = makeMaterials();

  try {
    assert.throws(
      () => createClassroomRoomGeometryV3({
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

test("C2 production opts into HD and preserves WASD/FOV", () => {
  const world = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  assert.match(
    world,
    /createClassroomRoomGeometryV3\(\{\s*scene,\s*materials:\s*classroomVisualSystem\.materials,\s*presentationMode:\s*"hd"/u
  );

  assert.match(world, /yaw:\s*movementYaw/u);

  assert.match(
    world,
    /CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56/u
  );
});
