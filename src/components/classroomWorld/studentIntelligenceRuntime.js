import { createStudentIntelligence } from "./studentIntelligenceContract.js";

const FORBIDDEN_RUNTIME_KEYS = new Set([
  "email",
  "studentEmail",
  "studentName",
  "rawSubmission",
  "rawSubmissions",
  "rawText",
  "submissionText"
]);

function assertPlainOptions(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError("options must be an object");
  }
}

function normalizeStudentKey(value, name = "studentKey") {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new RangeError(`${name} must be non-empty`);
  }

  return normalized;
}

function assertCanonicalRecord(value, index) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `canonical record at index ${index} must be an object`
    );
  }

  normalizeStudentKey(
    value.studentKey,
    `records[${index}].studentKey`
  );
}

function cloneFrozenRuntimeValue(value, path = "record") {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} contains a non-finite number`);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item, index) =>
        cloneFrozenRuntimeValue(item, `${path}[${index}]`)
      )
    );
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new TypeError(
        `${path} must contain only plain runtime data`
      );
    }

    const copy = {};

    for (const key of Object.keys(value)) {
      if (FORBIDDEN_RUNTIME_KEYS.has(key)) {
        throw new Error(
          `forbidden raw student data field at ${path}.${key}`
        );
      }

      copy[key] = cloneFrozenRuntimeValue(
        value[key],
        `${path}.${key}`
      );
    }

    return Object.freeze(copy);
  }

  throw new TypeError(
    `${path} contains unsupported runtime data type: ${typeof value}`
  );
}

function canonicalizeRuntimeStudentIntelligence(input) {
  return createStudentIntelligence(input);
}

function createStudentIntelligenceRuntimeStore(
  records = [],
  options = {}
) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  assertPlainOptions(options);

  const canonicalize =
    options.canonicalize ??
    canonicalizeRuntimeStudentIntelligence;

  if (typeof canonicalize !== "function") {
    throw new TypeError("options.canonicalize must be a function");
  }

  const byStudentKey = new Map();

  records.forEach((record, index) => {
    const canonical = canonicalize(record);

    assertCanonicalRecord(canonical, index);

    const studentKey = normalizeStudentKey(
      canonical.studentKey,
      `records[${index}].studentKey`
    );

    if (byStudentKey.has(studentKey)) {
      throw new Error(
        `duplicate studentKey in runtime store: ${studentKey}`
      );
    }

    const frozenRecord = cloneFrozenRuntimeValue(
      canonical,
      `records[${index}]`
    );

    byStudentKey.set(studentKey, frozenRecord);
  });

  const orderedKeys = Object.freeze(
    Array.from(byStudentKey.keys()).sort()
  );

  const orderedRecords = Object.freeze(
    orderedKeys.map((studentKey) =>
      byStudentKey.get(studentKey)
    )
  );

  function has(studentKey) {
    const normalized = normalizeStudentKey(
      studentKey,
      "lookup studentKey"
    );

    return byStudentKey.has(normalized);
  }

  function get(studentKey) {
    const normalized = normalizeStudentKey(
      studentKey,
      "lookup studentKey"
    );

    return byStudentKey.get(normalized) ?? null;
  }

  function requireStudent(studentKey) {
    const normalized = normalizeStudentKey(
      studentKey,
      "lookup studentKey"
    );

    const record = byStudentKey.get(normalized);

    if (!record) {
      throw new RangeError(
        `unknown studentKey in runtime store: ${normalized}`
      );
    }

    return record;
  }

  function keys() {
    return orderedKeys;
  }

  function snapshot() {
    return orderedRecords;
  }

  return Object.freeze({
    size: byStudentKey.size,
    has,
    get,
    requireStudent,
    keys,
    snapshot
  });
}

export {
  canonicalizeRuntimeStudentIntelligence,
  createStudentIntelligenceRuntimeStore
};