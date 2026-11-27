import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

test(
  "P4A narrows classroom vertical FOV without changing player height",
  () => {
    assert.match(
      source,
      /const CLASSROOM_CAMERA_VERTICAL_FOV = 56;/u
    );

    assert.match(
      source,
      /const PLAYER_HEIGHT = 1\.65;/u
    );

    assert.match(
      source,
      /new THREE\.PerspectiveCamera\(\s*CLASSROOM_CAMERA_VERTICAL_FOV,\s*16 \/ 9,\s*0\.1,\s*50\s*\)/u
    );

    assert.doesNotMatch(
      source,
      /new THREE\.PerspectiveCamera\(62,/u
    );
  }
);

test(
  "P4A delegates pitch limits to PointerLockControls",
  () => {
    assert.match(
      source,
      /const CLASSROOM_CAMERA_MIN_POLAR_ANGLE = Math\.PI \/ 3;/u
    );

    assert.match(
      source,
      /const CLASSROOM_CAMERA_MAX_POLAR_ANGLE =\s*\(7 \* Math\.PI\) \/ 9;/u
    );

    assert.match(
      source,
      /controls\.minPolarAngle =\s*CLASSROOM_CAMERA_MIN_POLAR_ANGLE;/u
    );

    assert.match(
      source,
      /controls\.maxPolarAngle =\s*CLASSROOM_CAMERA_MAX_POLAR_ANGLE;/u
    );
  }
);

test(
  "P4A preserves yaw-driven locomotion authority",
  () => {
    assert.match(
      source,
      /yaw:\s*movementYaw/u
    );

    assert.match(
      source,
      /new PointerLockControls\(camera, renderer\.domElement\)/u
    );

    assert.doesNotMatch(
      source,
      /controls\.moveForward\(/u
    );

    assert.doesNotMatch(
      source,
      /controls\.moveRight\(/u
    );
  }
);
