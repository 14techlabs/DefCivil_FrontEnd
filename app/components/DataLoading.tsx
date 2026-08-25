import { Icon } from "./Primitives";

export function DataLoading({ description }: { description?: string }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <div className="card-tonal flex w-full max-w-md flex-col items-center p-10 text-center shadow-ambient-sm">
        <Icon name="progress_activity" className="mb-4 animate-spin text-[32px] text-secondary" />
        <p className="text-sm font-bold text-primary">Carregando dados…</p>
        {description && (
          <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
        )}
      </div>
    </div>
  );
}
