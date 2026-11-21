import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Upload,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from "../data/demoClassroom";
const NewAnalysisWizard = ({
  onCancel,
  onStartAnalysis,
  initialDemoLoad = false
}) => {
  const [step, setStep] = useState(initialDemoLoad ? 2 : 1);
  const [context, setContext] = useState(
    initialDemoLoad ? DEMO_CONTEXT : {
      subject: "",
      gradeLevel: "",
      lessonTitle: "",
      learningObjective: "",
      expectedAnswerRubric: "",
      teacherNotes: ""
    }
  );
  const [submissions, setSubmissions] = useState(
    initialDemoLoad ? DEMO_SUBMISSIONS : []
  );
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentText, setNewStudentText] = useState("");
  const [errors, setErrors] = useState({});
  const handleLoadDemo = () => {
    setContext(DEMO_CONTEXT);
    setSubmissions(DEMO_SUBMISSIONS);
    setErrors({});
    setStep(2);
  };
  const handleProceedToStep2 = () => {
    const newErrors = {};
    if (!context.lessonTitle.trim()) {
      newErrors.lessonTitle = "Please enter a lesson or assessment title.";
    }
    if (!context.learningObjective.trim()) {
      newErrors.learningObjective = "Please specify the learning objective students are being assessed on.";
    }
    if (!context.expectedAnswerRubric.trim()) {
      newErrors.expectedAnswerRubric = "Please provide diagnostic rubric criteria or expected solutions.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setStep(2);
  };
  const handleProceedToStep3 = () => {
    if (submissions.length === 0) {
      setErrors({ submissions: "Please add at least one student response before proceeding to analysis." });
      return;
    }
    setErrors({});
    setStep(3);
  };
  const handleAddSubmission = () => {
    if (!newStudentText.trim()) {
      setErrors({ newStudentText: "Enter student response text or paste an exit ticket sentence." });
      return;
    }
    const nextId = newStudentId.trim() || `Student ${String(submissions.length + 1).padStart(2, "0")}`;
    setSubmissions([
      ...submissions,
      {
        studentId: nextId,
        studentText: newStudentText.trim(),
        workType: "typed"
      }
    ]);
    setNewStudentId("");
    setNewStudentText("");
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.submissions;
      delete copy.newStudentText;
      return copy;
    });
  };
  const handleRemoveSubmission = (index) => {
    setSubmissions(submissions.filter((_, i) => i !== index));
  };
  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result?.split(",")[1];
        if (base64Data) {
          const nextNum = submissions.length + index + 1;
          const assignedId = `Student ${String(nextNum).padStart(2, "0")}`;
          setSubmissions((prev) => [
            ...prev,
            {
              studentId: assignedId,
              studentText: `[Photographed Worksheet Upload: ${file.name}]`,
              imageBase64: base64Data,
              mimeType: file.type || "image/jpeg",
              workType: "handwritten_work"
            }
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
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {
    /* Wizard Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-3">
        <div>
          <button
    onClick={onCancel}
    className="ui-btn ui-btn-ghost gap-1.5 px-2 py-1 text-xs mb-1"
  >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            New Formative Assessment Analysis
          </h1>
        </div>

        {
    /* Pre-fill Demo Button */
  }
        <button
    onClick={handleLoadDemo}
    className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs shadow-2xs self-start sm:self-auto"
  >
          <Play size={14} className="text-[var(--text-primary)]" />
          <span>Pre-fill 12 Demo Students</span>
        </button>
      </div>

      {
    /* Stepper Navigation */
  }
      <nav aria-label="Analysis steps" className="flex items-center justify-between border-b border-[var(--border-decorative)] pb-3 text-xs">
        <button
    onClick={() => {
      setErrors({});
      setStep(1);
    }}
    className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded ${step === 1 ? "text-[var(--text-primary)] border-b-2 border-[var(--border-focus)] -mb-3" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
  >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === 1 ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>
            1
          </span>
          <span>1. Lesson Context</span>
        </button>

        <button
    onClick={() => {
      handleProceedToStep2();
    }}
    className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded ${step === 2 ? "text-[var(--text-primary)] border-b-2 border-[var(--border-focus)] -mb-3" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
  >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === 2 ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>
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
    className={`flex items-center gap-2 pb-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded ${step === 3 ? "text-[var(--text-primary)] border-b-2 border-[var(--border-focus)] -mb-3" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
  >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === 3 ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>
            3
          </span>
          <span>3. Review &amp; Analyze</span>
        </button>
      </nav>

      {
    /* STEP 1: LESSON CONTEXT */
  }
      {step === 1 && <form
    onSubmit={(e) => {
      e.preventDefault();
      handleProceedToStep2();
    }}
    className="ui-card space-y-6 p-6 sm:p-8 rounded-xl shadow-2xs"
  >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Step 1: Lesson Context &amp; Rubric</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Define the curriculum target and diagnostic criteria so analysis can accurately anchor evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-subject" className="ui-label block text-xs mb-1">
                Subject
              </label>
              <input
    id="field-subject"
    type="text"
    value={context.subject}
    onChange={(e) => setContext({ ...context, subject: e.target.value })}
    placeholder="e.g. English Language Arts"
    className="ui-input rounded-lg px-3 py-2 text-sm"
  />
            </div>

            <div>
              <label htmlFor="field-grade" className="ui-label block text-xs mb-1">
                Grade Level
              </label>
              <input
    id="field-grade"
    type="text"
    value={context.gradeLevel}
    onChange={(e) => setContext({ ...context, gradeLevel: e.target.value })}
    placeholder="e.g. Grade 10"
    className="ui-input rounded-lg px-3 py-2 text-sm"
  />
            </div>
          </div>

          <div>
            <label htmlFor="field-title" className="ui-label block text-xs mb-1">
              Lesson / Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
    id="field-title"
    type="text"
    aria-required="true"
    value={context.lessonTitle}
    onChange={(e) => {
      setContext({ ...context, lessonTitle: e.target.value });
      if (errors.lessonTitle) setErrors((prev) => ({ ...prev, lessonTitle: "" }));
    }}
    placeholder="e.g. Diagnostic: Present Perfect vs. Past Simple"
    className={`ui-input rounded-lg px-3 py-2 text-sm ${errors.lessonTitle ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : "border-[var(--border-control)] focus:border-[var(--border-focus)] focus:ring-[var(--border-focus)]"}`}
  />
            {errors.lessonTitle && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.lessonTitle}
              </p>}
          </div>

          <div>
            <label htmlFor="field-objective" className="ui-label block text-xs mb-1">
              Learning Objective <span className="text-rose-500">*</span>
            </label>
            <textarea
    id="field-objective"
    rows={2}
    aria-required="true"
    value={context.learningObjective}
    onChange={(e) => {
      setContext({ ...context, learningObjective: e.target.value });
      if (errors.learningObjective) setErrors((prev) => ({ ...prev, learningObjective: "" }));
    }}
    placeholder="What specific skill or understanding should students demonstrate?"
    className={`ui-input rounded-lg px-3 py-2 text-sm ${errors.learningObjective ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : "border-[var(--border-control)] focus:border-[var(--border-focus)] focus:ring-[var(--border-focus)]"}`}
  />
            {errors.learningObjective && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.learningObjective}
              </p>}
          </div>

          <div>
            <label htmlFor="field-rubric" className="ui-label block text-xs mb-1">
              Diagnostic Rubric / Key Criteria <span className="text-rose-500">*</span>
            </label>
            <textarea
    id="field-rubric"
    rows={3}
    aria-required="true"
    value={context.expectedAnswerRubric}
    onChange={(e) => {
      setContext({ ...context, expectedAnswerRubric: e.target.value });
      if (errors.expectedAnswerRubric) setErrors((prev) => ({ ...prev, expectedAnswerRubric: "" }));
    }}
    placeholder="Key criteria, expected grammatical rules, or target solutions"
    className={`ui-input rounded-lg px-3 py-2 text-sm ${errors.expectedAnswerRubric ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : "border-[var(--border-control)] focus:border-[var(--border-focus)] focus:ring-[var(--border-focus)]"}`}
  />
            {errors.expectedAnswerRubric && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.expectedAnswerRubric}
              </p>}
          </div>

          <div>
            <label htmlFor="field-notes" className="ui-label block text-xs mb-1">
              Teacher Context Notes (Optional)
            </label>
            <textarea
    id="field-notes"
    rows={2}
    value={context.teacherNotes || ""}
    onChange={(e) => setContext({ ...context, teacherNotes: e.target.value })}
    placeholder="Classroom context, ESL background, common historical pitfalls..."
    className="ui-input rounded-lg px-3 py-2 text-sm"
  />
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border-decorative)]">
            <button
    type="submit"
    className="ui-btn ui-btn-primary gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--action-primary-fg)] shadow-xs hover:bg-[var(--action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 transition"
  >
              <span>Continue to Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>}

      {
    /* STEP 2: STUDENT WORK */
  }
      {step === 2 && <div className="ui-card space-y-6 p-6 sm:p-8 rounded-xl shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Step 2: Collect Student Work</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Add typed responses, exit ticket snippets, or upload photographed worksheets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs cursor-pointer shadow-2xs focus-within:ring-2 focus-within:ring-[var(--border-focus)]">
                <Upload size={14} className="text-[var(--text-secondary)]" />
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
    className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs shadow-2xs"
  >
                <Play size={14} className="text-[var(--text-primary)]" />
                <span>Pre-fill 12 Demo Students</span>
              </button>
            </div>
          </div>

          {
    /* Multimodal notice */
  }
          <div className="ui-card-elevated rounded-lg p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
            <ImageIcon size={15} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Multimodal Uploads:</strong> Photographed worksheets are transcribed by the vision model. In the results view, evidence from unverified transcriptions is marked <em>&quot;Transcription needs review&quot;</em> until verified by the teacher.
            </p>
          </div>

          {
    /* Quick Add Form */
  }
          <div className="ui-card-elevated rounded-lg p-4 space-y-3">
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
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
    placeholder={`Student ${String(submissions.length + 1).padStart(2, "0")}`}
    className="ui-input rounded-lg px-3 py-2 text-xs"
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
      if (errors.newStudentText) setErrors((prev) => ({ ...prev, newStudentText: "" }));
    }}
    placeholder="Type or paste student exit ticket sentence..."
    className={`ui-input rounded-lg px-3 py-2 text-xs ${errors.newStudentText ? "border-rose-300" : "border-[var(--border-control)]"}`}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddSubmission();
      }
    }}
  />
                {errors.newStudentText && <p className="mt-1 text-xs text-rose-600">{errors.newStudentText}</p>}
              </div>
              <button
    type="button"
    onClick={handleAddSubmission}
    className="ui-btn ui-btn-primary gap-1.5 px-4 py-2 text-xs font-semibold text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] transition active:scale-98"
  >
                <Plus size={14} /> Add Submission
              </button>
            </div>
          </div>

          {
    /* Submissions List */
  }
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-1">
              <span className="font-semibold text-[var(--text-primary)]">
                Loaded Submissions ({submissions.length})
              </span>
              {submissions.length > 0 && <button
    type="button"
    onClick={() => setSubmissions([])}
    className="text-rose-600 hover:text-rose-800 transition text-xs"
  >
                  Clear all
                </button>}
            </div>

            {errors.submissions && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errors.submissions}</span>
              </div>}

            {submissions.length === 0 ? <div className="ui-card-elevated rounded-lg border-dashed p-8 text-center text-xs text-[var(--text-secondary)]">
                No submissions added yet. Add responses above, upload worksheet images, or click &quot;Pre-fill 12 Demo Students&quot;.
              </div> : <div className="ui-card max-h-80 overflow-y-auto divide-y divide-[var(--border-decorative)] rounded-lg">
                {submissions.map((sub, index) => <div
    key={index}
    className="flex items-start justify-between p-3 text-xs hover:bg-[var(--bg-elevated)] transition-colors gap-3"
  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono font-semibold text-[var(--text-primary)] shrink-0 w-24">
                        {sub.studentId}
                      </span>
                      {sub.workType === "handwritten_work" ? <span className="flex items-center gap-1 text-[var(--text-secondary)] italic">
                          <ImageIcon size={13} className="text-[var(--text-secondary)] shrink-0" />
                          [Photographed Worksheet Upload]
                        </span> : <p className="text-[var(--text-primary)] truncate max-w-xl">
                          &quot;{sub.studentText}&quot;
                        </p>}
                    </div>
                    <button
    type="button"
    onClick={() => handleRemoveSubmission(index)}
    className="text-[var(--text-secondary)] hover:text-rose-600 p-1 transition rounded"
    aria-label={`Remove submission for ${sub.studentId}`}
  >
                      <Trash2 size={14} />
                    </button>
                  </div>)}
              </div>}
          </div>

          {
    /* Stepper Navigation */
  }
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-decorative)]">
            <button
    type="button"
    onClick={() => {
      setErrors({});
      setStep(1);
    }}
    className="ui-btn ui-btn-ghost gap-1.5 px-2 py-1 text-xs"
  >
              <ArrowLeft size={14} /> Back to Step 1
            </button>
            <button
    type="button"
    onClick={handleProceedToStep3}
    className="ui-btn ui-btn-primary gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--action-primary-fg)] shadow-xs hover:bg-[var(--action-primary-hover)] transition"
  >
              <span>Review &amp; Prepare Analysis ({submissions.length})</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>}

      {
    /* STEP 3: REVIEW & LAUNCH */
  }
      {step === 3 && <div className="ui-card space-y-6 p-6 sm:p-8 rounded-xl shadow-2xs">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Step 3: Review &amp; Analyze Student Work</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Verify your diagnostic parameters before starting the evidence-grounded analysis.
            </p>
          </div>

          <div className="ui-card-elevated rounded-xl p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[var(--border-decorative)]">
              <div>
                <span className="text-[var(--text-secondary)] block">Class Cohort</span>
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  {context.subject} / {context.gradeLevel}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block">Lesson Topic</span>
                <span className="font-semibold text-[var(--text-primary)] text-sm">{context.lessonTitle}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block">Submissions Attached</span>
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  {submissions.length} student responses
                </span>
              </div>
            </div>

            <div>
              <span className="text-[var(--text-secondary)] block mb-1 font-semibold">Target Learning Objective</span>
              <p className="ui-card p-3 rounded-lg leading-relaxed">
                {context.learningObjective}
              </p>
            </div>

            <div>
              <span className="text-[var(--text-secondary)] block mb-1 font-semibold">Diagnostic Rubric</span>
              <pre className="ui-card p-3 rounded-lg whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {context.expectedAnswerRubric}
              </pre>
            </div>
          </div>

          {
    /* Architectural Notice */
  }
          <div className="ui-card-elevated rounded-lg p-4 flex items-start gap-3 text-xs text-[var(--text-primary)]">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-[var(--text-primary)]">Deterministic Code Verification:</span>
              <p className="mt-0.5 leading-relaxed text-[var(--text-secondary)]">
                During analysis, server-side Gemini extracts individual quotes and synthesizes class patterns. Deterministic code then audits roster coverage, cluster arithmetic, and citation matches before independent verification audits the recommendations.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-decorative)]">
            <button
    type="button"
    onClick={() => {
      setErrors({});
      setStep(2);
    }}
    className="ui-btn ui-btn-ghost gap-1.5 px-2 py-1 text-xs"
  >
              <ArrowLeft size={14} /> Back to Submissions
            </button>

            <button
    type="button"
    onClick={() => onStartAnalysis(context, submissions)}
    className="ui-btn ui-btn-primary gap-2 px-6 py-3 text-sm font-semibold text-[var(--action-primary-fg)] shadow-sm hover:bg-[var(--action-primary-hover)] transition active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
  >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>}
    </div>;
};
export {
  NewAnalysisWizard
};
