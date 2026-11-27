import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createClassroomRoomGeometryV3 } from "./classroomRoomGeometryV3.js";

function instantiate(mode) {
  const scene = new THREE.Scene();
  const materials = new Proxy(Object.create(null), {
    get(target, name) {
      if (typeof name !== "string") return undefined;
      if (!Object.hasOwn(target, name)) {
        target[name] = new THREE.MeshStandardMaterial({
          color: 0x8899aa
        });
      }
      return target[name];
    }
  });
  return createClassroomRoomGeometryV3({
    scene,
    materials,
    presentationMode: mode
  });
}

test("E4D1 HD ceiling closes panel seams without changing retro layout", () => {
  const retro = instantiate("retro");
  const hd = instantiate("hd");

  try {
    const name = "ceiling-tiles-v3-instanced";
    const retroTiles = retro.group.getObjectByName(name);
    const hdTiles = hd.group.getObjectByName(name);

    assert.ok(retroTiles?.isInstancedMesh);
    assert.ok(hdTiles?.isInstancedMesh);

    assert.equal(retroTiles.count, 25);
    assert.equal(hdTiles.count, 25);

    assert.equal(retroTiles.geometry.parameters.width, 2.12);
    assert.equal(retroTiles.geometry.parameters.depth, 2.12);

    assert.equal(hdTiles.geometry.parameters.width, 2.38);
    assert.equal(hdTiles.geometry.parameters.depth, 2.38);
    assert.equal(hdTiles.geometry.parameters.height, 0.045);

    assert.ok(2.4 - hdTiles.geometry.parameters.width > 0);
    assert.ok(2.4 - hdTiles.geometry.parameters.width < 0.03);

    assert.equal(
      retro.group.children.length,
      hd.group.children.length
    );

    for (let i = 0; i < 25; i++) {
      const a = new THREE.Matrix4();
      const b = new THREE.Matrix4();

      retroTiles.getMatrixAt(i, a);
      hdTiles.getMatrixAt(i, b);

      assert.deepEqual(a.toArray(), b.toArray());
    }
  } finally {
    retro.dispose?.();
    hd.dispose?.();
  }
});
