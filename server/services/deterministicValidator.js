function normalizeTextForSearch(str) {
  return str.toLowerCase().replace(/[“”"''`.,!?;:()\[\]{}]/g, "").replace(/\s+/g, " ").trim();
}
function checkQuoteInSource(excerpt, sourceText, sourceType = "typed", isTranscriptionVerified = false) {
  if (!excerpt || !sourceText) return "unsupported_citation";
  const trimmedExcerpt = excerpt.trim();
  if (!trimmedExcerpt) return "unsupported_citation";
  if (sourceText.includes(trimmedExcerpt)) {
    if (sourceType === "image_transcription") {
      return isTranscriptionVerified ? "image_transcription_verified" : "image_transcription_match";
    }
    return "exact_quote_found";
  }
  const cleanExcerpt = normalizeTextForSearch(trimmedExcerpt);
  const cleanSource = normalizeTextForSearch(sourceText);
  if (!cleanExcerpt || !cleanSource) return "unsupported_citation";
  if (cleanSource.includes(cleanExcerpt)) {
    if (sourceType === "image_transcription") {
      return isTranscriptionVerified ? "image_transcription_verified" : "image_transcription_match";
    }
    return "normalized_exact_match";
  }
  const words = cleanExcerpt.split(" ").filter((w) => w.length > 0);
  if (words.length >= 3) {
    const windowSize = Math.min(3, words.length);
    let foundContiguousSequence = false;
    for (let i = 0; i <= words.length - windowSize; i++) {
      const windowStr = words.slice(i, i + windowSize).join(" ");
      if (cleanSource.includes(windowStr)) {
        foundContiguousSequence = true;
        break;
      }
    }
    if (foundContiguousSequence) {
      return "approximate_match";
    }
  }
  return "unsupported_citation";
}
function validateObservationCoverage(submissions, observations) {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const observedIds = /* @__PURE__ */ new Set();
  const duplicateIds = [];
  const unknownIds = [];
  const issues = [];
  for (const obs of observations) {
    if (!submittedIds.has(obs.studentId)) {
      unknownIds.push(obs.studentId);
      issues.push(`Observation references unknown student ID: "${obs.studentId}"`);
    }
    if (observedIds.has(obs.studentId)) {
      duplicateIds.push(obs.studentId);
      issues.push(`Duplicate observation detected for student ID: "${obs.studentId}"`);
    }
    observedIds.add(obs.studentId);
  }
  const missingIds = [];
  for (const id of submittedIds) {
    if (!observedIds.has(id)) {
      missingIds.push(id);
      issues.push(`Missing observation for submitted student ID: "${id}"`);
    }
  }
  const passed = issues.length === 0;
  return { passed, issues, missingIds, duplicateIds, unknownIds };
}
function validateStudentReferences(clusters, submissions) {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const invalidStudentRefs = [];
  const issues = [];
  for (const cluster of clusters) {
    for (const studentId of cluster.affectedStudentIds) {
      if (!submittedIds.has(studentId)) {
        invalidStudentRefs.push(studentId);
        issues.push(
          `Cluster "${cluster.misconceptionTitle}" referenced non-existent student ID: "${studentId}"`
        );
      }
    }
  }
  return {
    passed: issues.length === 0,
    issues,
    invalidStudentRefs
  };
}
function validateClusterMath(clusters, totalStudents, validStudentIds) {
  const issues = [];
  let mathMismatches = 0;
  const auditedClusters = clusters.map((cluster) => {
    const uniqueAffected = Array.from(
      new Set(
        validStudentIds ? cluster.affectedStudentIds.filter((id) => validStudentIds.has(id)) : cluster.affectedStudentIds
      )
    );
    const calculatedCount = uniqueAffected.length;
    const calculatedPercentage = Math.round(calculatedCount / Math.max(1, totalStudents) * 100);
    if (cluster.studentCount !== void 0 && cluster.studentCount !== calculatedCount) {
      mathMismatches++;
      issues.push(
        `Prevalence math corrected for "${cluster.misconceptionTitle}": Model reported ${cluster.studentCount} students, actual count is ${calculatedCount}`
      );
    }
    return {
      ...cluster,
      affectedStudentIds: uniqueAffected,
      studentCount: calculatedCount,
      percentageAffected: calculatedPercentage
    };
  });
  return {
    passed: mathMismatches === 0,
    auditedClusters,
    issues
  };
}
function validateInstructionalGroupPartition(groups, submissions) {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const assignedStudentToGroup = /* @__PURE__ */ new Map();
  const duplicateAssignments = [];
  const unknownIds = [];
  const issues = [];
  if (!groups || groups.length === 0) {
    issues.push("Model produced 0 instructional groups. Group partition validation failed.");
  }
  for (const group of groups || []) {
    for (const sId of group.studentIds) {
      if (!submittedIds.has(sId)) {
        unknownIds.push(sId);
        issues.push(`Instructional group "${group.groupName}" assigned unknown student ID: "${sId}"`);
      }
      if (assignedStudentToGroup.has(sId)) {
        duplicateAssignments.push(sId);
        issues.push(
          `Duplicate assignment: Student "${sId}" assigned to both "${assignedStudentToGroup.get(sId)}" and "${group.groupName}"`
        );
      } else {
        assignedStudentToGroup.set(sId, group.groupName);
      }
    }
  }
  const unassignedStudents = Array.from(submittedIds).filter((id) => !assignedStudentToGroup.has(id));
  if (unassignedStudents.length > 0) {
    issues.push(`Unassigned students omitted from instructional groups: ${unassignedStudents.join(", ")}`);
  }
  let initialGroups = [...groups || []];
  if (initialGroups.length === 0 && submittedIds.size > 0) {
    initialGroups = [
      {
        groupId: "group-repaired-1",
        groupName: "Targeted Concept Clarification & Guided Practice",
        studentIds: Array.from(submittedIds),
        commonLearningNeed: "Consolidate core lesson standard and address active misconception patterns.",
        evidenceSummary: "All participating students requiring targeted practice.",
        suggestedActivity: "Structured contrastive analysis and guided peer discussion.",
        teacherInstructions: "Guide students through key contrasting examples and check for understanding.",
        exampleQuestion: "Explain the reason behind your choice in the example problem.",
        estimatedDuration: "15 min",
        successCriterion: "All students can independently identify and correct misconception patterns."
      }
    ];
  }
  const seenInAudited = /* @__PURE__ */ new Set();
  const auditedGroups = initialGroups.map((g, idx) => {
    const studentIds = [];
    for (const id of g.studentIds) {
      if (submittedIds.has(id) && !seenInAudited.has(id)) {
        seenInAudited.add(id);
        studentIds.push(id);
      }
    }
    if (idx === 0) {
      for (const id of submittedIds) {
        if (!seenInAudited.has(id)) {
          seenInAudited.add(id);
          studentIds.push(id);
        }
      }
    }
    return {
      ...g,
      studentIds
    };
  });
  const passed = issues.length === 0;
  return {
    passed,
    issues,
    unassignedStudents,
    duplicateAssignments,
    unknownIds,
    auditedGroups
  };
}
function validateEvidenceQuotes(clusters, observations, normalizedEvidence, submissions) {
  const issues = [];
  let totalClaimsCount = 0;
  for (const c of clusters) {
    totalClaimsCount += (c.evidenceExamples || []).length;
  }
  for (const o of observations) {
    totalClaimsCount += (o.supportingEvidence || []).length;
  }
  const hasNormalizedEvidence = Boolean(normalizedEvidence && Array.isArray(normalizedEvidence) && normalizedEvidence.length > 0);
  if (!hasNormalizedEvidence) {
    if (totalClaimsCount > 0) {
      issues.push(
        "Evidence validation failure: normalizedEvidence is unavailable. All evidence-dependent claims remain ungrounded and require review."
      );
    }
    const auditedClusters2 = clusters.map((cluster) => {
      const auditedEvidence = (cluster.evidenceExamples || []).map((ex) => ({
        ...ex,
        sourceType: "typed",
        deterministicMatch: "unsupported_citation"
      }));
      return {
        ...cluster,
        evidenceExamples: auditedEvidence,
        evidenceStrength: "review_required"
      };
    });
    const auditedObservations2 = observations.map((obs) => {
      const auditedEvidence = (obs.supportingEvidence || []).map((ev) => ({
        ...ev,
        sourceType: "typed",
        deterministicMatch: "unsupported_citation"
      }));
      return {
        ...obs,
        supportingEvidence: auditedEvidence,
        evidenceStrength: "review_required"
      };
    });
    return {
      quotesGroundedCount: 0,
      quotesFlaggedCount: totalClaimsCount,
      evidenceValidationPassed: totalClaimsCount === 0,
      auditedClusters: auditedClusters2,
      auditedObservations: auditedObservations2,
      issues
    };
  }
  const sourceTextById = /* @__PURE__ */ new Map();
  if (normalizedEvidence && Array.isArray(normalizedEvidence)) {
    for (const norm of normalizedEvidence) {
      const isVerified = norm.confidenceOrStatus === "transcription_reviewed" || norm.confidenceOrStatus === "transcription_supported";
      sourceTextById.set(norm.studentId, {
        text: norm.extractedText,
        sourceType: norm.sourceType,
        isTranscriptionVerified: isVerified
      });
    }
  }
  if (submissions && Array.isArray(submissions)) {
    for (const sub of submissions) {
      if (!sourceTextById.has(sub.studentId) && sub.studentText) {
        sourceTextById.set(sub.studentId, {
          text: sub.studentText,
          sourceType: sub.workType === "handwritten_work" || sub.workType === "worksheet" || !!sub.imageBase64 ? "image_transcription" : "typed",
          isTranscriptionVerified: false
        });
      }
    }
  }
  const isGroundedMatch = (m) => m === "exact_match" || m === "exact_quote_found" || m === "normalized_exact_match" || m === "image_transcription_verified";
  let quotesGroundedCount = 0;
  let quotesFlaggedCount = 0;
  const auditedClusters = clusters.map((cluster) => {
    let clusterQuotesPassed = 0;
    const auditedEvidence = (cluster.evidenceExamples || []).map((ex) => {
      const sourceInfo = sourceTextById.get(ex.studentId);
      const sourceType = sourceInfo?.sourceType || "typed";
      const matchResult = sourceInfo ? checkQuoteInSource(ex.excerpt, sourceInfo.text, sourceType, sourceInfo.isTranscriptionVerified) : "unsupported_citation";
      if (isGroundedMatch(matchResult)) {
        quotesGroundedCount++;
        clusterQuotesPassed++;
      } else {
        quotesFlaggedCount++;
        if (matchResult === "image_transcription_match") {
          issues.push(
            `Unverified transcription quote in cluster "${cluster.misconceptionTitle}": Student ${ex.studentId} quote "${ex.excerpt}" matches unverified image transcription and requires review.`
          );
        } else if (matchResult === "approximate_match") {
          issues.push(
            `Approximate quote in cluster "${cluster.misconceptionTitle}": Student ${ex.studentId} quote "${ex.excerpt}" is only an approximate match and requires teacher review.`
          );
        } else {
          issues.push(
            `Unverified quote in cluster "${cluster.misconceptionTitle}": Student ${ex.studentId} quote "${ex.excerpt}" not found in source text.`
          );
        }
      }
      return {
        ...ex,
        sourceType,
        deterministicMatch: matchResult
      };
    });
    let evidenceStrength = "moderate";
    if (clusterQuotesPassed >= 2 && auditedEvidence.every((e) => isGroundedMatch(e.deterministicMatch || ""))) {
      evidenceStrength = "strong";
    } else if (auditedEvidence.some(
      (e) => e.deterministicMatch === "unsupported_citation" || e.deterministicMatch === "approximate_match" || e.deterministicMatch === "image_transcription_match"
    )) {
      evidenceStrength = "review_required";
    }
    return {
      ...cluster,
      evidenceExamples: auditedEvidence,
      evidenceStrength
    };
  });
  const auditedObservations = observations.map((obs) => {
    const sourceInfo = sourceTextById.get(obs.studentId);
    let strongQuotes = 0;
    const auditedEvidence = (obs.supportingEvidence || []).map((ev) => {
      const match = sourceInfo ? checkQuoteInSource(ev.quoteOrDetail, sourceInfo.text, sourceInfo.sourceType, sourceInfo.isTranscriptionVerified) : "unsupported_citation";
      if (isGroundedMatch(match)) {
        strongQuotes++;
      }
      return {
        ...ev,
        sourceType: sourceInfo?.sourceType || "typed",
        deterministicMatch: match
      };
    });
    const hasFlagged = auditedEvidence.some(
      (e) => e.deterministicMatch === "unsupported_citation" || e.deterministicMatch === "approximate_match" || e.deterministicMatch === "image_transcription_match"
    );
    const evidenceStrength = hasFlagged ? "review_required" : strongQuotes >= 1 ? "strong" : auditedEvidence.length > 0 ? "moderate" : "review_required";
    return {
      ...obs,
      supportingEvidence: auditedEvidence,
      evidenceStrength
    };
  });
  const evidenceValidationPassed = quotesFlaggedCount === 0 && (totalClaimsCount === 0 || quotesGroundedCount > 0);
  return {
    quotesGroundedCount,
    quotesFlaggedCount,
    evidenceValidationPassed,
    auditedClusters,
    auditedObservations,
    issues
  };
}
function runDeterministicValidation(params) {
  const { submissions, normalizedEvidence, observations, clusters, groups } = params;
  const allIssues = [];
  const covResult = validateObservationCoverage(submissions, observations);
  allIssues.push(...covResult.issues);
  const refResult = validateStudentReferences(clusters, submissions);
  allIssues.push(...refResult.issues);
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const mathResult = validateClusterMath(clusters, submissions.length, submittedIds);
  allIssues.push(...mathResult.issues);
  const partResult = validateInstructionalGroupPartition(groups, submissions);
  allIssues.push(...partResult.issues);
  const quoteResult = validateEvidenceQuotes(
    mathResult.auditedClusters,
    observations,
    normalizedEvidence,
    submissions
  );
  allIssues.push(...quoteResult.issues);
  return {
    coveragePassed: covResult.passed,
    clusterMathPassed: mathResult.passed && refResult.passed,
    groupPartitionPassed: partResult.passed,
    evidenceValidationPassed: quoteResult.evidenceValidationPassed,
    quotesGroundedCount: quoteResult.quotesGroundedCount,
    quotesFlaggedCount: quoteResult.quotesFlaggedCount,
    issues: allIssues,
    auditedClusters: quoteResult.auditedClusters,
    auditedGroups: partResult.auditedGroups,
    auditedObservations: quoteResult.auditedObservations
  };
}
function validateInterventionRelationships(interventions, clusters, options) {
  const issues = [];
  const clusterIdSet = /* @__PURE__ */ new Set();
  const duplicateClusterIds = /* @__PURE__ */ new Set();
  for (const c of clusters) {
    if (clusterIdSet.has(c.clusterId)) {
      duplicateClusterIds.add(c.clusterId);
    }
    clusterIdSet.add(c.clusterId);
  }
  if (duplicateClusterIds.size > 0) {
    issues.push(`Duplicate cluster IDs detected: ${Array.from(duplicateClusterIds).join(", ")}`);
  }
  const interventionIdSet = /* @__PURE__ */ new Set();
  const duplicateInterventionIds = /* @__PURE__ */ new Set();
  const auditedInterventions = [];
  for (const int of interventions) {
    if (int.interventionId) {
      if (interventionIdSet.has(int.interventionId)) {
        duplicateInterventionIds.add(int.interventionId);
      }
      interventionIdSet.add(int.interventionId);
    }
    if (!int.clusterId) {
      if (options?.isNewData) {
        issues.push(`New canonical intervention "${int.title || int.interventionId}" is missing required clusterId.`);
        auditedInterventions.push({
          ...int,
          clusterId: "unresolved_missing_cluster_id"
        });
      } else {
        const matchingClusters = clusters.filter(
          (c) => c.misconceptionTitle.trim().toLowerCase() === (int.targetMisconceptionTitle || "").trim().toLowerCase()
        );
        if (matchingClusters.length === 1) {
          auditedInterventions.push({
            ...int,
            clusterId: matchingClusters[0].clusterId
          });
        } else {
          issues.push(
            `Legacy intervention "${int.title || int.interventionId}" has ambiguous relationship (${matchingClusters.length} matching clusters for "${int.targetMisconceptionTitle}"). Relationship cannot be inferred.`
          );
          auditedInterventions.push({
            ...int,
            clusterId: "unresolved_ambiguous_relationship"
          });
        }
      }
    } else {
      if (!clusterIdSet.has(int.clusterId)) {
        issues.push(
          `Intervention "${int.title || int.interventionId}" references unknown clusterId: "${int.clusterId}"`
        );
      }
      auditedInterventions.push(int);
    }
  }
  if (duplicateInterventionIds.size > 0) {
    issues.push(`Duplicate intervention IDs detected: ${Array.from(duplicateInterventionIds).join(", ")}`);
  }
  return {
    passed: issues.length === 0,
    issues,
    auditedInterventions
  };
}
function migrateLegacyInterventions(interventions, clusters) {
  return validateInterventionRelationships(interventions, clusters, { isNewData: false }).auditedInterventions;
}
export {
  checkQuoteInSource,
  migrateLegacyInterventions,
  normalizeTextForSearch,
  runDeterministicValidation,
  validateClusterMath,
  validateEvidenceQuotes,
  validateInstructionalGroupPartition,
  validateInterventionRelationships,
  validateObservationCoverage,
  validateStudentReferences
};
