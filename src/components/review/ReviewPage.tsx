import { useState, useEffect } from "react";

import { ReviewForm } from "@/components/review/ReviewForm";
import { ActionPlanWidget } from "@/components/review/ActionPlanWidget";
import { HistoryArchives } from "@/components/review/HistoryArchives";
import { MistakesWidget } from "@/components/review/MistakesWidget";
import { TradeNotesTab } from "@/components/review/TradeNotesTab";
import { useReviewsStorage } from "@/hooks/useReviewsStorage";
import { Review } from "@/types/review";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle, Edit2, ClipboardList, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Helper to get current week period, e.g., "2026-04-W3"
const getCurrentWeekPeriod = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");

  // Calculate week of the month (assuming week starts on Monday)
  const firstDayOfMonth = new Date(year, d.getMonth(), 1);
  const dayOffset = (firstDayOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const weekOfMonth = Math.ceil((d.getDate() + dayOffset) / 7);

  return `${year}-${month}-W${weekOfMonth}`;
};

export function ReviewPage() {
  const {
    reviews,
    saveReview,
    removeReview,
    getReviewByPeriod,
    getPreviousReview,
    createEmptyReview,
    isLoaded,
  } = useReviewsStorage();

  const [currentPeriod, setCurrentPeriod] = useState(getCurrentWeekPeriod());
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // The review currently being edited (the "current" week)
  const [draftReview, setDraftReview] = useState<Review | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempPeriod, setTempPeriod] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"reflection" | "trade-notes">("reflection");

  const handleConfirmPeriod = () => {
    if (tempPeriod && tempPeriod.trim() !== "") {
      setCurrentPeriod(tempPeriod.trim().toUpperCase());
      setSelectedPeriod(null);
      setDraftReview(null); // trigger reload
      setIsDialogOpen(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      const reviewToDelete = reviews.find((r) => r.id === id);
      await removeReview(id);
      if (selectedPeriod === reviewToDelete?.period) {
        setSelectedPeriod(null);
      }
      if (currentPeriod === reviewToDelete?.period) {
        setDraftReview(null); // trigger recreation of empty review
      }
      toast.success("Review deleted successfully");
    } catch (e) {
      toast.error("Failed to delete review");
    }
  };

  // Initialize draft when storage is loaded
  useEffect(() => {
    if (isLoaded && !draftReview) {
      const existing = getReviewByPeriod(currentPeriod);
      if (existing) {
        setDraftReview(existing);
      } else {
        setDraftReview(createEmptyReview(currentPeriod, "weekly"));
      }
    }
  }, [isLoaded, currentPeriod, getReviewByPeriod, createEmptyReview]);

  const handleDraftChange = (updates: Partial<Review>) => {
    if (!draftReview) return;
    setDraftReview({ ...draftReview, ...updates });
  };

  const handleSave = async () => {
    if (draftReview) {
      setIsSaving(true);
      try {
        await saveReview(draftReview);
        toast.success("Review saved successfully!");
      } catch (e) {
        toast.error("Failed to save review");
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!isLoaded || !draftReview) {
    return (
      <div className="min-h-screen bg-background text-primary flex items-center justify-center font-bold">
        Loading Storage...
      </div>
    );
  }

  // Determine what we are displaying: the active draft or a historical read-only view
  const isReadOnly = selectedPeriod !== null && selectedPeriod !== currentPeriod;
  const displayReview = isReadOnly ? getReviewByPeriod(selectedPeriod) : draftReview;

  if (!displayReview) {
    return (
      <div className="min-h-screen bg-background text-destructive flex items-center justify-center font-bold">
        Error: Review data not found.
      </div>
    );
  }

  const previousReviewForDraft = getPreviousReview(currentPeriod);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 lg:p-10">
      <div className="max-w-[1600px] mx-auto space-y-6 lg:space-y-8">
        <header className="mb-6 lg:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4 lg:pb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 lg:mb-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Save className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
              </div>
              <h1 className="text-xl lg:text-3xl font-bold tracking-tight text-foreground">
                Performance Review
              </h1>
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground font-medium max-w-2xl">
              Deep self-reflection and systemic analysis of your trading behavior.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="text-left md:text-right">
              <div className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5 lg:mb-1">
                Editing Period
              </div>
              <div className="text-lg lg:text-2xl font-black text-primary flex items-center justify-start md:justify-end gap-2 lg:gap-3">
                {currentPeriod}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      onClick={() => setTempPeriod(currentPeriod)}
                      className="text-muted-foreground hover:text-primary transition-all p-1 rounded-lg hover:bg-muted"
                      title="Change Period"
                    >
                      <Edit2 className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-border text-foreground rounded-2xl shadow-xl">
                    <DialogHeader>
                      <DialogTitle className="text-primary font-bold text-xl">
                        Create / Edit Different Period
                      </DialogTitle>
                    </DialogHeader>
                    <div className="py-6">
                      <label className="text-sm font-semibold text-muted-foreground mb-3 block uppercase tracking-wider">
                        Period Code (e.g., 2026-04-W2)
                      </label>
                      <Input
                        value={tempPeriod}
                        onChange={(e) => setTempPeriod(e.target.value)}
                        className="bg-muted/30 border-border h-12 text-lg focus-visible:ring-primary/20 rounded-xl"
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmPeriod()}
                      />
                    </div>
                    <DialogFooter className="gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => setIsDialogOpen(false)}
                        className="rounded-xl font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmPeriod}
                        className="forest-gradient text-white rounded-xl font-bold px-8"
                      >
                        Confirm
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {!isReadOnly && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="forest-gradient text-white font-bold gap-2 lg:gap-3 h-10 lg:h-14 px-4 lg:px-8 rounded-xl lg:rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 text-xs lg:text-base"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 lg:h-5 lg:w-5" />
                )}
                {isSaving ? "Saving..." : "Save Review"}
              </Button>
            )}
            {isReadOnly && (
              <div className="flex items-center gap-4">
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 px-6 py-3 rounded-2xl flex items-center gap-3 font-bold shadow-sm">
                  <AlertCircle className="h-5 w-5" />
                  Read-only History
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedPeriod) {
                      setCurrentPeriod(selectedPeriod);
                      setSelectedPeriod(null);
                      setDraftReview(null);
                    }
                  }}
                  className="border-primary text-primary font-bold hover:bg-primary/5 rounded-2xl h-14 px-6 shadow-sm transition-all active:scale-95"
                >
                  <Edit2 className="h-5 w-5 mr-2" />
                  Edit this Period
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border/50 w-fit">
          <button
            onClick={() => setActiveTab("reflection")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "reflection"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Self-Reflection
          </button>
          <button
            onClick={() => setActiveTab("trade-notes")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "trade-notes"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <StickyNote className="w-4 h-4" />
            Trade Notes
          </button>
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === "reflection" ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Left Column - Input Form */}
              <div className="xl:col-span-5 flex flex-col gap-8">
                <ReviewForm review={displayReview} onChange={handleDraftChange} readOnly={isReadOnly} />
              </div>

              {/* Right Column - Dashboards */}
              <div className="xl:col-span-7 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[600px]">
                  <MistakesWidget
                    review={displayReview}
                    previousReview={
                      isReadOnly ? getPreviousReview(selectedPeriod) : previousReviewForDraft
                    }
                    onChange={handleDraftChange}
                    onUpdatePrevious={saveReview}
                    readOnly={isReadOnly}
                  />
                  <ActionPlanWidget
                    review={displayReview}
                    onChange={handleDraftChange}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>
          ) : (
            <TradeNotesTab period={isReadOnly && selectedPeriod ? selectedPeriod : currentPeriod} />
          )}
        </div>

        {/* Bottom Area - History Archives */}
        <div className="mt-12 pt-12 border-t border-border">
          <HistoryArchives
            reviews={reviews}
            selectedPeriod={selectedPeriod}
            onSelectPeriod={setSelectedPeriod}
            onDelete={handleDeleteReview}
          />
        </div>
      </div>
    </div>
  );
}
