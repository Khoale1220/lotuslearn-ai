import {
  TeacherInterventionValidationError,
  validateTeacherInterventionPayload,
} from "../validation/teacherInterventionValidation.js";

import {
  persistTeacherInterventionViaPython,
} from "../services/teacherInterventionBridge.js";

function statusForBridgeCode(code) {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;

    case "INTERVENTION_CONFLICT":
      return 409;

    case "PERSISTENCE_NOT_CONFIGURED":
    case "PYTHON_BRIDGE_SPAWN_FAILED":
    case "PYTHON_BRIDGE_TIMEOUT":
    case "PYTHON_BRIDGE_EMPTY_RESPONSE":
    case "PYTHON_BRIDGE_INVALID_RESPONSE":
    case "PYTHON_BRIDGE_OUTPUT_LIMIT":
    case "PYTHON_BRIDGE_ERROR_LIMIT":
    case "PYTHON_BRIDGE_INPUT_FAILED":
    case "PERSISTENCE_ERROR":
      return 503;

    default:
      return 500;
  }
}

function createTeacherInterventionController({
  persistIntervention =
    persistTeacherInterventionViaPython,
} = {}) {
  return async function handleTeacherIntervention(
    req,
    res,
  ) {
    let command;

    try {
      command =
        validateTeacherInterventionPayload(
          req?.body,
        );
    } catch (error) {
      if (
        error instanceof
        TeacherInterventionValidationError
      ) {
        return res.status(400).json({
          ok: false,
          error: {
            code:
              "TEACHER_INTERVENTION_VALIDATION_ERROR",
            message: error.message,
          },
        });
      }

      throw error;
    }

    try {
      const result =
        await persistIntervention(command);

      return res
        .status(result.created ? 201 : 200)
        .json({
          ok: true,
          created:
            result.created === true,
          intervention:
            result.intervention,
        });
    } catch (error) {
      const code =
        typeof error?.code === "string"
          ? error.code
          : "TEACHER_INTERVENTION_PERSISTENCE_ERROR";

      const status =
        statusForBridgeCode(code);

      return res.status(status).json({
        ok: false,
        error: {
          code,
          message:
            status === 400 ||
            status === 409
              ? error.message
              : "teacher intervention persistence is unavailable",
        },
      });
    }
  };
}

const handleTeacherIntervention =
  createTeacherInterventionController();

export {
  createTeacherInterventionController,
  handleTeacherIntervention,
};