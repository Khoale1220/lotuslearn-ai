const ALLOWED_FIELDS = Object.freeze([
  "interventionKey",
  "studentKey",
  "actionType",
  "analysisKey",
  "createdAt",
  "provenance",
]);

const REQUIRED_FIELDS = Object.freeze([
  "interventionKey",
  "studentKey",
  "actionType",
  "createdAt",
  "provenance",
]);

const ALLOWED_FIELD_SET = new Set(ALLOWED_FIELDS);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIMEZONE_SUFFIX_PATTERN =
  /(?:Z|[+-]\d{2}:\d{2})$/i;

const FORBIDDEN_PRIVACY_KEYS = new Set([
  "rawsubmission",
  "rawsubmissions",
  "studentname",
  "email",
]);

class TeacherInterventionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TeacherInterventionValidationError";
    this.code = "TEACHER_INTERVENTION_VALIDATION_ERROR";
  }
}

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string") {
    throw new TeacherInterventionValidationError(
      `${fieldName} must be a string`,
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TeacherInterventionValidationError(
      `${fieldName} must not be blank`,
    );
  }

  return normalized;
}

function normalizePrivacyKey(key) {
  return String(key)
    .replaceAll("_", "")
    .toLowerCase();
}

function assertPrivacyBoundary(value, path = "provenance") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertPrivacyBoundary(
        item,
        `${path}[${index}]`,
      );
    });

    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizePrivacyKey(key);

    if (FORBIDDEN_PRIVACY_KEYS.has(normalizedKey)) {
      throw new TeacherInterventionValidationError(
        `forbidden privacy field at ${path}.${key}`,
      );
    }

    assertPrivacyBoundary(
      nestedValue,
      `${path}.${key}`,
    );
  }
}

function canonicalizeProvenance(value) {
  if (!isPlainObject(value)) {
    throw new TeacherInterventionValidationError(
      "provenance must be an object",
    );
  }

  assertPrivacyBoundary(value);

  let encoded;

  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new TeacherInterventionValidationError(
      "provenance must contain JSON-compatible values",
    );
  }

  if (typeof encoded !== "string") {
    throw new TeacherInterventionValidationError(
      "provenance must contain JSON-compatible values",
    );
  }

  const canonical = JSON.parse(encoded);

  if (!isPlainObject(canonical)) {
    throw new TeacherInterventionValidationError(
      "provenance must be an object",
    );
  }

  return canonical;
}

function canonicalizeCreatedAt(value) {
  const normalized = requireNonEmptyString(
    value,
    "createdAt",
  );

  if (!TIMEZONE_SUFFIX_PATTERN.test(normalized)) {
    throw new TeacherInterventionValidationError(
      "createdAt must include a timezone",
    );
  }

  const milliseconds = Date.parse(normalized);

  if (!Number.isFinite(milliseconds)) {
    throw new TeacherInterventionValidationError(
      "createdAt must be an ISO-8601 timestamp",
    );
  }

  return new Date(milliseconds).toISOString();
}

function validateTeacherInterventionPayload(input) {
  if (!isPlainObject(input)) {
    throw new TeacherInterventionValidationError(
      "request body must be an object",
    );
  }

  const suppliedFields = Object.keys(input);

  const unknownFields = suppliedFields.filter(
    (field) => !ALLOWED_FIELD_SET.has(field),
  );

  if (unknownFields.length > 0) {
    throw new TeacherInterventionValidationError(
      `unsupported intervention fields: ${unknownFields
        .sort()
        .join(", ")}`,
    );
  }

  const missingFields = REQUIRED_FIELDS.filter(
    (field) =>
      !Object.prototype.hasOwnProperty.call(
        input,
        field,
      ),
  );

  if (missingFields.length > 0) {
    throw new TeacherInterventionValidationError(
      `missing intervention fields: ${missingFields.join(", ")}`,
    );
  }

  const interventionKey = requireNonEmptyString(
    input.interventionKey,
    "interventionKey",
  ).toLowerCase();

  if (!UUID_PATTERN.test(interventionKey)) {
    throw new TeacherInterventionValidationError(
      "interventionKey must be a valid UUID",
    );
  }

  const studentKey = requireNonEmptyString(
    input.studentKey,
    "studentKey",
  );

  const actionType = requireNonEmptyString(
    input.actionType,
    "actionType",
  );

  let analysisKey = null;

  if (
    input.analysisKey !== null &&
    input.analysisKey !== undefined
  ) {
    analysisKey = requireNonEmptyString(
      input.analysisKey,
      "analysisKey",
    );
  }

  const createdAt = canonicalizeCreatedAt(
    input.createdAt,
  );

  const provenance = canonicalizeProvenance(
    input.provenance,
  );

  return Object.freeze({
    interventionKey,
    studentKey,
    actionType,
    analysisKey,
    createdAt,
    provenance: Object.freeze(provenance),
  });
}

export {
  TeacherInterventionValidationError,
  validateTeacherInterventionPayload,
};