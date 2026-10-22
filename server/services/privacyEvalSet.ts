/**
 * LotusLearn AI — False-Positive Educational Privacy Evaluation Set
 *
 * Curated benchmark of 35 diverse test cases covering:
 * - Legitimate English lesson grammar & text
 * - Ambiguous English common nouns / modal verbs (May, Hope, Rose)
 * - Vietnamese student names (Nguyen Van Minh, Tran Thi Mai, Le Van Cuong)
 * - English student names (John Doe, Alice Johnson, Jane Smith)
 * - Domestic and international email formats
 * - Domestic and international phone number formats
 * - Geographical locations and calendar dates (should NOT be stripped)
 * - Mixed multilingual sentences
 */

import { PrivacyGateway } from './privacyGateway';

export interface PrivacyEvalCase {
  id: string;
  category:
    | 'grammar_preservation'
    | 'ambiguous_nouns'
    | 'vietnamese_names'
    | 'english_names'
    | 'emails'
    | 'phones'
    | 'mixed_multilingual'
    | 'dates_and_locations';
  input: string;
  expectedPiiDetected: boolean;
  expectedInfoTypes?: string[];
  mustPreserveTokens?: string[];
  notes?: string;
}

export const PRIVACY_EVAL_FIXTURES: PrivacyEvalCase[] = [
  // 1. Pure Grammar Preservation (No PII)
  {
    id: 'EVAL-01',
    category: 'grammar_preservation',
    input: 'I have lived in London since 2020 and I really love the historical architecture.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['London', 'have lived', 'since 2020'],
  },
  {
    id: 'EVAL-02',
    category: 'grammar_preservation',
    input: 'She visited Paris last summer and had an unforgettable cultural experience.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Paris', 'visited', 'last summer'],
  },
  {
    id: 'EVAL-03',
    category: 'grammar_preservation',
    input: 'We have already finished unit 3 on Present Perfect and Past Simple contrast.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Present Perfect', 'Past Simple', 'finished'],
  },
  {
    id: 'EVAL-04',
    category: 'grammar_preservation',
    input: 'The teacher wrote three examples on the blackboard for the students to copy.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['teacher', 'blackboard', 'students'],
  },
  {
    id: 'EVAL-05',
    category: 'grammar_preservation',
    input: 'Did you go to school yesterday, or did you stay at home because of the rain?',
    expectedPiiDetected: false,
    mustPreserveTokens: ['yesterday', 'school'],
  },

  // 2. Ambiguous Nouns / Modal Verbs (May, Hope, Rose)
  {
    id: 'EVAL-06',
    category: 'ambiguous_nouns',
    input: 'In May, our class will take the regional English proficiency examination.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['May', 'regional English proficiency'],
    notes: 'May used as month of year — must not be redacted',
  },
  {
    id: 'EVAL-07',
    category: 'ambiguous_nouns',
    input: 'May I ask a question regarding the differences between since and for?',
    expectedPiiDetected: false,
    mustPreserveTokens: ['May I ask', 'since and for'],
    notes: 'May used as modal verb — must not be redacted',
  },
  {
    id: 'EVAL-08',
    category: 'ambiguous_nouns',
    input: 'We hope the weather will be clear so we can play football during break.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['hope', 'weather', 'football'],
    notes: 'hope used as verb — must not be redacted',
  },
  {
    id: 'EVAL-09',
    category: 'ambiguous_nouns',
    input: 'There is always hope when students practice regularly and review feedback.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['hope', 'students practice'],
    notes: 'hope used as abstract noun — must not be redacted',
  },
  {
    id: 'EVAL-10',
    category: 'ambiguous_nouns',
    input: 'A red rose was painted in the middle of the art worksheet.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['rose', 'art worksheet'],
    notes: 'rose used as botanical noun — must not be redacted',
  },
  {
    id: 'EVAL-11',
    category: 'ambiguous_nouns',
    input: 'The student rose from his chair to answer the teacher questions.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['rose from his chair'],
    notes: 'rose used as past tense of rise — must not be redacted',
  },

  // 3. Vietnamese Student Names
  {
    id: 'EVAL-12',
    category: 'vietnamese_names',
    input: 'My name is Nguyen Van Minh and this is my homework essay.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['My name is', 'homework essay'],
  },
  {
    id: 'EVAL-13',
    category: 'vietnamese_names',
    input: 'Tên em là Tran Thi Mai, học sinh lớp 10A1.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['học sinh lớp 10A1'],
  },
  {
    id: 'EVAL-14',
    category: 'vietnamese_names',
    input: 'Em là Le Van Cuong, em đã làm bài tập này hôm qua.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['bài tập này hôm qua'],
  },
  {
    id: 'EVAL-15',
    category: 'vietnamese_names',
    input: 'Nguyen Van A submitted the assignment before the midnight deadline.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['submitted the assignment'],
  },

  // 4. English Student Names
  {
    id: 'EVAL-16',
    category: 'english_names',
    input: 'My name is John Doe and I like learning languages.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['My name is', 'learning languages'],
  },
  {
    id: 'EVAL-17',
    category: 'english_names',
    input: 'I am Alice Johnson and this is my response to Question 2.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['response to Question 2'],
  },
  {
    id: 'EVAL-18',
    category: 'english_names',
    input: 'Jane Smith completed all sentences with appropriate past time markers.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME'],
    mustPreserveTokens: ['past time markers'],
  },

  // 5. Emails
  {
    id: 'EVAL-19',
    category: 'emails',
    input: 'Please send corrections to minh.student@example.com before tomorrow.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['EMAIL_ADDRESS'],
    mustPreserveTokens: ['Please send corrections to'],
  },
  {
    id: 'EVAL-20',
    category: 'emails',
    input: 'Student portal contact: test.user_123@school.edu.vn.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['EMAIL_ADDRESS'],
    mustPreserveTokens: ['Student portal contact'],
  },
  {
    id: 'EVAL-21',
    category: 'emails',
    input: 'Feedback can be forwarded to teacher.helpdesk@district.org.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['EMAIL_ADDRESS'],
    mustPreserveTokens: ['Feedback can be forwarded to'],
  },

  // 6. Phone Numbers
  {
    id: 'EVAL-22',
    category: 'phones',
    input: 'Parent contact phone number is 0901234567.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PHONE_NUMBER'],
    mustPreserveTokens: ['Parent contact phone number is'],
  },
  {
    id: 'EVAL-23',
    category: 'phones',
    input: 'Call (555) 123-4567 if you have questions about the bus schedule.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PHONE_NUMBER'],
    mustPreserveTokens: ['bus schedule'],
  },
  {
    id: 'EVAL-24',
    category: 'phones',
    input: 'Direct office line: 555-987-6543 during school hours.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PHONE_NUMBER'],
    mustPreserveTokens: ['during school hours'],
  },

  // 7. Dates and Locations (Must NOT be stripped)
  {
    id: 'EVAL-25',
    category: 'dates_and_locations',
    input: 'On October 15th, 2026, our class took a field trip to Da Nang.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['October 15th', '2026', 'Da Nang'],
  },
  {
    id: 'EVAL-26',
    category: 'dates_and_locations',
    input: 'The historical treaty was signed in Geneva in July 1954.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Geneva', 'July 1954'],
  },
  {
    id: 'EVAL-27',
    category: 'dates_and_locations',
    input: 'We visited Tokyo and Kyoto during the spring break holiday.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Tokyo', 'Kyoto', 'spring break'],
  },
  {
    id: 'EVAL-28',
    category: 'dates_and_locations',
    input: 'Yesterday was Monday, October 1st, and tomorrow will be Wednesday.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Monday', 'October 1st', 'Wednesday'],
  },

  // 8. Mixed Multilingual & Multi-PII
  {
    id: 'EVAL-29',
    category: 'mixed_multilingual',
    input: 'Tên tôi là Nguyen Van Minh, email minh@test.com, sđt 0901234567. Tôi đã học thì Hiện tại hoàn thành.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME', 'EMAIL_ADDRESS', 'PHONE_NUMBER'],
    mustPreserveTokens: ['Hiện tại hoàn thành'],
  },
  {
    id: 'EVAL-30',
    category: 'mixed_multilingual',
    input: 'My name is John Doe, email john@edu.com, and I moved to London in 2022.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME', 'EMAIL_ADDRESS'],
    mustPreserveTokens: ['London', '2022'],
  },
  {
    id: 'EVAL-31',
    category: 'mixed_multilingual',
    input: 'Tran Thi B wrote to student.b@edu.vn: "I haven\'t finished the worksheet yet."',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME', 'EMAIL_ADDRESS'],
    mustPreserveTokens: ["haven't finished the worksheet yet"],
  },
  {
    id: 'EVAL-32',
    category: 'grammar_preservation',
    input: 'Have you ever been to Ha Long Bay? Yes, I have been there once.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['Ha Long Bay', 'Have you ever been', 'once'],
  },
  {
    id: 'EVAL-33',
    category: 'grammar_preservation',
    input: 'He has worked as an engineer for five years.',
    expectedPiiDetected: false,
    mustPreserveTokens: ['has worked', 'engineer', 'five years'],
  },
  {
    id: 'EVAL-34',
    category: 'grammar_preservation',
    input: 'They didn\'t know the correct answer because they missed the review lecture.',
    expectedPiiDetected: false,
    mustPreserveTokens: ["didn't know", 'review lecture'],
  },
  {
    id: 'EVAL-35',
    category: 'mixed_multilingual',
    input: 'Le Van Cuong call 0987654321 for tutoring assistance in English writing.',
    expectedPiiDetected: true,
    expectedInfoTypes: ['PERSON_NAME', 'PHONE_NUMBER'],
    mustPreserveTokens: ['tutoring assistance in English writing'],
  },
];

