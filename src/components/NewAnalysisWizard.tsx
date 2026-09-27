import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { LearningContext, StudentSubmission } from '../types';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../data/demoClassroom';

interface NewAnalysisWizardProps {
  onCancel: () => void;
  onStartAnalysis: (context: LearningContext, submissions: StudentSubmission[]) => void;
  initialDemoLoad?: boolean;
}

export const NewAnalysisWizard: React.FC<NewAnalysisWizardProps> = ({
  onCancel,
  onStartAnalysis,
  initialDemoLoad = false,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(initialDemoLoad ? 2 : 1);

  // Form State
  const [context, setContext] = useState<LearningContext>(
    initialDemoLoad
      ? DEMO_CONTEXT
      : {
          subject: 'English Language Arts',
          gradeLevel: 'Grade 10',
          lessonTitle: 'Diagnostic: Present Perfect vs. Past Simple',
          learningObjective:
            'Students can correctly choose between the present perfect and past simple when describing experiences, finished past events, and unfinished time periods.',
          expectedAnswerRubric:
            '1. Present Perfect for unfinished time, life experience, and present result.\n2. Past Simple for finished definite past time (yesterday, last year, ago).\n3. Correct irregular past participle forms.',
          teacherNotes:
            'Vietnamese ESL students often confuse past simple and present perfect due to aspect markers in Vietnamese grammar.',
        }
  );

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(
    initialDemoLoad ? DEMO_SUBMISSIONS : []
  );

  // Quick single manual entry field
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentText, setNewStudentText] = useState('');

  // Handle Load Demo Classroom
  const handleLoadDemo = () => {
    setContext(DEMO_CONTEXT);
    setSubmissions(DEMO_SUBMISSIONS);
    setStep(2);
  };

  // Add individual student submission
  const handleAddSubmission = () => {
    if (!newStudentText.trim()) return;
    const nextId =
      newStudentId.trim() ||
      `Student ${String(submissions.length + 1).padStart(2, '0')}`;

    setSubmissions([
      ...submissions,
      {
        studentId: nextId,
        studentText: newStudentText.trim(),
        workType: 'typed',
      },
    ]);
    setNewStudentId('');
    setNewStudentText('');
  };

  // Remove submission
  const handleRemoveSubmission = (index: number) => {
    setSubmissions(submissions.filter((_, i) => i !== index));
  };

  // Handle Image Upload (Photographed worksheet or handwritten work)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (base64Data) {
          const nextNum = submissions.length + index + 1;
          const assignedId = `Student ${String(nextNum).padStart(2, '0')}`;
          setSubmissions((prev) => [
            ...prev,
            {
              studentId: assignedId,
              studentText: `[Photographed Worksheet Upload: ${file.name}]`,
              imageBase64: base64Data,
              mimeType: file.type || 'image/jpeg',
              workType: 'handwritten_work',
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {/* Wizard Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            New Formative Assessment Analysis
          </h1>
        </div>

        {/* 1-Click Demo Classroom Load */}
        <button
          onClick={handleLoadDemo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3.5 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
        >
          <Sparkles size={14} className="text-rose-600" />
          <span>Pre-fill 12 Demo Students</span>
        </button>
      </div>

      {/* Stepper Tabs (Zero-pill discipline, clean segmented buttons) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
        <button
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 pb-2 font-semibold transition ${
            step === 1
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px]">
            1
          </span>
          <span>Learning Context</span>
        </button>

        <button
          onClick={() => setStep(2)}
          className={`flex items-center gap-2 pb-2 font-semibold transition ${
            step === 2
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px]">
            2
          </span>
          <span>Student Submissions ({submissions.length})</span>
        </button>

        <button
          onClick={() => {
            if (submissions.length > 0) setStep(3);
          }}
          className={`flex items-center gap-2 pb-2 font-semibold transition ${
            step === 3
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px]">
            3
          </span>
          <span>Review &amp; Analyze</span>
        </button>
      </div>

      {/* STEP 1: LEARNING CONTEXT */}
      {step === 1 && (
        <div className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Step 1: Learning Context</h2>
            <p className="text-xs text-slate-500">
              Define the curriculum target and evaluation rubric so Gemini can accurately anchor evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={context.subject}
                onChange={(e) => setContext({ ...context, subject: e.target.value })}
                placeholder="e.g. English Language Arts"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Grade Level</label>
              <input
                type="text"
                value={context.gradeLevel}
                onChange={(e) => setContext({ ...context, gradeLevel: e.target.value })}
                placeholder="e.g. Grade 10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lesson / Assessment Title</label>
            <input
              type="text"
              value={context.lessonTitle}
              onChange={(e) => setContext({ ...context, lessonTitle: e.target.value })}
              placeholder="e.g. Present Perfect vs. Past Simple: Formative Diagnostic"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Learning Objective <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={context.learningObjective}
              onChange={(e) => setContext({ ...context, learningObjective: e.target.value })}
              placeholder="What specific skill or understanding should students demonstrate?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Answer / Diagnostic Rubric <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={context.expectedAnswerRubric}
              onChange={(e) => setContext({ ...context, expectedAnswerRubric: e.target.value })}
              placeholder="Key criteria, expected grammatical rules, or target solutions"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Teacher Notes (Optional Nuances)
            </label>
            <textarea
              rows={2}
              value={context.teacherNotes || ''}
              onChange={(e) => setContext({ ...context, teacherNotes: e.target.value })}
              placeholder="Class context, ESL background, common historical pitfalls..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <span>Continue to Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: STUDENT WORK */}
      {step === 2 && (
        <div className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 2: Collect Student Work</h2>
              <p className="text-xs text-slate-500">
                Add typed responses, exit ticket snippets, or upload photographed worksheets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
                <Upload size={14} className="text-slate-500" />
                <span>Upload Photos / Worksheets</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              <button
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Sparkles size={14} className="text-rose-600" />
                <span>Reset to 12 Demo Students</span>
              </button>
            </div>
          </div>

          {/* Quick Add Form */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-700 block">
              Add Individual Student Text
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder={`Student ${String(submissions.length + 1).padStart(2, '0')}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={newStudentText}
                onChange={(e) => setNewStudentText(e.target.value)}
                placeholder="Type or paste student exit ticket sentence..."
                className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubmission();
                }}
              />
              <button
                type="button"
                onClick={handleAddSubmission}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus size={14} /> Add Submission
              </button>
            </div>
          </div>

          {/* Submissions List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
              <span className="font-semibold text-slate-700">
                Loaded Submissions ({submissions.length})
              </span>
              {submissions.length > 0 && (
                <button
                  onClick={() => setSubmissions([])}
                  className="text-rose-600 hover:text-rose-800"
                >
                  Clear all
                </button>
              )}
            </div>

            {submissions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No submissions added yet. Click &quot;Reset to 12 Demo Students&quot; or paste a response above.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                {submissions.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 text-xs hover:bg-slate-50/70 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono font-semibold text-blue-700 shrink-0 w-20">
                        {sub.studentId}
                      </span>
                      {sub.workType === 'handwritten_work' ? (
                        <span className="flex items-center gap-1 text-slate-600 italic">
                          <ImageIcon size={13} className="text-blue-500" />
                          [Worksheet Image Upload]
                        </span>
                      ) : (
                        <p className="text-slate-700 truncate max-w-xl">
                          &quot;{sub.studentText}&quot;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSubmission(index)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition"
                      title="Remove submission"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={14} /> Back to Step 1
            </button>
            <button
              disabled={submissions.length === 0}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Review Submissions ({submissions.length})</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & LAUNCH */}
      {step === 3 && (
        <div className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Step 3: Review &amp; Launch Analysis</h2>
            <p className="text-xs text-slate-500">
              Verify your diagnostic parameters before triggering the 4-stage Gemini reasoning pipeline.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-slate-500 block">Class Cohort</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {context.subject} · {context.gradeLevel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Lesson Topic</span>
                <span className="font-semibold text-slate-900 text-sm">{context.lessonTitle}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Submissions Attached</span>
                <span className="font-semibold text-blue-700 text-sm">
                  {submissions.length} student responses
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-1 font-semibold">Target Learning Objective</span>
              <p className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200">
                {context.learningObjective}
              </p>
            </div>

            <div>
              <span className="text-slate-500 block mb-1 font-semibold">Diagnostic Rubric</span>
              <pre className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap font-sans text-xs">
                {context.expectedAnswerRubric}
              </pre>
            </div>
          </div>

          {/* Pipeline Notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 flex items-start gap-3 text-xs text-blue-900">
            <CheckCircle2 size={16} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Server-Side Multi-Stage Execution:</span>
              <p className="mt-0.5 text-blue-800">
                Clicking the button below will trigger Gemini 3.8 Flash sequentially across Observer, Diagnosis, Strategist, and Verifier stages. Zero client-side API keys are used.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={14} /> Back to Submissions
            </button>

            <button
              onClick={() => onStartAnalysis(context, submissions)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition active:scale-98"
            >
              <Sparkles size={16} className="text-rose-300" />
              <span>Analyze with Gemini</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
