const ALLOWED_FIELDS = Object.freeze([
  "studentKey",
  "safeLabel",
  "learningState",
  "strengths",
  "misconceptions",
  "interventionPriority",
  "recommendedActions",
  "confidence",
  "provenance"
]);

const PRIORITIES = Object.freeze([
  "low",
  "medium",
  "high"
]);

const LEARNING_STATES = Object.freeze([
  "on-track",
  "needs-review",
  "needs-intervention"
]);

function assertPlainObject(value, fieldName) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${fieldName} must be a plain object`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new TypeError(`${fieldName} must be a plain object`);
  }
}
function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an array`);
  }

  for (const item of value) {
    assertNonEmptyString(item, `${fieldName} item`);
  }
}

function assertAllowedFields(input) {
  const allowed = new Set(ALLOWED_FIELDS);

  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new Error(`Unsupported student intelligence field: ${key}`);
    }
  }
}

function freezeStringArray(values) {
  return Object.freeze([...values]);
}

function createStudentIntelligence(input) {
  assertPlainObject(input, "input");
  assertAllowedFields(input);

  assertNonEmptyString(input.studentKey, "studentKey");
  assertNonEmptyString(input.safeLabel, "safeLabel");

  if (!LEARNING_STATES.includes(input.learningState)) {
    throw new RangeError(
      `learningState must be one of: ${LEARNING_STATES.join(", ")}`
    );
  }

  assertStringArray(input.strengths, "strengths");
  assertStringArray(input.misconceptions, "misconceptions");

  if (!PRIORITIES.includes(input.interventionPriority)) {
    throw new RangeError(
      `interventionPriority must be one of: ${PRIORITIES.join(", ")}`
    );
  }

  assertStringArray(
    input.recommendedActions,
    "recommendedActions"
  );

  if (
    typeof input.confidence !== "number" ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    throw new RangeError(
      "confidence must be a finite number between 0 and 1"
    );
  }

  assertPlainObject(input.provenance, "provenance");
  assertNonEmptyString(
    input.provenance.analysisVersion,
    "provenance.analysisVersion"
  );
  assertNonEmptyString(
    input.provenance.sourceType,
    "provenance.sourceType"
  );

  const provenanceKeys = Object.keys(input.provenance);
  const allowedProvenanceKeys = new Set([
    "analysisVersion",
    "sourceType"
  ]);

  for (const key of provenanceKeys) {
    if (!allowedProvenanceKeys.has(key)) {
      throw new Error(
        `Unsupported provenance field: ${key}`
      );
    }
  }

  const provenance = Object.freeze({
    analysisVersion: input.provenance.analysisVersion.trim(),
    sourceType: input.provenance.sourceType.trim()
  });

  return Object.freeze({
    studentKey: input.studentKey.trim(),
    safeLabel: input.safeLabel.trim(),
    learningState: input.learningState,
    strengths: freezeStringArray(input.strengths),
    misconceptions: freezeStringArray(input.misconceptions),
    interventionPriority: input.interventionPriority,
    recommendedActions: freezeStringArray(
      input.recommendedActions
    ),
    confidence: input.confidence,
    provenance
  });
}

export {
  ALLOWED_FIELDS,
  LEARNING_STATES,
  PRIORITIES,
  createStudentIntelligence
};