import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "three";
import { fileURLToPath } from "node:url";

import {
  CARD_DEFINITIONS_V39,
  CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE,
  computeCardPoseV39,
  computeForegroundFrameV39,
  createClassroomForegroundCompositionV39,
  createForegroundTextureV39
} from "./classroomForegroundCompositionV39.js";

const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

function readSource(name) {
  return readFileSync(path.join(DIRECTORY, name), "utf8");
}

function createCameraFixture() {
  const camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.1, 50);
  camera.position.set(2.5, 1.65, 5.5);
  camera.lookAt(0, 1.4, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

test("V39 profile adds only static visual composition authority", () => {
  const profile = CLASSROOM_FOREGROUND_COMPOSITION_V39_PROFILE;

  assert.equal(profile.cardCount, 4);
  assert.equal(profile.addedMeshes, 4);
  assert.equal(profile.addedGeometries, 1);
  assert.equal(profile.addedMaterials, 4);
  assert.equal(profile.addedTextures, 4);
  assert.equal(profile.addedDrawCalls, 4);
  assert.equal(profile.addedLights, 0);
  assert.equal(profile.addedShadowMaps, 0);
  assert.equal(profile.cameraMutation, false);
  assert.equal(profile.runtimeSceneTraversal, false);
  assert.equal(profile.runtimeTickRequired, false);
  assert.equal(profile.runtimeTexturePainting, false);
  assert.equal(profile.interactionAuthorityMutations, 0);
  assert.equal(profile.collisionAuthorityMutations, 0);
  assert.equal(profile.locomotionAuthorityMutations, 0);
  assert.equal(profile.lightingAuthorityMutations, 0);
});

test("V39 camera frame is read-only and horizontally normalized", () => {
  const camera = createCameraFixture();
  const before = camera.position.clone();
  const beforeFov = camera.fov;
  const frame = computeForegroundFrameV39(camera);

  assert.equal(camera.position.equals(before), true);
  assert.equal(camera.fov, beforeFov);

  const forwardLength = Math.hypot(frame.forward.x, frame.forward.z);
  const rightLength = Math.hypot(frame.right.x, frame.right.z);
  const dot = frame.forward.x * frame.right.x + frame.forward.z * frame.right.z;

  assert.ok(Math.abs(forwardLength - 1) <= 1e-9);
  assert.ok(Math.abs(rightLength - 1) <= 1e-9);
  assert.ok(Math.abs(dot) <= 1e-9);
});

test("V39 card definitions preserve an open focal corridor", () => {
  const sideCards = CARD_DEFINITIONS_V39.filter(
    (definition) => definition.role !== "low-desk-edge"
  );

  assert.equal(sideCards.length, 3);
  assert.equal(
    sideCards.every((definition) => Math.abs(definition.sideOffset) >= 2.5),
    true
  );

  const lowDesk = CARD_DEFINITIONS_V39.find(
    (definition) => definition.role === "low-desk-edge"
  );

  assert.ok(lowDesk);
  assert.ok(lowDesk.centerY <= 0.5);
  assert.ok(lowDesk.height <= 1.05);
});

test("V39 card poses are deterministic world-space placements", () => {
  const camera = createCameraFixture();
  const frame = computeForegroundFrameV39(camera);

  const first = CARD_DEFINITIONS_V39.map((definition) =>
    computeCardPoseV39({ frame, definition })
  );

  const second = CARD_DEFINITIONS_V39.map((definition) =>
    computeCardPoseV39({ frame, definition })
  );

  assert.deepEqual(first, second);

  for (let index = 0; index < first.length; index += 1) {
    const pose = first[index];
    const definition = CARD_DEFINITIONS_V39[index];
    const horizontalDistance = Math.hypot(
      pose.x - frame.origin.x,
      pose.z - frame.origin.z
    );

    const expectedDistance = Math.hypot(
      definition.forwardDistance,
      definition.sideOffset
    );

    assert.ok(Math.abs(horizontalDistance - expectedDistance) <= 1e-9);
  }
});

test("V39 textures use crisp VGA sampling with hard transparency", () => {
  for (const definition of CARD_DEFINITIONS_V39) {
    const texture = createForegroundTextureV39(definition.role);

    assert.equal(texture.isDataTexture, true);
    assert.equal(texture.image.width, 128);
    assert.equal(texture.image.height, 128);
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.flipY, true);

    let visiblePixels = 0;
    let transparentPixels = 0;

    for (let index = 3; index < texture.image.data.length; index += 4) {
      if (texture.image.data[index] === 0) {
        transparentPixels += 1;
      } else {
        visiblePixels += 1;
      }
    }

    assert.ok(visiblePixels > 0);
    assert.ok(transparentPixels > 0);
    texture.dispose();
  }
});

