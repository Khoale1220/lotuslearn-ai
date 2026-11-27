import * as THREE from "three";

const CLASSROOM_LIGHTING_CONFIG =
  Object.freeze({
    hemisphereIntensity:
      0.7,

    sunlightIntensity:
      1.25,

    shadowMapSize:
      1024,

    shadowExtent:
      9
  });

function createClassroomLightingV2({
  renderer,
  scene,
  presentationMode = "retro"
}) {
  if (presentationMode !== "retro" && presentationMode !== "hd") {
    throw new RangeError("Invalid lighting presentation mode");
  }
  const hdMode = presentationMode === "hd";
  if (
    !renderer ||
    !renderer.shadowMap
  ) {
    throw new TypeError(
      "renderer.shadowMap is required"
    );
  }

  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "scene must be a THREE.Scene"
    );
  }

  const previousShadowState = {
    enabled:
      renderer.shadowMap.enabled,

    type:
      renderer.shadowMap.type
  };

  /*
   * CW08.3C-D:
   * classroomLightingV2 is the canonical owner of
   * renderer shadow enablement, shadow-map filtering,
   * directional shadow-map sizing, bias, normalBias,
   * and directional shadow-camera configuration.
   *
   * Downstream visual modules may configure shadow
   * participants or contact-shadow artwork, but must not
   * mutate global shadow infrastructure.
   */
  renderer.shadowMap.enabled =
    true;

  /*
   * Hard, slightly pixel-like shadow filtering fits
   * the visual language and avoids the cost of adding
   * several independent shadow-casting lights.
   */

  renderer.shadowMap.type =
    hdMode ? THREE.PCFShadowMap : THREE.BasicShadowMap;

  const rig =
    new THREE.Group();

  rig.name =
    "classroom-lighting-v2";

  const hemisphere =
    new THREE.HemisphereLight(
      0xbfdff4,
      0x51493d,
      CLASSROOM_LIGHTING_CONFIG
        .hemisphereIntensity
    );

  hemisphere.name =
    "classroom-hemisphere-fill";

  rig.add(
    hemisphere
  );

  const sunlight =
    new THREE.DirectionalLight(
      0xfff0d2,
      CLASSROOM_LIGHTING_CONFIG
        .sunlightIntensity
    );

  sunlight.name =
    "classroom-window-sun";

  sunlight.position.set(
    9,
    11,
    6
  );

  sunlight.castShadow =
    true;

  sunlight.shadow.mapSize.set(
    CLASSROOM_LIGHTING_CONFIG
      .shadowMapSize,

    CLASSROOM_LIGHTING_CONFIG
      .shadowMapSize
  );

  const extent =
    CLASSROOM_LIGHTING_CONFIG
      .shadowExtent;

  sunlight.shadow.camera.left =
    -extent;

  sunlight.shadow.camera.right =
    extent;

  sunlight.shadow.camera.top =
    extent;

  sunlight.shadow.camera.bottom =
    -extent;

  sunlight.shadow.camera.near =
    0.5;

  sunlight.shadow.camera.far =
    32;

  sunlight.shadow.bias =
    -0.0004;

  sunlight.shadow.normalBias =
    0.02;

  sunlight.target.position.set(
    -1,
    1,
    -1
  );

  rig.add(
    sunlight
  );

  rig.add(
    sunlight.target
  );

  /*
   * Six ceiling panels are emissive geometry only.
   * They contribute visual depth without creating six
   * additional shadow render passes.
   */

  const ceilingGeometry =
    new THREE.BoxGeometry(
      1.7,
      0.05,
      0.52
    );

  const ceilingMaterial =
    new THREE.MeshStandardMaterial({
      color: hdMode ? 0xf5f1e9 : 0xf4e9ca,

      emissive: hdMode ? 0xffe8d2 : 0xffddb0,

      emissiveIntensity: hdMode ? 0.78 : 1.25,

      roughness: hdMode ? 0.82 : 0.64,

      metalness:
        0,

      flatShading:
        true
    });

  const panelPositions = [
    [-3.2, 3.46, -2.35],
    [0, 3.46, -2.35],
    [3.2, 3.46, -2.35],

    [-3.2, 3.46, 2.35],
    [0, 3.46, 2.35],
    [3.2, 3.46, 2.35]
  ];

  for (
    let index = 0;
    index < panelPositions.length;
    index += 1
  ) {
    const panel =
      new THREE.Mesh(
        ceilingGeometry,
        ceilingMaterial
      );

    panel.name =
      `ceiling-light-panel-${index + 1}`;

    panel.position.set(
      ...panelPositions[index]
    );

    rig.add(
      panel
    );
  }

  scene.add(
    rig
  );

  let disposed =
    false;

  return {
    group:
      rig,

    hemisphere,

    sunlight,

    ceilingPanelCount:
      panelPositions.length,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        rig
      );

      ceilingGeometry.dispose();
      ceilingMaterial.dispose();

      /*
       * DirectionalLight shadow resources are owned by
       * the light. Dispose the shadow map if it has been
       * allocated.
       */

      sunlight.shadow.dispose();

      renderer.shadowMap.enabled =
        previousShadowState.enabled;

      renderer.shadowMap.type =
        previousShadowState.type;
    }
  };
}

export {
  CLASSROOM_LIGHTING_CONFIG,
  createClassroomLightingV2
};