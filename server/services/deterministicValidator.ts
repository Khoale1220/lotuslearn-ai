import {
  InstructionalGroup,
  MisconceptionCluster,
  NormalizedSourceEvidence,
  StudentObservation,
  StudentSubmission,
} from '../../src/types';

export interface DeterministicValidationResult {
  coveragePassed: boolean;
  clusterMathPassed: boolean;
  groupPartitionPassed: boolean;
  evidenceValidationPassed: boolean;
  quotesGroundedCount: number;
  quotesFlaggedCount: number;
  issues: string[];
  auditedClusters: MisconceptionCluster[];
  auditedGroups: InstructionalGroup[];
  auditedObservations: StudentObservation[];
}

/**
 * Normalizes text for quote matching: collapses spaces, removes punctuation, lowercases
 */
export function normalizeTextForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[“”"''`.,!?;:()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies if an excerpt exists in the source text (typed vs image transcribed)
 */
export function checkQuoteInSource(
  excerpt: string,
  sourceText: string,
  sourceType: 'typed' | 'image_transcription' = 'typed'
): 'exact_quote_found' | 'image_transcription_match' | 'approximate_match' | 'unsupported_citation' {
  if (!excerpt || !sourceText) return 'unsupported_citation';

  const cleanExcerpt = normalizeTextForSearch(excerpt);
  const cleanSource = normalizeTextForSearch(sourceText);

  if (cleanSource.includes(cleanExcerpt)) {
    // Never claim verbatim match for image transcriptions
    return sourceType === 'image_transcription' ? 'image_transcription_match' : 'exact_quote_found';
  }

  // Check if significant keywords (3+ words in sequence) match
  const words = cleanExcerpt.split(' ').filter((w) => w.length > 2);
  if (words.length >= 3) {
    let matchCount = 0;
    for (const w of words) {
      if (cleanSource.includes(w)) matchCount++;
    }
    if (matchCount / words.length >= 0.75) {
      return sourceType === 'image_transcription' ? 'image_transcription_match' : 'approximate_match';
    }
  }

  return 'unsupported_citation';
}

/**
 * Priority 4.A: Observation coverage validation
 * Every submitted student ID must have exactly one observation.
 * No unknown student IDs. No duplicate observations.
 */
export function validateObservationCoverage(
  submissions: StudentSubmission[],
  observations: StudentObservation[]
): {
  passed: boolean;
  issues: string[];
  missingIds: string[];
  duplicateIds: string[];
  unknownIds: string[];
} {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const observedIds = new Set<string>();
  const duplicateIds: string[] = [];
  const unknownIds: string[] = [];
  const issues: string[] = [];

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

  const missingIds: string[] = [];
  for (const id of submittedIds) {
    if (!observedIds.has(id)) {
      missingIds.push(id);
      issues.push(`Missing observation for submitted student ID: "${id}"`);
    }
  }

  const passed = issues.length === 0;
  return { passed, issues, missingIds, duplicateIds, unknownIds };
}

/**
 * Priority 4.B: Misconception references validation
 * Every affectedStudentId must exist in submitted student IDs.
 */
export function validateStudentReferences(
  clusters: MisconceptionCluster[],
  submissions: StudentSubmission[]
): {
  passed: boolean;
  issues: string[];
  invalidStudentRefs: string[];
} {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const invalidStudentRefs: string[] = [];
  const issues: string[] = [];

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
    invalidStudentRefs,
  };
}

/**
 * Priority 4.C: Cluster math calculation
 * Do not trust Gemini to calculate prevalence. Compute in code:
 * studentCount = unique affectedStudentIds.length
 * percentageAffected = round(studentCount / totalStudents * 100)
 */
