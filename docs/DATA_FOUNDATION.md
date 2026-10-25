# LotusLearn AI — Data Architecture & Engineering Foundation

## 1. Executive Summary

This document specifies the data engineering foundation and data science readiness framework for LotusLearn AI. It establishes:
1. A rigorous educational domain data model (entities, relationships, and data contracts).
2. End-to-end data lineage through the 7-stage privacy and analysis lifecycle.
3. Strict data retention boundaries ensuring zero student PII enters persistent storage tiers.
4. Production-grade data engineering patterns (idempotency, schema validation, streaming events).
5. Quantitative learning analytics metrics and offline evaluation protocols.

---

## 2. Educational Domain Data Model

### Entity-Relationship Conceptual Model

```text
┌───────────────────────┐
│    LearningContext    │
└──────────┬────────────┘
           │ 1:N
┌──────────▼────────────┐        ┌─────────────────────────┐
│ StudentSubmissionInput├───────►│ SanitizedSourceEvidence │
└───────────────────────┘ 1:1    └────────────┬────────────┘
                                              │ 1:1
                                 ┌────────────▼────────────┐
                                 │   StudentObservation    │
                                 └────────────┬────────────┘
                                              │ N:M
                                 ┌────────────▼────────────┐
                                 │  MisconceptionCluster   │◄──────┐
                                 └────────────┬────────────┘       │ 1:N
                                              │ N:M                │
                                 ┌────────────▼────────────┐ ┌─────┴──────────────────┐
                                 │   InstructionalGroup    │ │DifferentiatedIntervention│
                                 └─────────────────────────┘ └────────────────────────┘
```

### Formal Entity Schemas

#### 1. `LearningContext`
Represents curricular and pedagogical framing for an assessment episode.

```typescript
interface LearningContext {
  contextId: string;              // UUID
  subject: string;                // e.g., "English Language Arts" (max 100)
  gradeLevel: string;             // e.g., "Grade 10" (max 50)
  lessonTitle: string;            // e.g., "Diagnostic: Present Perfect vs Past Simple" (max 200)
  learningObjective: string;      // Core learning goal (min 3, max 1,000)
  expectedAnswerRubric: string;   // Pedagogical rubric / criteria (max 4,000)
  teacherNotes?: string;          // Formative classroom context (max 2,000)
}
```

#### 2. `StudentSubmissionInput` (Ingestion Entity — Transient Only)
Raw input provided at the ingestion boundary. **Never persisted to database or local storage.**

```typescript
interface StudentSubmissionInput {
  studentId: string;              // Roster identifier or pseudonym (1–64 chars)
  studentText: string;            // Typed student answer (max 10,000 chars)
  workType: 'typed' | 'handwritten_work' | 'worksheet';
  imageBase64?: string;           // Base64 encoded image (max 7.5 MB)
  mimeType?: 'image/jpeg' | 'image/png';
}
```

#### 3. `SanitizedSourceEvidence` (Clean Analytical Entity)
De-identified, normalized artifact produced by the Privacy Gateway.

```typescript
interface SanitizedSourceEvidence {
  studentId: string;              // Normalized pseudonym (e.g., "Student 01")
  sourceType: 'typed' | 'image_transcription';
  extractedText: string;          // De-identified text representation
  confidenceOrStatus:
    | 'exact_source'
    | 'transcription_unverified'
    | 'transcription_supported'
    | 'transcription_reviewed';
}
```

#### 4. `StudentObservation` (Micro Diagnostic Reasoning)
Granular, per-student pedagogical evaluation grounded in verbatim evidence.

```typescript
interface StudentObservation {
  studentId: string;
  demonstratedUnderstanding: string[];
  misconceptions: string[];
  supportingEvidence: Array<{
    quoteOrDetail: string;        // Verbatim student excerpt
    interpretation: string;       // Cognitive breakdown explanation
    deterministicMatch?:
      | 'exact_match'
      | 'normalized_exact_match'
      | 'approximate_match'
      | 'unsupported_citation';
  }>;
  rubricAlignment: string;
  confidence: number;             // Model-estimated confidence (0.0 to 1.0)
  recommendedSupportLevel:
    | 'extension'
    | 'concept_clarification'
    | 'guided_practice'
    | 'error_correction';
}
```

#### 5. `MisconceptionCluster` (Macro Synthesis Entity)
Cohort-level clustering synthesized across individual observations.

```typescript
interface MisconceptionCluster {
  clusterId: string;              // e.g., "cluster-1"
  misconceptionTitle: string;     // Pedagogical classification title
  explanation: string;            // 2–3 sentence root-cause synthesis
  affectedStudentIds: string[];   // Cohort subset exhibiting this error
  studentCount: number;           // Deterministically verified count
  percentageAffected: number;     // Deterministically verified percentage (0–100%)
  evidenceExamples: Array<{
    studentId: string;
    excerpt: string;
    groundingReason: string;
    deterministicMatch?: string;
  }>;
  teachingPriority: 'urgent' | 'high' | 'moderate';
  teacherDecision: 'pending' | 'accepted' | 'edited' | 'dismissed';
}
```

