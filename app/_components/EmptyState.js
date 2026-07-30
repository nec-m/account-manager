export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}) {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel px-6 text-center ${compact ? 'py-10' : 'py-14'}`}
    >
      {icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
