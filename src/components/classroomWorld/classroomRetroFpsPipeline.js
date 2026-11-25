import * as THREE from "three";

const RETRO_FPS_PROFILE =
  Object.freeze({
    name:
      "lotuslearn-retro-fps",

    internalHeight:
      240,

    minimumInternalWidth:
      320,

    maximumInternalWidth:
      640,

    pixelRatio:
      1,

    textureFilter:
      "nearest",

    mipmaps:
      false,

    anisotropy:
      1,

    shadowStyle:
      "hard",

    hudStyle:
      "dos-fps"
  });

const RETRO_TEACHER_INTERVENTION_UI_EVENT =
  "lotuslearn:teacher-intervention-ui";

const TEXTURE_PROPERTIES =
  Object.freeze([
    "map",
    "alphaMap",
    "aoMap",
    "lightMap",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap"
  ]);

function evenInteger(
  value
) {
  return Math.max(
    2,
    Math.round(
      value / 2
    ) * 2
  );
}

function computeRetroRenderSize({
  displayWidth,
  displayHeight,
  internalHeight =
    RETRO_FPS_PROFILE
      .internalHeight
}) {
  if (
    !Number.isFinite(displayWidth) ||
    !Number.isFinite(displayHeight) ||
    displayWidth <= 0 ||
    displayHeight <= 0
  ) {
    throw new RangeError(
      "display dimensions must be positive"
    );
  }

  const aspect =
    displayWidth /
    displayHeight;

  let height =
    evenInteger(
      internalHeight
    );

  let width =
    evenInteger(
      height *
      aspect
    );

  if (
    width <
    RETRO_FPS_PROFILE
      .minimumInternalWidth
  ) {
    width =
      RETRO_FPS_PROFILE
        .minimumInternalWidth;

    height =
      evenInteger(
        width /
        aspect
      );
  }

  if (
    width >
    RETRO_FPS_PROFILE
      .maximumInternalWidth
  ) {
    width =
      RETRO_FPS_PROFILE
        .maximumInternalWidth;

    height =
      evenInteger(
        width /
        aspect
      );
  }

  return {
    width,
    height,
    aspect
  };
}

function applyRetroTextureSampling(
  texture
) {
  if (
    !texture ||
    !texture.isTexture
  ) {
    return texture;
  }

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy =
    1;

  texture.needsUpdate =
    true;

  return texture;
}

function getRetroFpsProfile() {
  return {
    ...RETRO_FPS_PROFILE
  };
}

function computeTeacherToolPose({
  timestamp = 0,
  targeted = false,
  interventionActive = false
}) {
  const phase =
    Number.isFinite(timestamp)
      ? timestamp * 0.007
      : 0;

  const idleBob =
    Math.round(
      Math.sin(phase) * 2
    );

  const targetLift =
    targeted
      ? -9
      : 0;

  const interventionKick =
    interventionActive
      ? -7
      : 0;

  const x =
    interventionActive
      ? 5
      : 0;

  const y =
    idleBob +
    targetLift +
    interventionKick;

  const rotation =
    interventionActive
      ? -2
      : targeted
        ? -1
        : 0;

  return {
    x,
    y,
    rotation
  };
}

function drawTeacherClipboard({
  canvas,
  active
}) {
  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "teacher sprite canvas unavailable"
    );
  }

  context.imageSmoothingEnabled =
    false;

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  /*
   * Clipboard outline.
   */
  context.fillStyle =
    "#3a3328";

  context.fillRect(
    66,
    12,
    78,
    82
  );

  context.fillStyle =
    active
      ? "#d8ae54"
      : "#a67d43";

  context.fillRect(
    70,
    16,
    70,
    76
  );

  /*
   * Paper.
   */
  context.fillStyle =
    "#efe4c2";

  context.fillRect(
    78,
    25,
    54,
    57
  );

  context.fillStyle =
    "#29333a";

  for (
    const y
    of [
      34,
      44,
      54,
      64
    ]
  ) {
    context.fillRect(
      84,
      y,
      40,
      3
    );
  }

  /*
   * Clipboard clip.
   */
  context.fillStyle =
    "#20252b";

  context.fillRect(
    92,
    9,
    27,
    13
  );

  context.fillStyle =
    "#818990";

  context.fillRect(
    97,
    11,
    17,
    6
  );

  /*
   * Teacher hand.
   *
   * Deliberately chunky: no curves, no smoothing.
   */
  context.fillStyle =
    "#594236";

  context.fillRect(
    24,
    59,
    54,
    34
  );

  context.fillRect(
    48,
    46,
    29,
    23
  );

  context.fillStyle =
    "#d4a076";

  context.fillRect(
    28,
    63,
    47,
    29
  );

  context.fillRect(
    52,
    49,
    21,
    18
  );

  /*
   * Sleeve.
   */
  context.fillStyle =
    "#273b53";

  context.fillRect(
    3,
    74,
    35,
    22
  );

  context.fillStyle =
    "#416487";

  context.fillRect(
    8,
    77,
    29,
    15
  );

  if (active) {
    context.fillStyle =
      "#f4cf61";

    context.fillRect(
      133,
      30,
      6,
      32
    );

    context.fillRect(
      120,
      43,
      32,
      6
    );
  }
}

