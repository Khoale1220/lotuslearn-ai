import { LearningContext, StudentSubmission } from '../types';

export const DEMO_CONTEXT: LearningContext = {
  subject: 'English Language Arts',
  gradeLevel: 'Grade 10',
  lessonTitle: 'Diagnostic Assessment: Present Perfect vs. Past Simple',
  learningObjective:
    'Students can correctly choose between the present perfect and past simple when describing experiences, finished past events, and unfinished time periods.',
  expectedAnswerRubric:
    '1. Use Present Perfect (have/has + past participle) for unspecified past experiences, actions continuing from the past into the present (with for/since), and recent actions with present relevance.\n2. Use Past Simple (V2/-ed) for actions completed at a definite, finished time in the past (e.g., yesterday, last year, in 2024, ago).\n3. Use accurate irregular past participles (e.g., written, eaten, been, seen, broken).\n4. Maintain correct subject-auxiliary agreement (have vs. has) without omitting auxiliary verbs.',
  teacherNotes:
    'Diagnostic exit ticket collected at the end of Week 3. High school students in Vietnam frequently struggle with tense contrast because Vietnamese verbs do not conjugate for tense and rely on aspect particles (đã, rồi, từng). Pay close attention to finished-time adverbs and irregular participles.',
};

export const DEMO_SUBMISSIONS: StudentSubmission[] = [
  {
    studentId: 'Student 01',
    studentText:
      'I have lived in Da Nang for five years, so I know the city well. Last summer, my family visited Ba Na Hills and we saw the Golden Bridge. I have never seen snow, but I hope to visit Sapa this winter.',
    workType: 'typed',
  },
  {
    studentId: 'Student 02',
    studentText:
      'I have visited Ha Long Bay last year with my middle school classmates. We have taken many photos yesterday afternoon when the boat stopped near the cave.',
    workType: 'typed',
  },
  {
    studentId: 'Student 03',
    studentText:
      'I have finished my English grammar homework yesterday at 9 PM. In 2024, my family has moved to a new apartment in District 1.',
    workType: 'typed',
  },
  {
    studentId: 'Student 04',
    studentText:
      'I lived in this town for six years and I still live here now. Did you ever eat banh mi in Hoi An? I went there three times in my life.',
    workType: 'typed',
  },
  {
    studentId: 'Student 05',
    studentText:
      'I have writed three essays for English class this month. She has ate all the fruits already, and they have went home early before the rain started.',
    workType: 'typed',
  },
  {
    studentId: 'Student 06',
    studentText:
      'My brother went to Singapore in 2023. Since then, he has sent me several postcards. Have you ever visited Singapore? I haven’t been there yet.',
    workType: 'typed',
  },
  {
    studentId: 'Student 07',
    studentText:
      'Last Sunday, I have played badminton with Minh in the park. When we were young in 2018, we have studied at the same primary school.',
    workType: 'typed',
  },
  {
    studentId: 'Student 08',
    studentText:
      'I never saw a 3D movie before today. My father worked at this telecommunication company since 2018 and he loves his job very much.',
    workType: 'typed',
  },
  {
    studentId: 'Student 09',
    studentText:
      'He have lived in Hue since he was born. I been to Phu Quoc island twice with my cousins, and we had great seafood there.',
    workType: 'typed',
  },
  {
    studentId: 'Student 10',
    studentText:
      'She have breaked her ruler yesterday during art class. Also my friends has seen the new animated movie last night at the cinema.',
    workType: 'typed',
  },
  {
    studentId: 'Student 11',
    studentText:
      'I have studied English since Grade 3. Yesterday, our teacher gave us a challenging grammar quiz, but I answered all the questions carefully.',
    workType: 'typed',
  },
  {
    studentId: 'Student 12',
    studentText:
      'We has lived in our current house since 2021. My uncle have traveled to Japan two years ago for business.',
    workType: 'typed',
  },
];
