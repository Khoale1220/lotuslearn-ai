function requireScene(scene) {
  if (
    !scene ||
    typeof scene.add !== "function" ||
    typeof scene.remove !== "function"
  ) {
    throw new TypeError(
      "scene must expose add() and remove()"
    );
  }

  return scene;
}

function requireInteractiveMeshes(interactiveMeshes) {
  if (!Array.isArray(interactiveMeshes)) {
    throw new TypeError(
      "interactiveMeshes must be an array"
    );
  }

  return interactiveMeshes;
}

function requireStudentMeshFactory(createStudentMesh) {
  if (typeof createStudentMesh !== "function") {
    throw new TypeError(
      "createStudentMesh must be a function"
    );
  }

  return createStudentMesh;
}

function requireStudentRecord(student) {
  if (!student || typeof student !== "object") {
    throw new TypeError(
      "student roster record must be an object"
    );
  }

  if (
    typeof student.studentKey !== "string" ||
    student.studentKey.trim().length === 0
  ) {
    throw new TypeError(
      "studentKey must be a non-empty string"
    );
  }

  if (
    typeof student.displayLabel !== "string" ||
    student.displayLabel.trim().length === 0
  ) {
    throw new TypeError(
      "displayLabel must be a non-empty string"
    );
  }

  if (
    !Number.isInteger(student.seatIndex) ||
    student.seatIndex < 0
  ) {
    throw new RangeError(
      "seatIndex must be a non-negative integer"
    );
  }

  if (
    !student.position ||
    !Number.isFinite(student.position.x) ||
    !Number.isFinite(student.position.y) ||
    !Number.isFinite(student.position.z)
  ) {
    throw new TypeError(
      "student.position must contain finite x/y/z"
    );
  }

  return student;
}

function normalizeRoster(roster) {
  if (!Array.isArray(roster)) {
    throw new TypeError(
      "roster must be an array"
    );
  }

  const seen = new Set();

  return roster.map((student) => {
    requireStudentRecord(student);

    const studentKey = student.studentKey.trim();

    if (seen.has(studentKey)) {
      throw new Error(
        `duplicate scene studentKey: ${studentKey}`
      );
    }

    seen.add(studentKey);

    return Object.freeze({
      studentKey,
      displayLabel: student.displayLabel.trim(),
      seatIndex: student.seatIndex,
      position: Object.freeze({
        x: student.position.x,
        y: student.position.y,
        z: student.position.z
      })
    });
  });
}

function setMeshPosition(mesh, position) {
  if (!mesh || typeof mesh !== "object") {
    throw new TypeError(
      "createStudentMesh must return an object"
    );
  }

  if (
    mesh.position &&
    typeof mesh.position.set === "function"
  ) {
    mesh.position.set(
      position.x,
      position.y,
      position.z
    );

    return;
  }

  if (!mesh.position || typeof mesh.position !== "object") {
    mesh.position = {};
  }

  mesh.position.x = position.x;
  mesh.position.y = position.y;
  mesh.position.z = position.z;
}

function setMeshSpatialIdentity(mesh, student) {
  setMeshPosition(mesh, student.position);

  mesh.userData = Object.freeze({
    studentKey: student.studentKey,
    displayLabel: student.displayLabel
  });

  return mesh;
}

function removeInteractiveMesh(
  interactiveMeshes,
  mesh
) {
  let index = interactiveMeshes.indexOf(mesh);

  while (index !== -1) {
    interactiveMeshes.splice(index, 1);
    index = interactiveMeshes.indexOf(mesh);
  }
}

function disposeMaterial(material) {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    for (const item of material) {
      if (item && typeof item.dispose === "function") {
        item.dispose();
      }
    }

    return;
  }

  if (typeof material.dispose === "function") {
    material.dispose();
  }
}

function defaultDisposeStudentMesh(mesh) {
  if (!mesh || typeof mesh !== "object") {
    return;
  }

  if (
    mesh.geometry &&
    typeof mesh.geometry.dispose === "function"
  ) {
    mesh.geometry.dispose();
  }

  disposeMaterial(mesh.material);
}

function createStudentSceneRoster({
  scene,
  interactiveMeshes,
  createStudentMesh,
  disposeStudentMesh = defaultDisposeStudentMesh
}) {
  const runtimeScene = requireScene(scene);
  const runtimeInteractiveMeshes =
    requireInteractiveMeshes(interactiveMeshes);
  const meshFactory =
    requireStudentMeshFactory(createStudentMesh);

  if (typeof disposeStudentMesh !== "function") {
    throw new TypeError(
      "disposeStudentMesh must be a function"
    );
  }

  const meshesByStudentKey = new Map();

  function destroyStudent(studentKey) {
    const mesh =
      meshesByStudentKey.get(studentKey);

    if (!mesh) {
      return false;
    }

    runtimeScene.remove(mesh);

    removeInteractiveMesh(
      runtimeInteractiveMeshes,
      mesh
    );

    disposeStudentMesh(mesh);

    meshesByStudentKey.delete(studentKey);

    return true;
  }

  function sync(roster) {
    /*
     * Validate the complete desired state before touching
     * the live Three.js scene. Invalid input therefore
     * fails closed without partially mutating runtime state.
     */
    const desiredRoster =
      normalizeRoster(roster);

    const desiredKeys = new Set(
      desiredRoster.map(
        (student) => student.studentKey
      )
    );

    for (
      const studentKey of
      [...meshesByStudentKey.keys()]
    ) {
      if (!desiredKeys.has(studentKey)) {
        destroyStudent(studentKey);
      }
    }

    for (const student of desiredRoster) {
      const existingMesh =
        meshesByStudentKey.get(
          student.studentKey
        );

      if (existingMesh) {
        setMeshSpatialIdentity(
          existingMesh,
          student
        );

        continue;
      }

      const mesh =
        meshFactory(student);

      setMeshSpatialIdentity(
        mesh,
        student
      );

      runtimeScene.add(mesh);

      runtimeInteractiveMeshes.push(mesh);

      meshesByStudentKey.set(
        student.studentKey,
        mesh
      );
    }

    return Object.freeze({
      size: meshesByStudentKey.size,
      studentKeys: Object.freeze(
        desiredRoster.map(
          (student) => student.studentKey
        )
      )
    });
  }

  function has(studentKey) {
    return meshesByStudentKey.has(
      studentKey
    );
  }

  function get(studentKey) {
    return (
      meshesByStudentKey.get(studentKey) ??
      null
    );
  }

  function keys() {
    return Object.freeze(
      [...meshesByStudentKey.keys()]
    );
  }

  function dispose() {
    for (
      const studentKey of
      [...meshesByStudentKey.keys()]
    ) {
      destroyStudent(studentKey);
    }
  }

  return Object.freeze({
    sync,
    has,
    get,
    keys,
    dispose
  });
}

export {
  createStudentSceneRoster
};