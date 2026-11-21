import { createHash } from "crypto";
function canonicalizeDemoPayload(context, submissions) {
  const ctx = [
    (context?.subject || "").trim(),
    (context?.gradeLevel || "").trim(),
    (context?.lessonTitle || "").trim(),
    (context?.learningObjective || "").trim()
  ].join("|");
  const subs = [...submissions || []].sort((a, b) => (a.studentId || "").localeCompare(b.studentId || "")).map((s) => [
    (s.studentId || "").trim(),
    (s.workType || "typed").trim().toLowerCase(),
    (s.studentText || "").trim().replace(/\s+/g, " ")
  ].join(":")).join(";");
  return `${ctx}||${subs}`;
}
function computeDatasetFingerprint(context, submissions) {
  const payload = canonicalizeDemoPayload(context, submissions);
  return createHash("sha256").update(payload).digest("hex");
}
const DEMO_DATASET_SHA256 = "f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce";
function isExactDemoClassroom(context, submissions) {
  if (!submissions || submissions.length === 0 || !context) {
    return false;
  }
  const fingerprint = computeDatasetFingerprint(context, submissions);
  return fingerprint === DEMO_DATASET_SHA256;
}
export {
  DEMO_DATASET_SHA256,
  canonicalizeDemoPayload,
  computeDatasetFingerprint,
  isExactDemoClassroom
};
