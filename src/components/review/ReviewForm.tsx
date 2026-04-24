import { Review } from "@/types/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReviewFormProps {
  review: Review;
  onChange: (updates: Partial<Review>) => void;
  readOnly?: boolean;
}

export function ReviewForm({ review, onChange, readOnly = false }: ReviewFormProps) {
  return (
    <Card className="bg-white border-border shadow-sm rounded-2xl h-full">
      <CardHeader className="pb-8">
        <CardTitle className="text-foreground text-2xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
            01
          </div>
          Self-Reflection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-10">
        <div className="space-y-4">
          <Label htmlFor="tech" className="text-muted-foreground font-bold uppercase tracking-wider text-xs block">
            Technical Assessment
          </Label>
          <p className="text-sm font-semibold text-foreground leading-relaxed mb-2">
            "In your losing trades, is there a common pattern (e.g., entering too early without MSS)?"
          </p>
          <Textarea
            id="tech"
            value={review.technicalReflection}
            onChange={(e) => onChange({ technicalReflection: e.target.value })}
            disabled={readOnly}
            className="min-h-[140px] bg-muted/20 border-border rounded-xl text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/40 resize-none font-medium leading-relaxed"
            placeholder="Technical analysis..."
          />
        </div>

        <div className="space-y-4">
          <Label htmlFor="psycho" className="text-muted-foreground font-bold uppercase tracking-wider text-xs block">
            Psychological Assessment
          </Label>
          <p className="text-sm font-semibold text-foreground leading-relaxed mb-2">
            "What emotions frequently push you to violate discipline in the past week/month?"
          </p>
          <Textarea
            id="psycho"
            value={review.psychologicalReflection}
            onChange={(e) => onChange({ psychologicalReflection: e.target.value })}
            disabled={readOnly}
            className="min-h-[140px] bg-muted/20 border-border rounded-xl text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/40 resize-none font-medium leading-relaxed"
            placeholder="Psychological analysis..."
          />
        </div>

        <div className="space-y-4">
          <Label htmlFor="env" className="text-muted-foreground font-bold uppercase tracking-wider text-xs block">
            External Factors
          </Label>
          <p className="text-sm font-semibold text-foreground leading-relaxed mb-2">
            "Are there external distractions reducing your focus while trading?"
          </p>
          <Textarea
            id="env"
            value={review.environmentalReflection}
            onChange={(e) => onChange({ environmentalReflection: e.target.value })}
            disabled={readOnly}
            className="min-h-[140px] bg-muted/20 border-border rounded-xl text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/40 resize-none font-medium leading-relaxed"
            placeholder="External analysis..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
