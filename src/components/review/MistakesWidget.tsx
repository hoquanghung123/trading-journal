import { Review, Mistake } from "@/types/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface MistakesWidgetProps {
  review: Review;
  previousReview: Review | null;
  onChange: (updates: Partial<Review>) => void;
  onUpdatePrevious?: (updatedPrevious: Review) => void;
  readOnly?: boolean;
}

export function MistakesWidget({ review, previousReview, onChange, onUpdatePrevious, readOnly = false }: MistakesWidgetProps) {
  const handleMistakeChange = (index: number, text: string) => {
    const newMistakes = [...review.topMistakes];
    newMistakes[index] = { ...newMistakes[index], text };
    onChange({ topMistakes: newMistakes });
  };

  const handlePreviousFixedToggle = (index: number, checked: boolean) => {
    if (!previousReview || !onUpdatePrevious || readOnly) return;
    const newMistakes = [...previousReview.topMistakes];
    newMistakes[index] = { ...newMistakes[index], fixed: checked };
    onUpdatePrevious({ ...previousReview, topMistakes: newMistakes });
  };

  const hasPreviousMistakes = previousReview && previousReview.topMistakes.some(m => m.text.trim() !== "");

  return (
    <Card className="bg-white border-destructive/20 shadow-sm rounded-2xl flex flex-col h-full overflow-hidden">
      <CardHeader className="bg-destructive/5 border-b border-destructive/10 pb-6">
        <CardTitle className="text-destructive text-xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          Top 3 Mistakes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pt-8 flex-1">
        
        {/* Previous Period Reminder */}
        {hasPreviousMistakes && (
          <div className="space-y-4 bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              From Previous Period ({previousReview.period})
            </h4>
            <div className="space-y-3">
              {previousReview.topMistakes.filter(m => m.text.trim() !== "").map((mistake, index) => (
                <div key={mistake.id} className="flex items-start space-x-3 group">
                  <Checkbox 
                    id={`prev-mistake-${index}`} 
                    checked={mistake.fixed}
                    onCheckedChange={(checked) => handlePreviousFixedToggle(index, checked as boolean)}
                    disabled={readOnly}
                    className="border-amber-500/50 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 mt-1 rounded-md"
                  />
                  <Label 
                    htmlFor={`prev-mistake-${index}`}
                    className={`text-sm font-semibold leading-relaxed transition-all ${mistake.fixed ? 'text-muted-foreground line-through opacity-50' : 'text-amber-900 group-hover:text-amber-700'}`}
                  >
                    {mistake.text}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Period Mistakes */}
        <div className="space-y-6">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Identify Current Mistakes</h4>
          <div className="space-y-4">
            {review.topMistakes.map((mistake, index) => (
              <div key={mistake.id} className="flex items-center gap-4 group">
                <span className="text-destructive/40 text-sm font-black w-4">{index + 1}.</span>
                <Input
                  value={mistake.text}
                  onChange={(e) => handleMistakeChange(index, e.target.value)}
                  disabled={readOnly}
                  placeholder={`Major mistake #${index + 1}...`}
                  className="bg-muted/20 border-border h-12 rounded-xl text-foreground focus-visible:ring-destructive/20 font-medium"
                />
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
