const TEACHER_INTERVENTION_ENDPOINT =
  "/api/teacher-interventions";

class TeacherInterventionClientError extends Error {
  constructor(
    code,
    message,
    {
      status = null,
      cause = null,
    } = {},
  ) {
    super(message);

    this.name =
      "TeacherInterventionClientError";

    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function persistTeacherInterventionCommand(
  command,
  {
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new TeacherInterventionClientError(
      "FETCH_UNAVAILABLE",
      "teacher intervention transport is unavailable",
    );
  }

  let response;

  try {
    response = await fetchImpl(
      TEACHER_INTERVENTION_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(command),
      },
    );
  } catch (error) {
    throw new TeacherInterventionClientError(
      "NETWORK_ERROR",
      "teacher intervention request failed",
      {
        cause: error,
      },
    );
  }

  const payload =
    await readJsonResponse(response);

  if (!response.ok) {
    throw new TeacherInterventionClientError(
      payload?.error?.code ??
        `HTTP_${response.status}`,
      payload?.error?.message ??
        "teacher intervention request was rejected",
      {
        status: response.status,
      },
    );
  }

  return payload;
}

export {
  TEACHER_INTERVENTION_ENDPOINT,
  TeacherInterventionClientError,
  persistTeacherInterventionCommand,
};