test("V39 creates real depth-writing world cutouts with raycast isolation", () => {
  const scene = new THREE.Scene();
  const camera = createCameraFixture();
  scene.add(camera);

  const runtime = createClassroomForegroundCompositionV39({ scene, camera });
  const snapshot = runtime.getSnapshot();

  assert.equal(runtime.root.parent, scene);
  assert.equal(runtime.root.children.length, 4);
  assert.equal(snapshot.cardCount, 4);
  assert.equal(snapshot.visualOnly, true);
  assert.equal(snapshot.interactionExcluded, true);
  assert.equal(snapshot.collisionExcluded, true);
  assert.equal(snapshot.raycastDisabled, true);
  assert.equal(snapshot.depthTest, true);
  assert.equal(snapshot.depthWrite, true);
  assert.equal(snapshot.opaqueCutout, true);
  assert.equal(snapshot.toneMappingExcluded, true);
  assert.equal(snapshot.nearestFiltering, true);
  assert.equal(snapshot.mipmapsDisabled, true);
  assert.equal(snapshot.srgbColorSpace, true);
  assert.equal(snapshot.staticMatrices, true);
  assert.equal(snapshot.runtimeSceneTraversal, false);
  assert.equal(snapshot.runtimeTickRequired, false);

  const sharedGeometry = runtime.root.children[0].geometry;

  for (const mesh of runtime.root.children) {
    assert.equal(mesh.geometry, sharedGeometry);
    assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.material.alphaTest, 0.5);
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.depthWrite, true);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    assert.equal(mesh.renderOrder, 0);
    assert.equal(mesh.matrixAutoUpdate, false);

    const raycaster = new THREE.Raycaster(
      camera.position.clone(),
      mesh.position.clone().sub(camera.position).normalize()
    );

    assert.equal(raycaster.intersectObject(mesh, false).length, 0);
  }

  runtime.dispose();
  assert.equal(runtime.root.parent, null);
});

test("V39 implementation owns no runtime loop, light, collision, or camera mutation", () => {
  const source = readSource("classroomForegroundCompositionV39.js");

  const forbidden = [
    /scene\.traverse\s*\(/gu,
    /requestAnimationFrame/gu,
    /setInterval/gu,
    /setTimeout/gu,
    /Math\.random/gu,
    /new THREE\..*Light\s*\(/gu,
    /new THREE\.Raycaster\s*\(/gu,
    /camera\.position\.(set|copy|add|sub)/gu,
    /camera\.fov\s*=/gu,
    /camera\.rotation\./gu,
    /stepPlayerLocomotion/gu,
    /resolvePlayerCollision/gu,
    /emitTeacherInterventionCommand/gu,
    /interactiveMeshes\.push/gu
  ];

  for (const expression of forbidden) {
    assert.equal(expression.test(source), false);
  }
});

test("V39 world integration is construction-only after V38 and reverse-disposed", () => {
  const world = readSource("ClassroomWorld.jsx");

  assert.equal(
    world.split('from "./classroomForegroundCompositionV39.js";').length - 1,
    1
  );
  assert.equal(
    world.split("createClassroomForegroundCompositionV39({").length - 1,
    1
  );
  assert.equal(
    world.split("classroomForegroundCompositionV39.dispose();").length - 1,
    1
  );

  assert.equal(world.includes("classroomForegroundCompositionV39.tick("), false);
  assert.equal(world.includes("classroomForegroundCompositionV39.update("), false);

  const v38Construction = world.indexOf("createClassroomExteriorDepthArtV38({");
  const v39Construction = world.indexOf("createClassroomForegroundCompositionV39({");
  assert.ok(v38Construction >= 0);
  assert.ok(v39Construction > v38Construction);

  const v39Dispose = world.indexOf("classroomForegroundCompositionV39.dispose();");
  const v38Dispose = world.indexOf("classroomExteriorDepthArtV38.dispose();");
  assert.ok(v39Dispose >= 0);
  assert.ok(v38Dispose >= 0);
  assert.ok(v39Dispose < v38Dispose);

  assert.equal(
    world.split(".intersectObjects(interactiveMeshes, false)").length - 1,
    1
  );
});
