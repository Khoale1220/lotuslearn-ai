import * as THREE from "three";

const CLASSROOM_OCEAN_VISTA_V16_PROFILE =
  Object.freeze({
    id: "cw06-ocean-vista-v16",
    doorId: "cw06-ocean-door",
    interactionPriority: 100,
    openSpeedPerSecond: 1.7,
    portalTextureWidth: 64,
    portalTextureHeight: 96
  });

const INTERACTION_METHOD_PATTERN =
  /(interaction|interact|raycast|target|mesh|candidate|hit|pick)/i;

const ACTION_METHOD_PATTERN =
  /(interact|activate|toggle|execute|handle|apply)/i;

const CANDIDATE_METHOD_PATTERN =
  /(candidate|resolve|hit|pick|raycast)/i;

const CENTER_NDC =
  new THREE.Vector2(0, 0);

function clamp01(value) {
  return Math.max(
    0,
    Math.min(1, value)
  );
}

function smoothstep(value) {
  const t =
    clamp01(value);

  return (
    t *
    t *
    (3 - 2 * t)
  );
}

function searchableText(object) {
  if (!object) {
    return "";
  }

  const userData =
    object.userData &&
    typeof object.userData === "object"
      ? object.userData
      : {};

  const userDataText =
    Object.entries(userData)
      .filter((entry) => {
        const value =
          entry[1];

        return (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        );
      })
      .map((entry) => {
        return (
          entry[0] +
          " " +
          String(entry[1])
        );
      })
      .join(" ");

  return [
    object.name || "",
    object.type || "",
    userDataText
  ]
    .join(" ")
    .toLowerCase();
}

function scoreDoor(object) {
  if (
    !object ||
    !object.isObject3D
  ) {
    return -1;
  }

  const text =
    searchableText(object);

  if (!text.includes("door")) {
    return -1;
  }

  let score = 10;

  if (
    text.includes("classroom")
  ) {
    score += 10;
  }

  if (
    text.includes("door-v3") ||
    text.includes("door_v3")
  ) {
    score += 10;
  }

  if (object.isMesh) {
    score += 5;
  }

  return score;
}

function findClassroomDoor(scene) {
  let best = null;
  let bestScore = -1;

  scene.traverse((object) => {
    const score =
      scoreDoor(object);

    if (score > bestScore) {
      best = object;
      bestScore = score;
    }
  });

  return best;
}

function createPixelOceanTexture(
  documentObject
) {
  if (
    !documentObject ||
    typeof documentObject.createElement !==
      "function"
  ) {
    return null;
  }

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width =
    CLASSROOM_OCEAN_VISTA_V16_PROFILE
      .portalTextureWidth;

  canvas.height =
    CLASSROOM_OCEAN_VISTA_V16_PROFILE
      .portalTextureHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled =
    false;

  /*
   * VGA SKY
   */
  context.fillStyle = "#74a6c7";
  context.fillRect(0, 0, 64, 42);

  context.fillStyle = "#a8d0db";
  context.fillRect(0, 29, 64, 13);

  /*
   * PIXEL SUN
   */
  context.fillStyle = "#f5d272";
  context.fillRect(49, 8, 7, 7);

  context.fillStyle = "#fff0a8";
  context.fillRect(51, 10, 3, 3);

  /*
   * HORIZON
   */
  context.fillStyle = "#dbe9e8";
  context.fillRect(0, 42, 64, 2);

  /*
   * OCEAN DEPTH BANDS
   */
  context.fillStyle = "#3b7d99";
  context.fillRect(0, 44, 64, 11);

  context.fillStyle = "#316b88";
  context.fillRect(0, 55, 64, 15);

  context.fillStyle = "#275a76";
  context.fillRect(0, 70, 64, 26);

  /*
   * GLINTS
   */
  context.fillStyle = "#a9dce0";

  for (
    let y = 48;
    y < 94;
    y += 8
  ) {
    const offset =
      y % 16 === 0
        ? 3
        : 10;

    for (
      let x = offset;
      x < 64;
      x += 18
    ) {
      context.fillRect(
        x,
        y,
        7,
        2
      );
    }
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.name =
    "cw06-v16-ocean-door-vista";

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy =
    1;

  texture.wrapS =
    THREE.RepeatWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate =
    true;

  return texture;
}

function readDoorBounds(door) {
  const box =
    new THREE.Box3()
      .setFromObject(door);

  if (box.isEmpty()) {
    return null;
  }

  const center =
    box.getCenter(
      new THREE.Vector3()
    );

  const size =
    box.getSize(
      new THREE.Vector3()
    );

  return {
    center,
    size
  };
}

function containsDoorReference(
  value,
  hitProxy,
  depth = 0
) {
  if (depth > 4) {
    return false;
  }

  if (value === hitProxy) {
    return true;
  }

  if (
    typeof value === "string"
  ) {
    return (
      value.toLowerCase() ===
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .doorId
    );
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  if (
    value.userData &&
    value.userData.oceanVistaDoor
  ) {
    return true;
  }

  const keys = [
    "object",
    "target",
    "mesh",
    "candidate",
    "hit",
    "id",
    "targetId",
    "shadeId",
    "windowShadeId"
  ];

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key
      ) &&
      containsDoorReference(
        value[key],
        hitProxy,
        depth + 1
      )
    ) {
      return true;
    }
  }

  return false;
}

