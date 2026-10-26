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
  AlertCircle,
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

  // Form State - strictly preserved across steps and errors
  const [context, setContext] = useState<LearningContext>(
    initialDemoLoad
      ? DEMO_CONTEXT
      : {
          subject: '',
          gradeLevel: '',
          lessonTitle: '',
          learningObjective: '',
          expectedAnswerRubric: '',
          teacherNotes: '',
        }
  );

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(
    initialDemoLoad ? DEMO_SUBMISSIONS : []
  );

  // Quick single manual entry field
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentText, setNewStudentText] = useState('');

  // Field validation error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle Load Demo Classroom
  const handleLoadDemo = () => {
    setContext(DEMO_CONTEXT);
    setSubmissions(DEMO_SUBMISSIONS);
    setErrors({});
    setStep(2);
  };

  // Validate Step 1 before proceeding
  const handleProceedToStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!context.lessonTitle.trim()) {
      newErrors.lessonTitle = 'Please enter a lesson or assessment title.';
    }
    if (!context.learningObjective.trim()) {
      newErrors.learningObjective = 'Please specify the learning objective students are being assessed on.';
    }
    if (!context.expectedAnswerRubric.trim()) {
      newErrors.expectedAnswerRubric = 'Please provide diagnostic rubric criteria or expected solutions.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep(2);
  };

  // Validate Step 2 before proceeding
  const handleProceedToStep3 = () => {
    if (submissions.length === 0) {
      setErrors({ submissions: 'Please add at least one student response before proceeding to analysis.' });
      return;
    }
    setErrors({});
    setStep(3);
  };

  // Add individual student submission
  const handleAddSubmission = () => {
    if (!newStudentText.trim()) {
      setErrors({ newStudentText: 'Enter student response text or paste an exit ticket sentence.' });
      return;
    }
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
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.submissions;
      delete copy.newStudentText;
      return copy;
    });
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
          setErrors((prevErr) => {
            const copy = { ...prevErr };
            delete copy.submissions;
            return copy;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {/* Wizard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            New Formative Assessment Analysis
          </h1>
        </div>

        {/* Pre-fill Demo Button */}
        <button
          onClick={handleLoadDemo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 self-start sm:self-auto"
        >
          <Sparkles size={14} className="text-rose-500" />
          <span>Pre-fill 12 Demo Students</span>
        </button>
      </div>

      {/* Stepper Navigation */}
      <nav aria-label="Analysis steps" className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
        <button
          onClick={() => {
            setErrors({});
            setStep(1);
          }}
          className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
            step === 1
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
            step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            1
          </span>
          <span>1. Lesson Context</span>
        </button>

        <button
          onClick={() => {
            handleProceedToStep2();
          }}
          className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
            step === 2
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
            step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            2
          </span>
          <span>2. Student Work ({submissions.length})</span>
        </button>

        <button
          onClick={() => {
            if (submissions.length > 0) {
              setErrors({});
              setStep(3);
            } else {
              handleProceedToStep3();
            }
          }}
          className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
            step === 3
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-3'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
            step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            3
          </span>
          <span>3. Review &amp; Analyze</span>
        </button>
      </nav>

      {/* STEP 1: LESSON CONTEXT */}
      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProceedToStep2();
          }}
          className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-2xs"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Step 1: Lesson Context &amp; Rubric</h2>
            <p className="text-xs text-slate-500">
              Define the curriculum target and diagnostic criteria so analysis can accurately anchor evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                Subject
              </label>
              <input
                id="field-subject"
                type="text"
                value={context.subject}
                onChange={(e) => setContext({ ...context, subject: e.target.value })}
                placeholder="e.g. English Language Arts"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="field-grade" className="block text-xs font-semibold text-slate-700 mb-1">
                Grade Level
              </label>
              <input
                id="field-grade"
                type="text"
                value={context.gradeLevel}
                onChange={(e) => setContext({ ...context, gradeLevel: e.target.value })}
                placeholder="e.g. Grade 10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="field-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Lesson / Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-title"
              type="text"
              aria-required="true"
              value={context.lessonTitle}
              onChange={(e) => {
                setContext({ ...context, lessonTitle: e.target.value });
                if (errors.lessonTitle) setErrors((prev) => ({ ...prev, lessonTitle: '' }));
              }}
              placeholder="e.g. Diagnostic: Present Perfect vs. Past Simple"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                errors.lessonTitle
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {errors.lessonTitle && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.lessonTitle}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="field-objective" className="block text-xs font-semibold text-slate-700 mb-1">
              Learning Objective <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="field-objective"
              rows={2}
              aria-required="true"
              value={context.learningObjective}
              onChange={(e) => {
                setContext({ ...context, learningObjective: e.target.value });
                if (errors.learningObjective) setErrors((prev) => ({ ...prev, learningObjective: '' }));
              }}
              placeholder="What specific skill or understanding should students demonstrate?"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                errors.learningObjective
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {errors.learningObjective && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.learningObjective}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="field-rubric" className="block text-xs font-semibold text-slate-700 mb-1">
              Diagnostic Rubric / Key Criteria <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="field-rubric"
              rows={3}
              aria-required="true"
              value={context.expectedAnswerRubric}
              onChange={(e) => {
                setContext({ ...context, expectedAnswerRubric: e.target.value });
                if (errors.expectedAnswerRubric) setErrors((prev) => ({ ...prev, expectedAnswerRubric: '' }));
              }}
              placeholder="Key criteria, expected grammatical rules, or target solutions"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                errors.expectedAnswerRubric
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {errors.expectedAnswerRubric && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.expectedAnswerRubric}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="field-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Teacher Context Notes (Optional)
            </label>
            <textarea
              id="field-notes"
              rows={2}
              value={context.teacherNotes || ''}
              onChange={(e) => setContext({ ...context, teacherNotes: e.target.value })}
              placeholder="Classroom context, ESL background, common historical pitfalls..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition"
            >
              <span>Continue to Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: STUDENT WORK */}
      {step === 2 && (
        <div className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 2: Collect Student Work</h2>
              <p className="text-xs text-slate-500">
                Add typed responses, exit ticket snippets, or upload photographed worksheets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition shadow-2xs focus-within:ring-2 focus-within:ring-blue-600">
                <Upload size={14} className="text-slate-500" />
                <span>Upload Photos / Worksheets</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleImageUpload}
                />
              </label>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <Sparkles size={14} className="text-rose-500" />
                <span>Pre-fill 12 Demo Students</span>
              </button>
            </div>
          </div>

          {/* Multimodal notice */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2.5">
            <ImageIcon size={15} className="text-slate-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Multimodal Uploads:</strong> Photographed worksheets are transcribed by the vision model. In the results view, evidence from unverified transcriptions is marked <em>&quot;Transcription needs review&quot;</em> until verified by the teacher.
            </p>
          </div>

          {/* Quick Add Form */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-700 block">
              Add Individual Student Response
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="field-student-id" className="sr-only">Student Identifier</label>
                <input
                  id="field-student-id"
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder={`Student ${String(submissions.length + 1).padStart(2, '0')}`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="field-student-text" className="sr-only">Student Response Text</label>
                <input
                  id="field-student-text"
                  type="text"
                  value={newStudentText}
                  onChange={(e) => {
                    setNewStudentText(e.target.value);
                    if (errors.newStudentText) setErrors((prev) => ({ ...prev, newStudentText: '' }));
                  }}
                  placeholder="Type or paste student exit ticket sentence..."
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500 ${
                    errors.newStudentText ? 'border-rose-300' : 'border-slate-300'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubmission();
                    }
                  }}
                />
                {errors.newStudentText && (
                  <p className="mt-1 text-xs text-rose-600">{errors.newStudentText}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddSubmission}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition active:scale-98"
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
                  type="button"
                  onClick={() => setSubmissions([])}
                  className="text-rose-600 hover:text-rose-800 transition text-xs"
                >
                  Clear all
                </button>
              )}
            </div>

            {errors.submissions && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errors.submissions}</span>
              </div>
            )}

            {submissions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No submissions added yet. Add responses above, upload worksheet images, or click &quot;Pre-fill 12 Demo Students&quot;.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                {submissions.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 text-xs hover:bg-slate-50/70 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono font-semibold text-blue-700 shrink-0 w-24">
                        {sub.studentId}
                      </span>
                      {sub.workType === 'handwritten_work' ? (
                        <span className="flex items-center gap-1 text-slate-600 italic">
                          <ImageIcon size={13} className="text-blue-500 shrink-0" />
                          [Photographed Worksheet Upload]
                        </span>
                      ) : (
                        <p className="text-slate-700 truncate max-w-xl">
                          &quot;{sub.studentText}&quot;
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubmission(index)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition rounded"
                      aria-label={`Remove submission for ${sub.studentId}`}
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
              type="button"
              onClick={() => {
                setErrors({});
                setStep(1);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={14} /> Back to Step 1
            </button>
            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <span>Review &amp; Prepare Analysis ({submissions.length})</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & LAUNCH */}
      {step === 3 && (
        <div className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-2xs">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Step 3: Review &amp; Analyze Student Work</h2>
            <p className="text-xs text-slate-500">
              Verify your diagnostic parameters before starting the evidence-grounded analysis.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-slate-500 block">Class Cohort</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {context.subject} / {context.gradeLevel}
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
              <p className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {context.learningObjective}
              </p>
            </div>

            <div>
              <span className="text-slate-500 block mb-1 font-semibold">Diagnostic Rubric</span>
              <pre className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {context.expectedAnswerRubric}
              </pre>
            </div>
          </div>

          {/* Architectural Notice */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 text-xs text-slate-700">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">Deterministic Code Verification:</span>
              <p className="mt-0.5 leading-relaxed text-slate-600">
                During analysis, server-side Gemini extracts individual quotes and synthesizes class patterns. Deterministic code then audits roster coverage, cluster arithmetic, and citation matches before independent verification audits the recommendations.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setStep(2);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={14} /> Back to Submissions
            </button>

            <button
              type="button"
              onClick={() => onStartAnalysis(context, submissions)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
