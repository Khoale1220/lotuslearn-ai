import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE,
  computeAmbientPointBaseV40,
  computeAmbientPointStateV40,
  createCameraSeedFrame,
  createClassroomAmbientPixelPolishV40,
  createPixelCrossTexture
} from "./classroomAmbientPixelPolishV40.js";

function cloneCameraState(camera) {
  return {
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    projection: camera.projectionMatrix.toArray()
  };
}

function assertCameraStateEqual(camera, expected) {
  assert.deepEqual(
    camera.position.toArray(),
    expected.position
  );

  assert.deepEqual(
    camera.quaternion.toArray(),
    expected.quaternion
  );

  assert.deepEqual(
    camera.projectionMatrix.toArray(),
    expected.projection
  );
}

test("V40 profile stays intentionally tiny and deterministic", () => {
  assert.equal(
    Object.isFrozen(
      CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE
    ),
    true
  );

  assert.equal(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.visualLayer,
    30
  );

  assert.equal(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.textureSize,
    8
  );

  assert.ok(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.warmDustCount <= 24
  );

  assert.ok(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.cyanGlintCount <= 8
  );

  assert.ok(
    CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.orangeGlintCount <= 8
  );
});

test("V40 camera seed frame is a read-only construction snapshot", () => {
  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  camera.position.set(
    2.5,
    1.65,
    5.5
  );

  camera.lookAt(0, 1.4, 0);

  const before =
    cloneCameraState(camera);

  const frame =
    createCameraSeedFrame(camera);

  assert.equal(
    Object.isFrozen(frame),
    true
  );

  assert.equal(
    Object.isFrozen(frame.origin),
    true
  );

  assert.ok(
    Number.isFinite(frame.forward.x)
  );

  assert.ok(
    Number.isFinite(frame.right.z)
  );

  assertCameraStateEqual(
    camera,
    before
  );
});

test("V40 point state is deterministic and bounded", () => {
  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const seedFrame =
    createCameraSeedFrame(camera);

  const base =
    computeAmbientPointBaseV40({
      index: 3,
      count: 18,
      seedFrame,
      lane: 0
    });

  const first =
    computeAmbientPointStateV40({
      base,
      timestamp: 2345,
      lane: 0
    });

  const second =
    computeAmbientPointStateV40({
      base,
      timestamp: 2345,
      lane: 0
    });

  assert.deepEqual(first, second);

  assert.ok(
    Math.abs(first.x - base.x) <=
      CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.driftAmplitude +
        1e-9
  );

  assert.ok(
    Math.abs(first.y - base.y) <=
      CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.liftAmplitude +
        1e-9
  );

  assert.equal(first.z, base.z);
});

test("V40 pixel texture keeps hard nearest-neighbor sampling", () => {
  const texture =
    createPixelCrossTexture({
      color: 0xffd9a0,
      accent: 0xff8a4c
    });

  assert.equal(
    texture.isDataTexture,
    true
  );

  assert.equal(
    texture.image.width,
    8
  );

  assert.equal(
    texture.image.height,
    8
  );

  assert.equal(
    texture.magFilter,
    THREE.NearestFilter
  );

  assert.equal(
    texture.minFilter,
    THREE.NearestFilter
  );

  assert.equal(
    texture.generateMipmaps,
    false
  );

  assert.equal(
    texture.colorSpace,
    THREE.SRGBColorSpace
  );

  texture.dispose();
});

test("V40 owns only three low-cost point fields and preserves camera authority", () => {
  const scene = new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const cameraBefore =
    cloneCameraState(camera);

  const childCountBefore =
    scene.children.length;

  const system =
    createClassroomAmbientPixelPolishV40({
      scene,
      camera
    });

  assert.equal(
    scene.children.length,
    childCountBefore + 1
  );

  assert.equal(
    system.root.children.length,
    3
  );

  assert.equal(
    system.root.matrixAutoUpdate,
    false
  );

  for (const child of system.root.children) {
    assert.equal(child.isPoints, true);
    assert.equal(child.renderOrder, 0);
    assert.equal(child.material.depthTest, true);
    assert.equal(child.material.depthWrite, false);
    assert.equal(child.material.transparent, false);
    assert.equal(
      child.material.alphaTest,
      CLASSROOM_AMBIENT_PIXEL_POLISH_V40_PROFILE.alphaTest
    );

    assert.equal(
      child.material.map.magFilter,
      THREE.NearestFilter
    );

    assert.equal(
      child.material.map.minFilter,
      THREE.NearestFilter
    );

    assert.equal(
      child.material.map.generateMipmaps,
      false
    );

    assert.equal(
      child.material.map.colorSpace,
      THREE.SRGBColorSpace
    );
  }

  assertCameraStateEqual(
    camera,
    cameraBefore
  );

  system.dispose();

  assert.equal(
    system.root.parent,
    null
  );
});

test("V40 tick moves only owned position buffers", () => {
  const scene = new THREE.Scene();
  const camera =
    new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 50);

  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);

  const cameraBefore =
    cloneCameraState(camera);

  const system =
    createClassroomAmbientPixelPolishV40({
      scene,
      camera
    });

  const positionsBefore =
    system.root.children.map((child) =>
      Array.from(
        child.geometry.getAttribute("position").array
      )
    );

  system.tick({
    timestamp: 1800,
    deltaSeconds: 1 / 60
  });

  const positionsAfter =
    system.root.children.map((child) =>
      Array.from(
        child.geometry.getAttribute("position").array
      )
    );

  assert.notDeepEqual(
    positionsAfter,
    positionsBefore
  );

  assertCameraStateEqual(
    camera,
    cameraBefore
  );

  const snapshot =
    system.getSnapshot();

  assert.equal(snapshot.fieldCount, 3);
  assert.equal(snapshot.drawCallCount, 3);
  assert.equal(snapshot.textureCount, 3);
  assert.equal(snapshot.runtimeSceneTraversal, false);
  assert.equal(snapshot.cameraMutation, false);
  assert.equal(snapshot.raycastAuthority, false);
  assert.equal(snapshot.collisionAuthority, false);
  assert.equal(snapshot.lightingAuthority, false);
  assert.equal(snapshot.tickCount, 1);

  system.dispose();
});

test("V40 source contains no duplicate runtime authority", () => {
  const source =
    fs.readFileSync(
      new URL(
        "./classroomAmbientPixelPolishV40.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.equal(
    source.includes("scene.traverse("),
    false
  );

  assert.equal(
    source.includes("requestAnimationFrame"),
    false
  );

  assert.equal(
    /new\s+THREE\.(DirectionalLight|PointLight|SpotLight|HemisphereLight)/u.test(source),
    false
  );

  assert.equal(
    source.includes("new THREE.Raycaster"),
    false
  );

  assert.equal(
    source.includes("stepPlayerLocomotion"),
    false
  );

  assert.equal(
    source.includes("resolvePlayerCollision"),
    false
  );

  assert.equal(
    source.includes("emitTeacherInterventionCommand"),
    false
  );
});