export function validateClusterMath(
  clusters: MisconceptionCluster[],
  totalStudents: number,
  validStudentIds?: Set<string>
): {
  passed: boolean;
  auditedClusters: MisconceptionCluster[];
  issues: string[];
} {
  const issues: string[] = [];
  let mathMismatches = 0;

  const auditedClusters = clusters.map((cluster) => {
    // Keep only valid student IDs if provided, and ensure uniqueness
    const uniqueAffected = Array.from(
      new Set(
        validStudentIds
          ? cluster.affectedStudentIds.filter((id) => validStudentIds.has(id))
          : cluster.affectedStudentIds
      )
    );

    const calculatedCount = uniqueAffected.length;
    const calculatedPercentage = Math.round((calculatedCount / Math.max(1, totalStudents)) * 100);

    if (
      cluster.studentCount !== undefined &&
      cluster.studentCount !== calculatedCount
    ) {
      mathMismatches++;
      issues.push(
        `Prevalence math corrected for "${cluster.misconceptionTitle}": Model reported ${cluster.studentCount} students, actual count is ${calculatedCount}`
      );
    }

    return {
      ...cluster,
      affectedStudentIds: uniqueAffected,
      studentCount: calculatedCount,
      percentageAffected: calculatedPercentage,
    };
  });

  return {
    passed: mathMismatches === 0,
    auditedClusters,
    issues,
  };
}

/**
 * Priority 4.D: Instructional group integrity validation
 * Every student must appear in exactly one instructional group.
 * Flag: missing students, duplicate assignments, unknown IDs.
 */