function appendUnique(
  array,
  value
) {
  if (
    !Array.isArray(array) ||
    !value ||
    array.includes(value)
  ) {
    return array;
  }

  return [
    ...array,
    value
  ];
}

function findRaycaster(args) {
  for (const arg of args) {
    if (
      arg &&
      arg.isRaycaster
    ) {
      return arg;
    }

    if (
      arg &&
      arg.raycaster &&
      arg.raycaster.isRaycaster
    ) {
      return arg.raycaster;
    }
  }

  return null;
}

function createClassroomOceanVistaV16({
  scene,
  camera,
  windowShadeSystem,
  oceanWorld,
  documentObject =
    typeof document !== "undefined"
      ? document
      : null
}) {
  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "V16 requires THREE.Scene"
    );
  }

  const baseSystem =
    windowShadeSystem &&
    typeof windowShadeSystem === "object"
      ? windowShadeSystem
      : Object.freeze({});

  const door =
    findClassroomDoor(scene);

  /*
   * No classroom door:
   * become a transparent adapter.
   */
  if (!door) {
    return Object.freeze({
      windowShadeSystem:
        baseSystem,

      tick() {},

      getSnapshot() {
        return Object.freeze({
          id:
            CLASSROOM_OCEAN_VISTA_V16_PROFILE.id,
          doorFound: false,
          openRatio: 0,
          targetOpen: false,
          oceanWorldLinked:
            Boolean(oceanWorld)
        });
      },

      dispose() {}
    });
  }

  door.updateMatrixWorld(true);

  const bounds =
    readDoorBounds(door);

  if (!bounds) {
    throw new Error(
      "V16 could not compute classroom door bounds"
    );
  }

  const thinOnZ =
    bounds.size.z <=
    bounds.size.x;

  const width =
    Math.max(
      0.9,
      thinOnZ
        ? bounds.size.x
        : bounds.size.z
    );

  const height =
    Math.max(
      1.8,
      bounds.size.y
    );

  /*
   * ---------------------------------------------------
   * INTERACTION HIT PROXY
   * layer 0 = existing gameplay interaction layer.
   * ---------------------------------------------------
   */

  const hitGeometry =
    thinOnZ
      ? new THREE.BoxGeometry(
          width,
          height,
          0.22
        )
      : new THREE.BoxGeometry(
          0.22,
          height,
          width
        );

  const hitMaterial =
    new THREE.MeshBasicMaterial({
      side:
        THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

  hitMaterial.colorWrite =
    false;

  const hitProxy =
    new THREE.Mesh(
      hitGeometry,
      hitMaterial
    );

  hitProxy.name =
    "cw06-v16-ocean-door-interaction";

  hitProxy.position.copy(
    bounds.center
  );

  hitProxy.layers.set(0);

  hitProxy.userData = {
    oceanVistaDoor: true,

    id:
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .doorId,

    targetId:
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .doorId,

    shadeId:
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .doorId,

    windowShadeId:
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .doorId,

    interactionType:
      "window_shade",

    targetType:
      "windowShade",

    displayLabel:
      "Ocean Door",

    prompt:
      "E  OPEN / CLOSE OCEAN DOOR"
  };

  scene.add(hitProxy);

  /*
   * ---------------------------------------------------
   * VISUAL PORTAL
   * Explicitly excluded from interaction raycast.
   * ---------------------------------------------------
   */

  const texture =
    createPixelOceanTexture(
      documentObject
    );

  const portalGeometry =
    new THREE.PlaneGeometry(
      width * 0.94,
      height * 0.94
    );

  const portalMaterial =
    new THREE.MeshBasicMaterial({
      map: texture,
      color:
        texture
          ? 0xffffff
          : 0x34728d,
      side:
        THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false
    });

  const portal =
    new THREE.Mesh(
      portalGeometry,
      portalMaterial
    );

  portal.name =
    "cw06-v16-ocean-door-portal";

  portal.position.copy(
    bounds.center
  );

  if (!thinOnZ) {
    portal.rotation.y =
      Math.PI * 0.5;
  }

  const normalAxis =
    thinOnZ
      ? "z"
      : "x";

  portal.position[normalAxis] +=
    0.025;

  portal.visible =
    false;

  portal.renderOrder =
    20;

  /*
   * Visual only:
   * V11 must never select this mesh.
   */
  portal.raycast =
    function noOceanPortalRaycast() {};

  scene.add(portal);

  /*
   * ---------------------------------------------------
   * DOOR MOTION
   * ---------------------------------------------------
   */

  const closedPosition =
    door.position.clone();

  const slideAxis =
    thinOnZ
      ? "x"
      : "z";

  const slideDirection =
    bounds.center[slideAxis] >= 0
      ? 1
      : -1;

  const slideDistance =
    width * 1.08;

  let targetOpen = false;
  let openRatio = 0;
  let disposed = false;

  const internalRaycaster =
    new THREE.Raycaster();

  internalRaycaster.layers.set(0);

  function toggleDoor() {
    if (disposed) {
      return false;
    }

    targetOpen =
      !targetOpen;

    return true;
  }

  function findDoorHit(args) {
    let raycaster =
      findRaycaster(args);

    if (
      !raycaster &&
      camera &&
      camera.isCamera
    ) {
      internalRaycaster.setFromCamera(
        CENTER_NDC,
        camera
      );

      raycaster =
        internalRaycaster;
    }

    if (!raycaster) {
      return null;
    }

    const hits =
      raycaster.intersectObject(
        hitProxy,
        false
      );

    return hits.length > 0
      ? hits[0]
      : null;
  }

  function makeDoorCandidate(
    hit,
    template
  ) {
    const base =
      template &&
      typeof template === "object" &&
      !Array.isArray(template)
        ? {
            ...template
          }
        : {};

    return {
      ...base,

      id:
        CLASSROOM_OCEAN_VISTA_V16_PROFILE
          .doorId,

      targetId:
        CLASSROOM_OCEAN_VISTA_V16_PROFILE
          .doorId,

      provider:
        "windowShadeSystem",

      interactionType:
        "window_shade",

      actionType:
        "toggle",

      priority:
        Number.isFinite(
          base.priority
        )
          ? base.priority
          : CLASSROOM_OCEAN_VISTA_V16_PROFILE
              .interactionPriority,

      distance:
        hit &&
        Number.isFinite(hit.distance)
          ? hit.distance
          : Number.POSITIVE_INFINITY,

      object:
        hitProxy,

      target:
        hitProxy,

      mesh:
        hitProxy,

      hit:
        hit || null,

      interact:
        toggleDoor,

      activate:
        toggleDoor,

      execute:
        toggleDoor
    };
  }

  function augmentObjectArrays(result) {
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return result;
    }

    const keys = [
      "targets",
      "meshes",
      "objects",
      "interactionTargets",
      "interactiveMeshes",
      "raycastTargets"
    ];

    let changed = false;

    const clone = {
      ...result
    };

    for (const key of keys) {
      if (
        Array.isArray(result[key])
      ) {
        clone[key] =
          appendUnique(
            result[key],
            hitProxy
          );

        changed = true;
      }
    }

    return changed
      ? clone
      : result;
  }

  /*
   * ---------------------------------------------------
   * COMPOSITE ADAPTER
   *
   * The adapter owns no keyboard listener.
   * Existing V11 still arbitrates E.
   * ---------------------------------------------------
   */

  const composite =
    new Proxy(
      baseSystem,
      {
        get(
          target,
          property
        ) {
          if (
            property ===
            "__oceanVistaV16"
          ) {
            return true;
          }

          const value =
            Reflect.get(
              target,
              property,
              target
            );

          const name =
            String(property);

          if (
            Array.isArray(value) &&
            INTERACTION_METHOD_PATTERN.test(
              name
            )
          ) {
            return appendUnique(
              value,
              hitProxy
            );
          }

          if (
            typeof value !==
            "function"
          ) {
            return value;
          }

          return function v16CompositeMethod(
            ...args
          ) {
            /*
             * Existing V11 action reaches the
             * V16 target through the normal
             * window-shade provider.
             */
            if (
              ACTION_METHOD_PATTERN.test(
                name
              ) &&
              args.some((arg) =>
                containsDoorReference(
                  arg,
                  hitProxy
                )
              )
            ) {
              return toggleDoor();
            }

            const result =
              value.apply(
                target,
                args
              );

            /*
             * Most provider APIs expose an
             * interaction mesh collection.
             */
            if (
              Array.isArray(result) &&
              INTERACTION_METHOD_PATTERN.test(
                name
              )
            ) {
              return appendUnique(
                result,
                hitProxy
              );
            }

            /*
             * Candidate APIs:
             * compare existing target with the
             * ocean-door center ray.
             */
            if (
              CANDIDATE_METHOD_PATTERN.test(
                name
              )
            ) {
              const doorHit =
                findDoorHit(args);

              if (doorHit) {
                if (
                  result === null ||
                  typeof result ===
                    "undefined"
                ) {
                  return makeDoorCandidate(
                    doorHit,
                    null
                  );
                }

                if (
                  result &&
                  typeof result === "object" &&
                  !Array.isArray(result)
                ) {
                  const existingDistance =
                    Number.isFinite(
                      result.distance
                    )
                      ? result.distance
                      : Number.POSITIVE_INFINITY;

                  if (
                    doorHit.distance <
                    existingDistance
                  ) {
                    return makeDoorCandidate(
                      doorHit,
                      result
                    );
                  }
                }
              }
            }

            return augmentObjectArrays(
              result
            );
          };
        }
      }
    );

  function tick(input) {
    if (disposed) {
      return;
    }

    const deltaSeconds =
      input &&
      Number.isFinite(
        input.deltaSeconds
      )
        ? Math.min(
            0.1,
            Math.max(
              0,
              input.deltaSeconds
            )
          )
        : 0;

    const destination =
      targetOpen
        ? 1
        : 0;

    const difference =
      destination -
      openRatio;

    const maxStep =
      deltaSeconds *
      CLASSROOM_OCEAN_VISTA_V16_PROFILE
        .openSpeedPerSecond;

    if (
      Math.abs(difference) <=
      maxStep
    ) {
      openRatio =
        destination;
    } else if (
      maxStep > 0
    ) {
      openRatio +=
        Math.sign(difference) *
        maxStep;
    }

    openRatio =
      clamp01(openRatio);

    const eased =
      smoothstep(openRatio);

    door.position[slideAxis] =
      closedPosition[slideAxis] +
      slideDirection *
        slideDistance *
        eased;

    door.updateMatrix();
    door.updateMatrixWorld(true);

    portal.visible =
      openRatio > 0.005;

    portalMaterial.opacity =
      clamp01(
        openRatio * 1.15
      );

    if (texture) {
      texture.offset.x =
        (
          texture.offset.x +
          deltaSeconds * 0.007
        ) % 1;
    }
  }

  function getSnapshot() {
    let oceanSnapshot = null;

    if (
      oceanWorld &&
      typeof oceanWorld.getSnapshot ===
        "function"
    ) {
      try {
        oceanSnapshot =
          oceanWorld.getSnapshot();
      } catch {
        oceanSnapshot =
          null;
      }
    }

    return Object.freeze({
      id:
        CLASSROOM_OCEAN_VISTA_V16_PROFILE
          .id,

      doorFound: true,

      doorName:
        door.name || null,

      targetOpen,

      openRatio,

      portalVisible:
        portal.visible,

      oceanWorldLinked:
        Boolean(oceanWorld),

      oceanSnapshot
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    door.position.copy(
      closedPosition
    );

    door.updateMatrix();
    door.updateMatrixWorld(true);

    scene.remove(hitProxy);
    scene.remove(portal);

    hitGeometry.dispose();
    hitMaterial.dispose();

    portalGeometry.dispose();
    portalMaterial.dispose();

    if (texture) {
      texture.dispose();
    }
  }

  return Object.freeze({
    windowShadeSystem:
      composite,

    tick,

    getSnapshot,

    dispose
  });
}

export {
  CLASSROOM_OCEAN_VISTA_V16_PROFILE,
  createClassroomOceanVistaV16
};
