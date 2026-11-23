import { seatToWorld } from "./classroomWorldContract.js";

function requireRuntimeStore(store) {
  if (!store || typeof store !== "object") {
    throw new TypeError("intelligenceStore is required");
  }

  if (typeof store.keys !== "function") {
    throw new TypeError("intelligenceStore.keys must be a function");
  }

  if (typeof store.requireStudent !== "function") {
    throw new TypeError(
      "intelligenceStore.requireStudent must be a function"
    );
  }

  return store;
}

function requireStudentKey(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("studentKey must be a non-empty string");
  }

  return value.trim();
}

function normalizeDisplayLabel(record, studentKey) {
  if (
    record &&
    typeof record.displayLabel === "string" &&
    record.displayLabel.trim().length > 0
  ) {
    return record.displayLabel.trim();
  }

  return studentKey;
}

function freezePosition(position) {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new TypeError("seatToWorld must return a finite position");
  }

  return Object.freeze({
    x: position.x,
    y: position.y,
    z: position.z
  });
}

function createDynamicStudentRoster(intelligenceStore) {
  const store = requireRuntimeStore(intelligenceStore);
  const keys = store.keys();

  if (!Array.isArray(keys)) {
    throw new TypeError("intelligenceStore.keys() must return an array");
  }

  const seen = new Set();

  const roster = keys.map((rawStudentKey, seatIndex) => {
    const studentKey = requireStudentKey(rawStudentKey);

    if (seen.has(studentKey)) {
      throw new Error(
        `duplicate studentKey in runtime roster: ${studentKey}`
      );
    }

    seen.add(studentKey);

    const intelligence = store.requireStudent(studentKey);

    if (!intelligence || typeof intelligence !== "object") {
      throw new TypeError(
        `runtime intelligence missing for ${studentKey}`
      );
    }

    if (intelligence.studentKey !== studentKey) {
      throw new Error(
        `runtime intelligence identity mismatch for ${studentKey}`
      );
    }

    return Object.freeze({
      studentKey,
      displayLabel: normalizeDisplayLabel(
        intelligence,
        studentKey
      ),
      seatIndex,
      position: freezePosition(
        seatToWorld(seatIndex)
      )
    });
  });

  return Object.freeze(roster);
}

export {
  createDynamicStudentRoster
};