import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

import {
  createClassroomReferenceSurfaceSilhouetteV29
} from "./classroomReferenceSurfaceSilhouetteV29.js";

const surfaces = [
  ["cw06-v29-wall-surface-breakup", 0.74, 0.48],
  ["cw06-v29-floor-surface-breakup", 0.68, 0.24],
  ["cw06-v29-desk-wood-grain", 0.76, 0.56],
  ["cw06-v29-board-surface-breakup", 0.70, 0.58]
];

for (const mode of ["retro", "hd"]) {
  test("C1 V29 " + mode + " sampling, opacity and draw-call invariants", () => {
    const scene = new THREE.Scene();

    const runtime =
      createClassroomReferenceSurfaceSilhouetteV29({
        scene,
        presentationMode: mode
      });

    try {
      assert.equal(runtime.root.children.length, 6);

      assert.equal(
        runtime.getSnapshot().staticVisualDrawCalls,
        6
      );

      assert.equal(
        Object.keys(runtime.textures).length,
        6
      );

      for (const texture of Object.values(runtime.textures)) {
        const filter = mode === "hd"
          ? THREE.LinearFilter
          : THREE.NearestFilter;

        assert.equal(texture.magFilter, filter);
        assert.equal(texture.minFilter, filter);
        assert.equal(texture.generateMipmaps, false);
      }

      for (const [name, retroOpacity, hdOpacity] of surfaces) {
        const mesh = runtime.root.getObjectByName(name);

        assert.equal(mesh?.isInstancedMesh, true, name);

        assert.equal(
          mesh.material.opacity,
          mode === "hd" ? hdOpacity : retroOpacity
        );

        assert.equal(
          mesh.userData.interactionExcluded,
          true
        );
      }
    } finally {
      runtime.dispose();
    }

    assert.equal(
      scene.children.includes(runtime.root),
      false
    );
  });
}

test("C1 V29 rejects invalid mode before modifying scene", () => {
  const scene = new THREE.Scene();

  assert.throws(
    () => createClassroomReferenceSurfaceSilhouetteV29({
      scene,
      presentationMode: "invalid"
    }),
    RangeError
  );

  assert.equal(scene.children.length, 0);
});

test("C1 production opts into HD and preserves WASD/FOV", () => {
  const source = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /createClassroomReferenceSurfaceSilhouetteV29\(\{\s*scene,\s*presentationMode:\s*"hd"/u
  );

  assert.match(source, /yaw:\s*movementYaw/u);

  assert.match(
    source,
    /CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56/u
  );
});
