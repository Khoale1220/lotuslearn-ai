import {
  DeterministicMatchType,
  DifferentiatedIntervention,
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
 * Verifies if an excerpt exists in the source text (typed vs image transcribed).
 * P2C / P2D / P2E / P2.1:
 * - Literal exact substring match -> exact_quote_found (or image_transcription_match / image_transcription_verified)
 * - Conservative normalized exact match -> normalized_exact_match (or image_transcription_match / image_transcription_verified)
 * - Contiguous token sequence match (>= 3 consecutive words in sequence) -> approximate_match (review_required)
 * - Scattered tokens without contiguous sequence -> unsupported_citation
 * - Empty or missing excerpt/source -> unsupported_citation
 */
export function checkQuoteInSource(
  excerpt: string,
  sourceText: string,
  sourceType: 'typed' | 'image_transcription' = 'typed',
  isTranscriptionVerified: boolean = false
): DeterministicMatchType {
  if (!excerpt || !sourceText) return 'unsupported_citation';

  const trimmedExcerpt = excerpt.trim();
  if (!trimmedExcerpt) return 'unsupported_citation';

  // 1. Literal exact substring match (case, punctuation, and inner spacing preserved)
  if (sourceText.includes(trimmedExcerpt)) {
    if (sourceType === 'image_transcription') {
      return isTranscriptionVerified ? 'image_transcription_verified' : 'image_transcription_match';
    }
    return 'exact_quote_found';
  }

  // 2. Conservative normalized exact match (lowercased, punctuation stripped, normalized spacing)
  const cleanExcerpt = normalizeTextForSearch(trimmedExcerpt);
  const cleanSource = normalizeTextForSearch(sourceText);

  if (!cleanExcerpt || !cleanSource) return 'unsupported_citation';

  if (cleanSource.includes(cleanExcerpt)) {
    if (sourceType === 'image_transcription') {
      return isTranscriptionVerified ? 'image_transcription_verified' : 'image_transcription_match';
    }
    return 'normalized_exact_match';
  }

  // 3. Approximate contiguous sequence match (testing actual contiguous token sequence >= 3 words)
  const words = cleanExcerpt.split(' ').filter((w) => w.length > 0);
  if (words.length >= 3) {
    const windowSize = Math.min(3, words.length);
    let foundContiguousSequence = false;
    for (let i = 0; i <= words.length - windowSize; i++) {
      const windowStr = words.slice(i, i + windowSize).join(' ');
      if (cleanSource.includes(windowStr)) {
        foundContiguousSequence = true;
        break;
      }
    }
    if (foundContiguousSequence) {
      return 'approximate_match';
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
  const sourceTextById = new Map<
    string,
    { text: string; sourceType: 'typed' | 'image_transcription'; isTranscriptionVerified: boolean }
  >();
  if (normalizedEvidence && Array.isArray(normalizedEvidence)) {
    for (const norm of normalizedEvidence) {
      const isVerified =
        norm.confidenceOrStatus === 'transcription_reviewed' ||
        norm.confidenceOrStatus === 'transcription_supported';
      sourceTextById.set(norm.studentId, {
        text: norm.extractedText,
        sourceType: norm.sourceType,
        isTranscriptionVerified: isVerified,
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
          isTranscriptionVerified: false,
        });
      }
    }
  }

  const isGroundedMatch = (m: string) =>
    m === 'exact_match' ||
    m === 'exact_quote_found' ||
    m === 'normalized_exact_match' ||
    m === 'image_transcription_verified';

  let quotesGroundedCount = 0;
  let quotesFlaggedCount = 0;

  // Audit clusters evidence
  const auditedClusters = clusters.map((cluster) => {
    let clusterQuotesPassed = 0;
    const auditedEvidence = (cluster.evidenceExamples || []).map((ex) => {
      const sourceInfo = sourceTextById.get(ex.studentId);
      const sourceType = sourceInfo?.sourceType || 'typed';
      const matchResult = sourceInfo
        ? checkQuoteInSource(ex.excerpt, sourceInfo.text, sourceType, sourceInfo.isTranscriptionVerified)
        : 'unsupported_citation';

      // P2C / P2D / P2.1: Only exact source quotes (literal or normalized) or human-reviewed transcriptions count as grounded.
      // Unreviewed image transcriptions and approximate matches require teacher review and MUST NOT increment quotesGroundedCount.
      if (isGroundedMatch(matchResult)) {
        quotesGroundedCount++;
        clusterQuotesPassed++;
      } else {
        quotesFlaggedCount++;
        if (matchResult === 'image_transcription_match') {
          issues.push(
            `Unverified transcription quote in cluster "${cluster.misconceptionTitle}": Student ${ex.studentId} quote "${ex.excerpt}" matches unverified image transcription and requires review.`
          );
        } else if (matchResult === 'approximate_match') {
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
        deterministicMatch: matchResult,
      };
    });

    let evidenceStrength: 'strong' | 'moderate' | 'review_required' = 'moderate';
    if (
      clusterQuotesPassed >= 2 &&
      auditedEvidence.every((e) => isGroundedMatch(e.deterministicMatch || ''))
    ) {
      evidenceStrength = 'strong';
    } else if (
      auditedEvidence.some(
        (e) =>
          e.deterministicMatch === 'unsupported_citation' ||
          e.deterministicMatch === 'approximate_match' ||
          e.deterministicMatch === 'image_transcription_match'
      )
    ) {
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
        ? checkQuoteInSource(ev.quoteOrDetail, sourceInfo.text, sourceInfo.sourceType, sourceInfo.isTranscriptionVerified)
        : 'unsupported_citation';

      if (isGroundedMatch(match)) {
        strongQuotes++;
      }

      return {
        ...ev,
        sourceType: sourceInfo?.sourceType || 'typed',
        deterministicMatch: match,
      };
    });

    const hasFlagged = auditedEvidence.some(
      (e) =>
        e.deterministicMatch === 'unsupported_citation' ||
        e.deterministicMatch === 'approximate_match' ||
        e.deterministicMatch === 'image_transcription_match'
    );
    const evidenceStrength: 'strong' | 'moderate' | 'review_required' =
      hasFlagged ? 'review_required' : strongQuotes >= 1 ? 'strong' : auditedEvidence.length > 0 ? 'moderate' : 'review_required';

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

/**
 * P2.1 Stable Domain Identity & Linkage Validator
 * Enforces:
 * - clusterId uniqueness among clusters
 * - interventionId uniqueness among interventions
 * - clusterId referenced by intervention actually exists in clusters
 * - NEW DATA: clusterId is mandatory and cannot be omitted
 * - LEGACY DATA: missing clusterId is migrated only when relationship is unambiguous
 *   (exactly 1 cluster matches by title). If ambiguous (multiple clusters same title or none),
 *   do NOT guess! Mark as unresolved.
 */
export function validateInterventionRelationships(
  interventions: DifferentiatedIntervention[],
  clusters: MisconceptionCluster[],
  options?: { isNewData?: boolean }
): {
  passed: boolean;
  issues: string[];
  auditedInterventions: DifferentiatedIntervention[];
} {
  const issues: string[] = [];
  const clusterIdSet = new Set<string>();
  const duplicateClusterIds = new Set<string>();

  for (const c of clusters) {
    if (clusterIdSet.has(c.clusterId)) {
      duplicateClusterIds.add(c.clusterId);
    }
    clusterIdSet.add(c.clusterId);
  }

  if (duplicateClusterIds.size > 0) {
    issues.push(`Duplicate cluster IDs detected: ${Array.from(duplicateClusterIds).join(', ')}`);
  }

  const interventionIdSet = new Set<string>();
  const duplicateInterventionIds = new Set<string>();
  const auditedInterventions: DifferentiatedIntervention[] = [];

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
          clusterId: 'unresolved_missing_cluster_id',
        });
      } else {
        // Legacy migration: try unambiguous title match
        const matchingClusters = clusters.filter(
          (c) =>
            c.misconceptionTitle.trim().toLowerCase() ===
            (int.targetMisconceptionTitle || '').trim().toLowerCase()
        );
        if (matchingClusters.length === 1) {
          auditedInterventions.push({
            ...int,
            clusterId: matchingClusters[0].clusterId,
          });
        } else {
          // 0 or >1 matching clusters: DO NOT GUESS!
          issues.push(
            `Legacy intervention "${int.title || int.interventionId}" has ambiguous relationship (${matchingClusters.length} matching clusters for "${int.targetMisconceptionTitle}"). Relationship cannot be inferred.`
          );
          auditedInterventions.push({
            ...int,
            clusterId: 'unresolved_ambiguous_relationship',
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
    issues.push(`Duplicate intervention IDs detected: ${Array.from(duplicateInterventionIds).join(', ')}`);
  }

  return {
    passed: issues.length === 0,
    issues,
    auditedInterventions,
  };
}

export function migrateLegacyInterventions(
  interventions: DifferentiatedIntervention[],
  clusters: MisconceptionCluster[]
): DifferentiatedIntervention[] {
  return validateInterventionRelationships(interventions, clusters, { isNewData: false }).auditedInterventions;
}