export interface PrivacyEvalSummary {
  totalCases: number;
  passedCases: number;
  falsePositives: number;
  falseNegatives: number;
  grammarPreservationRate: number;
  failures: Array<{
    id: string;
    input: string;
    expectedPii: boolean;
    actualPii: boolean;
    sanitized: string;
    issue: string;
  }>;
}

export async function runPrivacyEvaluation(
  gateway: PrivacyGateway = new PrivacyGateway()
): Promise<PrivacyEvalSummary> {
  let passedCases = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const failures: PrivacyEvalSummary['failures'] = [];

  let pureGrammarCases = 0;
  let preservedGrammarCases = 0;

  for (const testCase of PRIVACY_EVAL_FIXTURES) {
    const res = await gateway.sanitizeText(testCase.input);
    const piiFound = res.findingCount > 0;

    let hasIssue = false;
    let issueReason = '';

    if (testCase.category === 'grammar_preservation' || testCase.category === 'dates_and_locations') {
      pureGrammarCases++;
    }

    // Check false positives
    if (!testCase.expectedPiiDetected && piiFound) {
      falsePositives++;
      hasIssue = true;
      issueReason = `False positive: detected ${res.findingCount} findings in clean educational text`;
    }
    // Check false negatives
    else if (testCase.expectedPiiDetected && !piiFound) {
      falseNegatives++;
      hasIssue = true;
      issueReason = 'False negative: failed to detect expected PII';
    }

    // Verify preservation of mandatory tokens
    if (testCase.mustPreserveTokens) {
      for (const token of testCase.mustPreserveTokens) {
        if (!res.sanitizedText.includes(token)) {
          hasIssue = true;
          issueReason = `Corrupted educational content: missing expected token "${token}"`;
          break;
        }
      }
    }

    if (!hasIssue) {
      passedCases++;
      if (testCase.category === 'grammar_preservation' || testCase.category === 'dates_and_locations') {
        preservedGrammarCases++;
      }
    } else {
      failures.push({
        id: testCase.id,
        input: testCase.input,
        expectedPii: testCase.expectedPiiDetected,
        actualPii: piiFound,
        sanitized: res.sanitizedText,
        issue: issueReason,
      });
    }
  }

  const grammarPreservationRate =
    pureGrammarCases > 0 ? (preservedGrammarCases / pureGrammarCases) * 100 : 100;

  return {
    totalCases: PRIVACY_EVAL_FIXTURES.length,
    passedCases,
    falsePositives,
    falseNegatives,
    grammarPreservationRate,
    failures,
  };
}