#### 6. `InstructionalGroup` (Actionable Grouping Entity)
Complete partition of students organized into differentiated instructional cohorts.

```typescript
interface InstructionalGroup {
  groupId: string;
  groupName: string;              // e.g., "Targeted Concept Review: Finished-Time Markers"
  studentIds: string[];           // Non-overlapping assigned students
  commonLearningNeed: string;
  suggestedActivity: string;
  teacherInstructions: string;
  exampleQuestion: string;
  estimatedDuration: string;      // e.g., "12-15 min"
  successCriterion: string;
}
```

#### 7. `DifferentiatedIntervention` & `NextLessonPlan`
Concrete classroom intervention cards and 25-minute timeline for the next instructional session.

```typescript
interface DifferentiatedIntervention {
  interventionId: string;
  clusterId: string;              // Mandatory foreign key to parent cluster
  targetMisconceptionTitle: string;
  title: string;
  supportTier:
    | 'Guided Practice'
    | 'Concept Clarification'
    | 'Ready for Extension'
    | 'Error Correction';
  rationale: string;
  suggestedActivity: string;
  teacherScript: string;
  exampleQuestion: string;
  exitTicketQuestion: string;
  teacherDecision: 'pending' | 'accepted' | 'edited' | 'dismissed';
}
```

---

## 3. End-to-End Data Lineage & Lifecycle

The following sequence details how data transitions through stages from raw student input to educator decision:

```text
[Raw Input] ─────────► [Stage 1: Privacy Gateway] ────────► [Stage 2: Observer]
 (Typed/Image)          (SDP / Regex Scrubbing)              (Extract Citations)
                                                                      │
[Stage 5: Strategist] ◄─ [Stage 4: Deterministic Audit] ◄── [Stage 3: Diagnosis]
 (Groups & Plans)        (Coverage & Math Verification)      (Synthesize Clusters)
         │
         ▼
[Stage 6: Adversarial Verifier] ────────► [Stage 7: Teacher Review State Machine]
 (Evidence Grounding Audit)                (Pending / Accepted / Edited / Dismissed)
```

| Lifecycle Stage | Component | Input Schema | Output Schema | Invariance / Quality Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 0: Ingestion** | Express HTTP Controller | HTTP POST Request Body | `AnalyzeRequestSchema` | Bounded strings, supported MIME types, non-empty work. |
| **Stage 1: Privacy** | `PrivacyGateway` | `StudentSubmissionInput[]` | `SanitizedSourceEvidence[]` | Zero unredacted PII in output; fail closed on error. |
| **Stage 2: Observer** | Gemini 3.5 Flash-Lite | `SanitizedSourceEvidence[]` | `StudentObservation[]` | 100% student roster coverage; non-stigmatizing tiers. |
| **Stage 3: Diagnosis** | Gemini 3.8 Flash | `StudentObservation[]` | `MisconceptionCluster[]` | Root-cause explanations; grounded excerpt links. |
| **Stage 4: Validation** | Deterministic Code | Observations + Clusters | `DeterministicValidationResult`| Code-computed prevalence math; group partition completeness. |
| **Stage 5: Strategy** | Gemini 3.8 Flash | Verified Clusters | `StrategyResult` | `clusterId` required; all items default to `pending`. |
| **Stage 6: Verifier** | Gemini 3.6 Flash | Full Pipeline Output | `VerificationResult` | Adversarial cross-check against ground truth. |
| **Stage 7: Review** | React Frontend State | Verification Result | `TeacherDecision` Record | Teacher is final pedagogical authority; status transitions tracked. |

---

## 4. Storage Architecture & Privacy Boundaries

### In-Memory vs. Persistent Boundary

```text
┌────────────────────────────────────────────────────────────────────────┐
│ IN-MEMORY VOLATILE PROCESSING (Server & Active Client Session)          │
│ - Raw student text (transient HTTP lifecycle only)                     │
│ - Uploaded image buffers (unencoded in memory during OCR)              │
│ - Unmasked student identifiers (mapped to pseudonyms at boundary)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Pre-AI Sanitization Boundary
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PERSISTENT STORAGE TIER (Local Storage / Future Relational Database)   │
│ - Strictly derived, sanitized evidence (SanitizedSourceEvidence)       │
│ - Misconception clusters & pedagogical strategies                      │
│ - Verification audit logs & teacher decision records                   │
│ - ZERO raw text, ZERO unredacted names, ZERO uploaded images           │
└────────────────────────────────────────────────────────────────────────┘
```

