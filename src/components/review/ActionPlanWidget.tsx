import { Review, ActionPlanItem } from "@/types/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface ActionPlanWidgetProps {
  review: Review;
  onChange: (updates: Partial<Review>) => void;
  readOnly?: boolean;
}

export function ActionPlanWidget({ review, onChange, readOnly = false }: ActionPlanWidgetProps) {
  
  const handleItemChange = (category: keyof Review["actionPlan"], index: number, updates: Partial<ActionPlanItem>) => {
    const newCategoryList = [...review.actionPlan[category]];
    newCategoryList[index] = { ...newCategoryList[index], ...updates };
    onChange({
      actionPlan: {
        ...review.actionPlan,
        [category]: newCategoryList,
      }
    });
  };

  const handleAddItem = (category: keyof Review["actionPlan"]) => {
    const newItem: ActionPlanItem = { id: Date.now().toString(), text: "", checked: false };
    onChange({
      actionPlan: {
        ...review.actionPlan,
        [category]: [...review.actionPlan[category], newItem],
      }
    });
  };

  const handleRemoveItem = (category: keyof Review["actionPlan"], index: number) => {
    const newCategoryList = [...review.actionPlan[category]];
    newCategoryList.splice(index, 1);
    onChange({
      actionPlan: {
        ...review.actionPlan,
        [category]: newCategoryList,
      }
    });
  };

  const renderCategory = (title: string, category: keyof Review["actionPlan"], colorClass: string, dotColor: string) => {
    const items = review.actionPlan[category] || [];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            <h4 className={`text-xs font-black uppercase tracking-widest ${colorClass}`}>{title}</h4>
          </div>
          {!readOnly && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleAddItem(category)}
              className="h-7 w-7 p-0 hover:bg-muted text-muted-foreground rounded-lg transition-all"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-start gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
              <Checkbox 
                checked={item.checked}
                onCheckedChange={(c) => handleItemChange(category, index, { checked: c as boolean })}
                disabled={readOnly}
                className="mt-1.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-md"
              />
              <Input
                value={item.text}
                onChange={(e) => handleItemChange(category, index, { text: e.target.value })}
                disabled={readOnly}
                placeholder="Task description..."
                className={`bg-transparent border-transparent hover:border-border focus-visible:border-primary/50 focus-visible:ring-0 shadow-none px-0 h-9 transition-all text-sm font-medium ${item.checked ? 'text-muted-foreground/50 line-through' : 'text-foreground'}`}
              />
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(category, index)}
                  className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all shrink-0 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {items.length === 0 && readOnly && (
            <p className="text-xs text-muted-foreground/50 italic px-2">No items listed.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white border-border shadow-sm rounded-2xl flex flex-col h-full overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border pb-6">
        <CardTitle className="text-foreground text-xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
            02
          </div>
          Action Plan v3.0
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-10 pt-8 flex-1 overflow-y-auto">
        {renderCategory("Hard Rules", "hardRules", "text-destructive", "bg-destructive")}
        {renderCategory("Optimization", "optimization", "text-primary", "bg-primary")}
        {renderCategory("Training", "training", "text-amber-600", "bg-amber-500")}
      </CardContent>
    </Card>
  );
}
