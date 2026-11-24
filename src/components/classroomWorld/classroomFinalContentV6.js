import * as THREE from "three";

const WINDOW_SHADE_V6_PROFILE =
  Object.freeze({
    desiredShadeCount: 3,
    initialOpenFraction: 0.38,
    movementSpeedPerSecond: 1.25,
    minimumVisibleFraction: 0.08,
    interactionDistance: 4.5,
    interiorOffset: 0.035,
    promptBottomPixels: 54
  });

function clamp01(value) {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

function advanceWindowShadeFraction({
  current,
  target,
  deltaSeconds,
  speed =
    WINDOW_SHADE_V6_PROFILE
      .movementSpeedPerSecond
}) {
  const safeCurrent =
    clamp01(
      current
    );

  const safeTarget =
    clamp01(
      target
    );

  const safeDelta =
    Number.isFinite(
      deltaSeconds
    )
      ? Math.max(
          0,
          deltaSeconds
        )
      : 0;

  const safeSpeed =
    Number.isFinite(
      speed
    )
      ? Math.max(
          0,
          speed
        )
      : 0;

  const distance =
    safeTarget -
    safeCurrent;

  const maximumStep =
    safeSpeed *
    safeDelta;

  if (
    Math.abs(
      distance
    ) <=
    maximumStep
  ) {
    return safeTarget;
  }

  return clamp01(
    safeCurrent +
      Math.sign(
        distance
      ) *
      maximumStep
  );
}

function computeWindowShadePose({
  closedHeight,
  openFraction,
  minimumVisibleFraction =
    WINDOW_SHADE_V6_PROFILE
      .minimumVisibleFraction
}) {
  const safeHeight =
    Number.isFinite(
      closedHeight
    )
      ? Math.max(
          0.01,
          closedHeight
        )
      : 1;

  const safeOpenFraction =
    clamp01(
      openFraction
    );

  const safeMinimum =
    Math.min(
      1,
      Math.max(
        0.01,
        Number.isFinite(
          minimumVisibleFraction
        )
          ? minimumVisibleFraction
          : 0.08
      )
    );

  const visibleFraction =
    Math.max(
      safeMinimum,
      1 -
        safeOpenFraction *
        (
          1 -
          safeMinimum
        )
    );

  const visibleHeight =
    safeHeight *
    visibleFraction;

  const topLocalY =
    safeHeight /
    2;

  return {
    visibleFraction,
    visibleHeight,

    fabricCenterLocalY:
      topLocalY -
      visibleHeight /
      2,

    bottomRailLocalY:
      topLocalY -
      visibleHeight
  };
}

function getWindowShadeActionLabel(
  targetOpenFraction
) {
  return clamp01(
    targetOpenFraction
  ) >= 0.5
    ? "CLOSE SHADE"
    : "OPEN SHADE";
}

function materialSemanticText(
  material
) {
  if (!material) {
    return "";
  }

  if (
    Array.isArray(
      material
    )
  ) {
    return material
      .map(
        materialSemanticText
      )
      .join(
        " "
      );
  }

  return [
    material.name ?? "",
    material.type ?? ""
  ]
    .join(
      " "
    )
    .toLowerCase();
}

function objectSemanticText(
  object
) {
  const userDataValues =
    Object.entries(
      object.userData ?? {}
    )
      .flatMap(
        ([key, value]) => {
          if (
            typeof value ===
              "string" ||
            typeof value ===
              "number" ||
            typeof value ===
              "boolean"
          ) {
            return [
              key,
              String(
                value
              )
            ];
          }

          return [
            key
          ];
        }
      );

  return [
    object.name ?? "",
    object.type ?? "",
    materialSemanticText(
      object.material
    ),
    ...userDataValues
  ]
    .join(
      " "
    )
    .toLowerCase();
}

function materialLooksTransparent(
  material
) {
  if (!material) {
    return false;
  }

  if (
    Array.isArray(
      material
    )
  ) {
    return material.some(
      materialLooksTransparent
    );
  }

  return Boolean(
    material.transparent ||
    (
      Number.isFinite(
        material.opacity
      ) &&
      material.opacity <
        0.98
    )
  );
}

function scoreWindowCandidate({
  object,
  size,
  center
}) {
  const semantics =
    objectSemanticText(
      object
    );

  const horizontalMaximum =
    Math.max(
      size.x,
      size.z
    );

  const horizontalMinimum =
    Math.min(
      size.x,
      size.z
    );

  const verticalPlane =
    size.y >= 0.75 &&
    horizontalMaximum >= 0.65 &&
    horizontalMinimum <= 0.4;

  if (!verticalPlane) {
    return -Infinity;
  }

  let score = 0;

  if (
    semantics.includes(
      "window"
    )
  ) {
    score += 120;
  }

  if (
    semantics.includes(
      "glass"
    )
  ) {
    score += 100;
  }

  if (
    semantics.includes(
      "exterior"
    )
  ) {
    score += 30;
  }

  if (
    semantics.includes(
      "frame"
    )
  ) {
    score += 8;
  }

  if (
    materialLooksTransparent(
      object.material
    )
  ) {
    score += 18;
  }

  if (
    center.y >
    1
  ) {
    score += 4;
  }

  if (
    horizontalMaximum >
    1
  ) {
    score += 4;
  }

  return score;
}

function discoverWindowDescriptors({
  scene,
  desiredCount =
    WINDOW_SHADE_V6_PROFILE
      .desiredShadeCount
}) {
  const candidates = [];

  scene.updateMatrixWorld(
    true
  );

  scene.traverse(
    (object) => {
      if (
        !object?.isMesh ||
        !object.geometry
      ) {
        return;
      }

      const bounds =
        new THREE.Box3()
          .setFromObject(
            object
          );

      if (
        bounds.isEmpty()
      ) {
        return;
      }

      const center =
        bounds.getCenter(
          new THREE.Vector3()
        );

      const size =
        bounds.getSize(
          new THREE.Vector3()
        );

      const score =
        scoreWindowCandidate({
          object,
          size,
          center
        });

      if (
        !Number.isFinite(
          score
        ) ||
        score < 18
      ) {
        return;
      }

      const normalAxis =
        size.x >=
        size.z
          ? "z"
          : "x";

      const width =
        normalAxis ===
        "z"
          ? size.x
          : size.z;

      candidates.push({
        sourceObject:
          object,

        center,
        size,
        width,
        height:
          size.y,

        normalAxis,
        score
      });
    }
  );

  candidates.sort(
    (left, right) => {
      if (
        right.score !==
        left.score
      ) {
        return (
          right.score -
          left.score
        );
      }

      return (
        right.width *
          right.height -
        left.width *
          left.height
      );
    }
  );

  const deduplicated = [];

  for (
    const candidate
    of candidates
  ) {
    const duplicate =
      deduplicated.some(
        (existing) => {
          if (
            existing.normalAxis !==
            candidate.normalAxis
          ) {
            return false;
          }

          return (
            existing.center
              .distanceTo(
                candidate.center
              ) <
            0.55
          );
        }
      );

    if (!duplicate) {
      deduplicated.push(
        candidate
      );
    }

    if (
      deduplicated.length >=
      desiredCount
    ) {
      break;
    }
  }

  return deduplicated;
}

function createShadeTexture({
  documentObject
}) {
  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width =
    16;

  canvas.height =
    32;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "window shade canvas context unavailable"
    );
  }

  context.fillStyle =
    "#292820";

  context.fillRect(
    0,
    0,
    16,
    32
  );

  for (
    let y = 0;
    y < 32;
    y += 4
  ) {
    context.fillStyle =
      "#3a382f";

    context.fillRect(
      0,
      y,
      16,
      1
    );

    context.fillStyle =
      "#1c1b18";

    context.fillRect(
      0,
      y + 3,
      16,
      1
    );
  }

  context.fillStyle =
    "rgba(255,255,255,0.05)";

  context.fillRect(
    2,
    0,
    1,
    32
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.name =
    "cw-v6-window-shade-texture";

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.wrapS =
    THREE.ClampToEdgeWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.needsUpdate =
    true;

  return texture;
}

