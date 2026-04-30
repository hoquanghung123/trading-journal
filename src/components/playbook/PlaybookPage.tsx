import { useState, useEffect, useMemo } from "react";
import { usePlaybook } from "@/hooks/usePlaybook";
import { PlaybookGrid } from "./PlaybookGrid";
import { StrategyDetail } from "./StrategyDetail";
import { StrategyForm } from "./StrategyForm";
import { TradeModal } from "../journal/TradeModal";
import { PlaybookModel } from "@/types/playbook";
import { toast } from "sonner";
import { AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onPlaybookFocus } from "@/lib/nav-bus";
import { fetchTrades, Trade, upsertTrade, deleteTrade, tradesQueryKey } from "@/lib/trades";

export function PlaybookPage() {
  const queryClient = useQueryClient();
  const { models, isLoaded: isPlaybookLoaded, addModel, updateModel, deleteModel } = usePlaybook();
  
  const { data: trades = [], isLoading: isTradesLoading } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
  });

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<PlaybookModel | undefined>(undefined);

  // Trade Modal State
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  useEffect(() => {
    return onPlaybookFocus((id) => {
      setSelectedModelId(id);
    });
  }, []);

  const stats = useMemo(() => {
    // Optimization: Group trades by setupId once
    const tradesBySetup: Record<string, Trade[]> = {};
    trades.forEach(t => {
      if (t.setupId) {
        if (!tradesBySetup[t.setupId]) tradesBySetup[t.setupId] = [];
        tradesBySetup[t.setupId].push(t);
      }
    });

    const map: Record<string, { winRate: number; avgRr: number; count: number }> = {};
    models.forEach((m) => {
      const modelTrades = tradesBySetup[m.id] || [];
      const followedTrades = modelTrades.filter((t) => t.complianceCheck);
      const wins = followedTrades.filter((t) => t.actualRr > 0).length;
      const wr = followedTrades.length > 0 ? (wins / followedTrades.length) * 100 : 0;
      const totalRr = followedTrades.reduce((acc, t) => acc + t.actualRr, 0);
      const avgRr = followedTrades.length > 0 ? totalRr / followedTrades.length : 0;
      map[m.id] = { winRate: wr, avgRr, count: followedTrades.length };
    });
    return map;
  }, [models, trades]);

  const warnings = useMemo(() => {
    return models
      .filter((m) => stats[m.id]?.count >= 3 && stats[m.id]?.winRate < 40)
      .map((m) => ({
        id: m.id,
        name: m.name,
        wr: stats[m.id].winRate,
      }));
  }, [models, stats]);

  if (!isPlaybookLoaded || isTradesLoading) {
    return (
      <div className="h-[calc(100vh-32px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-black text-muted-foreground uppercase tracking-widest animate-pulse">
            Syncing Playbook Data...
          </p>
        </div>
      </div>
    );
  }

  const handleSaveModel = (model: PlaybookModel) => {
    if (editingModel) {
      updateModel(model);
      toast.success("Strategy updated");
    } else {
      addModel(model);
      toast.success("Strategy created");
    }
    setIsFormOpen(false);
    setEditingModel(undefined);
  };

  const handleEdit = (model: PlaybookModel) => {
    setEditingModel(model);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteModel(id);
    setSelectedModelId(null);
    toast.success("Strategy deleted");
  };

  const handleAddNew = () => {
    setEditingModel(undefined);
    setIsFormOpen(true);
  };

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsTradeModalOpen(true);
  };

  const handleSaveTrade = async (trade: Trade) => {
    try {
      await upsertTrade(trade);
      toast.success("Trade updated");
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      setIsTradeModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update trade");
    }
  };

  const handleDeleteTrade = async (id: string) => {
    try {
      await deleteTrade(id);
      toast.success("Trade deleted");
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      setIsTradeModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete trade");
    }
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="h-[calc(100vh-32px)] flex flex-col p-6 max-w-7xl mx-auto w-full">
      {selectedModel ? (
        <StrategyDetail
          model={selectedModel}
          trades={trades}
          onBack={() => setSelectedModelId(null)}
          onEdit={() => handleEdit(selectedModel)}
          onDelete={() => handleDelete(selectedModel.id)}
          onUpdate={updateModel}
          onTradeClick={handleTradeClick}
        />
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4 animate-in slide-in-from-top duration-500">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-amber-500 uppercase tracking-widest">
                  Performance Warning
                </h4>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                  Low performance detected on some setups:
                  {warnings.map((w, i) => (
                    <span key={w.id} className="font-bold text-foreground">
                      {" "}
                      {w.name} ({w.wr.toFixed(0)}% WR){i < warnings.length - 1 ? "," : ""}
                    </span>
                  ))}
                  . Consider moving them to "Under Review".
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-muted-foreground/30" />
            </div>
          )}
          <PlaybookGrid
            models={models}
            onSelectModel={setSelectedModelId}
            onAddNew={handleAddNew}
            stats={stats}
          />
        </>
      )}

      {isFormOpen && (
        <StrategyForm
          initialData={editingModel}
          onSave={handleSaveModel}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingModel(undefined);
          }}
        />
      )}

      {selectedTrade && (
        <TradeModal
          open={isTradeModalOpen}
          trade={selectedTrade}
          onClose={() => setIsTradeModalOpen(false)}
          onSave={handleSaveTrade}
          onDelete={() => handleDeleteTrade(selectedTrade.id)}
        />
      )}
    </div>
  );
}
