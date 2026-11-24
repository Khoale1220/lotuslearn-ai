import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import * as THREE from "three";

import {
  fileURLToPath
} from "node:url";

import {
  CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE,
  createClassroomDepthAtmospherePixelLightingV35,
  discoverLightingAuthoritiesV35
} from "./classroomDepthAtmospherePixelLightingV35.js";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

function createFixture() {
  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x17151f
    );

  scene.fog =
    new THREE.Fog(
      0x17151f,
      12,
      24
    );

  const hemisphere =
    new THREE.HemisphereLight(
      0xe7efff,
      0x2c2436,
      2.4
    );

  const directional =
    new THREE.DirectionalLight(
      0xfff0d8,
      2.2
    );

  directional.position.set(
    4,
    7,
    5
  );

  directional.target.position.set(
    0,
    0,
    0
  );

  directional.castShadow =
    true;

  directional.shadow.mapSize.set(
    2048,
    2048
  );

  scene.add(
    hemisphere
  );

  scene.add(
    directional
  );

  return {
    scene,
    hemisphere,
    directional
  };
}

test(
  "V35 profile introduces zero rendering resources",
  () => {
    const profile =
      CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE;

    assert.equal(
      profile.addedMeshes,
      0
    );

    assert.equal(
      profile.addedMaterials,
      0
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedLights,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.addedShadowMaps,
      0
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeTick,
      false
    );

    assert.equal(
      profile.runtimeMaterialMutation,
      false
    );
  }
);

test(
  "V35 discovers existing canonical light authorities",
  () => {
    const {
      scene,
      hemisphere,
      directional
    } =
      createFixture();

    const discovery =
      discoverLightingAuthoritiesV35(
        scene
      );

    assert.equal(
      discovery.hemisphereLight,
      hemisphere
    );

    assert.equal(
      discovery.directionalLight,
      directional
    );

    assert.equal(
      discovery.hemisphereCount,
      1
    );

    assert.equal(
      discovery.directionalCount,
      1
    );
  }
);

