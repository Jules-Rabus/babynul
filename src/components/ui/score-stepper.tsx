"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScoreStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function ScoreStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  disabled,
  className,
  id,
}: ScoreStepperProps) {
  const decrement = () => onChange(clamp(value - step, min, max));
  const increment = () => onChange(clamp(value + step, min, max));
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("flex flex-col items-stretch gap-1.5", className)} id={id}>
      {label && (
        <span className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-background p-1.5 shadow-sm ring-1 ring-border">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={decrement}
          disabled={disabled || atMin}
          aria-label="Diminuer le score"
          className="h-12 w-12 shrink-0 rounded-lg"
        >
          <Minus className="h-5 w-5" />
        </Button>
        <span
          aria-live="polite"
          className="flex-1 select-none text-center text-3xl font-bold tabular-nums"
        >
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={increment}
          disabled={disabled || atMax}
          aria-label="Augmenter le score"
          className="h-12 w-12 shrink-0 rounded-lg"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      {typeof max === "number" && Number.isFinite(max) && (
        <span className="text-center text-[10px] text-muted-foreground">
          max {max}
        </span>
      )}
    </div>
  );
}