export function validateInstructionalGroupPartition(
  groups: InstructionalGroup[],
  submissions: StudentSubmission[]
): {
  passed: boolean;
  issues: string[];
  unassignedStudents: string[];
  duplicateAssignments: string[];
  unknownIds: string[];
  auditedGroups: InstructionalGroup[];
} {
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const assignedStudentToGroup = new Map<string, string>();
  const duplicateAssignments: string[] = [];
  const unknownIds: string[] = [];
  const issues: string[] = [];

  // A. Empty model groups check
  if (!groups || groups.length === 0) {
    issues.push('Model produced 0 instructional groups. Group partition validation failed.');
  }

  for (const group of groups || []) {
    for (const sId of group.studentIds) {
      // D. Unknown student ID check
      if (!submittedIds.has(sId)) {
        unknownIds.push(sId);
        issues.push(`Instructional group "${group.groupName}" assigned unknown student ID: "${sId}"`);
      }
      // C. Duplicate student assignment check
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

  // B. Omitted student check
  const unassignedStudents = Array.from(submittedIds).filter((id) => !assignedStudentToGroup.has(id));
  if (unassignedStudents.length > 0) {
    issues.push(`Unassigned students omitted from instructional groups: ${unassignedStudents.join(', ')}`);
  }

  // Safe partition repair: ensure groups exist and assign any omitted students
  let initialGroups = [...(groups || [])];
  if (initialGroups.length === 0 && submittedIds.size > 0) {
    initialGroups = [
      {
        groupId: 'group-repaired-1',
        groupName: 'Targeted Concept Clarification & Guided Practice',
        studentIds: Array.from(submittedIds),
        commonLearningNeed: 'Consolidate core lesson standard and address active misconception patterns.',
        evidenceSummary: 'All participating students requiring targeted practice.',
        suggestedActivity: 'Structured contrastive analysis and guided peer discussion.',
        teacherInstructions: 'Guide students through key contrasting examples and check for understanding.',
        exampleQuestion: 'Explain the reason behind your choice in the example problem.',
        estimatedDuration: '15 min',
        successCriterion: 'All students can independently identify and correct misconception patterns.',
      },
    ];
  }

  // Safe partition repair: ensure every submitted student appears exactly once in auditedGroups,
  // unknown IDs are stripped, and duplicate assignments are resolved deterministically for safe rendering.
  const seenInAudited = new Set<string>();
  const auditedGroups = initialGroups.map((g, idx) => {
    const studentIds: string[] = [];
    for (const id of g.studentIds) {
      if (submittedIds.has(id) && !seenInAudited.has(id)) {
        seenInAudited.add(id);
        studentIds.push(id);
      }
    }
    // If first group, also assign any omitted unassigned students
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
      studentIds,
    };
  });

  // CRITICAL INVARIANT: passed is strictly false if ANY issues were detected!
  // A repaired partition must NEVER transform an invalid model output into "passed".
  const passed = issues.length === 0;
  return {
    passed,
    issues,
    unassignedStudents,
    duplicateAssignments,
    unknownIds,
    auditedGroups,
  };
}

/**
 * Priority 4.E & Priority 6: Evidence quote grounding
 * Normalize whitespace and punctuation and verify that claimed quotation evidence exists.
 * Distinguish exact typed source vs image-transcribed evidence.
 * Fail-closed: If normalizedEvidence is unavailable and claims exist, claims CANNOT be marked grounded.
 */
export function validateEvidenceQuotes(
  clusters: MisconceptionCluster[],
  observations: StudentObservation[],
  normalizedEvidence?: NormalizedSourceEvidence[],
  submissions?: StudentSubmission[]
): {
  quotesGroundedCount: number;
  quotesFlaggedCount: number;
  evidenceValidationPassed: boolean;
  auditedClusters: MisconceptionCluster[];
  auditedObservations: StudentObservation[];
  issues: string[];
} {
  const issues: string[] = [];

  // Count total evidence-dependent claims across clusters and observations
  let totalClaimsCount = 0;
  for (const c of clusters) {
    totalClaimsCount += (c.evidenceExamples || []).length;
  }
  for (const o of observations) {
    totalClaimsCount += (o.supportingEvidence || []).length;
  }

  // Strict check: Is normalized evidence available?
  const hasNormalizedEvidence =
    Boolean(normalizedEvidence && Array.isArray(normalizedEvidence) && normalizedEvidence.length > 0);

  // If normalizedEvidence is unavailable and claims exist:
  // Fail-closed! Missing normalized evidence must NEVER silently behave as successful validation.
  if (!hasNormalizedEvidence) {
    if (totalClaimsCount > 0) {
      issues.push(
        'Evidence validation failure: normalizedEvidence is unavailable. All evidence-dependent claims remain ungrounded and require review.'
      );
    }

    const auditedClusters = clusters.map((cluster) => {
      const auditedEvidence = (cluster.evidenceExamples || []).map((ex) => ({
        ...ex,
        sourceType: 'typed' as const,
        deterministicMatch: 'unsupported_citation' as const,
      }));
      return {
        ...cluster,
        evidenceExamples: auditedEvidence,
        evidenceStrength: 'review_required' as const,
      };
    });

    const auditedObservations = observations.map((obs) => {
      const auditedEvidence = (obs.supportingEvidence || []).map((ev) => ({
        ...ev,
        sourceType: 'typed' as const,
        deterministicMatch: 'unsupported_citation' as const,
      }));
      return {
        ...obs,
        supportingEvidence: auditedEvidence,
        evidenceStrength: 'review_required' as const,
      };
    });

    return {
      quotesGroundedCount: 0,
      quotesFlaggedCount: totalClaimsCount,
      evidenceValidationPassed: totalClaimsCount === 0,
      auditedClusters,
      auditedObservations,
      issues,
    };
  }

  // When normalizedEvidence IS available, build lookup
  const sourceTextById = new Map<string, { text: string; sourceType: 'typed' | 'image_transcription' }>();
  if (normalizedEvidence && Array.isArray(normalizedEvidence)) {
    for (const norm of normalizedEvidence) {
      sourceTextById.set(norm.studentId, {
        text: norm.extractedText,
        sourceType: norm.sourceType,
      });
    }
  }

  // Canonical fallback only for canonical typed submissions if missing from normalizedEvidence
  if (submissions && Array.isArray(submissions)) {
    for (const sub of submissions) {
      if (!sourceTextById.has(sub.studentId) && sub.studentText) {
        sourceTextById.set(sub.studentId, {
          text: sub.studentText,
          sourceType:
            sub.workType === 'handwritten_work' || sub.workType === 'worksheet' || !!sub.imageBase64
              ? 'image_transcription'
              : 'typed',
        });
      }
    }
  }

  let quotesGroundedCount = 0;
  let quotesFlaggedCount = 0;

  // Audit clusters evidence
  const auditedClusters = clusters.map((cluster) => {
    let clusterQuotesPassed = 0;
    const auditedEvidence = (cluster.evidenceExamples || []).map((ex) => {
      const sourceInfo = sourceTextById.get(ex.studentId);
      const sourceType = sourceInfo?.sourceType || 'typed';
      const matchResult = sourceInfo
        ? checkQuoteInSource(ex.excerpt, sourceInfo.text, sourceType)
        : 'unsupported_citation';

      if (
        matchResult === 'exact_quote_found' ||
        matchResult === 'image_transcription_match' ||
        matchResult === 'approximate_match'
      ) {
        quotesGroundedCount++;
        clusterQuotesPassed++;
      } else {
        quotesFlaggedCount++;
        issues.push(
          `Unverified quote in cluster "${cluster.misconceptionTitle}": Student ${ex.studentId} quote "${ex.excerpt}" not found in source text.`
        );
      }

      return {
        ...ex,
        sourceType,
        deterministicMatch: matchResult,
      };
    });

    let evidenceStrength: 'strong' | 'moderate' | 'review_required' = 'moderate';
    if (
      clusterQuotesPassed >= 2 &&
      auditedEvidence.every((e) => e.deterministicMatch !== 'unsupported_citation')
    ) {
      evidenceStrength = 'strong';
    } else if (auditedEvidence.some((e) => e.deterministicMatch === 'unsupported_citation')) {
      evidenceStrength = 'review_required';
    }

    return {
      ...cluster,
      evidenceExamples: auditedEvidence,
      evidenceStrength,
    };
  });

  // Audit individual observations evidence
  const auditedObservations = observations.map((obs) => {
    const sourceInfo = sourceTextById.get(obs.studentId);
    let strongQuotes = 0;
    const auditedEvidence = (obs.supportingEvidence || []).map((ev) => {
      const match = sourceInfo
        ? checkQuoteInSource(ev.quoteOrDetail, sourceInfo.text, sourceInfo.sourceType)
        : 'unsupported_citation';

      if (
        match === 'exact_quote_found' ||
        match === 'image_transcription_match' ||
        match === 'approximate_match'
      ) {
        strongQuotes++;
      }

      return {
        ...ev,
        sourceType: sourceInfo?.sourceType || 'typed',
        deterministicMatch: match,
      };
    });

    const evidenceStrength: 'strong' | 'moderate' | 'review_required' =
      strongQuotes >= 1 ? 'strong' : auditedEvidence.length > 0 ? 'moderate' : 'review_required';

    return {
      ...obs,
      supportingEvidence: auditedEvidence,
      evidenceStrength,
    };
  });

  const evidenceValidationPassed =
    quotesFlaggedCount === 0 && (totalClaimsCount === 0 || quotesGroundedCount > 0);

  return {
    quotesGroundedCount,
    quotesFlaggedCount,
    evidenceValidationPassed,
    auditedClusters,
    auditedObservations,
    issues,
  };
}

/**
 * Master deterministic validation coordinating all 5 sub-validators
 */
export function runDeterministicValidation(params: {
  submissions: StudentSubmission[];
  normalizedEvidence?: NormalizedSourceEvidence[];
  observations: StudentObservation[];
  clusters: MisconceptionCluster[];
  groups: InstructionalGroup[];
}): DeterministicValidationResult {
  const { submissions, normalizedEvidence, observations, clusters, groups } = params;
  const allIssues: string[] = [];

  // 1. Observation Coverage
  const covResult = validateObservationCoverage(submissions, observations);
  allIssues.push(...covResult.issues);

  // 2. Student References
  const refResult = validateStudentReferences(clusters, submissions);
  allIssues.push(...refResult.issues);

  // 3. Cluster Math
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const mathResult = validateClusterMath(clusters, submissions.length, submittedIds);
  allIssues.push(...mathResult.issues);

  // 4. Instructional Group Partition
  const partResult = validateInstructionalGroupPartition(groups, submissions);
  allIssues.push(...partResult.issues);

  // 5. Evidence Quote Grounding
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
    auditedObservations: quoteResult.auditedObservations,
  };
}