function applyInteractionMetadata({
  object,
  shadeIndex,
  shadeId,
  part
}) {
  Object.assign(
    object.userData,
    {
      interactionType:
        "window-shade",

      shadeIndex,
      shadeId,
      shadePart:
        part
    }
  );
}

function createShadeState({
  descriptor,
  index,
  texture,
  railMaterial,
  scene,
  camera
}) {
  const shadeId =
    `window-shade-${index + 1}`;

  const group =
    new THREE.Group();

  group.name =
    `cw-v6-${shadeId}`;

  Object.assign(
    group.userData,
    {
      interactionType:
        "window-shade",

      shadeIndex:
        index,

      shadeId
    }
  );

  const width =
    Math.max(
      0.6,
      descriptor.width *
        0.92
    );

  const closedHeight =
    Math.max(
      0.65,
      descriptor.height *
        0.92
    );

  group.position.copy(
    descriptor.center
  );

  if (
    descriptor.normalAxis ===
    "z"
  ) {
    const direction =
      Math.sign(
        camera.position.z -
        descriptor.center.z
      ) || 1;

    group.position.z +=
      direction *
      WINDOW_SHADE_V6_PROFILE
        .interiorOffset;
  }
  else {
    const direction =
      Math.sign(
        camera.position.x -
        descriptor.center.x
      ) || 1;

    group.position.x +=
      direction *
      WINDOW_SHADE_V6_PROFILE
        .interiorOffset;

    group.rotation.y =
      Math.PI /
      2;
  }

  const fabricMaterial =
    new THREE.MeshBasicMaterial({
      map:
        texture,

      color:
        0xffffff,

      side:
        THREE.DoubleSide,

      toneMapped:
        false
    });

  fabricMaterial.name =
    `cw-v6-${shadeId}-fabric-material`;

  const fabric =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        1,
        1
      ),
      fabricMaterial
    );

  fabric.name =
    `cw-v6-${shadeId}-fabric`;

  fabric.scale.x =
    width;

  applyInteractionMetadata({
    object:
      fabric,

    shadeIndex:
      index,

    shadeId,
    part:
      "fabric"
  });

  const headRail =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1,
        1,
        1
      ),
      railMaterial
    );

  headRail.name =
    `cw-v6-${shadeId}-headrail`;

  headRail.scale.set(
    width *
      1.04,
    0.055,
    0.055
  );

  headRail.position.y =
    closedHeight /
      2 +
    0.025;

  applyInteractionMetadata({
    object:
      headRail,

    shadeIndex:
      index,

    shadeId,
    part:
      "headrail"
  });

  const bottomRail =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1,
        1,
        1
      ),
      railMaterial
    );

  bottomRail.name =
    `cw-v6-${shadeId}-bottomrail`;

  bottomRail.scale.set(
    width,
    0.04,
    0.04
  );

  applyInteractionMetadata({
    object:
      bottomRail,

    shadeIndex:
      index,

    shadeId,
    part:
      "bottomrail"
  });

  group.add(
    fabric,
    headRail,
    bottomRail
  );

  scene.add(
    group
  );

  const openFraction =
    WINDOW_SHADE_V6_PROFILE
      .initialOpenFraction;

  const state = {
    index,
    shadeId,
    group,
    fabric,
    headRail,
    bottomRail,
    closedHeight,
    openFraction,
    targetOpenFraction:
      openFraction
  };

  return state;
}

