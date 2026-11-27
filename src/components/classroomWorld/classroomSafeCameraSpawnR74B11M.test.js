import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

const source = readFileSync(
  new URL("./ClassroomWorld.jsx", import.meta.url),
  "utf8"
);

test("R74B11M source wiring is present and ordered", () => {
  const initial = source.indexOf(
    "camera.position.set(teacherAnchor.x + 2.5, PLAYER_HEIGHT, 5.5);"
  );

  const lookAt = source.indexOf(
    "camera.lookAt(teacherAnchor.x, 1.4, teacherAnchor.z);"
  );

  const inset = source.indexOf(
    "camera.position.addScaledVector(spawnIntoRoom, 2.0);"
  );

  const addCamera = source.indexOf("scene.add(camera);");

  assert.equal(
    source.split("CW08_R74B11M_SAFE_CAMERA_SPAWN").length - 1,
    1
  );

  assert.ok(initial >= 0);
  assert.ok(lookAt > initial);
  assert.ok(inset > lookAt);
  assert.ok(addCamera > inset);

  assert.match(
    source,
    /spawnIntoRoom\.y\s*=\s*0/
  );

  assert.match(
    source,
    /spawnIntoRoom\.normalize\(\)/
  );
});

test("safe spawn increases distance from rear boundary", () => {
  const camera = new THREE.PerspectiveCamera(
    56, 16 / 9, 0.1, 50
  );

  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const originalQuaternion = camera.quaternion.clone();
  const originalPosition = camera.position.clone();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  camera.position.addScaledVector(forward, 2.0);

  const rearLimit = 7.2 - 0.35;
  const oldClearance = rearLimit - originalPosition.z;
  const newClearance = rearLimit - camera.position.z;

  assert.ok(newClearance > oldClearance + 1.5);
  assert.ok(newClearance > 3.0);
  assert.ok(camera.position.z < 5.5);
  assert.ok(camera.position.x < 2.5);

  assert.ok(
    camera.position.distanceTo(originalPosition) > 1.99
  );

  assert.ok(
    Math.abs(camera.quaternion.dot(originalQuaternion)) >
      0.999999
  );

  assert.equal(camera.position.y, 1.65);
});

test("safe spawn stays within room bounds", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  camera.position.addScaledVector(forward, 2.0);

  const max = 7.2 - 0.35;

  assert.ok(Math.abs(camera.position.x) < max);
  assert.ok(Math.abs(camera.position.z) < max);
});

test("WASD authority and HD isolation remain wired", () => {
  assert.match(
    source,
    /controls\.getDirection\(\s*movementForward\s*\)/
  );

  assert.match(
    source,
    /yaw:\s*movementYaw/
  );

  assert.match(
    source,
    /isolateClassroomHdVisualLayersR74B10B\(scene\)/
  );

  assert.doesNotMatch(source, /R74B11I_RENDER_PERSPECTIVE/);
  assert.doesNotMatch(source, /R74B11E_WS_WINDOW/);
});