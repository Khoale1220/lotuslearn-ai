import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE,
  createClassroomCargoShipLanesV17
} from "./classroomCargoShipLanesV17.js";

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

  const oceanWorld = {
    getSnapshot() {
      return {
        oceanY: -3
      };
    }
  };

  return {
    scene,
    camera,
    oceanWorld
  };
}

function compactSnapshot(
  snapshot
) {
  return snapshot.ships.map(
    (ship) => ({
      lane:
        ship.lane,

      progress:
        Number(
          ship.progress.toFixed(8)
        ),

      x:
        Number(
          ship.x.toFixed(8)
        ),

      y:
        Number(
          ship.y.toFixed(8)
        ),

      z:
        Number(
          ship.z.toFixed(8)
        )
    })
  );
}

test(
  "V17 creates four deterministic cargo shipping lanes and eight ships",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomCargoShipLanesV17({
        ...fixture,
        documentObject: null
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.laneCount,
      4
    );

    assert.equal(
      snapshot.shipCount,
      8
    );

    assert.equal(
      snapshot.oceanY,
      -3
    );

    assert.equal(
      snapshot.visualOnly,
      true
    );

    assert.equal(
      CLASSROOM_CARGO_SHIP_LANES_V17_PROFILE
        .interactionAuthorityMutations,
      0
    );

    system.dispose();
  }
);

test(
  "V17 movement is deterministic for identical delta sequences",
  () => {
    const fixtureA =
      createFixture();

    const fixtureB =
      createFixture();

    const systemA =
      createClassroomCargoShipLanesV17({
        ...fixtureA,
        documentObject: null
      });

    const systemB =
      createClassroomCargoShipLanesV17({
        ...fixtureB,
        documentObject: null
      });

    const sequence = [
      0.016,
      0.016,
      0.033,
      0.025,
      0.050,
      0.016
    ];

    for (
      const deltaSeconds
      of sequence
    ) {
      systemA.tick({
        deltaSeconds
      });

      systemB.tick({
        deltaSeconds
      });
    }

    assert.deepEqual(
      compactSnapshot(
        systemA.getSnapshot()
      ),
      compactSnapshot(
        systemB.getSnapshot()
      )
    );

    systemA.dispose();
    systemB.dispose();
  }
);

test(
  "V17 ships move without joining interaction raycasts",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomCargoShipLanesV17({
        ...fixture,
        documentObject: null
      });

    const ship =
      fixture.scene.getObjectByName(
        "cw06-v17-cargo-ship-0"
      );

    assert.ok(ship);

    assert.equal(
      ship.userData.visualOnly,
      true
    );

    assert.equal(
      ship.userData.interactionExcluded,
      true
    );

    const before =
      ship.position.clone();

    system.tick({
      deltaSeconds: 0.1
    });

    assert.notDeepEqual(
      ship.position.toArray(),
      before.toArray()
    );

    const hits = [];

    ship.raycast(
      new THREE.Raycaster(),
      hits
    );

    assert.equal(
      hits.length,
      0
    );

    system.dispose();
  }
);

test(
  "V17 dispose removes every cargo ship",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomCargoShipLanesV17({
        ...fixture,
        documentObject: null
      });

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06CargoShipV17
      ).length,
      8
    );

    system.dispose();

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06CargoShipV17
      ).length,
      0
    );
  }
);
