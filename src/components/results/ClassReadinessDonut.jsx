import { useState } from "react";
const ClassReadinessDonut = ({
  groups,
  misconceptions,
  totalStudents,
  onFilterGroup
}) => {
  const [activeFilter, setActiveFilter] = useState("all");
  let extendCount = 0;
  let reinforceCount = 0;
  let supportCount = 0;
  groups.forEach((g) => {
    const name = g.groupName.toLowerCase();
    if (name.includes("extension") || name.includes("extend") || name.includes("advanced")) {
      extendCount += g.studentIds.length;
    } else if (name.includes("reinforce") || name.includes("clarification") || name.includes("practice")) {
      reinforceCount += g.studentIds.length;
    } else {
      supportCount += g.studentIds.length;
    }
  });
  if (extendCount === 0 && reinforceCount === 0 && supportCount === 0 && totalStudents > 0) {
    extendCount = Math.round(totalStudents * 0.35);
    reinforceCount = Math.round(totalStudents * 0.45);
    supportCount = Math.max(1, totalStudents - extendCount - reinforceCount);
  }
  const effectiveTotal = Math.max(totalStudents, extendCount + reinforceCount + supportCount, 1);
  const readinessPercent = Math.round((extendCount + reinforceCount * 0.6) / effectiveTotal * 100);
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const extendFraction = extendCount / effectiveTotal;
  const reinforceFraction = reinforceCount / effectiveTotal;
  const supportFraction = supportCount / effectiveTotal;
  const extendStroke = extendFraction * circumference;
  const reinforceStroke = reinforceFraction * circumference;
  const supportStroke = supportFraction * circumference;
  const handleFilterClick = (filter) => {
    const nextFilter = activeFilter === filter ? "all" : filter;
    setActiveFilter(nextFilter);
    onFilterGroup?.(nextFilter);
  };
  return <div className="ui-card rounded-2xl p-6 shadow-2xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-decorative)]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-0.5">
            Diagnostic Readiness
          </span>
          <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
            Class Readiness for Target Standard
          </h3>
        </div>
        <span className="text-xs text-[var(--text-secondary)] font-mono">
          {totalStudents} students evaluated
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {
    /* SVG Donut Center */
  }
        <div className="sm:col-span-5 flex justify-center">
          <div className="relative flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
              {
    /* Background circle */
  }
              <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    stroke="var(--border-decorative)"
    strokeWidth={strokeWidth}
    fill="transparent"
  />
              {
    /* Ready to Extend segment (Emerald) */
  }
              <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    stroke="var(--status-success)"
    strokeWidth={strokeWidth}
    fill="transparent"
    strokeDasharray={`${extendStroke} ${circumference - extendStroke}`}
    strokeDashoffset={0}
    className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
    onClick={() => handleFilterClick("extend")}
  />
              {
    /* Needs Reinforcement segment (Amber) */
  }
              <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    stroke="var(--status-warning)"
    strokeWidth={strokeWidth}
    fill="transparent"
    strokeDasharray={`${reinforceStroke} ${circumference - reinforceStroke}`}
    strokeDashoffset={-extendStroke}
    className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
    onClick={() => handleFilterClick("reinforce")}
  />
              {
    /* Targeted Support segment (Rose) */
  }
              <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    stroke="var(--status-error)"
    strokeWidth={strokeWidth}
    fill="transparent"
    strokeDasharray={`${supportStroke} ${circumference - supportStroke}`}
    strokeDashoffset={-(extendStroke + reinforceStroke)}
    className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
    onClick={() => handleFilterClick("support")}
  />
            </svg>

            {
    /* Inner Center Metrics */
  }
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                {readinessPercent}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Mastery Index
              </span>
            </div>
          </div>
        </div>

        {
    /* Legend with Interactive Filters */
  }
        <div className="sm:col-span-7 space-y-2.5">
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Click any readiness category to inspect assigned student cohorts:
          </p>

          <button
    type="button"
    onClick={() => handleFilterClick("extend")}
    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${activeFilter === "extend" ? "ui-status-success ring-1 ring-[var(--status-success)] font-semibold" : "ui-card-elevated text-[var(--text-primary)] hover:border-[var(--border-control)]"}`}
  >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-success)] shrink-0" />
              <span>Ready for Extension</span>
            </div>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {extendCount} students
            </span>
          </button>

          <button
    type="button"
    onClick={() => handleFilterClick("reinforce")}
    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${activeFilter === "reinforce" ? "ui-status-warning ring-1 ring-[var(--status-warning)] font-semibold" : "ui-card-elevated text-[var(--text-primary)] hover:border-[var(--border-control)]"}`}
  >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-warning)] shrink-0" />
              <span>Needs Targeted Reinforcement</span>
            </div>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {reinforceCount} students
            </span>
          </button>

          <button
    type="button"
    onClick={() => handleFilterClick("support")}
    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${activeFilter === "support" ? "ui-status-error ring-1 ring-[var(--status-error)] font-semibold" : "ui-card-elevated text-[var(--text-primary)] hover:border-[var(--border-control)]"}`}
  >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-error)] shrink-0" />
              <span>Priority Core Scaffold</span>
            </div>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {supportCount} students
            </span>
          </button>
        </div>
      </div>
    </div>;
};
export {
  ClassReadinessDonut
};
