import { PlaybookModel } from "@/types/playbook";
import { StrategyCard } from "./StrategyCard";
import { Plus, FolderOpen } from "lucide-react";

interface PlaybookGridProps {
  models: PlaybookModel[];
  onSelectModel: (id: string) => void;
  onAddNew: () => void;
  stats?: Record<string, { winRate: number; avgRr: number; count: number }>;
}

export function PlaybookGrid({ models, onSelectModel, onAddNew, stats }: PlaybookGridProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Playbook
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Trading Models & Strategies
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="forest-gradient flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Strategy
        </button>
      </div>

      {models.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-border shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3">No Strategies Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm font-medium">
            Your playbook is empty. Define your first trading model to start building your edge.
          </p>
          <button
            onClick={onAddNew}
            className="mt-8 px-8 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all"
          >
            Create Your First Model
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {models.map((model) => (
            <StrategyCard
              key={model.id}
              model={model}
              onClick={() => onSelectModel(model.id)}
              stats={stats?.[model.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
