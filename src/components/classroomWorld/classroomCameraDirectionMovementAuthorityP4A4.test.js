import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

test(
  "P4A4 derives movement authority from actual camera direction",
  () => {
    assert.match(
      source,
      /CW08_P4A4_CAMERA_DIRECTION_MOVEMENT_AUTHORITY/
    );

    assert.match(
      source,
      /const movementForward = new THREE\.Vector3\(\)/
    );

    assert.match(
      source,
      /controls\.getDirection\(\s*movementForward\s*\)/
    );

    assert.match(
      source,
      /movementForward\.y\s*=\s*0/
    );

    assert.match(
      source,
      /movementForward\.normalize\(\)/
    );

    assert.match(
      source,
      /Math\.atan2\(\s*-movementForward\.x,\s*-movementForward\.z\s*\)/
    );

    assert.match(
      source,
      /yaw:\s*movementYaw/
    );

    assert.doesNotMatch(
      source,
      /yaw:\s*camera\.rotation\.y/
    );
  }
);

test(
  "P4A4 preserves camera/FOV composition work",
  () => {
    assert.match(
      source,
      /const CLASSROOM_CAMERA_VERTICAL_FOV = 56;/
    );

    assert.match(
      source,
      /new THREE\.PerspectiveCamera\(\s*CLASSROOM_CAMERA_VERTICAL_FOV,/
    );

    assert.match(
      source,
      /PLAYER_HEIGHT/
    );

    assert.match(
      source,
      /createThreeCameraMovementInput/
    );

    assert.match(
      source,
      /stepPlayerLocomotion/
    );
  }
);
