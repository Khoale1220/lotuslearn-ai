# LotusLearn AI
> **From student work to targeted intervention in 60 seconds.**  
> *AI-assisted formative assessment and teaching decision support.*

[![Google Cloud AI Builder Cup 2026](https://img.shields.io/badge/Google%20Cloud-AI%20Builder%20Cup%202026-4285F4?logo=google-cloud&logoColor=white)](https://hack2skill.com)
[![Gemini 3.8 Flash](https://img.shields.io/badge/Model-Gemini%203.8%20Flash-1a73e8?logo=google-gemini&logoColor=white)](https://ai.google.dev)
[![Team TTKK](https://img.shields.io/badge/Team-TTKK%20(Vietnam)-E11D48)](https://github.com)

---

## 1. Executive Summary & Problem

In classrooms worldwide — from high schools in Vietnam to secondary schools globally — teachers collect dozens of student artifacts every week:
- Handwritten worksheets
- Quick-write exit tickets
- Paragraph diagnostic answers
- Quiz responses

**The Bottleneck:** Inspecting 35–45 individual student responses manually takes 1.5 to 2 hours after a tiring teaching day. By the time a teacher has categorized student errors, the opportunity for timely intervention has passed.

**Existing GenAI Shortcomings:** Most AI tools analyze one student submission at a time or output generic pedagogical recommendations ("Provide differentiated practice"). They cannot reason across an entire cohort to detect systemic class-wide misconceptions and convert them into tomorrow's concrete lesson steps.

**LotusLearn AI's Solution:** LotusLearn turns messy multimodal student evidence into an evidence-grounded instructional decision map in 60 seconds.

---

## 2. Core Differentiators

1. **Multimodal Student Work Understanding:** Accepts typed text, photographed worksheets, and handwritten exit tickets.
2. **Whole-Cohort Reasoning:** Reasons across all students simultaneously rather than analyzing students in silos.
3. **Verbatim Evidence Grounding:** Every diagnosed misconception is paired with exact student quotations and pedagogical justification.
4. **Non-Stigmatizing Instructional Grouping:** Groups students dynamically by immediate learning need (`Ready for Extension`, `Needs Concept Clarification`, `Needs Guided Practice`) with zero permanent ability labels.
5. **Actionable 25-Minute Next-Lesson Plan:** Delivers a realistic timeline for tomorrow morning with teacher prompts and mini-activities.
6. **Dynamic Scaffolds:** Generates differentiated micro-interventions with on-the-fly Gemini adjustments (`Simplify`, `Challenge`, `New Exit Ticket`).
7. **Adversarial AI Verifier (Stage 4):** An independent verification stage audits generated claims against raw student text to prevent hallucinations.
8. **Human-in-the-Loop Agency:** Teachers can Accept, Edit, or Dismiss any AI diagnosis or intervention card.

---

## 3. Four-Stage Gemini Reasoning Architecture

LotusLearn AI does not use a single monolithic prompt. It operates as a 4-stage pipeline executed server-side via `@google/genai`:

```
               [ RAW STUDENT WORK ]
     (Photographed Worksheets, Exit Tickets, Text)
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │          STAGE 1: OBSERVER              │
   │  - Individual Evidence Extraction       │
   │  - Rubric & Objective Benchmarking      │
   │  - Verbatim Quotation Anchoring         │
   └────────────────────┬────────────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │         STAGE 2: DIAGNOSIS              │
   │  - Whole-Cohort Cross-Reasoning         │
   │  - Misconception Cluster Discovery      │
   │  - Prevalence & Teaching Priority Calc  │
   └────────────────────┬────────────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │    STAGE 3: TEACHING STRATEGIST         │
   │  - Non-Stigmatizing Group Formation     │
   │  - 25-Minute Tomorrow Lesson Sequence   │
   │  - Differentiated Scaffolds & Prompts   │
   └────────────────────┬────────────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │          STAGE 4: VERIFIER              │
   │  - Adversarial Quality Audit            │
   │  - Verification against Ground Truth    │
   │  - Anti-Hallucination & Scope Check     │
   └────────────────────┬────────────────────┘
                        │
                        ▼
          [ TEACHER DECISION DASHBOARD ]
  (Snapshot · Map · Grounding · Groups · Plan · Audit)
```

---

## 4. Google Technologies & Models Used

- **Google GenAI SDK (`@google/genai` v2.4.0):** Used exclusively server-side for structured output generation and multi-stage orchestration.
- **Model:** `gemini-3.8-flash` (with automated fallback resilience to `gemini-flash-latest` and `gemini-3.1-flash-lite`).
- **Google Cloud Run:** Serverless container hosting providing sub-second latency and zero-config autoscaling.
- **Vite + React 19 + TypeScript + Tailwind CSS:** Fast, accessible, high-contrast user interface engineered according to the Universal Frontend Design Constitution.

---

## 5. Responsible AI & Ethical Guardrails

LotusLearn is engineered from the ground up to respect student dignity and empower teacher agency:

1. **Human-in-the-Loop Philosophy:** LotusLearn supports teacher decision-making; it does not replace it. AI-generated insights are presented as recommendations for teacher review.
2. **Zero Permanent Ability Labels:** Explicit system instructions forbid labels such as "weak", "smart", "low ability", or "gifted".
3. **No Student Ranking or Tracking:** Does not generate comparative scores or rank students against peers.
4. **Zero Extraneous Inferences:** Prohibits inferences regarding intelligence, medical status, mental health, socioeconomic background, or protected attributes.
5. **Strict Anonymization:** Ingests anonymized identifiers (`Student 01`, `Student 02`). No PII is collected or transmitted.
6. **Anti-Hallucination Grounding:** Stage 4 Verifier checks every claim against raw student work excerpts before display.

---

## 6. Pre-Loaded Demo Classroom (Grade 10 English)

To enable frictionless 60-second judging, LotusLearn includes a pre-loaded Grade 10 English diagnostic dataset:
- **Objective:** Correctly distinguish between Present Perfect and Past Simple across experiences, finished past events, and unfinished time periods.
- **Cohort Size:** 12 anonymized student submissions.
- **Target Misconceptions:**
  - *Pattern A:* Using past simple where present perfect is required for unfinished periods or experiences.
  - *Pattern B:* Pairing present perfect with finished-time adverbs (*yesterday*, *last year*, *in 2024*).
  - *Pattern C:* Irregular past participle errors (*writed*, *ate*, *breaked*).
  - *Pattern D:* Auxiliary agreement or omission (*he have*, *we has*, *I been*).
  - *Mastery submissions:* Solid correct responses demonstrating tense contrast.

*Note: The demo submissions are fixed; the analysis is generated live by Gemini.*

---

## 7. Local Development Setup

### Prerequisites
- Node.js >= 18.0.0
- A valid Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Installation
```bash
# Clone the repository
git clone https://github.com/ttkk-team/lotuslearn-ai.git
cd lotuslearn-ai

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Set your GEMINI_API_KEY in .env:
# GEMINI_API_KEY="your-api-key-here"

# Start the full-stack development server (Express + Vite)
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 8. Deployment to Google Cloud Run

LotusLearn AI is container-ready:
```bash
# Build the production frontend assets
npm run build

# Start the Node.js production server
npm start
```

Deploy to Google Cloud Run:
```bash
gcloud run deploy lotuslearn-ai \
  --source . \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="your-key"
```

---

## 9. Team TTKK

- **Team Name:** TTKK
- **Location:** Vietnam
- **Competition:** Google Cloud AI Builder Cup 2026 (Powered by Hack2skill)
- **Primary Theme:** Media, Content & Digital Experiences (Education)
- **Objective:** Grand Finale Shortlist — Singapore
