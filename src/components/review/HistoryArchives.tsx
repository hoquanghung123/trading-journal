import { useState, useMemo } from "react";
import { Review } from "@/types/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarDays, Search, ListFilter, ArrowRight, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HistoryArchivesProps {
  reviews: Review[];
  selectedPeriod: string | null;
  onSelectPeriod: (period: string | null) => void;
  onDelete?: (id: string) => void;
}

export function HistoryArchives({ reviews, selectedPeriod, onSelectPeriod, onDelete }: HistoryArchivesProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredReviews = useMemo(() => {
    return [...reviews]
      .filter((r) => {
        const matchSearch = r.period.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || r.type === filter;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [reviews, search, filter]);

  return (
    <Card className="bg-white border-border shadow-sm rounded-2xl h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-6 pt-8 px-8">
        <CardTitle className="text-foreground text-2xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>History Archives</span>
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">Last 3 Months</span>
            </div>
          </div>
          {selectedPeriod && (
            <button 
              onClick={() => onSelectPeriod(null)}
              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl"
            >
              Back to Active
            </button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-6 px-8 pb-8">
        {/* Toolbar: Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search periods..."
              className="pl-11 h-12 bg-muted/20 border-border rounded-xl text-foreground focus-visible:ring-primary/20 font-medium"
            />
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Type</span>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] h-12 bg-white border-border rounded-xl text-sm font-bold shadow-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="bg-white border-border rounded-xl shadow-xl">
                <SelectItem value="all" className="font-bold">All</SelectItem>
                <SelectItem value="weekly" className="font-bold">Weekly</SelectItem>
                <SelectItem value="monthly" className="font-bold">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List Layout */}
        <div className="flex-1 border border-border rounded-2xl overflow-hidden bg-muted/10 shadow-inner">
          <div className="grid grid-cols-12 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border p-4 bg-muted/30">
            <div className="col-span-8 flex items-center gap-2">
              Period <ArrowRight className="w-3 h-3 text-primary" />
            </div>
            <div className="col-span-4 text-right">Review Type</div>
          </div>
          
          <div className="overflow-y-auto max-h-[500px] divide-y divide-border/50">
            {filteredReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
                <Search className="w-10 h-10 mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">No matching archives found</p>
              </div>
            ) : (
              filteredReviews.map((rev) => {
                const isSelected = selectedPeriod === rev.period;
                const mistakesCount = rev.topMistakes.filter(m => m.text.trim() !== "").length;
                const actionCount = rev.actionPlan.hardRules.length + rev.actionPlan.optimization.length + rev.actionPlan.training.length;

                return (
                  <HoverCard key={rev.id} openDelay={200}>
                    <HoverCardTrigger asChild>
                      <div 
                        onClick={() => onSelectPeriod(isSelected ? null : rev.period)}
                        className={`
                          grid grid-cols-12 items-center p-5 cursor-pointer transition-all duration-300
                          hover:bg-white hover:shadow-lg hover:z-10 relative group
                          ${isSelected ? 'bg-primary/5 text-primary' : 'text-foreground'}
                        `}
                      >
                        <div className="col-span-8 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-primary text-white shadow-lg' : 'bg-white border border-border text-muted-foreground group-hover:text-primary'}`}>
                            <CalendarDays className="h-5 w-5" />
                          </div>
                          <span className="font-bold text-base">{rev.period}</span>
                          {isSelected && <div className="px-2 py-0.5 rounded-md bg-primary/20 text-[10px] font-black uppercase ml-2">Active</div>}
                        </div>
                        <div className="col-span-4 text-right flex items-center justify-end gap-3">
                          <Badge variant="outline" className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase border-border bg-white shadow-sm ${rev.type === 'weekly' ? 'text-blue-600' : 'text-purple-600'}`}>
                            {rev.type}
                          </Badge>
                          
                          {onDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button 
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete Review"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white border-border rounded-2xl shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-xl font-bold text-foreground">Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-muted-foreground font-medium">
                                    This will permanently delete the review for <span className="font-bold text-primary">{rev.period}</span>. 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3 mt-6">
                                  <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete(rev.id);
                                    }}
                                    className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold px-6"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </HoverCardTrigger>
                    
                    <HoverCardContent side="top" align="start" sideOffset={10} className="w-[400px] bg-white border-border shadow-2xl p-0 rounded-[24px] z-50 overflow-hidden">
                      <div className="bg-primary/5 px-6 py-4 border-b border-border/50 flex items-center justify-between">
                        <div>
                          <h4 className="text-primary font-black text-sm uppercase tracking-wider">{rev.period} Snapshot</h4>
                          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Quick overview of your performance</p>
                        </div>
                        <Badge className="bg-primary text-white border-none text-[9px] px-3 py-1 rounded-lg shadow-sm">{rev.type}</Badge>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Reflections */}
                        <div className="space-y-3">
                          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Self-Reflection
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {rev.technicalReflection && (
                              <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                <span className="text-[9px] font-black uppercase text-primary/60 block mb-1">Technical</span>
                                <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                                  {rev.technicalReflection}
                                </p>
                              </div>
                            )}
                            {rev.psychologicalReflection && (
                              <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                <span className="text-[9px] font-black uppercase text-purple-600/60 block mb-1">Psychological</span>
                                <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                                  {rev.psychologicalReflection}
                                </p>
                              </div>
                            )}
                            {rev.environmentalReflection && (
                              <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                <span className="text-[9px] font-black uppercase text-amber-600/60 block mb-1">Environmental</span>
                                <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                                  {rev.environmentalReflection}
                                </p>
                              </div>
                            )}
                            {!rev.technicalReflection && !rev.psychologicalReflection && !rev.environmentalReflection && (
                              <p className="text-xs text-muted-foreground italic p-2">No reflections recorded.</p>
                            )}
                          </div>
                        </div>

                        {/* Mistakes */}
                        {mistakesCount > 0 && (
                          <div className="space-y-3">
                            <div className="text-[10px] text-destructive/80 font-black uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                              Top Mistakes
                            </div>
                            <div className="space-y-2">
                              {rev.topMistakes.filter(m => m.text.trim() !== "").slice(0, 3).map((m, i) => (
                                <div key={i} className="flex items-start gap-3 bg-destructive/[0.03] p-2.5 rounded-xl border border-destructive/10 group">
                                  <span className="text-destructive/40 text-[10px] font-black mt-0.5">#0{i+1}</span>
                                  <span className="text-xs text-foreground font-bold leading-tight line-clamp-2">{m.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Plan Summary */}
                        {actionCount > 0 && (
                          <div className="pt-4 border-t border-border/50">
                            <div className="flex flex-wrap gap-2">
                              {rev.actionPlan.hardRules.length > 0 && (
                                <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg">
                                  <div className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                                  {rev.actionPlan.hardRules.length} Rules
                                </div>
                              )}
                              {rev.actionPlan.optimization.length > 0 && (
                                <div className="flex items-center gap-2 bg-primary/10 text-primary text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg">
                                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                  {rev.actionPlan.optimization.length} Optimizations
                                </div>
                              )}
                              {rev.actionPlan.training.length > 0 && (
                                <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg">
                                  <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  {rev.actionPlan.training.length} Training
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
