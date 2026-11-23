import { adaptStudentIntelligence } from "./studentIntelligenceAdapter.js";
import { createStudentIntelligenceRuntimeStore } from "./studentIntelligenceRuntime.js";

function createStudentIntelligenceBridge(input, storeOptions = {}) {
  const sanitizedRecords = adaptStudentIntelligence(input);

  if (!Array.isArray(sanitizedRecords)) {
    throw new TypeError("adaptStudentIntelligence must return an array");
  }

  return createStudentIntelligenceRuntimeStore(
    sanitizedRecords,
    storeOptions
  );
}

export {
  createStudentIntelligenceBridge
};