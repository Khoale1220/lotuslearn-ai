export function isolateClassroomHdVisualLayersR74B10B(scene) {
  if (!scene || scene.isScene !== true) {
    throw new TypeError("A THREE.Scene is required");
  }

  const hdFloor = scene.getObjectByName(
    "classroom-64bit-floor"
  );

  const retroFloor = scene.getObjectByName(
    "retro-floor-v4"
  );

  const deskEdge = scene.getObjectByName(
    "cw06-v39-low-desk-edge"
  );

  const hdFloorAvailable = hdFloor?.isMesh === true;

  // Never hide the fallback floor without an HD replacement.
  const retroFloorHidden =
    hdFloorAvailable && retroFloor?.isMesh === true;

  if (retroFloorHidden) {
    retroFloor.visible = false;
  }

  // Remove only the artificial foreground billboard.
  const deskEdgeHidden = hdFloorAvailable && deskEdge?.isMesh === true;

  if (deskEdgeHidden) {
    deskEdge.visible = false;
  }

  // HD presentation hides legacy V39 foreground cutouts.
  // Keep all meshes/resources intact for reversible visual A/B.
  if (hdFloorAvailable) {
    for (const name of [
      "cw06-v39-left-shelf",
      "cw06-v39-right-plant",
      "cw06-v39-right-chair-stack"
    ]) {
      const card = scene.getObjectByName(name);
      if (card?.isMesh === true) {
        card.visible = false;
      }
    }
  }
  return Object.freeze({
    hdFloorAvailable,
    retroFloorHidden,
    deskEdgeHidden
  });
}