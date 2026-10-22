import {
  ClassAnalysisResult,
  DifferentiatedIntervention,
  InstructionalGroup,
  LearningContext,
  MisconceptionCluster,
  NextLessonPlan,
  StudentObservation,
  StudentSubmission,
  VerificationResult,
} from '../../src/types';

export function generateGroundedDemoAnalysis(
  context: LearningContext,
  submissions: StudentSubmission[]
): ClassAnalysisResult {
  const timestamp = new Date().toISOString();
  const id = `analysis_demo_${Date.now()}`;

  const studentObservations: StudentObservation[] = [
    {
      studentId: 'Student 01',
      demonstratedUnderstanding: [
        'Correct present perfect with "for five years" for unfinished time',
        'Accurate past simple ("visited", "saw") for completed trip last summer',
        'Life experience negation ("have never seen snow")',
      ],
      misconceptions: [],
      supportingEvidence: [
        {
          quoteOrDetail: 'I have lived in Da Nang for five years',
          interpretation: 'Accurately pairs present perfect with duration preposition "for" to denote an action starting in the past and continuing into the present.',
        },
        {
          quoteOrDetail: 'Last summer, my family visited Ba Na Hills and we saw the Golden Bridge',
          interpretation: 'Correctly shifts to past simple when specifying a finished time period ("Last summer").',
        },
      ],
      rubricAlignment: 'Exceeds standard; demonstrates complete mastery of tense contrast.',
      confidence: 0.98,
      recommendedSupportLevel: 'extension',
    },
    {
      studentId: 'Student 02',
      demonstratedUnderstanding: [
        'Recognizes present perfect formula (have + V3)',
        'Understands past narrative context',
      ],
      misconceptions: [
        'Pairs present perfect with finished past time expressions ("last year", "yesterday afternoon")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'I have visited Ha Long Bay last year',
          interpretation: 'Inappropriate use of present perfect with the specific finished time marker "last year".',
        },
        {
          quoteOrDetail: 'We have taken many photos yesterday afternoon',
          interpretation: 'Incorrect present perfect with finished-time phrase "yesterday afternoon".',
        },
      ],
      rubricAlignment: 'Partially meets standard; violates finished-time restriction.',
      confidence: 0.96,
      recommendedSupportLevel: 'concept_clarification',
    },
    {
      studentId: 'Student 03',
      demonstratedUnderstanding: [
        'Correctly forms present perfect auxiliary and participle',
      ],
      misconceptions: [
        'Uses present perfect with specific past timestamp ("yesterday at 9 PM")',
        'Uses present perfect with past calendar year ("In 2024")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'I have finished my English grammar homework yesterday at 9 PM',
          interpretation: 'Finished time adverbial "yesterday at 9 PM" requires past simple "finished".',
        },
        {
          quoteOrDetail: 'In 2024, my family has moved to a new apartment',
          interpretation: 'Calendar year "In 2024" indicates a completed past window, requiring "moved".',
        },
      ],
      rubricAlignment: 'Requires targeted concept clarification on finished time anchors.',
      confidence: 0.95,
      recommendedSupportLevel: 'concept_clarification',
    },
    {
      studentId: 'Student 04',
      demonstratedUnderstanding: [
        'Understands duration concept ("for six years")',
        'Correct past simple form "went"',
      ],
      misconceptions: [
        'Substitutes past simple for an unfinished action continuing into present ("lived... and still live")',
        'Uses past simple for life experience query ("Did you ever eat")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'I lived in this town for six years and I still live here now',
          interpretation: 'Since the state continues into the present, English requires "have lived".',
        },
        {
          quoteOrDetail: 'Did you ever eat banh mi in Hoi An?',
          interpretation: 'Life experience question without specific time should be "Have you ever eaten".',
        },
      ],
      rubricAlignment: 'Emerging; relies on simple past for open time windows.',
      confidence: 0.94,
      recommendedSupportLevel: 'guided_practice',
    },
    {
      studentId: 'Student 05',
      demonstratedUnderstanding: [
        'Selects present perfect correctly for unfinished time ("this month") and recent action ("already")',
      ],
      misconceptions: [
        'Forms irregular past participles incorrectly (*writed, *ate as participle, *went as participle)',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'I have writed three essays',
          interpretation: 'Overgeneralizes regular "-ed" rule to irregular verb "write" (*writed instead of written).',
        },
        {
          quoteOrDetail: 'She has ate all the fruits already',
          interpretation: 'Uses past simple form "ate" instead of past participle "eaten".',
        },
        {
          quoteOrDetail: 'they have went home early',
          interpretation: 'Uses V2 "went" instead of participle "gone".',
        },
      ],
      rubricAlignment: 'Tense choice is correct, but morphological participle production fails.',
      confidence: 0.97,
      recommendedSupportLevel: 'error_correction',
    },
    {
      studentId: 'Student 06',
      demonstratedUnderstanding: [
        'Exemplary past simple ("went in 2023")',
        'Exemplary present perfect with "since then" ("has sent")',
        'Accurate question and negative forms ("Have you ever visited", "haven’t been")',
      ],
      misconceptions: [],
      supportingEvidence: [
        {
          quoteOrDetail: 'My brother went to Singapore in 2023. Since then, he has sent me several postcards.',
          interpretation: 'Flawlessly contrasts finished event with subsequent ongoing span.',
        },
        {
          quoteOrDetail: 'Have you ever visited Singapore? I haven’t been there yet.',
          interpretation: 'Accurate experience inquiry and unfinished negation with "yet".',
        },
      ],
      rubricAlignment: 'Mastery; ready for advanced stylistic extension.',
      confidence: 0.99,
      recommendedSupportLevel: 'extension',
    },
    {
      studentId: 'Student 07',
      demonstratedUnderstanding: [
        'Constructs have + V3 correctly',
      ],
      misconceptions: [
        'Overuses present perfect with specific past narrative anchors ("Last Sunday", "When we were young in 2018")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'Last Sunday, I have played badminton with Minh',
          interpretation: '"Last Sunday" specifies a closed time unit requiring past simple "played".',
        },
        {
          quoteOrDetail: 'When we were young in 2018, we have studied',
          interpretation: 'Past clause "When we were young" establishes past narrative context; requires "studied".',
        },
      ],
      rubricAlignment: 'Struggles with time-marker constraints on present perfect.',
      confidence: 0.95,
      recommendedSupportLevel: 'concept_clarification',
    },
    {
      studentId: 'Student 08',
      demonstratedUnderstanding: [
        'Correctly identifies ongoing duration marker ("since 2018")',
      ],
      misconceptions: [
        'Uses past simple for life experience ("never saw before today")',
        'Uses past simple with "since" ("worked... since 2018")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'I never saw a 3D movie before today',
          interpretation: 'Unfinished experience prior to speaking moment requires "have never seen".',
        },
        {
          quoteOrDetail: 'My father worked at this telecommunication company since 2018 and he loves his job',
          interpretation: 'Ongoing job starting in 2018 requires "has worked".',
        },
      ],
      rubricAlignment: 'Replaces present perfect with past simple in durative contexts.',
      confidence: 0.94,
      recommendedSupportLevel: 'guided_practice',
    },
    {
      studentId: 'Student 09',
      demonstratedUnderstanding: [
        'Selects present perfect for duration ("since he was born") and experience ("twice")',
      ],
      misconceptions: [
        'Subject-auxiliary agreement error ("He have")',
        'Omits auxiliary verb in present perfect experience clause ("I been")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'He have lived in Hue since he was born',
          interpretation: 'Third-person singular "He" requires auxiliary "has", not "have".',
        },
        {
          quoteOrDetail: 'I been to Phu Quoc island twice',
          interpretation: 'Omits required auxiliary "have" before past participle "been".',
        },
      ],
      rubricAlignment: 'Understands temporal function but makes syntax/agreement errors.',
      confidence: 0.96,
      recommendedSupportLevel: 'error_correction',
    },
    {
      studentId: 'Student 10',
      demonstratedUnderstanding: [
        'Connects actions to past time contexts',
      ],
      misconceptions: [
        'Subject agreement + non-standard participle ("She have breaked")',
        'Subject agreement + finished past time marker ("friends has seen ... last night")',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'She have breaked her ruler yesterday',
          interpretation: 'Triple error: auxiliary agreement (*have), irregular participle (*breaked), and finished time marker (*yesterday).',
        },
        {
          quoteOrDetail: 'my friends has seen the new animated movie last night',
          interpretation: 'Agreement error (plural "friends" + "has") paired with finished time marker "last night".',
        },
      ],
      rubricAlignment: 'Compound breakdown across auxiliary agreement, participle morphology, and time-marker rules.',
      confidence: 0.97,
      recommendedSupportLevel: 'error_correction',
    },
    {
      studentId: 'Student 11',
      demonstratedUnderstanding: [
        'Accurate present perfect with "since Grade 3"',
        'Accurate past simple with "Yesterday"',
        'Sharp contrast between ongoing study and yesterday’s completed quiz',
      ],
      misconceptions: [],
      supportingEvidence: [
        {
          quoteOrDetail: 'I have studied English since Grade 3. Yesterday, our teacher gave us a challenging grammar quiz',
          interpretation: 'Impeccable contrast between unfinished ongoing state and finished past event.',
        },
      ],
      rubricAlignment: 'Full mastery across all rubric criteria.',
      confidence: 0.99,
      recommendedSupportLevel: 'extension',
    },
    {
      studentId: 'Student 12',
      demonstratedUnderstanding: [
        'Identifies "since 2021" for ongoing state and "two years ago" for past event',
      ],
      misconceptions: [
        'Auxiliary agreement mismatch with plural "We has"',
        'Auxiliary agreement mismatch with singular "uncle have traveled"',
      ],
      supportingEvidence: [
        {
          quoteOrDetail: 'We has lived in our current house since 2021',
          interpretation: 'Plural subject "We" mistakenly paired with singular auxiliary "has".',
        },
        {
          quoteOrDetail: 'My uncle have traveled to Japan two years ago',
          interpretation: 'Third-person singular "uncle" paired with "have", plus present perfect with "two years ago".',
        },
      ],
      rubricAlignment: 'Inconsistent subject-verb agreement and residual finished-time interference.',
      confidence: 0.95,
      recommendedSupportLevel: 'error_correction',
    },
  ];

  const misconceptionClusters: MisconceptionCluster[] = [
    {
      clusterId: 'cluster-1',
      misconceptionTitle: 'Present Perfect with Finished-Time Expressions',
      explanation:
        'Students use the present perfect form (have/has + V3) together with specific, closed past time markers (e.g., "last year", "yesterday", "in 2024"). This typically stems from L1 Vietnamese interference where the aspect marker "đã" is applied universally regardless of whether the time period is open or closed.',
      affectedStudentIds: ['Student 02', 'Student 03', 'Student 07', 'Student 10', 'Student 12'],
      studentCount: 5,
      percentageAffected: 42,
      evidenceExamples: [
        {
          studentId: 'Student 02',
          excerpt: 'I have visited Ha Long Bay last year... We have taken many photos yesterday afternoon',
          groundingReason: 'Direct pairing of present perfect with closed past time adverbs "last year" and "yesterday afternoon".',
        },
        {
          studentId: 'Student 03',
          excerpt: 'I have finished my English grammar homework yesterday at 9 PM',
          groundingReason: 'Exact timestamp ("yesterday at 9 PM") grammatically mandates past simple "finished".',
        },
        {
          studentId: 'Student 07',
          excerpt: 'Last Sunday, I have played badminton with Minh in the park',
          groundingReason: 'Initial temporal anchor "Last Sunday" establishes a completed window incompatible with present perfect.',
        },
      ],
      teachingPriority: 'urgent',
      confidence: 0.97,
      recommendedInstructionalResponse:
        'Implement the "Open vs. Closed Door Timeline" visual drill. Teach students to check for closed past time words before choosing verb tense.',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      clusterId: 'cluster-2',
      misconceptionTitle: 'Past Simple Substitution for Unfinished Time & Experiences',
      explanation:
        'Students default to past simple when describing actions continuing from the past into the present (with for/since) or unspecified life experiences. They overlook the present relevance required by English aspect.',
      affectedStudentIds: ['Student 04', 'Student 08'],
      studentCount: 2,
      percentageAffected: 17,
      evidenceExamples: [
        {
          studentId: 'Student 04',
          excerpt: 'I lived in this town for six years and I still live here now. Did you ever eat banh mi...?',
          groundingReason: 'Explicitly states "I still live here now" yet used simple past "lived", plus past simple "Did you ever eat" for general life experience.',
        },
        {
          studentId: 'Student 08',
          excerpt: 'My father worked at this telecommunication company since 2018 and he loves his job',
          groundingReason: 'Ongoing employment marked by "since 2018" requires present perfect "has worked".',
        },
      ],
      teachingPriority: 'high',
      confidence: 0.95,
      recommendedInstructionalResponse:
        'Use duration bridge frames: "Action started in past + still true today = HAVE/HAS + V3". Contrast with completed life events.',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      clusterId: 'cluster-3',
      misconceptionTitle: 'Irregular Past Participle Morphology Overgeneralization',
      explanation:
        'Students understand the need for the present perfect tense but fail in morphological production, overgeneralizing the regular "-ed" rule (*writed, *breaked) or confusing V2 simple past with V3 participle (*has ate, *have went).',
      affectedStudentIds: ['Student 05', 'Student 10'],
      studentCount: 2,
      percentageAffected: 17,
      evidenceExamples: [
        {
          studentId: 'Student 05',
          excerpt: 'I have writed three essays... She has ate all the fruits... they have went home',
          groundingReason: 'Overgeneralization of regular suffix to write (*writed) and substitution of V2 for V3 (ate -> eaten, went -> gone).',
        },
        {
          studentId: 'Student 10',
          excerpt: 'She have breaked her ruler yesterday',
          groundingReason: 'Morphological overgeneralization *breaked instead of broken.',
        },
      ],
      teachingPriority: 'high',
      confidence: 0.98,
      recommendedInstructionalResponse:
        'Run high-frequency irregular V1-V2-V3 speed-matching cards focusing specifically on write-wrote-written, eat-ate-eaten, and go-went-gone.',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      clusterId: 'cluster-4',
      misconceptionTitle: 'Auxiliary Agreement & Auxiliary Omission',
      explanation:
        'Students omit the auxiliary verb altogether (*I been) or produce subject-auxiliary agreement mismatches (*he have, *we has).',
      affectedStudentIds: ['Student 09', 'Student 10', 'Student 12'],
      studentCount: 3,
      percentageAffected: 25,
      evidenceExamples: [
        {
          studentId: 'Student 09',
          excerpt: 'He have lived in Hue... I been to Phu Quoc island twice',
          groundingReason: 'Subject agreement mismatch "He have" and auxiliary omission "I been" instead of "I have been".',
        },
        {
          studentId: 'Student 12',
          excerpt: 'We has lived in our current house... My uncle have traveled',
          groundingReason: 'Inverted auxiliary agreement: plural "we has" and singular "uncle have".',
        },
      ],
      teachingPriority: 'moderate',
      confidence: 0.94,
      recommendedInstructionalResponse:
        'Provide a quick 2-column subject-auxiliary anchor chart (I/You/We/They HAVE vs. He/She/It HAS) and color-coded pronoun warmups.',
      status: 'pending',
      teacherDecision: 'pending',
    },
  ];

  const instructionalGroups: InstructionalGroup[] = [
    {
      groupId: 'group-1',
      groupName: 'Needs Concept Clarification: Finished vs. Unfinished Time Markers',
      studentIds: ['Student 02', 'Student 03', 'Student 07'],
      commonLearningNeed:
        'Differentiating between closed past time markers (yesterday, last year, ago) which demand Past Simple, and open or unspecified time windows that take Present Perfect.',
      evidenceSummary:
        'All three students consistently constructed have + V3 but attached explicit finished-time adverbials (*yesterday, *last year, *last Sunday).',
      suggestedActivity:
        'Time Marker Sort & Pair Sentence Repair: Students sort 12 time cards into "Closed Box" vs. "Open Window", then correct 4 anchor sentences.',
      teacherInstructions:
        'Prompt students: "Can you point to yesterday on a calendar with a red X? If yes, it is closed — use Past Simple!"',
      exampleQuestion:
        'Which sentence is correct? (A) I saw that movie last night. (B) I have seen that movie last night.',
      estimatedDuration: '12–15 min',
      successCriterion:
        'Students correctly reject present perfect when a finished time word is present in 4 out of 4 diagnostic trials.',
    },
    {
      groupId: 'group-2',
      groupName: 'Needs Guided Practice: Experience and Duration Clauses',
      studentIds: ['Student 04', 'Student 08'],
      commonLearningNeed:
        'Selecting Present Perfect when describing life experiences and actions continuing up to the present moment with for/since.',
      evidenceSummary:
        'Both students defaulted to past simple ("lived for six years and still live", "worked since 2018") despite ongoing duration.',
      suggestedActivity:
        'Life Timeline Mapping: Draw personal timelines connecting past start date to today, writing "I have [verb-ed] since [year]".',
      teacherInstructions:
        'Emphasize the bridge metaphor: if the rope connects the past to right now, use HAVE/HAS.',
      exampleQuestion:
        'Complete the thought: "My family ______ (live) in this city since 2020 and we still live here."',
      estimatedDuration: '12 min',
      successCriterion:
        'Students produce 3 accurate ongoing duration sentences using have/has + past participle with for/since.',
    },
    {
      groupId: 'group-3',
      groupName: 'Needs Error Correction: Irregular Participles and Auxiliary Agreement',
      studentIds: ['Student 05', 'Student 09', 'Student 10', 'Student 12'],
      commonLearningNeed:
        'Mastering irregular V3 participle forms (written, eaten, gone, broken) and ensuring subject-auxiliary concord (have vs. has).',
      evidenceSummary:
        'Students demonstrated tense awareness but produced morphological errors (*writed, *ate, *breaked) or agreement mismatches (*he have, *we has, *I been).',
      suggestedActivity:
        'Participle Dominoes & Auxiliary Flip Cards: Fast-paced paired drill pairing base verbs with their irregular V3 forms, followed by subject-verb matching.',
      teacherInstructions:
        'Provide the "Irregular Triad" sheet. Have students say the chant aloud: "Write - Wrote - WRITTEN; Eat - Ate - EATEN".',
      exampleQuestion:
        'Correct the error: "She has ate lunch" and "He have lived in Da Nang."',
      estimatedDuration: '15 min',
      successCriterion:
        '100% accuracy on identifying the correct V3 form from a list of 10 high-frequency irregular verbs.',
    },
    {
      groupId: 'group-4',
      groupName: 'Ready for Extension: Discourse-Level Tense Synthesis',
      studentIds: ['Student 01', 'Student 06', 'Student 11'],
      commonLearningNeed:
        'Synthesizing past simple and present perfect within connected narrative paragraphs and interview dialogues.',
      evidenceSummary:
        'These students demonstrated complete mastery across both tenses, accurate irregular participles, and correct time-adverb placement.',
      suggestedActivity:
        'The Biographer Challenge: Write a 100-word mini-biography of a notable figure (e.g., Professor Ngo Bao Chau), seamlessly switching between lifetime achievements and specific dated events.',
      teacherInstructions:
        'Ask students to highlight present perfect sentences in yellow (ongoing/experience) and past simple in blue (specific dated milestones).',
      exampleQuestion:
        'Write two sentences about travel: one about a general life experience and one specifying the exact year it happened.',
      estimatedDuration: '15 min',
      successCriterion:
        'Produces a coherent 4-sentence paragraph with zero tense contamination between finished and unfinished clauses.',
    },
  ];

  const nextLessonPlan: NextLessonPlan = {
    totalDuration: '25 minutes',
    targetObjective:
      'Eliminate finished-time interference with present perfect and reinforce irregular participle recall across differentiated student stations.',
    phases: [
      {
        timeRange: '0–5 min',
        phaseTitle: 'Diagnostic Warm-up: The Closed Door Test',
        description:
          'Whole-class whiteboard drill: Teacher flashes 6 time expressions. Students hold up "CLOSED" (Past Simple) or "OPEN" (Present Perfect).',
        actionableTeacherPrompt:
          '"Look at the phrase on the screen: \'in 2024\'. Can you go back to 2024 right now? No, the door is closed! Hold up your cards — what tense does it demand?"',
        materials: 'Mini whiteboards, two-sided OPEN/CLOSED cards',
      },
      {
        timeRange: '5–12 min',
        phaseTitle: 'Target Misconception Debrief: Why Finished Words Reject "Have"',
        description:
          'Teacher models the core error found in 42% of class exit tickets: using present perfect with specific past clocks. Direct instruction with side-by-side contrast.',
        actionableTeacherPrompt:
          '"42% of our exit tickets had sentences like \'I have visited last year\'. Let\'s look at why English speakers never do this: \'have visited\' means the result touches right now, but \'last year\' pushes it into the completed past."',
        materials: 'Anchor chart with timeline diagram',
      },
      {
        timeRange: '12–18 min',
        phaseTitle: 'Guided Practice: Station Rotation',
        description:
          'Students break into their 4 instructional groups. Group 1 does Time Marker Sorts, Group 2 maps Duration Bridges, Group 3 plays Participle Dominoes, Group 4 begins Biographer Challenge.',
        actionableTeacherPrompt:
          '"Move to your designated station. Check your group task card. Remember our rule: time word first, verb form second."',
        materials: 'Station task envelopes, card sets',
      },
      {
        timeRange: '18–23 min',
        phaseTitle: 'Differentiated Task Execution & Peer Review',
        description:
          'Within stations, students solve their 3 targeted practice prompts and exchange with a partner for verification against the rubric criteria.',
        actionableTeacherPrompt:
          '"Switch papers with your partner. Check rule #2: did they pair a finished time word with past simple? Circle any irregular participles."',
        materials: 'Tiered response sheets',
      },
      {
        timeRange: '23–25 min',
        phaseTitle: 'Formative Exit Ticket Check',
        description:
          'Individual 2-item diagnostic check to measure immediate misconception elimination.',
        actionableTeacherPrompt:
          '"Before you leave, complete the 2 questions on your slip. Work independently."',
        materials: 'Exit ticket slips (2 diagnostic prompts)',
      },
    ],
  };

  const interventions: DifferentiatedIntervention[] = [
    {
      interventionId: 'int-1',
      clusterId: 'cluster-1',
      targetMisconceptionTitle: 'Present Perfect with Finished-Time Expressions',
      title: 'The Closed Calendar Filter',
      supportTier: 'Concept Clarification',
      rationale:
        'Directly breaks the habit of applying present perfect universally by enforcing an antecedent check for closed time adverbials.',
      suggestedActivity:
        'Give students 8 sentence strips with missing verbs. Students must underline the time adverb first and label it [CLOSED] or [OPEN] before choosing their verb form.',
      teacherScript:
        '"Always circle the time phrase first. If it tells you WHEN in the past (yesterday, last year, ago), lock in Past Simple immediately."',
      exampleQuestion:
        'Fill in: "My sister ______ (buy) a new bicycle two days ago."',
      exitTicketQuestion:
        'Choose and explain: "I (have seen / saw) that documentary last Friday."',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      interventionId: 'int-2',
      clusterId: 'cluster-2',
      targetMisconceptionTitle: 'Past Simple Substitution for Unfinished Time & Experiences',
      title: 'The Duration Bridge Protocol',
      supportTier: 'Guided Practice',
      rationale:
        'Connects the mental model of continuing actions to the have/has + V3 structure using physical timeline spans.',
      suggestedActivity:
        'Paired sentence transformation: Convert two simple sentences ("I moved here in 2020. I still live here.") into one compound present perfect sentence.',
      teacherScript:
        '"Notice that the state is not finished — you are still sitting in this classroom. That continuous connection to today is why we say HAVE LIVED."',
      exampleQuestion:
        'Combine into one sentence: "Nam started playing the guitar in 2022. He still plays it now."',
      exitTicketQuestion:
        'Complete with for or since: "Our teacher has worked at this high school ______ five years."',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      interventionId: 'int-3',
      clusterId: 'cluster-3',
      targetMisconceptionTitle: 'Irregular Past Participle Morphology Overgeneralization',
      title: 'Irregular V3 Rapid Match',
      supportTier: 'Error Correction',
      rationale:
        'High-repetition retrieval practice targeting high-frequency irregular participles prone to overgeneralization.',
      suggestedActivity:
        'Flash-card speed sorting: pair base verb cards with their corresponding irregular V3 cards (write -> written, break -> broken, eat -> eaten, go -> gone).',
      teacherScript:
        '"Watch out for the trap of adding \'-ed\' to every verb. Write becomes written, not writed!"',
      exampleQuestion:
        'Correct the mistake: "They have went to the school library."',
      exitTicketQuestion:
        'Write the correct participle for: write -> ________, eat -> ________, break -> ________.',
      status: 'pending',
      teacherDecision: 'pending',
    },
    {
      interventionId: 'int-4',
      clusterId: 'cluster-4',
      targetMisconceptionTitle: 'Discourse-Level Narrative Mastery',
      title: 'The Career Biographer Synthesis',
      supportTier: 'Ready for Extension',
      rationale:
        'Provides authentic cognitive challenge for students who have mastered basic tense mechanics by requiring discourse-level tense switching.',
      suggestedActivity:
        'Draft an interview profile of a scientist or athlete, using present perfect for career highlights and past simple for historical milestones.',
      teacherScript:
        '"Challenge yourself: introduce their career with present perfect, then zoom into specific breakthrough years using past simple."',
      exampleQuestion:
        'Create a sentence contrasting a milestone in 2021 with an ongoing project since 2023.',
      exitTicketQuestion:
        'Write 2 sentences: one about something you have achieved this year, and one about what you did last weekend.',
      status: 'pending',
      teacherDecision: 'pending',
    },
  ];

  const verification: VerificationResult = {
    overallStatus: 'verified',
    evidenceCoverageStatus: 'verified',
    objectiveAlignmentStatus: 'verified',
    unsupportedClaimsStatus: 'none_detected',
    pedagogicalPlausibility: 'sound',
    explanation:
      'All 4 diagnosed misconception clusters and 4 instructional groups were rigorously cross-referenced against raw student responses. Direct textual citations were verified for every error pattern with zero unsupported claims detected.',
    groundedCheckDetails: [
      {
        claim: 'Finished-time marker interference with present perfect',
        evidenceFound:
          'Confirmed via Student 02 ("have visited... last year", "have taken... yesterday"), Student 03 ("have finished... yesterday"), and Student 07 ("Last Sunday, I have played")',
        verdict: 'verified',
        auditType: 'semantic',
      },
      {
        claim: 'Past simple substitution for ongoing duration or experience',
        evidenceFound:
          'Confirmed via Student 04 ("lived... for six years and I still live here") and Student 08 ("worked... since 2018")',
        verdict: 'verified',
        auditType: 'semantic',
      },
      {
        claim: 'Irregular participle morphology overgeneralization',
        evidenceFound:
          'Confirmed via Student 05 ("writed", "has ate", "have went") and Student 10 ("breaked")',
        verdict: 'verified',
        auditType: 'semantic',
      },
      {
        claim: 'Auxiliary agreement and omission errors',
        evidenceFound:
          'Confirmed via Student 09 ("He have", "I been") and Student 12 ("We has", "uncle have")',
        verdict: 'verified',
        auditType: 'semantic',
      },
      {
        claim: 'Mastery subgroup identified for extension',
        evidenceFound:
          'Confirmed via Student 01, Student 06, and Student 11 demonstrating flawless tense contrast and accurate markers',
        verdict: 'verified',
        auditType: 'semantic',
      },
    ],
    deterministicChecks: {
      coveragePassed: true,
      clusterMathPassed: true,
      groupPartitionPassed: true,
      quotesGroundedCount: 10,
      quotesFlaggedCount: 0,
    },
  };

  return {
    id,
    timestamp,
    context,
    classSnapshot: {
      totalSubmissions: submissions.length,
      misconceptionCount: misconceptionClusters.length,
      strongestConcept: 'Life experience negation and ongoing duration recognition',
      highestPriorityNeed: 'Eliminating finished-time adverbials from Present Perfect clauses',
      overallRecommendation:
        'Focus tomorrow on pairing time expressions with tense selection before student free-writing. Use the "Closed Calendar Filter" drill.',
    },
    studentObservations,
    misconceptionClusters,
    instructionalGroups,
    nextLessonPlan,
    interventions,
    verification,
    privacyAudit: {
      status: 'passed',
      findingCount: 0,
      findingTypeCounts: {},
      sanitizationApplied: false,
      provider: 'google-sensitive-data-protection',
      providerVersionOrPolicyId: 'prevalidated-demo-fixture',
      durationMs: 0,
      rawValuesRetained: false,
      failClosed: true,
    },
    executionMetadata: {
      executionMode: 'demo_resilience',
      primaryModel: 'demo_fallback_cache',
      modelsUsed: ['cached_demo_baseline'],
      totalDurationMs: 0,
      privacyScanDurationMs: 0,
      stageDurationsMs: {},
      submissionCount: submissions.length,
      deterministicAuditPassed: true,
      runId: id,
      pipelineVersion: '2.0.0',
      fallbackUsed: true,
      startedAt: timestamp,
      completedAt: timestamp,
    },
  };
}
