import * as THREE from "three";

const STUDENT_ID_KEYS =
  Object.freeze([
    "studentKey",
    "studentId",
    "student_id",
    "learnerKey",
    "learnerId"
  ]);

function normalizeIdentity(
  value
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function resolveStudentTargetFromObject(
  object
) {
  let current =
    object;

  let depth =
    0;

  while (
    current &&
    !current.isScene &&
    depth < 10
  ) {
    if (
      current.userData
        ?.studentVisualV2Decoration ||
      current.userData
        ?.environmentDetailV2 ||
      current.userData
        ?.exteriorDepthV2
    ) {
      return null;
    }

    const userData =
      current.userData ?? {};

    for (
      const key
      of STUDENT_ID_KEYS
    ) {
      const identity =
        normalizeIdentity(
          userData[key]
        );

      if (identity) {
        return {
          identity,
          anchor:
            current
        };
      }
    }

    for (
      const nestedKey
      of [
        "student",
        "studentData",
        "runtimeStudent",
        "learner",
        "profile",
        "record"
      ]
    ) {
      const nested =
        userData[nestedKey];

      if (
        nested &&
        typeof nested ===
          "object"
      ) {
        for (
          const key
          of [
            ...STUDENT_ID_KEYS,
            "key",
            "id"
          ]
        ) {
          const identity =
            normalizeIdentity(
              nested[key]
            );

          if (identity) {
            return {
              identity,
              anchor:
                current
            };
          }
        }
      }
    }

    const name =
      typeof current.name ===
      "string"
        ? current.name.trim()
        : "";

    if (
      /^student(?:[-_:]|$)/iu
        .test(name)
    ) {
      return {
        identity:
          name,

        anchor:
          current
      };
    }

    current =
      current.parent;

    depth += 1;
  }

  return null;
}

function disableRaycast() {}

function createClassroomInteractionFeedbackV2({
  renderer,
  scene,
  documentObject =
    globalThis.document
}) {
  if (
    !renderer ||
    !renderer.domElement
  ) {
    throw new TypeError(
      "renderer.domElement is required"
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

  const indicatorGeometry =
    new THREE.RingGeometry(
      0.14,
      0.22,
      8
    );

  const indicatorMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0xf2cf66,

      transparent:
        true,

      opacity:
        0.94,

      depthWrite:
        false,

      depthTest:
        true,

      side:
        THREE.DoubleSide,

      toneMapped:
        false
    });

  const indicator =
    new THREE.Mesh(
      indicatorGeometry,
      indicatorMaterial
    );

  indicator.name =
    "student-target-indicator-v2";

  indicator.visible =
    false;

  indicator.renderOrder =
    20;

  indicator.raycast =
    disableRaycast;

  indicator.userData
    .studentVisualV2Decoration =
      true;

  scene.add(
    indicator
  );

  const parent =
    renderer.domElement
      .parentElement ??
    documentObject.body;

  if (!parent) {
    throw new Error(
      "renderer overlay parent unavailable"
    );
  }

  const previousParentPosition =
    parent.style?.position ?? "";

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
    "z-index:6",
    "font-family:monospace",
    "image-rendering:pixelated"
  ].join(";");

  const crosshair =
    documentObject.createElement(
      "div"
    );

  crosshair.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    "width:14px",
    "height:14px",
    "transform:translate(-50%,-50%)",
    "transition:transform 80ms linear,filter 80ms linear"
  ].join(";");

  const horizontal =
    documentObject.createElement(
      "div"
    );

  horizontal.style.cssText = [
    "position:absolute",
    "left:0",
    "top:6px",
    "width:14px",
    "height:2px",
    "background:#f4e6bd",
    "box-shadow:0 0 0 1px #263238"
  ].join(";");

  const vertical =
    documentObject.createElement(
      "div"
    );

  vertical.style.cssText = [
    "position:absolute",
    "left:6px",
    "top:0",
    "width:2px",
    "height:14px",
    "background:#f4e6bd",
    "box-shadow:0 0 0 1px #263238"
  ].join(";");

  const hint =
    documentObject.createElement(
      "div"
    );

  hint.textContent =
    "WASD MOVE  •  MOUSE LOOK";

  hint.style.cssText = [
    "position:absolute",
    "left:50%",
    "bottom:18px",
    "transform:translateX(-50%)",
    "padding:5px 8px",
    "font-size:10px",
    "line-height:1",
    "letter-spacing:.06em",
    "color:#f4e6bd",
    "background:rgba(28,36,38,.82)",
    "border:2px solid rgba(244,230,189,.8)",
    "box-shadow:2px 2px 0 rgba(0,0,0,.35)",
    "white-space:nowrap"
  ].join(";");

  crosshair.appendChild(
    horizontal
  );

  crosshair.appendChild(
    vertical
  );

  overlay.appendChild(
    crosshair
  );

  overlay.appendChild(
    hint
  );

  parent.appendChild(
    overlay
  );

  const targetBox =
    new THREE.Box3();

  const targetCenter =
    new THREE.Vector3();

  let frame =
    0;

  let currentIdentity =
    null;

  let disposed =
    false;

  function clearTarget() {
    currentIdentity =
      null;

    indicator.visible =
      false;

    crosshair.style.transform =
      "translate(-50%,-50%) scale(1)";

    crosshair.style.filter =
      "none";

    hint.textContent =
      "WASD MOVE  •  MOUSE LOOK";
  }

  function update({
    raycaster,
    scene:
      activeScene,
    camera,
    controlsLocked
  }) {
    if (disposed) {
      return {
        hasTarget: false,
        identity: null
      };
    }

    if (
      !controlsLocked ||
      !raycaster ||
      !camera
    ) {
      clearTarget();

      return {
        hasTarget: false,
        identity: null
      };
    }

    frame += 1;

    if (
      frame % 2 === 0 &&
      currentIdentity
    ) {
      indicator.quaternion.copy(
        camera.quaternion
      );

      return {
        hasTarget: true,
        identity:
          currentIdentity
      };
    }

    const intersections =
      raycaster.intersectObjects(
        activeScene.children,
        true
      );

    let resolved =
      null;

    for (
      const intersection
      of intersections
    ) {
      const candidate =
        resolveStudentTargetFromObject(
          intersection.object
        );

      if (candidate) {
        resolved =
          candidate;

        break;
      }
    }

    if (!resolved) {
      clearTarget();

      return {
        hasTarget: false,
        identity: null
      };
    }

    currentIdentity =
      resolved.identity;

    targetBox.setFromObject(
      resolved.anchor
    );

    if (targetBox.isEmpty()) {
      clearTarget();

      return {
        hasTarget: false,
        identity: null
      };
    }

    targetBox.getCenter(
      targetCenter
    );

    indicator.position.set(
      targetCenter.x,
      targetBox.max.y + 0.24,
      targetCenter.z
    );

    indicator.quaternion.copy(
      camera.quaternion
    );

    indicator.visible =
      true;

    crosshair.style.transform =
      "translate(-50%,-50%) scale(1.28)";

    crosshair.style.filter =
      "drop-shadow(0 0 3px #f2cf66)";

    hint.textContent =
      "STUDENT TARGET  •  CLICK TO INSPECT";

    return {
      hasTarget: true,
      identity:
        currentIdentity
    };
  }

  return {
    update,

    getCurrentIdentity() {
      return currentIdentity;
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        indicator
      );

      indicatorGeometry.dispose();
      indicatorMaterial.dispose();

      if (
        overlay.parentElement
      ) {
        overlay.parentElement.removeChild(
          overlay
        );
      }

      if (parent.style) {
        parent.style.position =
          previousParentPosition;
      }
    }
  };
}

export {
  createClassroomInteractionFeedbackV2,
  resolveStudentTargetFromObject
};