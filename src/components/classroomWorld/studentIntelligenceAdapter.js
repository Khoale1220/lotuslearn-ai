import {
  createStudentIntelligence,
} from "./studentIntelligenceContract.js";

const PRIORITY_RANK = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
});

const SUPPORT_PRIORITY_MAP = Object.freeze({
  low: "low",
  light: "low",
  minimal: "low",
  "tier 1": "low",
  "tier-1": "low",

  medium: "medium",
  moderate: "medium",
  targeted: "medium",
  "tier 2": "medium",
  "tier-2": "medium",

  high: "high",
  intensive: "high",
  urgent: "high",
  "tier 3": "high",
  "tier-3": "high",
});

const FORBIDDEN_SOURCE_KEYS = new Set([
  "email",
  "fullName",
  "studentName",
  "rawSubmission",
  "rawSubmissions",
  "rawText",
  "submissionText",
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  return value;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function assertNoForbiddenSourceKeys(value, label) {
  assertPlainObject(value, label);

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_SOURCE_KEYS.has(key)) {
      throw new Error(`${label} contains forbidden raw-data field: ${key}`);
    }
  }
}

function normalizeStringArray(value, label) {
  if (value === undefined || value === null) {
    return [];
  }

  const source = Array.isArray(value) ? value : [value];

  const result = [];

  for (const item of source) {
    if (typeof item !== "string") {
      throw new TypeError(`${label} must contain strings only`);
    }

    const normalized = item.trim();

    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }

  return result;
}

function normalizeConfidence(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new RangeError("observation.confidence must be between 0 and 1");
  }

  return value;
}

function normalizePriority(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return SUPPORT_PRIORITY_MAP[normalized] ?? null;
}

function maxPriority(...values) {
  let result = "low";

  for (const value of values) {
    if (!value) continue;

    if (PRIORITY_RANK[value] > PRIORITY_RANK[result]) {
      result = value;
    }
  }

  return result;
}

function createSafeIdentity(index) {
  const ordinal = String(index + 1).padStart(2, "0");

  return Object.freeze({
    studentKey: `student-${ordinal}`,
    safeLabel: `Student ${ordinal}`,
  });
}

function clusterAffectsStudent(cluster, studentId) {
  if (!Array.isArray(cluster?.affectedStudentIds)) {
    return false;
  }

  return cluster.affectedStudentIds.includes(studentId);
}

function deriveLearningState(priority, misconceptions) {
  if (priority === "high") {
    return "needs-intervention";
  }

  if (misconceptions.length > 0) {
    return "needs-review";
  }

  return "on-track";
}

function collectRecommendedActions({
  matchingClusters,
  interventions,
  misconceptions,
}) {
  const actions = [];

  const push = (value) => {
    if (typeof value !== "string") return;

    const normalized = value.trim();

    if (normalized && !actions.includes(normalized)) {
      actions.push(normalized);
    }
  };

  const matchingClusterIds = new Set(
    matchingClusters
      .map((cluster) => cluster.clusterId)
      .filter((value) => typeof value === "string" && value.trim() !== "")
  );

  const matchingTitles = new Set(
    matchingClusters
      .map((cluster) => cluster.misconceptionTitle)
      .filter((value) => typeof value === "string" && value.trim() !== "")
  );

  for (const cluster of matchingClusters) {
    push(cluster.recommendedInstructionalResponse);
  }

  for (const intervention of interventions) {
    if (!intervention || typeof intervention !== "object") continue;

    const matchesCluster =
      typeof intervention.clusterId === "string" &&
      matchingClusterIds.has(intervention.clusterId);

    const matchesTitle =
      typeof intervention.targetMisconceptionTitle === "string" &&
      (
        matchingTitles.has(intervention.targetMisconceptionTitle) ||
        misconceptions.includes(intervention.targetMisconceptionTitle)
      );

    if (!matchesCluster && !matchesTitle) continue;

    push(intervention.title);
    push(intervention.suggestedActivity);
  }

  return actions;
}

function adaptStudentIntelligence({
  observations,
  misconceptionClusters = [],
  interventions = [],
  analysisVersion,
  sourceType,
}) {
  if (!Array.isArray(observations)) {
    throw new TypeError("observations must be an array");
  }

  if (!Array.isArray(misconceptionClusters)) {
    throw new TypeError("misconceptionClusters must be an array");
  }

  if (!Array.isArray(interventions)) {
    throw new TypeError("interventions must be an array");
  }

  const normalizedAnalysisVersion = assertNonEmptyString(
    analysisVersion,
    "analysisVersion"
  );

  const normalizedSourceType = assertNonEmptyString(
    sourceType,
    "sourceType"
  );

  const studentIds = new Set();

  const orderedObservations = observations
    .map((observation, originalIndex) => {
      assertNoForbiddenSourceKeys(
        observation,
        `observations[${originalIndex}]`
      );

      const studentId = assertNonEmptyString(
        observation.studentId,
        `observations[${originalIndex}].studentId`
      );

      if (studentIds.has(studentId)) {
        throw new Error(`duplicate observation studentId: ${studentId}`);
      }

      studentIds.add(studentId);

      return {
        observation,
        studentId,
      };
    })
    .sort((left, right) =>
      left.studentId.localeCompare(right.studentId)
    );

  const intelligence = orderedObservations.map(
    ({ observation, studentId }, index) => {
      const identity = createSafeIdentity(index);

      const strengths = normalizeStringArray(
        observation.demonstratedUnderstanding,
        `observation(${studentId}).demonstratedUnderstanding`
      );

      const directMisconceptions = normalizeStringArray(
        observation.misconceptions,
        `observation(${studentId}).misconceptions`
      );

      const matchingClusters = misconceptionClusters.filter((cluster) =>
        clusterAffectsStudent(cluster, studentId)
      );

      const clusterMisconceptions = matchingClusters
        .map((cluster) => cluster.misconceptionTitle)
        .filter(
          (value) =>
            typeof value === "string" && value.trim() !== ""
        )
        .map((value) => value.trim());

      const misconceptions = [
        ...new Set([
          ...directMisconceptions,
          ...clusterMisconceptions,
        ]),
      ];

      const sourcePriorities = [
        normalizePriority(observation.recommendedSupportLevel),
        ...matchingClusters.map((cluster) =>
          normalizePriority(cluster.teachingPriority)
        ),
      ];

      const baselinePriority =
        misconceptions.length > 0 ? "medium" : "low";

      const interventionPriority = maxPriority(
        baselinePriority,
        ...sourcePriorities
      );

      const recommendedActions = collectRecommendedActions({
        matchingClusters,
        interventions,
        misconceptions,
      });

      const confidence = normalizeConfidence(
        observation.confidence
      );

      return createStudentIntelligence({
        studentKey: identity.studentKey,
        safeLabel: identity.safeLabel,
        learningState: deriveLearningState(
          interventionPriority,
          misconceptions
        ),
        strengths,
        misconceptions,
        interventionPriority,
        recommendedActions,
        confidence,
        provenance: {
          analysisVersion: normalizedAnalysisVersion,
          sourceType: normalizedSourceType,
        },
      });
    }
  );

  return Object.freeze(intelligence);
}

export {
  adaptStudentIntelligence,
};