test(
  "V35 builds foreground midground background depth separation",
  () => {
    const {
      scene,
      hemisphere,
      directional
    } =
      createFixture();

    const fogIdentity =
      scene.fog;

    const backgroundIdentity =
      scene.background;

    const originalFogNear =
      scene.fog.near;

    const originalFogFar =
      scene.fog.far;

    const originalHemisphere =
      hemisphere.intensity;

    const originalDirectional =
      directional.intensity;

    const childrenBefore =
      scene.children.length;

    const runtime =
      createClassroomDepthAtmospherePixelLightingV35({
        scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      scene.children.length,
      childrenBefore
    );

    assert.equal(
      scene.fog,
      fogIdentity
    );

    assert.equal(
      scene.background,
      backgroundIdentity
    );

    assert.ok(
      scene.fog.near <
        originalFogNear
    );

    assert.ok(
      scene.fog.far >
        originalFogFar
    );

    assert.equal(
      snapshot.backgroundMatchesFog,
      true
    );

    assert.ok(
      hemisphere.intensity <
        originalHemisphere
    );

    assert.ok(
      directional.intensity >
        originalDirectional
    );

    assert.ok(
      snapshot.directionalToHemisphereRatio >
        originalDirectional /
          originalHemisphere
    );

    runtime.dispose();
  }
);

test(
  "V35 preserves directional shadow and projection authority",
  () => {
    const {
      scene,
      directional
    } =
      createFixture();

    const position =
      directional.position.clone();

    const target =
      directional.target.position.clone();

    const castShadow =
      directional.castShadow;

    const shadowWidth =
      directional.shadow.mapSize.x;

    const shadowHeight =
      directional.shadow.mapSize.y;

    const runtime =
      createClassroomDepthAtmospherePixelLightingV35({
        scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.directionalPositionPreserved,
      true
    );

    assert.equal(
      snapshot.directionalTargetPreserved,
      true
    );

    assert.equal(
      snapshot.directionalCastShadowPreserved,
      true
    );

    assert.equal(
      snapshot.shadowMapResolutionPreserved,
      true
    );

    assert.equal(
      directional.position.equals(
        position
      ),
      true
    );

    assert.equal(
      directional.target.position.equals(
        target
      ),
      true
    );

    assert.equal(
      directional.castShadow,
      castShadow
    );

    assert.equal(
      directional.shadow.mapSize.x,
      shadowWidth
    );

    assert.equal(
      directional.shadow.mapSize.y,
      shadowHeight
    );

    runtime.dispose();
  }
);

test(
  "V35 dispose restores original atmosphere and lighting exactly",
  () => {
    const {
      scene,
      hemisphere,
      directional
    } =
      createFixture();

    const fogColor =
      scene.fog.color.clone();

    const fogNear =
      scene.fog.near;

    const fogFar =
      scene.fog.far;

    const background =
      scene.background.clone();

    const hemisphereColor =
      hemisphere.color.clone();

    const hemisphereGround =
      hemisphere.groundColor.clone();

    const hemisphereIntensity =
      hemisphere.intensity;

    const directionalColor =
      directional.color.clone();

    const directionalIntensity =
      directional.intensity;

    const runtime =
      createClassroomDepthAtmospherePixelLightingV35({
        scene
      });

    runtime.dispose();

    assert.equal(
      scene.fog.color.equals(
        fogColor
      ),
      true
    );

    assert.equal(
      scene.fog.near,
      fogNear
    );

    assert.equal(
      scene.fog.far,
      fogFar
    );

    assert.equal(
      scene.background.equals(
        background
      ),
      true
    );

    assert.equal(
      hemisphere.color.equals(
        hemisphereColor
      ),
      true
    );

    assert.equal(
      hemisphere.groundColor.equals(
        hemisphereGround
      ),
      true
    );

    assert.equal(
      hemisphere.intensity,
      hemisphereIntensity
    );

    assert.equal(
      directional.color.equals(
        directionalColor
      ),
      true
    );

    assert.equal(
      directional.intensity,
      directionalIntensity
    );
  }
);

test(
  "V35 creates no second render gameplay or interaction system",
  () => {
    const source =
      readSource(
        "classroomDepthAtmospherePixelLightingV35.js"
      );

    const forbidden = [
      /new THREE\.Mesh\s*\(/gu,
      /new THREE\.Sprite\s*\(/gu,
      /new THREE\.InstancedMesh\s*\(/gu,
      /new THREE\..*Material\s*\(/gu,
      /new THREE\..*Texture\s*\(/gu,
      /new THREE\..*Light\s*\(/gu,
      /new THREE\.Raycaster\s*\(/gu,
      /requestAnimationFrame/gu,
      /setInterval/gu,
      /setTimeout/gu,
      /PointerLockControls/gu,
      /emitTeacherInterventionCommand/gu,
      /stepPlayerLocomotion/gu,
      /resolvePlayerCollision/gu,
      /Math\.random/gu
    ];

    for (
      const expression
      of forbidden
    ) {
      assert.equal(
        expression.test(
          source
        ),
        false
      );
    }

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/gu
        ) ??
        []
      ).length,
      1
    );
  }
);

test(
  "V35 does not mutate material shading authorities",
  () => {
    const source =
      readSource(
        "classroomDepthAtmospherePixelLightingV35.js"
      );

    assert.equal(
      /material\.color\.set/gu
        .test(
          source
        ),
      false
    );

    assert.equal(
      /material\.opacity\s*=/gu
        .test(
          source
        ),
      false
    );

    assert.equal(
      /material\.transparent\s*=/gu
        .test(
          source
        ),
      false
    );

    assert.equal(
      /material\.fog\s*=/gu
        .test(
          source
        ),
      false
    );
  }
);

test(
  "V35 world integration is construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomDepthAtmospherePixelLightingV35({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomDepthAtmospherePixelLightingV35.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomDepthAtmospherePixelLightingV35.tick("
      ),
      false
    );

    const v35Dispose =
      world.indexOf(
        "classroomDepthAtmospherePixelLightingV35.dispose();"
      );

    const v34Dispose =
      world.indexOf(
        "classroomBlackboardStorytellingV34.dispose();"
      );

    assert.ok(
      v35Dispose >=
        0
    );

    assert.ok(
      v34Dispose >=
        0
    );

    assert.ok(
      v35Dispose <
        v34Dispose
    );

    assert.equal(
      world
        .split(
          ".intersectObjects(interactiveMeshes, false)"
        )
        .length - 1,
      1
    );
  }
);
