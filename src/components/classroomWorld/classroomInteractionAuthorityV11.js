import * as THREE from "three";

const CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE =
  Object.freeze({
    interactionKey:
      "KeyE",

    raycastLayer:
      0,

    maximumDistance:
      3.25,

    studentMaximumDistance:
      3.0,

    windowShadeMaximumDistance:
      3.25,

    distanceTieEpsilon:
      0.04,

    studentPriority:
      200,

    windowShadePriority:
      100,

    authority:
      "CW06_INTERACTION_AUTHORITY_V11",

    centerNdc:
      Object.freeze({
        x: 0,
        y: 0
      })
  });

function finiteDistance(
  value
) {
  return (
    Number.isFinite(
      value
    )
      ? value
      : Number.POSITIVE_INFINITY
  );
}

function descriptorText(
  object
) {
  const values = [
    object?.name
  ];

  const userData =
    object?.userData ??
    {};

  for (
    const value
    of Object.values(
      userData
    )
  ) {
    if (
      typeof value ===
        "string"
    ) {
      values.push(
        value
      );
    }
  }

  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isWindowShadeObject(
  object
) {
  const text =
    descriptorText(
      object
    );

  return (
    /window[-_\s]?shade/u.test(
      text
    ) ||
    /\bshade\b/u.test(
      text
    ) ||
    /\bblind\b/u.test(
      text
    )
  );
}

function addUniqueObject(
  target,
  seen,
  object
) {
  if (
    !object?.isObject3D ||
    seen.has(
      object
    )
  ) {
    return;
  }

  seen.add(
    object
  );

  target.push(
    object
  );
}

function collectStudentInteractionObjects(
  characterVisualIntegration
) {
  const objects = [];
  const seen =
    new Set();

  const descriptors =
    characterVisualIntegration
      ?.descriptors;

  if (
    !Array.isArray(
      descriptors
    )
  ) {
    return objects;
  }

  for (
    const descriptor
    of descriptors
  ) {
    addUniqueObject(
      objects,
      seen,
      descriptor?.mesh
    );
  }

  return objects;
}

function collectWindowShadeInteractionObjects({
  scene,
  windowShadeSystem
}) {
  const objects = [];
  const seen =
    new Set();

  const visited =
    new WeakSet();

  function inspect(
    value,
    depth
  ) {
    if (
      value === null ||
      typeof value !==
        "object" ||
      depth >
        4
    ) {
      return;
    }

    if (
      visited.has(
        value
      )
    ) {
      return;
    }

    visited.add(
      value
    );

    if (
      value.isObject3D
    ) {
      if (
        isWindowShadeObject(
          value
        )
      ) {
        addUniqueObject(
          objects,
          seen,
          value
        );
      }

      if (
        typeof value.traverse ===
          "function"
      ) {
        value.traverse(
          (descendant) => {
            if (
              isWindowShadeObject(
                descendant
              )
            ) {
              addUniqueObject(
                objects,
                seen,
                descendant
              );
            }
          }
        );
      }

      return;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      for (
        const child
        of value
      ) {
        inspect(
          child,
          depth + 1
        );
      }

      return;
    }

    for (
      const child
      of Object.values(
        value
      )
    ) {
      if (
        typeof child ===
          "function"
      ) {
        continue;
      }

      inspect(
        child,
        depth + 1
      );
    }
  }

  inspect(
    windowShadeSystem,
    0
  );

  if (
    scene &&
    typeof scene.traverse ===
      "function"
  ) {
    scene.traverse(
      (object) => {
        if (
          isWindowShadeObject(
            object
          )
        ) {
          addUniqueObject(
            objects,
            seen,
            object
          );
        }
      }
    );
  }

  return objects;
}

function findRegisteredRoot(
  object,
  registeredObjects
) {
  let cursor =
    object;

  while (cursor) {
    if (
      registeredObjects.includes(
        cursor
      )
    ) {
      return cursor;
    }

    cursor =
      cursor.parent;
  }

  return null;
}

function resolveStudentKeyFromIntersection({
  intersection,
  characterVisualIntegration
}) {
  const instanceId =
    intersection?.instanceId;

  if (
    !Number.isInteger(
      instanceId
    ) ||
    instanceId <
      0
  ) {
    return null;
  }

  const controller =
    characterVisualIntegration
      ?.controllers
      ?.[instanceId];

  const studentKey =
    controller
      ?.sprite
      ?.userData
      ?.studentKey;

  return (
    typeof studentKey ===
      "string" &&
    studentKey.length >
      0
      ? studentKey
      : null
  );
}

function windowShadeIdentity(
  object,
  intersection
) {
  const userData =
    object?.userData ??
    {};

  for (
    const value
    of [
      userData.windowShadeId,
      userData.shadeId,
      userData.interactionId,
      object?.name
    ]
  ) {
    if (
      typeof value ===
        "string" &&
      value.length >
        0
    ) {
      return value;
    }
  }

  if (
    Number.isInteger(
      intersection?.instanceId
    )
  ) {
    return `window-shade-instance-${intersection.instanceId}`;
  }

  return (
    object?.uuid ??
    "window-shade"
  );
}

function sortInteractionCandidates(
  left,
  right
) {
  const leftDistance =
    finiteDistance(
      left?.distance
    );

  const rightDistance =
    finiteDistance(
      right?.distance
    );

  const delta =
    leftDistance -
    rightDistance;

  if (
    Math.abs(
      delta
    ) >
    CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE
      .distanceTieEpsilon
  ) {
    return delta;
  }

  const priorityDelta =
    (
      right?.priority ??
      0
    ) -
    (
      left?.priority ??
      0
    );

  if (
    priorityDelta !==
      0
  ) {
    return priorityDelta;
  }

  return String(
    left?.interactionKey ??
    ""
  ).localeCompare(
    String(
      right?.interactionKey ??
      ""
    )
  );
}

function deduplicateCandidates(
  candidates
) {
  const sorted =
    [
      ...candidates
    ].sort(
      sortInteractionCandidates
    );

  const result = [];
  const seen =
    new Set();

  for (
    const candidate
    of sorted
  ) {
    if (
      seen.has(
        candidate.interactionKey
      )
    ) {
      continue;
    }

    seen.add(
      candidate.interactionKey
    );

    result.push(
      candidate
    );
  }

  return result;
}

function collectRaycastCandidates({
  raycaster,
  objects,
  provider,
  priority,
  maximumDistance,
  resolve
}) {
  if (
    !Array.isArray(
      objects
    ) ||
    objects.length ===
      0
  ) {
    return [];
  }

  const intersections =
    raycaster.intersectObjects(
      objects,
      true
    );

  const candidates = [];

  for (
    const intersection
    of intersections
  ) {
    if (
      intersection.distance >
      maximumDistance
    ) {
      continue;
    }

    const root =
      findRegisteredRoot(
        intersection.object,
        objects
      );

    if (!root) {
      continue;
    }

    const resolved =
      resolve({
        intersection,
        root
      });

    if (!resolved) {
      continue;
    }

    candidates.push({
      provider,
      priority,

      distance:
        intersection.distance,

      point:
        intersection.point,

      instanceId:
        intersection.instanceId,

      object:
        root,

      hitObject:
        intersection.object,

      intersection,

      ...resolved
    });
  }

  return candidates;
}

function findObjectInteractionInvoker(
  object
) {
  const userData =
    object?.userData ??
    {};

  for (
    const name
    of [
      "onInteract",
      "interact",
      "activate",
      "toggle"
    ]
  ) {
    if (
      typeof userData[
        name
      ] ===
        "function"
    ) {
      return {
        owner:
          userData,

        name,

        fn:
          userData[
            name
          ]
      };
    }
  }

  return null;
}

function findSystemWindowShadeInvoker(
  root
) {
  const preferredNames =
    [
      "interactWindowShade",
      "toggleWindowShade",
      "activateWindowShade",
      "handleWindowShadeInteraction",
      "interactShade",
      "toggleShade"
    ];

  const visited =
    new WeakSet();

  function inspect(
    value,
    depth
  ) {
    if (
      value === null ||
      typeof value !==
        "object" ||
      depth >
        4
    ) {
      return null;
    }

    if (
      visited.has(
        value
      )
    ) {
      return null;
    }

    visited.add(
      value
    );

    for (
      const name
      of preferredNames
    ) {
      if (
        typeof value[
          name
        ] ===
          "function"
      ) {
        return {
          owner:
            value,

          name,

          fn:
            value[
              name
            ]
        };
      }
    }

    for (
      const child
      of Object.values(
        value
      )
    ) {
      if (
        child === null ||
        typeof child !==
          "object"
      ) {
        continue;
      }

      const found =
        inspect(
          child,
          depth + 1
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  return inspect(
    root,
    0
  );
}

function invokeWindowShadeCandidate({
  candidate,
  windowShadeSystem
}) {
  const invoker =
    findObjectInteractionInvoker(
      candidate.object
    ) ??
    findSystemWindowShadeInvoker(
      windowShadeSystem
    );

  if (!invoker) {
    return {
      handled:
        false,

      delegated:
        true,

      invoker:
        null
    };
  }

  const payload = {
    source:
      CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE
        .authority,

    interactionType:
      "window-shade",

    interactionKey:
      candidate.interactionKey,

    object:
      candidate.object,

    hitObject:
      candidate.hitObject,

    instanceId:
      candidate.instanceId,

    intersection:
      candidate.intersection
  };

  if (
    invoker.fn.length ===
      0
  ) {
    invoker.fn.call(
      invoker.owner
    );
  }
  else {
    invoker.fn.call(
      invoker.owner,
      payload
    );
  }

  return {
    handled:
      true,

    delegated:
      false,

    invoker:
      invoker.name
  };
}

function isEditableTarget(
  target
) {
  if (!target) {
    return false;
  }

  if (
    target.isContentEditable ===
      true
  ) {
    return true;
  }

  const tagName =
    typeof target.tagName ===
      "string"
      ? target.tagName.toUpperCase()
      : "";

  return (
    tagName ===
      "INPUT" ||
    tagName ===
      "TEXTAREA" ||
    tagName ===
      "SELECT"
  );
}

function createClassroomInteractionAuthorityV11({
  scene,
  camera,
  characterVisualIntegration,
  windowShadeSystem,
  onTeacherIntervention,
  windowObject
}) {
  if (
    !scene?.isScene
  ) {
    throw new TypeError(
      "scene is required"
    );
  }

  if (
    !camera?.isCamera
  ) {
    throw new TypeError(
      "camera is required"
    );
  }

  if (
    typeof onTeacherIntervention !==
      "function"
  ) {
    throw new TypeError(
      "onTeacherIntervention must be a function"
    );
  }

  if (
    !windowObject ||
    typeof windowObject.addEventListener !==
      "function" ||
    typeof windowObject.removeEventListener !==
      "function"
  ) {
    throw new TypeError(
      "windowObject event API is required"
    );
  }

  const profile =
    CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE;

  const raycaster =
    new THREE.Raycaster();

  raycaster.near =
    0;

  raycaster.far =
    profile.maximumDistance;

  raycaster.layers.set(
    profile.raycastLayer
  );

  const centerNdc =
    new THREE.Vector2(
      profile.centerNdc.x,
      profile.centerNdc.y
    );

  const studentObjects =
    collectStudentInteractionObjects(
      characterVisualIntegration
    );

  const windowShadeObjects =
    collectWindowShadeInteractionObjects({
      scene,
      windowShadeSystem
    });

  let disposed =
    false;

  let lastCandidate =
    null;

  let lastActivation =
    null;

  let pickSequence =
    0;

  function collectCandidates() {
    raycaster.setFromCamera(
      centerNdc,
      camera
    );

    const studentCandidates =
      collectRaycastCandidates({
        raycaster,

        objects:
          studentObjects,

        provider:
          "student",

        priority:
          profile.studentPriority,

        maximumDistance:
          profile.studentMaximumDistance,

        resolve({
          intersection
        }) {
          const studentKey =
            resolveStudentKeyFromIntersection({
              intersection,
              characterVisualIntegration
            });

          if (!studentKey) {
            return null;
          }

          return {
            interactionType:
              "student",

            interactionKey:
              `student:${studentKey}`,

            studentKey
          };
        }
      });

    const windowShadeCandidates =
      collectRaycastCandidates({
        raycaster,

        objects:
          windowShadeObjects,

        provider:
          "window-shade",

        priority:
          profile.windowShadePriority,

        maximumDistance:
          profile.windowShadeMaximumDistance,

        resolve({
          intersection,
          root
        }) {
          const identity =
            windowShadeIdentity(
              root,
              intersection
            );

          return {
            interactionType:
              "window-shade",

            interactionKey:
              `window-shade:${identity}`,

            windowShadeId:
              identity
          };
        }
      });

    return deduplicateCandidates([
      ...studentCandidates,
      ...windowShadeCandidates
    ]);
  }

  function pick() {
    if (disposed) {
      return null;
    }

    pickSequence +=
      1;

    const candidates =
      collectCandidates();

    lastCandidate =
      candidates[0] ??
      null;

    return lastCandidate;
  }

  function activateCandidate(
    candidate
  ) {
    if (
      disposed ||
      !candidate
    ) {
      return {
        handled:
          false,

        delegated:
          false,

        candidate:
          candidate ??
          null
      };
    }

    if (
      candidate.interactionType ===
        "student"
    ) {
      const command = {
        studentKey:
          candidate.studentKey,

        actionType:
          "probe_understanding"
      };

      onTeacherIntervention(
        command
      );

      lastActivation = {
        handled:
          true,

        delegated:
          false,

        interactionType:
          "student",

        interactionKey:
          candidate.interactionKey,

        command
      };

      return {
        ...lastActivation,

        candidate
      };
    }

    if (
      candidate.interactionType ===
        "window-shade"
    ) {
      const result =
        invokeWindowShadeCandidate({
          candidate,
          windowShadeSystem
        });

      lastActivation = {
        ...result,

        interactionType:
          "window-shade",

        interactionKey:
          candidate.interactionKey
      };

      return {
        ...lastActivation,

        candidate
      };
    }

    return {
      handled:
        false,

      delegated:
        false,

      candidate
    };
  }

  function activate() {
    return activateCandidate(
      pick()
    );
  }

  function onKeyDown(
    event
  ) {
    if (
      disposed ||
      event?.code !==
        profile.interactionKey ||
      event?.repeat ===
        true ||
      isEditableTarget(
        event?.target
      )
    ) {
      return;
    }

    const candidate =
      pick();

    if (!candidate) {
      return;
    }

    const result =
      activateCandidate(
        candidate
      );

    /*
     * If V11 has successfully executed the selected action,
     * suppress legacy listeners to guarantee exactly-once
     * interaction.
     *
     * When a V6-specific callable API cannot be discovered,
     * window-shade handling deliberately falls through to
     * the proven V6 listener as a migration fallback.
     */
    if (
      result.handled
    ) {
      if (
        typeof event.preventDefault ===
          "function"
      ) {
        event.preventDefault();
      }

      if (
        typeof event.stopImmediatePropagation ===
          "function"
      ) {
        event.stopImmediatePropagation();
      }
    }
  }

  windowObject.addEventListener(
    "keydown",
    onKeyDown,
    true
  );

  function getSnapshot() {
    return {
      authority:
        profile.authority,

      interactionKey:
        profile.interactionKey,

      raycastLayer:
        profile.raycastLayer,

      studentObjectCount:
        studentObjects.length,

      windowShadeObjectCount:
        windowShadeObjects.length,

      pickSequence,

      lastCandidate:
        lastCandidate
          ? {
              provider:
                lastCandidate.provider,

              interactionType:
                lastCandidate.interactionType,

              interactionKey:
                lastCandidate.interactionKey,

              distance:
                lastCandidate.distance
            }
          : null,

      lastActivation:
        lastActivation
          ? {
              ...lastActivation
            }
          : null,

      disposed
    };
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    windowObject.removeEventListener(
      "keydown",
      onKeyDown,
      true
    );
  }

  return {
    raycaster,
    studentObjects,
    windowShadeObjects,
    collectCandidates,
    pick,
    activate,
    activateCandidate,
    getSnapshot,
    dispose
  };
}

export {
  CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE,
  collectRaycastCandidates,
  collectStudentInteractionObjects,
  collectWindowShadeInteractionObjects,
  createClassroomInteractionAuthorityV11,
  deduplicateCandidates,
  descriptorText,
  findObjectInteractionInvoker,
  findRegisteredRoot,
  findSystemWindowShadeInvoker,
  invokeWindowShadeCandidate,
  isEditableTarget,
  isWindowShadeObject,
  resolveStudentKeyFromIntersection,
  sortInteractionCandidates,
  windowShadeIdentity
};