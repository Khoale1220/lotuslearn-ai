import {
  INTERVENTION_ACTIONS,
  createTeacherIntervention
} from "./teacherInterventionContract.js";

const COMMAND_ALLOWED_FIELDS = Object.freeze([
  "studentKey",
  "actionType",
  "analysisKey"
]);

const MATERIALIZER_ALLOWED_DEPENDENCIES =
  Object.freeze([
    "createInterventionKey",
    "nowIso"
  ]);

const actionSet =
  new Set(INTERVENTION_ACTIONS);

const commandFieldSet =
  new Set(COMMAND_ALLOWED_FIELDS);

const materializerDependencySet =
  new Set(
    MATERIALIZER_ALLOWED_DEPENDENCIES
  );

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

  const prototype =
    Object.getPrototypeOf(value);

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

function createTeacherInterventionCommand(
  input
) {
  assertPlainObject(
    input,
    "teacher intervention command"
  );

  assertAllowedFields(
    input,
    commandFieldSet,
    "teacher intervention command"
  );

  const studentKey =
    assertNonEmptyString(
      input.studentKey,
      "studentKey"
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

  let analysisKey;

  if (
    input.analysisKey !== undefined &&
    input.analysisKey !== null
  ) {
    analysisKey =
      assertNonEmptyString(
        input.analysisKey,
        "analysisKey"
      );
  }

  return Object.freeze({
    studentKey,
    actionType,
    ...(analysisKey
      ? { analysisKey }
      : {})
  });
}

function materializeTeacherIntervention(
  command,
  dependencies
) {
  const canonicalCommand =
    createTeacherInterventionCommand(
      command
    );

  assertPlainObject(
    dependencies,
    "materializer dependencies"
  );

  assertAllowedFields(
    dependencies,
    materializerDependencySet,
    "materializer dependency"
  );

  const {
    createInterventionKey,
    nowIso
  } = dependencies;

  if (
    typeof createInterventionKey !==
    "function"
  ) {
    throw new TypeError(
      "createInterventionKey must be a function"
    );
  }

  if (typeof nowIso !== "function") {
    throw new TypeError(
      "nowIso must be a function"
    );
  }

  const interventionKey =
    assertNonEmptyString(
      createInterventionKey(
        canonicalCommand
      ),
      "generated interventionKey"
    );

  const createdAt =
    nowIso(canonicalCommand);

  return createTeacherIntervention({
    interventionKey,
    studentKey:
      canonicalCommand.studentKey,
    actionType:
      canonicalCommand.actionType,
    createdAt,
    provenance: {
      source: "classroom-world",
      ...(canonicalCommand.analysisKey
        ? {
            analysisKey:
              canonicalCommand.analysisKey
          }
        : {})
    }
  });
}

export {
  COMMAND_ALLOWED_FIELDS,
  MATERIALIZER_ALLOWED_DEPENDENCIES,
  createTeacherInterventionCommand,
  materializeTeacherIntervention
};
