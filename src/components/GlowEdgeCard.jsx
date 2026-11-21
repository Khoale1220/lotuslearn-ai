const GlowEdgeCard = ({
  variant = "ai",
  selected = false,
  className = "",
  innerClassName = "",
  children,
  as: Component = "div",
  ...rest
}) => {
  let borderClass = "border-[var(--border-decorative)] shadow-2xs hover:border-[var(--border-control)] hover:shadow-xs";
  if (selected) {
    switch (variant) {
      case "ai":
        borderClass = "border-[var(--border-focus)] ring-2 ring-[var(--border-focus)] shadow-xs";
        break;
      case "validation":
        borderClass = "border-[var(--border-focus)] ring-2 ring-[var(--border-focus)] shadow-xs";
        break;
      case "verified":
        borderClass = "border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs";
        break;
      case "warning":
      case "human":
        borderClass = "border-amber-500 ring-2 ring-amber-500/20 shadow-xs";
        break;
      default:
        borderClass = "border-[var(--border-control)] ring-2 ring-[var(--border-focus)] shadow-xs";
        break;
    }
  }
  return <Component
    className={`relative ui-card rounded-xl transition-all duration-150 ${borderClass} ${className}`}
    {...rest}
  >
      <div className={`w-full h-full rounded-xl bg-[var(--bg-surface)] ${innerClassName}`}>
        {children}
      </div>
    </Component>;
};
export {
  GlowEdgeCard
};