### Storage Retention Rules
1. **Raw Submission Discard**: Once Stage 1 (Privacy Gateway) completes, raw text and base64 images are evicted from the analysis state.
2. **Persistence Sanitization**: In `src/App.tsx`, `localStorage` persistence saves only `sanitizedSubmissions` derived from `normalizedSourceEvidence`.
3. **Legacy Migration Safeguard**: When restoring cached sessions from `localStorage`, missing `sanitizedSubmissions` causes raw fallbacks to be discarded (`[]`), preventing old unredacted test entries from surfacing.

---

## 5. Data Engineering Pipeline Architecture

### Cohort Provenance & Reproducibility
- **Dataset Fingerprinting**: A SHA-256 digest is computed across normalized submission text (`computeDatasetFingerprint`). This fingerprint identifies the exact classroom submission state for data lineage, audit logging, and cohort version tracking (distinguished from algorithmic idempotency, as generative language models exhibit natural stochasticity unless deterministic caching is enabled).
- **Deterministic Validation**: Code routines execute with pure, side-effect-free functions (`server/services/deterministicValidator.ts`), ensuring mathematical invariants remain stable across environments.

### UI Progress Streaming Channel
The `/api/analyze-stream` endpoint implements an ephemeral Server-Sent Events (SSE) channel for live UI progression during analysis (distinct from a durable message bus or persistent event-sourcing log):

```json
{
  "stage": 2,
  "stageName": "Diagnosis",
  "detail": "Synthesizing cross-classroom misconception clusters",
  "timestamp": "2026-10-25T09:30:00.000Z"
}
```

Upon pipeline completion, the stream emits a terminal `complete` event containing the verified `ClassAnalysisResult`.

---

## 6. Data Science Readiness & Learning Analytics

### Quantitative Learning Metrics

#### 1. Cluster Prevalence Rate ($P_c$)
Measures the proportion of the cohort affected by a specific misconception:
$$P_c = \frac{|S_{\text{affected}}(c)|}{|S_{\text{total}}|}$$
*Constraint*: Computed by deterministic code; generative model estimation is strictly prohibited.

#### 2. Grounded Citation Integrity Ratio ($R_{\text{grounding}}$)
Measures the proportion of extracted student quotes that verbatim or normalized match source text:
$$R_{\text{grounding}} = \frac{N_{\text{exact}} + N_{\text{normalized}}}{N_{\text{total\_quotes}}}$$
*Monitoring Target*: Tracked longitudinally across runs as an empirical grounding health indicator, with baseline thresholds calibrated against educator review during classroom trials.

#### 3. Support Tier Allocation Distribution
Measures the distribution of student assignments across instructional support tiers:
$$D_{\text{tier}} = \left[ \frac{|S_{\text{ext}}|}{|S|}, \frac{|S_{\text{clarif}}|}{|S|}, \frac{|S_{\text{guided}}|}{|S|}, \frac{|S_{\text{error}}|}{|S|} \right]$$

#### 4. Educator Modification Rate ($R_{\text{modification}}$)
Measures the proportion of AI-generated recommendations that the educator edited or dismissed during human-in-the-loop review:
$$R_{\text{modification}} = \frac{N_{\text{edited}} + N_{\text{dismissed}}}{N_{\text{total\_recommendations}}}$$
This metric serves as a direct ground-truth signal for tracking human trust and calibrating model prompt instructions.

### Offline Evaluation Harness
LotusLearn maintains a 35-case educational privacy benchmark fixture (`server/services/privacyEvalSet.ts`) running automated regression tests:
- **False-Positive Grammar Preservation**: Confirms that grammatical labels (e.g., "Past Simple", "Present Perfect", "Subject-Verb Agreement") are 100% preserved without erroneous PII scrubbing.
- **True-Positive Identification**: Confirms that student full names, email addresses, and phone numbers are 100% redacted before inference.
- **Deterministic Test Suite**: Comprehensive 211-test regression harness validating schema contracts, rate limiting, and fail-closed edge cases.

---

## 7. Future Relational Schema (PostgreSQL DDL Preparation)

```sql
CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE learning_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    lesson_title VARCHAR(200) NOT NULL,
    learning_objective TEXT NOT NULL,
    rubric TEXT,
    teacher_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_context_id UUID REFERENCES learning_contexts(id) ON DELETE CASCADE,
    dataset_fingerprint_sha256 CHAR(64) NOT NULL,
    privacy_provider VARCHAR(50) NOT NULL,
    deterministic_audit_passed BOOLEAN NOT NULL,
    overall_verification_status VARCHAR(50) NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE misconception_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_run_id UUID REFERENCES analysis_runs(id) ON DELETE CASCADE,
    cluster_title VARCHAR(200) NOT NULL,
    explanation TEXT NOT NULL,
    teaching_priority VARCHAR(20) NOT NULL,
    affected_student_count INT NOT NULL,
    teacher_decision VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
