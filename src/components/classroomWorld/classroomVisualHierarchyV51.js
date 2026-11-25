const CLASSROOM_VISUAL_HIERARCHY_V51_PROFILE =
  Object.freeze({
    version: 51,

    mode:
      "focused-classroom",

    decorativeNamePattern:
      /(?:backpack|noticeboard|storytelling|story-density|story-panel|story-paper|microdetail|foreground-decor|foreground-prop|poster|sticky|sticker|ornament|decorative|clutter)/i,

    essentialNamePattern:
      /(?:student|character|teacher|student-desk|teacher-desk|chair|chalkboard|blackboard|classroom-door|classroom-window|room-shell|architecture|ceiling|floor|wall)/i,

    protectedScenicNamePattern:
      /(?:ocean|sky|cargo|ship|seagull|headphone)/i
  });


function requireScene(
  scene
) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V51 requires a Three.js scene"
    );
  }

  return scene;
}


function normalizedName(
  object
) {
  return typeof object?.name ===
    "string"
    ? object.name.trim()
    : "";
}


function readUserData(
  object
) {
  return (
    object?.userData &&
    typeof object.userData ===
      "object"
  )
    ? object.userData
    : {};
}


function hasInteractionSemantic(
  object
) {
  const userData =
    readUserData(
      object
    );

  return Boolean(
    userData.studentKey ||
    userData.studentId ||
    userData.interactionId ||
    userData.windowShadeId ||
    userData.shadeId ||
    userData.raycastRole
  );
}


function hasCanonicalClassroomSemantic(
  object
) {
  const userData =
    readUserData(
      object
    );

  return Boolean(
    userData
      .classroomCanonicalDeskSurface ===
        true ||
    userData
      .classroomCanonicalBlackboard ===
        true ||
    userData.teacherDesk ===
      true ||
    userData.isTeacherDesk ===
      true ||
    userData.teacherStation ===
      true
  );
}


function isEssentialVisualV51(
  object,
  profile =
    CLASSROOM_VISUAL_HIERARCHY_V51_PROFILE
) {
  if (!object) {
    return false;
  }

  if (
    hasInteractionSemantic(
      object
    ) ||
    hasCanonicalClassroomSemantic(
      object
    )
  ) {
    return true;
  }

  const name =
    normalizedName(
      object
    );

  if (
    profile
      .protectedScenicNamePattern
      .test(name)
  ) {
    return true;
  }

  return profile
    .essentialNamePattern
    .test(name);
}


function isDecorativeVisualV51(
  object,
  profile =
    CLASSROOM_VISUAL_HIERARCHY_V51_PROFILE
) {
  if (!object) {
    return false;
  }

  if (
    isEssentialVisualV51(
      object,
      profile
    )
  ) {
    return false;
  }

  const name =
    normalizedName(
      object
    );

  return profile
    .decorativeNamePattern
    .test(name);
}


function collectSceneObjectsV51(
  scene
) {
  const objects = [];

  scene.traverse(
    (object) => {
      objects.push(
        object
      );
    }
  );

  return objects;
}


function collectProtectedObjectsV51({
  scene,
  objects,
  profile
}) {
  const protectedObjects =
    new Set([
      scene
    ]);

  for (
    const object
    of objects
  ) {
    if (
      !isEssentialVisualV51(
        object,
        profile
      )
    ) {
      continue;
    }

    let current =
      object;

    while (current) {
      protectedObjects.add(
        current
      );

      current =
        current.parent;
    }
  }

  return protectedObjects;
}


function createClassroomVisualHierarchyV51({
  scene,
  profile =
    CLASSROOM_VISUAL_HIERARCHY_V51_PROFILE
}) {
  requireScene(
    scene
  );

  const originalVisibility =
    new Map();

  let disposed =
    false;

  let snapshot =
    null;


  function apply() {
    if (disposed) {
      return false;
    }

    /*
     * Idempotent refresh:
     *
     * restore V51-owned mutations first, then
     * recalculate the hierarchy from current scene.
     */

    for (
      const [
        object,
        visible
      ]
      of originalVisibility
    ) {
      object.visible =
        visible;
    }

    originalVisibility.clear();

    const objects =
      collectSceneObjectsV51(
        scene
      );

    const protectedObjects =
      collectProtectedObjectsV51({
        scene,
        objects,
        profile
      });

    let essentialCount =
      0;

    let supportingCount =
      0;

    let decorativeCount =
      0;

    let hiddenDecorativeCount =
      0;

    for (
      const object
      of objects
    ) {
      if (object === scene) {
        continue;
      }

      if (
        protectedObjects.has(
          object
        )
      ) {
        essentialCount +=
          1;

        continue;
      }

      if (
        isDecorativeVisualV51(
          object,
          profile
        )
      ) {
        decorativeCount +=
          1;

        if (
          object.visible !==
            false
        ) {
          originalVisibility.set(
            object,
            object.visible
          );

          object.visible =
            false;

          hiddenDecorativeCount +=
            1;
        }

        continue;
      }

      supportingCount +=
        1;
    }

    snapshot =
      Object.freeze({
        version:
          profile.version,

        mode:
          profile.mode,

        sceneObjectCount:
          Math.max(
            0,
            objects.length - 1
          ),

        essentialCount,

        supportingCount,

        decorativeCount,

        hiddenDecorativeCount,

        visibilityMutationCount:
          originalVisibility.size,

        interactionAuthorityMutations:
          0,

        raycastMutations:
          0,

        layerMutations:
          0,

        transformMutations:
          0,

        materialMutations:
          0
      });

    return true;
  }


  function getSnapshot() {
    return snapshot;
  }


  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    for (
      const [
        object,
        visible
      ]
      of originalVisibility
    ) {
      object.visible =
        visible;
    }

    originalVisibility.clear();
  }


  apply();


  return Object.freeze({
    apply,
    getSnapshot,
    dispose
  });
}


export {
  CLASSROOM_VISUAL_HIERARCHY_V51_PROFILE,
  createClassroomVisualHierarchyV51,
  hasCanonicalClassroomSemantic,
  hasInteractionSemantic,
  isDecorativeVisualV51,
  isEssentialVisualV51
};