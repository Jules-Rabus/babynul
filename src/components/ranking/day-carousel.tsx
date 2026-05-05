"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const dayLabelFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatShort(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayLabelFormatter.format(new Date(y, m - 1, d));
}

function isToday(day: string): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return day === today;
}

export type DayCarouselProps = {
  /** Journées triées du plus récent au plus ancien */
  days: string[];
  selectedDay: string | null;
  onSelect: (day: string) => void;
  /** Nombre de matches par jour, pour afficher un compteur sur la carte */
  matchCountByDay?: Record<string, number>;
};

export function DayCarousel({ days, selectedDay, onSelect, matchCountByDay }: DayCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Auto-scroll vers la carte sélectionnée
  useEffect(() => {
    if (!selectedDay) return;
    const el = itemsRef.current.get(selectedDay);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedDay]);

  if (days.length === 0) return null;

  const currentIndex = selectedDay ? days.indexOf(selectedDay) : 0;
  // Rappel: days[0] = plus récent. "Précédent" (flèche gauche) = remonter dans le temps = index+1.
  const goNewer = () => {
    const next = Math.max(0, currentIndex - 1);
    onSelect(days[next]);
  };
  const goOlder = () => {
    const next = Math.min(days.length - 1, currentIndex + 1);
    onSelect(days[next]);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0"
        onClick={goOlder}
        disabled={currentIndex >= days.length - 1}
        aria-label="Journée précédente"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        ref={trackRef}
        className="flex flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth scrollbar-none"
      >
        {days.map((day) => {
          const isSelected = day === selectedDay;
          const count = matchCountByDay?.[day];
          return (
            <button
              key={day}
              type="button"
              ref={(el) => {
                if (el) itemsRef.current.set(day, el);
                else itemsRef.current.delete(day);
              }}
              onClick={() => onSelect(day)}
              className={cn(
                "flex shrink-0 snap-center flex-col items-center justify-center rounded-md border px-3 py-1.5 text-xs transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card hover:bg-muted",
              )}
              aria-pressed={isSelected}
            >
              <span className="font-semibold capitalize leading-tight">
                {isToday(day) ? "Aujourd'hui" : formatShort(day)}
              </span>
              {typeof count === "number" && (
                <span
                  className={cn(
                    "tabular-nums leading-tight",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {count} match{count > 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0"
        onClick={goNewer}
        disabled={currentIndex <= 0}
        aria-label="Journée suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
