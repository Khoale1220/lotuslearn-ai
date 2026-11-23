import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_OCEAN_VISTA_V16_PROFILE,
  createClassroomOceanVistaV16
} from "./classroomOceanVistaV16.js";

function createDoor() {
  const door =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.1,
        2.2,
        0.18
      ),
      new THREE.MeshBasicMaterial()
    );

  door.name =
    "classroom-door-v3";

  door.position.set(
    2,
    1.1,
    -4
  );

  door.updateMatrixWorld(true);

  return door;
}

test(
  "V16 extends the existing window shade interaction provider",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        50
      );

    const door =
      createDoor();

    scene.add(door);

    const shade =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          1,
          1
        ),
        new THREE.MeshBasicMaterial()
      );

    const delegated = [];

    const baseSystem = {
      getInteractionMeshes() {
        return [shade];
      },

      interact(target) {
        delegated.push(target);
        return "base";
      }
    };

    const system =
      createClassroomOceanVistaV16({
        scene,
        camera,
        windowShadeSystem:
          baseSystem
      });

    const targets =
      system.windowShadeSystem
        .getInteractionMeshes();

    assert.equal(
      targets.length,
      2
    );

    assert.equal(
      targets[0],
      shade
    );

    const oceanDoor =
      targets.find(
        (target) =>
          target.userData &&
          target.userData
            .oceanVistaDoor
      );

    assert.ok(oceanDoor);

    assert.equal(
      system.windowShadeSystem
        .interact(shade),
      "base"
    );

    assert.equal(
      delegated.length,
      1
    );

    assert.equal(
      system.windowShadeSystem
        .interact(oceanDoor),
      true
    );

    assert.equal(
      system.getSnapshot()
        .targetOpen,
      true
    );

    system.tick({
      deltaSeconds: 0.1
    });

    assert.ok(
      system.getSnapshot()
        .openRatio > 0
    );

    assert.notEqual(
      door.position.x,
      2
    );

    system.dispose();

    assert.equal(
      door.position.x,
      2
    );
  }
);

test(
  "V16 degrades to the original provider when no classroom door exists",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera();

    const baseSystem = {
      getInteractionMeshes() {
        return [];
      }
    };

    const system =
      createClassroomOceanVistaV16({
        scene,
        camera,
        windowShadeSystem:
          baseSystem
      });

    assert.equal(
      system.windowShadeSystem,
      baseSystem
    );

    assert.equal(
      system.getSnapshot()
        .doorFound,
      false
    );

    system.dispose();
  }
);

test(
  "V16 stays on the existing V11 interaction priority tier",
  () => {
    assert.equal(
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .interactionPriority,
      100
    );
  }
);