function updateShadeVisual(
  state
) {
  const pose =
    computeWindowShadePose({
      closedHeight:
        state.closedHeight,

      openFraction:
        state.openFraction
    });

  state.fabric.scale.y =
    pose.visibleHeight;

  state.fabric.position.y =
    pose.fabricCenterLocalY;

  state.bottomRail.position.y =
    pose.bottomRailLocalY;
}

function createPromptElement({
  host,
  documentObject
}) {
  const prompt =
    documentObject.createElement(
      "div"
    );

  prompt.className =
    "cw-window-shade-prompt";

  prompt.style.cssText = [
    "position:absolute",
    "left:50%",
    `bottom:${WINDOW_SHADE_V6_PROFILE.promptBottomPixels}px`,
    "transform:translateX(-50%)",
    "z-index:9",
    "display:none",
    "min-width:220px",
    "padding:7px 10px",
    "border:2px solid #b7aa72",
    "background:#171812",
    "box-shadow:3px 3px 0 #060706",
    "color:#eee5b8",
    "font:700 11px/1.25 monospace",
    "letter-spacing:.035em",
    "text-align:center",
    "pointer-events:none",
    "image-rendering:pixelated"
  ].join(
    ";"
  );

  host.appendChild(
    prompt
  );

  return prompt;
}