function createClassroomRetroFpsPipeline({
  renderer,
  scene,
  documentObject =
    globalThis.document
}) {
  if (
    !renderer ||
    !renderer.domElement ||
    !renderer.info
  ) {
    throw new TypeError(
      "renderer is required"
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

  if (
    !documentObject ||
    typeof documentObject
      .createElement !==
      "function"
  ) {
    throw new TypeError(
      "documentObject.createElement is required"
    );
  }

  const canvas =
    renderer.domElement;

  const parent =
    canvas.parentElement ??
    documentObject.body;

  if (!parent) {
    throw new Error(
      "retro FPS overlay parent unavailable"
    );
  }

  const rendererState = {
    pixelRatio:
      typeof renderer
        .getPixelRatio ===
        "function"
        ? renderer.getPixelRatio()
        : 1,

    shadowType:
      renderer.shadowMap
        ?.type,

    canvasImageRendering:
      canvas.style
        .imageRendering,

    canvasWidth:
      canvas.style.width,

    canvasHeight:
      canvas.style.height,

    parentPosition:
      parent.style
        ?.position ?? ""
  };

  /*
   * Pixel ratio must be reset before setSize is wrapped,
   * because setPixelRatio itself can trigger a resize.
   */
  if (
    typeof renderer
      .setPixelRatio ===
      "function"
  ) {
    renderer.setPixelRatio(
      RETRO_FPS_PROFILE
        .pixelRatio
    );
  }

  const originalSetSize =
    renderer.setSize;

  const nativeSetSize =
    renderer.setSize.bind(
      renderer
    );

  if (renderer.shadowMap) {
    renderer.shadowMap.type =
      THREE.BasicShadowMap;
  }

  /*
   * CW08.3B:
   * Retro FPS owns presentation scaling,
   * not global renderer tone mapping.
   */

  canvas.style.imageRendering =
    "pixelated";

  canvas.style.imageRendering =
    "crisp-edges";

  canvas.style.imageRendering =
    "pixelated";

  const textureStates =
    new Map();

  const materialStates =
    new Map();

  function captureTexture(
    texture
  ) {
    if (
      !texture?.isTexture ||
      textureStates.has(
        texture.uuid
      )
    ) {
      return;
    }

    textureStates.set(
      texture.uuid,
      {
        texture,

        magFilter:
          texture.magFilter,

        minFilter:
          texture.minFilter,

        generateMipmaps:
          texture.generateMipmaps,

        anisotropy:
          texture.anisotropy
      }
    );

    applyRetroTextureSampling(
      texture
    );
  }

  function captureMaterial(
    material
  ) {
    if (
      !material ||
      materialStates.has(
        material.uuid
      )
    ) {
      return;
    }

    const state = {
      material,

      flatShading:
        material.flatShading,

      roughness:
        material.roughness,

      metalness:
        material.metalness,

      transmission:
        material.transmission,

      clearcoat:
        material.clearcoat,

      clearcoatRoughness:
        material
          .clearcoatRoughness
    };

    materialStates.set(
      material.uuid,
      state
    );

    for (
      const property
      of TEXTURE_PROPERTIES
    ) {
      captureTexture(
        material[property]
      );
    }

    if (
      "flatShading" in
      material
    ) {
      material.flatShading =
        true;
    }

    if (
      typeof material
        .roughness ===
      "number"
    ) {
      material.roughness =
        Math.max(
          0.84,
          material.roughness
        );
    }

    if (
      typeof material
        .metalness ===
      "number"
    ) {
      material.metalness =
        Math.min(
          0.08,
          material.metalness
        );
    }

    if (
      typeof material
        .transmission ===
      "number"
    ) {
      material.transmission =
        0;
    }

    if (
      typeof material
        .clearcoat ===
      "number"
    ) {
      material.clearcoat =
        0;
    }

    material.needsUpdate =
      true;
  }

  function refreshSceneMaterials() {
    scene.traverse(
      (object) => {
        if (
          !object.material
        ) {
          return;
        }

        if (
          Array.isArray(
            object.material
          )
        ) {
          for (
            const material
            of object.material
          ) {
            captureMaterial(
              material
            );
          }

          return;
        }

        captureMaterial(
          object.material
        );
      }
    );
  }

  refreshSceneMaterials();

  let lastDisplaySize = {
    width: 0,
    height: 0
  };

  let lastInternalSize = {
    width: 0,
    height: 0
  };

  function resize({
    displayWidth,
    displayHeight
  }) {
    const retroSize =
      computeRetroRenderSize({
        displayWidth,
        displayHeight
      });

    /*
     * Drawing buffer becomes intentionally low-res.
     * CSS canvas remains at layout resolution.
     */
    nativeSetSize(
      retroSize.width,
      retroSize.height,
      false
    );

    canvas.style.width =
      `${Math.round(
        displayWidth
      )}px`;

    canvas.style.height =
      `${Math.round(
        displayHeight
      )}px`;

    lastDisplaySize = {
      width:
        displayWidth,

      height:
        displayHeight
    };

    lastInternalSize = {
      width:
        retroSize.width,

      height:
        retroSize.height
    };

    return {
      ...retroSize
    };
  }

  /*
   * Existing ClassroomWorld resize code remains the
   * owner of camera aspect.
   *
   * Only renderer.setSize behavior is intercepted.
   */
  renderer.setSize =
    function retroSetSize(
      width,
      height
    ) {
      resize({
        displayWidth:
          width,

        displayHeight:
          height
      });

      return renderer;
    };

  /*
   * Apply initial size immediately.
   */
  const initialWidth =
    canvas.clientWidth ||
    parent.clientWidth ||
    960;

  const initialHeight =
    canvas.clientHeight ||
    parent.clientHeight ||
    540;

  resize({
    displayWidth:
      initialWidth,

    displayHeight:
      initialHeight
  });

  /*
   * ==================================================
   * RETRO HUD
   * ==================================================
   */

  if (
    parent.style &&
    !parent.style.position
  ) {
    parent.style.position =
      "relative";
  }

  const overlay =
    documentObject.createElement(
      "div"
    );

  overlay.setAttribute(
    "aria-hidden",
    "true"
  );

  overlay.style.cssText = [
    "position:absolute",
    "inset:0",
    "pointer-events:none",
    "z-index:12",
    "overflow:hidden",
    "font-family:monospace",
    "font-weight:700",
    "image-rendering:pixelated"
  ].join(";");

  const titleBadge =
    documentObject.createElement(
      "div"
    );

  titleBadge.textContent =
    "LOTUSLEARN // CLASSROOM FPS";

  titleBadge.style.cssText = [
    "position:absolute",
    "left:12px",
    "top:12px",
    "padding:5px 8px",
    "font-size:11px",
    "letter-spacing:.05em",
    "color:#f4d863",
    "background:#171b20",
    "border:2px solid #d3b74e",
    "box-shadow:2px 2px 0 #08090a"
  ].join(";");

  const statusBadge =
    documentObject.createElement(
      "div"
    );

  statusBadge.textContent =
    "READY";

  statusBadge.style.cssText = [
    "position:absolute",
    "right:12px",
    "top:12px",
    "min-width:116px",
    "padding:5px 8px",
    "font-size:11px",
    "text-align:center",
    "letter-spacing:.04em",
    "color:#dce7cf",
    "background:#17271f",
    "border:2px solid #7ea56e",
    "box-shadow:2px 2px 0 #08090a"
  ].join(";");

  const hud =
    documentObject.createElement(
      "div"
    );

  hud.style.cssText = [
    "position:absolute",
    "left:0",
    "right:0",
    "bottom:0",
    "height:50px",
    "display:grid",
    "grid-template-columns:150px 1fr 220px",
    "align-items:stretch",
    "background:#132a48",
    "border-top:4px solid #e2d36d",
    "box-shadow:0 -3px 0 #080b12",
    "color:#f4e7aa",
    "font-size:11px",
    "line-height:1.15"
  ].join(";");

  function createHudCell() {
    const cell =
      documentObject.createElement(
        "div"
      );

    cell.style.cssText = [
      "display:flex",
      "align-items:center",
      "padding:7px 10px",
      "border-right:2px solid #e2d36d",
      "text-shadow:1px 1px 0 #000"
    ].join(";");

    return cell;
  }

  const modeCell =
    createHudCell();

  modeCell.textContent =
    "TEACHER MODE";

  const targetCell =
    createHudCell();

  targetCell.textContent =
    "TARGET: NONE";

  const controlsCell =
    createHudCell();

  controlsCell.style
    .borderRight =
      "0";

  controlsCell.textContent =
    "WASD MOVE  |  MOUSE LOOK";

  hud.appendChild(
    modeCell
  );

  hud.appendChild(
    targetCell
  );

  hud.appendChild(
    controlsCell
  );

  /*
   * First-person teacher sprite.
   */
  const teacherCanvas =
    documentObject.createElement(
      "canvas"
    );

  teacherCanvas.width =
    160;

  teacherCanvas.height =
    96;

  teacherCanvas.style.cssText = [
    "position:absolute",
    "right:14px",
    "bottom:46px",
    "width:176px",
    "height:106px",
    "image-rendering:pixelated",
    "pointer-events:none"
  ].join(";");

  drawTeacherClipboard({
    canvas:
      teacherCanvas,

    active:
      false
  });

  overlay.appendChild(
    titleBadge
  );

  overlay.appendChild(
    statusBadge
  );

  overlay.appendChild(
    teacherCanvas
  );

  overlay.appendChild(
    hud
  );

  parent.appendChild(
    overlay
  );

  let previousTarget =
    null;

  let targetFlashUntil =
    0;

  let interventionFlashUntil =
    0;

  let lastInterventionStudentKey =
    null;

  function nowMilliseconds() {
    return (
      globalThis.performance
        ?.now
        ?.() ??
      Date.now()
    );
  }

  function notifyIntervention(
    studentKey,
    timestamp =
      nowMilliseconds()
  ) {
    lastInterventionStudentKey =
      studentKey
        ? String(studentKey)
        : "STUDENT";

    interventionFlashUntil =
      timestamp +
      900;

    statusBadge.textContent =
      `REQUESTED: ${lastInterventionStudentKey}`;

    statusBadge.style.color =
      "#fff0a8";

    statusBadge.style.background =
      "#5b451a";

    statusBadge.style.borderColor =
      "#f0ca55";
  }

  function onInterventionUiEvent(
    event
  ) {
    notifyIntervention(
      event?.detail
        ?.studentKey ??
      null
    );
  }

  if (
    typeof globalThis
      .addEventListener ===
      "function"
  ) {
    globalThis.addEventListener(
      RETRO_TEACHER_INTERVENTION_UI_EVENT,
      onInterventionUiEvent
    );
  }

  function updateHud({
    targetIdentity,
    controlsLocked,
    timestamp =
      nowMilliseconds()
  }) {
    const normalizedTarget =
      targetIdentity
        ? String(
            targetIdentity
          )
        : null;

    if (
      normalizedTarget !==
      previousTarget
    ) {
      previousTarget =
        normalizedTarget;

      targetFlashUntil =
        timestamp +
        220;

      drawTeacherClipboard({
        canvas:
          teacherCanvas,

        active:
          Boolean(
            normalizedTarget
          )
      });
    }

    const interventionActive =
      timestamp <
      interventionFlashUntil;

    const targetFlashActive =
      timestamp <
      targetFlashUntil;

    const pose =
      computeTeacherToolPose({
        timestamp,
        targeted:
          Boolean(
            normalizedTarget
          ),
        interventionActive
      });

    teacherCanvas.style.transformOrigin =
      "100% 100%";

    teacherCanvas.style.transform =
      (
        `translate(${pose.x}px, ${pose.y}px) ` +
        `rotate(${pose.rotation}deg)`
      );

    targetCell.textContent =
      normalizedTarget
        ? `TARGET: ${normalizedTarget}`
        : "TARGET: NONE";

    targetCell.style.background =
      targetFlashActive
        ? "#66551c"
        : normalizedTarget
          ? "#243d55"
          : "transparent";

    targetCell.style.color =
      targetFlashActive
        ? "#fff0a8"
        : "#f4e7aa";

    controlsCell.textContent =
      controlsLocked
        ? (
            normalizedTarget
              ? "CLICK INSPECT  |  ESC RELEASE"
              : "WASD MOVE  |  MOUSE LOOK"
          )
        : "CLICK VIEW TO ENTER";

    if (
      interventionActive
    ) {
      statusBadge.textContent =
        `REQUESTED: ${
          lastInterventionStudentKey ??
          "STUDENT"
        }`;

      statusBadge.style.color =
        "#fff0a8";

      statusBadge.style.background =
        "#5b451a";

      statusBadge.style.borderColor =
        "#f0ca55";
    }
    else if (
      normalizedTarget
    ) {
      statusBadge.textContent =
        "TARGET LOCK";

      statusBadge.style.color =
        "#d7ebff";

      statusBadge.style.background =
        "#20394d";

      statusBadge.style.borderColor =
        "#6e9ab6";
    }
    else {
      statusBadge.textContent =
        "READY";

      statusBadge.style.color =
        "#dce7cf";

      statusBadge.style.background =
        "#17271f";

      statusBadge.style.borderColor =
        "#7ea56e";
    }
  }

  let disposed =
    false;

  return {
    profile:
      getRetroFpsProfile(),

    resize,

    refreshSceneMaterials,

    updateHud,

    getInternalSize() {
      return {
        ...lastInternalSize
      };
    },

    getDisplaySize() {
      return {
        ...lastDisplaySize
      };
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      /*
       * Restore renderer method before pixel ratio.
       */
      renderer.setSize =
        originalSetSize;

      if (
        typeof renderer
          .setPixelRatio ===
          "function"
      ) {
        renderer.setPixelRatio(
          rendererState
            .pixelRatio
        );
      }

      if (renderer.shadowMap) {
        renderer.shadowMap.type =
          rendererState
            .shadowType;
      }

      /*
       * CW08.3B:
       * No tone-mapping authority was acquired,
       * therefore nothing is restored here.
       */

      canvas.style.imageRendering =
        rendererState
          .canvasImageRendering;

      canvas.style.width =
        rendererState
          .canvasWidth;

      canvas.style.height =
        rendererState
          .canvasHeight;

      for (
        const state
        of textureStates.values()
      ) {
        state.texture.magFilter =
          state.magFilter;

        state.texture.minFilter =
          state.minFilter;

        state.texture.generateMipmaps =
          state.generateMipmaps;

        state.texture.anisotropy =
          state.anisotropy;

        state.texture.needsUpdate =
          true;
      }

      for (
        const state
        of materialStates.values()
      ) {
        const material =
          state.material;

        if (
          "flatShading" in
          material
        ) {
          material.flatShading =
            state.flatShading;
        }

        if (
          typeof state
            .roughness ===
          "number"
        ) {
          material.roughness =
            state.roughness;
        }

        if (
          typeof state
            .metalness ===
          "number"
        ) {
          material.metalness =
            state.metalness;
        }

        if (
          typeof state
            .transmission ===
          "number"
        ) {
          material.transmission =
            state.transmission;
        }

        if (
          typeof state
            .clearcoat ===
          "number"
        ) {
          material.clearcoat =
            state.clearcoat;
        }

        if (
          typeof state
            .clearcoatRoughness ===
          "number"
        ) {
          material.clearcoatRoughness =
            state.clearcoatRoughness;
        }

        material.needsUpdate =
          true;
      }

      if (
        typeof globalThis
          .removeEventListener ===
          "function"
      ) {
        globalThis.removeEventListener(
          RETRO_TEACHER_INTERVENTION_UI_EVENT,
          onInterventionUiEvent
        );
      }

      if (
        overlay.parentElement
      ) {
        overlay.parentElement
          .removeChild(
            overlay
          );
      }

      if (parent.style) {
        parent.style.position =
          rendererState
            .parentPosition;
      }
    }
  };
}

export {
  RETRO_FPS_PROFILE,
  RETRO_TEACHER_INTERVENTION_UI_EVENT,
  applyRetroTextureSampling,
  computeRetroRenderSize,
  computeTeacherToolPose,
  createClassroomRetroFpsPipeline,
  getRetroFpsProfile
};