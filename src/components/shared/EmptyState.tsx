import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`bg-card rounded-[32px] border border-border p-10 sm:p-16 text-center max-w-xl mx-auto shadow-sm ${className}`}
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
      </div>
      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{title}</h2>
      <p className="text-sm font-medium text-muted-foreground mt-2 mb-8 leading-relaxed px-2 sm:px-6">
        {description}
      </p>
      {((actionLabel && onAction) || (secondaryLabel && onSecondary)) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="forest-gradient inline-flex items-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-xl hover:opacity-90 transition-all active:scale-95"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center gap-2 px-8 py-3 text-sm font-black rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all active:scale-95"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
