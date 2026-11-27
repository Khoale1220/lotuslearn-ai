import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";

import {
  createClassroomLightingV2
} from "./classroomLightingV2.js";

import {
  createClassroomDepthAtmospherePixelLightingV35
} from "./classroomDepthAtmospherePixelLightingV35.js";

function exercise(mode) {
  const renderer = {
    shadowMap: {
      enabled: false,
      type: THREE.BasicShadowMap
    }
  };

  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x617f96);
  scene.fog = new THREE.Fog(0x617f96, 2, 28);

  const rig = createClassroomLightingV2({
    renderer,
    scene,
    presentationMode: mode
  });

  const before = {
    hemisphere: rig.hemisphere.intensity,
    sunlight: rig.sunlight.intensity,
    hemisphereColor: rig.hemisphere.color.getHex(),
    sunlightColor: rig.sunlight.color.getHex()
  };

  const atmosphere = createClassroomDepthAtmospherePixelLightingV35({
    scene,
    presentationMode: mode
  });

  try {
    assert.equal(renderer.shadowMap.enabled, true);

    assert.equal(
      renderer.shadowMap.type,
      mode === "hd" ? THREE.PCFShadowMap : THREE.BasicShadowMap
    );

    const panels = rig.group.children.filter(
      object => object.name.startsWith("ceiling-light-panel-")
    );

    assert.equal(panels.length, 6);
    assert.equal(rig.sunlight.shadow.mapSize.x, 1024);
    assert.equal(rig.sunlight.shadow.mapSize.y, 1024);
    assert.equal(rig.sunlight.castShadow, true);

    assert.equal(
      panels[0].material.emissiveIntensity,
      mode === "hd" ? 0.78 : 1.25
    );

    assert.equal(
      panels[0].material.roughness,
      mode === "hd" ? 0.82 : 0.64
    );

    const lights = [];

    scene.traverse(object => {
      if (object.isLight) lights.push(object);
    });

    assert.equal(lights.length, 2);

    const snapshot = atmosphere.getSnapshot();

    assert.equal(snapshot.addedLights, 0);
    assert.equal(snapshot.addedShadowMaps, 0);
    assert.equal(snapshot.shadowMapResolutionPreserved, true);
    assert.equal(snapshot.backgroundMatchesFog, true);

    assert.equal(
      rig.hemisphere.color.getHex(),
      mode === "hd" ? 0xdde9ee : 0xb7d6e8
    );

    assert.equal(
      rig.sunlight.color.getHex(),
      mode === "hd" ? 0xffe9d6 : 0xffd29d
    );

    assert.ok(
      Math.abs(
        rig.hemisphere.intensity -
        before.hemisphere * (mode === "hd" ? 1.06 : 0.78)
      ) < 1e-10
    );

    assert.ok(
      Math.abs(
        rig.sunlight.intensity -
        before.sunlight * (mode === "hd" ? 0.90 : 1.14)
      ) < 1e-10
    );
  } finally {
    atmosphere.dispose();

    assert.equal(rig.hemisphere.intensity, before.hemisphere);
    assert.equal(rig.sunlight.intensity, before.sunlight);

    assert.equal(
      rig.hemisphere.color.getHex(),
      before.hemisphereColor
    );

    assert.equal(
      rig.sunlight.color.getHex(),
      before.sunlightColor
    );

    rig.dispose();
  }

  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap);
  assert.equal(scene.children.length, 0);
}

test("C4 Retro preserves original lighting", () => {
  exercise("retro");
});

test("C4 HD uses warm daylight and filtered shadows", () => {
  exercise("hd");
});

test("C4 rejects invalid modes before scene mutation", () => {
  const renderer = {
    shadowMap: {
      enabled: false,
      type: THREE.BasicShadowMap
    }
  };

  const scene = new THREE.Scene();

  assert.throws(
    () => createClassroomLightingV2({
      renderer,
      scene,
      presentationMode: "wrong"
    }),
    RangeError
  );

  assert.throws(
    () => createClassroomDepthAtmospherePixelLightingV35({
      scene,
      presentationMode: "wrong"
    }),
    RangeError
  );

  assert.equal(scene.children.length, 0);
  assert.equal(renderer.shadowMap.enabled, false);
});

test("C4 production retains movement and furniture contracts", () => {
  const source = fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /yaw:\s*movementYaw/u);

  assert.match(
    source,
    /CLASSROOM_CAMERA_VERTICAL_FOV\s*=\s*56/u
  );

  assert.match(
    source,
    /createClassroomLightingV2\(\{\s*renderer,\s*scene,\s*presentationMode:\s*"hd"/u
  );

  assert.match(
    source,
    /createClassroomDepthAtmospherePixelLightingV35\(\{\s*scene,\s*presentationMode:\s*"hd"/u
  );

  assert.match(
    source,
    /classroomFurnitureV2\.applyHdMaterialFinish\(\)/u
  );
});