function disposeOwnedGraph(
  root
) {
  const geometries =
    new Set();

  const materials =
    new Set();

  const textures =
    new Set();

  root.traverse(
    (object) => {
      if (
        object.geometry?.dispose
      ) {
        geometries.add(
          object.geometry
        );
      }

      const ownedMaterials =
        Array.isArray(
          object.material
        )
          ? object.material
          : object.material
            ? [
                object.material
              ]
            : [];

      for (
        const material
        of ownedMaterials
      ) {
        materials.add(
          material
        );

        if (
          material.map?.dispose
        ) {
          textures.add(
            material.map
          );
        }
      }
    }
  );

  for (
    const geometry
    of geometries
  ) {
    geometry.dispose();
  }

  for (
    const texture
    of textures
  ) {
    texture.dispose();
  }

  for (
    const material
    of materials
  ) {
    material.dispose();
  }
}

function createClassroomFinalContentV6({
  scene,
  camera,
  host,
  documentObject
}) {
  if (
    !scene ||
    !camera ||
    !host ||
    !documentObject
  ) {
    throw new TypeError(
      "Classroom Final Content V6 requires scene, camera, host, and documentObject"
    );
  }

  const root =
    new THREE.Group();

  root.name =
    "cw-final-content-v6";

  scene.add(
    root
  );

  const shadeTexture =
    createShadeTexture({
      documentObject
    });

  const railMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0x332e24,

      toneMapped:
        false
    });

  railMaterial.name =
    "cw-v6-window-shade-rail-material";

  const descriptors =
    discoverWindowDescriptors({
      scene,

      desiredCount:
        WINDOW_SHADE_V6_PROFILE
          .desiredShadeCount
    });

  const states =
    descriptors.map(
      (
        descriptor,
        index
      ) =>
        createShadeState({
          descriptor,
          index,
          texture:
            shadeTexture,

          railMaterial,
          scene:
            root,
          camera
        })
    );

  for (
    const state
    of states
  ) {
    updateShadeVisual(
      state
    );
  }

  const raycaster =
    new THREE.Raycaster();

  raycaster.near =
    0.05;

  raycaster.far =
    WINDOW_SHADE_V6_PROFILE
      .interactionDistance;

  const centerNdc =
    new THREE.Vector2(
      0,
      0
    );

  const raycastTargets =
    states.flatMap(
      (state) => [
        state.fabric,
        state.headRail,
        state.bottomRail
      ]
    );

  const prompt =
    createPromptElement({
      host,
      documentObject
    });

  let lastTimestamp =
    null;

  let controlsLocked =
    false;

  let activeShadeIndex =
    -1;

  let disposed =
    false;

  function resolveActiveShade(
    activeCamera
  ) {
    if (
      states.length ===
      0
    ) {
      return null;
    }

    raycaster.setFromCamera(
      centerNdc,
      activeCamera
    );

    const intersections =
      raycaster.intersectObjects(
        raycastTargets,
        false
      );

    const intersection =
      intersections.find(
        (candidate) =>
          candidate.distance <=
          WINDOW_SHADE_V6_PROFILE
            .interactionDistance
      );

    if (!intersection) {
      return null;
    }

    const shadeIndex =
      intersection.object
        ?.userData
        ?.shadeIndex;

    if (
      !Number.isInteger(
        shadeIndex
      ) ||
      shadeIndex < 0 ||
      shadeIndex >=
        states.length
    ) {
      return null;
    }

    return states[
      shadeIndex
    ];
  }

  function updatePrompt(
    activeShade
  ) {
    if (
      !controlsLocked ||
      !activeShade
    ) {
      prompt.style.display =
        "none";

      return;
    }

    const action =
      getWindowShadeActionLabel(
        activeShade
          .targetOpenFraction
      );

    const percent =
      Math.round(
        activeShade
          .openFraction *
        100
      );

    prompt.textContent =
      (
        `E - ${action}  |  ` +
        `SHADE ${activeShade.index + 1}/${states.length}  |  ` +
        `${percent}% OPEN`
      );

    prompt.style.display =
      "block";
  }

  function onKeyDown(
    event
  ) {
    if (
      disposed ||
      !controlsLocked ||
      event.code !==
        "KeyE" ||
      event.repeat ||
      activeShadeIndex < 0 ||
      activeShadeIndex >=
        states.length
    ) {
      return;
    }

    const state =
      states[
        activeShadeIndex
      ];

    state.targetOpenFraction =
      state.targetOpenFraction >=
      0.5
        ? 0
        : 1;

    event.preventDefault?.();
  }

  globalThis.addEventListener?.(
    "keydown",
    onKeyDown
  );

  function tick({
    timestamp,
    camera:
      activeCamera =
        camera,
    controlsLocked:
      nextControlsLocked =
        false
  } = {}) {
    if (disposed) {
      return;
    }

    const safeTimestamp =
      Number.isFinite(
        timestamp
      )
        ? timestamp
        : globalThis.performance
            ?.now
            ?.() ??
          Date.now();

    const deltaSeconds =
      lastTimestamp ===
      null
        ? 0
        : Math.min(
            0.05,
            Math.max(
              0,
              (
                safeTimestamp -
                lastTimestamp
              ) /
                1000
            )
          );

    lastTimestamp =
      safeTimestamp;

    controlsLocked =
      Boolean(
        nextControlsLocked
      );

    for (
      const state
      of states
    ) {
      state.openFraction =
        advanceWindowShadeFraction({
          current:
            state.openFraction,

          target:
            state
              .targetOpenFraction,

          deltaSeconds
        });

      updateShadeVisual(
        state
      );
    }

    const activeShade =
      controlsLocked
        ? resolveActiveShade(
            activeCamera
          )
        : null;

    activeShadeIndex =
      activeShade
        ? activeShade.index
        : -1;

    updatePrompt(
      activeShade
    );
  }

  function getDebugState() {
    return {
      discoveredWindowCount:
        descriptors.length,

      installedShadeCount:
        states.length,

      desiredShadeCount:
        WINDOW_SHADE_V6_PROFILE
          .desiredShadeCount,

      activeShadeIndex,

      shades:
        states.map(
          (state) => ({
            shadeId:
              state.shadeId,

            openFraction:
              state.openFraction,

            targetOpenFraction:
              state
                .targetOpenFraction
          })
        )
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    globalThis
      .removeEventListener
      ?.(
        "keydown",
        onKeyDown
      );

    prompt.remove();

    root.removeFromParent();

    disposeOwnedGraph(
      root
    );

    railMaterial.dispose();

    shadeTexture.dispose();
  }

  return {
    tick,
    dispose,
    getDebugState
  };
}

export {
  WINDOW_SHADE_V6_PROFILE,
  advanceWindowShadeFraction,
  computeWindowShadePose,
  createClassroomFinalContentV6,
  getWindowShadeActionLabel
};