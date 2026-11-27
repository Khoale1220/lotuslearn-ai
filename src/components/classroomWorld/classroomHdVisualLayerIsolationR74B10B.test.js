import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

import {
  isolateClassroomHdVisualLayersR74B10B
} from "./classroomHdVisualLayerIsolationR74B10B.js";

import {
  createClassroomForegroundCompositionV39
} from "./classroomForegroundCompositionV39.js";

function mesh(name) {
  const result = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial()
  );

  result.name = name;
  return result;
}

test("R74B10B isolates only unwanted HD visual layers", () => {
  const scene = new THREE.Scene();

  const hdFloor = mesh("classroom-64bit-floor");
  const retroFloor = mesh("retro-floor-v4");
  const deskEdge = mesh("cw06-v39-low-desk-edge");
  const furniture = mesh("student-desk");

  scene.add(hdFloor, retroFloor, deskEdge, furniture);

  const originalRaycast = retroFloor.raycast;
  const originalChildren = scene.children.length;

  const result =
    isolateClassroomHdVisualLayersR74B10B(scene);

  assert.deepEqual(result, {
    hdFloorAvailable: true,
    retroFloorHidden: true,
    deskEdgeHidden: true
  });

  assert.equal(hdFloor.visible, true);
  assert.equal(retroFloor.visible, false);
  assert.equal(deskEdge.visible, false);
  assert.equal(furniture.visible, true);

  assert.equal(scene.children.length, originalChildren);
  assert.equal(retroFloor.raycast, originalRaycast);
  assert.equal(retroFloor.parent, scene);
});

test("R74B10B retains fallback floor when HD is absent", () => {
  const scene = new THREE.Scene();
  const retroFloor = mesh("retro-floor-v4");
  scene.add(retroFloor);

  const result =
    isolateClassroomHdVisualLayersR74B10B(scene);

  assert.equal(result.hdFloorAvailable, false);
  assert.equal(result.retroFloorHidden, false);
  assert.equal(retroFloor.visible, true);
});

test("R74B10B rejects invalid scene authority", () => {
  assert.throws(
    () => isolateClassroomHdVisualLayersR74B10B(null),
    TypeError
  );
});

test("R74B10B integrates with actual V39 foreground", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    56, 16 / 9, 0.1, 200
  );

  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const composition = createClassroomForegroundCompositionV39({
    scene,
    camera
  });

  try {
    const hdFloor = mesh("classroom-64bit-floor");
    const retroFloor = mesh("retro-floor-v4");

    scene.add(hdFloor, retroFloor);

    const result =
      isolateClassroomHdVisualLayersR74B10B(scene);

    assert.equal(result.deskEdgeHidden, true);
    assert.equal(result.retroFloorHidden, true);

    const edge = scene.getObjectByName(
      "cw06-v39-low-desk-edge"
    );

    const plant = scene.getObjectByName(
      "cw06-v39-right-plant"
    );

    assert.ok(edge);
    assert.ok(plant);
    assert.equal(edge.visible, false);
    assert.equal(plant.visible, false);

    assert.equal(composition.getSnapshot().cardCount, 4);
  } finally {
    composition.dispose();
  }
});

test("R74B10B is wired after visual scene creation", () => {
  const world = readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  const call =
    "isolateClassroomHdVisualLayersR74B10B(scene);";

  assert.equal(world.split(call).length - 1, 1);

  const position = world.indexOf(call);

  assert.ok(
    world.indexOf("createClassroomForegroundCompositionV39({") <
      position
  );

  assert.ok(
    world.indexOf("createClassroomRetroCompositionV4({") <
      position
  );

  assert.ok(
    position < world.indexOf("const floor = new THREE.Mesh(")
  );
});
test("R74B11C hides remaining V39 cards only with HD floor", () => {
  const names = [
    "cw06-v39-left-shelf",
    "cw06-v39-right-plant",
    "cw06-v39-right-chair-stack"
  ];

  const hdScene = new THREE.Scene();
  hdScene.add(mesh("classroom-64bit-floor"));

  for (const name of names) {
    hdScene.add(mesh(name));
  }

  isolateClassroomHdVisualLayersR74B10B(hdScene);

  for (const name of names) {
    assert.equal(hdScene.getObjectByName(name).visible, false);
  }

  const fallbackScene = new THREE.Scene();

  for (const name of names) {
    fallbackScene.add(mesh(name));
  }

  isolateClassroomHdVisualLayersR74B10B(fallbackScene);

  for (const name of names) {
    assert.equal(fallbackScene.getObjectByName(name).visible, true);
  }
});

test("R74B11Q8 retro fallback retains the V39 desk edge", () => {
  const scene = new THREE.Scene();

  const retroFloor = mesh("retro-floor-v4");
  const deskEdge = mesh("cw06-v39-low-desk-edge");

  scene.add(retroFloor, deskEdge);

  const result =
    isolateClassroomHdVisualLayersR74B10B(scene);

  assert.equal(result.hdFloorAvailable, false);
  assert.equal(result.retroFloorHidden, false);
  assert.equal(result.deskEdgeHidden, false);

  assert.equal(retroFloor.visible, true);
  assert.equal(deskEdge.visible, true);
});
