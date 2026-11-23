const INTERVENTION_ACTIONS = Object.freeze([
  "probe_understanding",
  "provide_hint",
  "reteach_concept",
  "assign_targeted_practice",
  "schedule_follow_up",
  "record_observation"
]);

const INTERVENTION_SOURCES = Object.freeze([
  "classroom-world"
]);

const ALLOWED_FIELDS = Object.freeze([
  "interventionKey",
  "studentKey",
  "actionType",
  "createdAt",
  "provenance"
]);

const ALLOWED_PROVENANCE_FIELDS = Object.freeze([
  "source",
  "analysisKey"
]);

const actionSet = new Set(INTERVENTION_ACTIONS);
const sourceSet = new Set(INTERVENTION_SOURCES);
const allowedFieldSet = new Set(ALLOWED_FIELDS);
const allowedProvenanceFieldSet =
  new Set(ALLOWED_PROVENANCE_FIELDS);

function assertPlainObject(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `${label} must be a plain object`
    );
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new TypeError(
      `${label} must be a plain object`
    );
  }
}

function assertAllowedFields(
  object,
  allowedFields,
  label
) {
  for (const field of Object.keys(object)) {
    if (!allowedFields.has(field)) {
      throw new TypeError(
        `Unsupported ${label} field: ${field}`
      );
    }
  }
}

function assertNonEmptyString(
  value,
  label,
  maxLength = 160
) {
  if (typeof value !== "string") {
    throw new TypeError(
      `${label} must be a string`
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(
      `${label} must not be empty`
    );
  }

  if (normalized.length > maxLength) {
    throw new TypeError(
      `${label} exceeds maximum length`
    );
  }

  return normalized;
}

function assertIsoTimestamp(value) {
  const normalized =
    assertNonEmptyString(
      value,
      "createdAt",
      64
    );

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(
      "createdAt must be a valid ISO timestamp"
    );
  }

  if (parsed.toISOString() !== normalized) {
    throw new TypeError(
      "createdAt must use canonical ISO-8601 UTC format"
    );
  }

  return normalized;
}

function createProvenance(input) {
  assertPlainObject(
    input,
    "provenance"
  );

  assertAllowedFields(
    input,
    allowedProvenanceFieldSet,
    "provenance"
  );

  const source =
    assertNonEmptyString(
      input.source,
      "provenance.source",
      80
    );

  if (!sourceSet.has(source)) {
    throw new TypeError(
      `Unsupported provenance source: ${source}`
    );
  }

  let analysisKey;

  if (
    input.analysisKey !== undefined &&
    input.analysisKey !== null
  ) {
    analysisKey =
      assertNonEmptyString(
        input.analysisKey,
        "provenance.analysisKey",
        160
      );
  }

  return Object.freeze({
    source,
    ...(analysisKey
      ? { analysisKey }
      : {})
  });
}

function createTeacherIntervention(input) {
  assertPlainObject(
    input,
    "teacher intervention"
  );

  assertAllowedFields(
    input,
    allowedFieldSet,
    "teacher intervention"
  );

  const interventionKey =
    assertNonEmptyString(
      input.interventionKey,
      "interventionKey",
      160
    );

  const studentKey =
    assertNonEmptyString(
      input.studentKey,
      "studentKey",
      160
    );

  const actionType =
    assertNonEmptyString(
      input.actionType,
      "actionType",
      80
    );

  if (!actionSet.has(actionType)) {
    throw new TypeError(
      `Unsupported intervention action: ${actionType}`
    );
  }

  const createdAt =
    assertIsoTimestamp(
      input.createdAt
    );

  const provenance =
    createProvenance(
      input.provenance
    );

  return Object.freeze({
    interventionKey,
    studentKey,
    actionType,
    createdAt,
    provenance
  });
}

export {
  ALLOWED_FIELDS,
  ALLOWED_PROVENANCE_FIELDS,
  INTERVENTION_ACTIONS,
  INTERVENTION_SOURCES,
  createTeacherIntervention
};
