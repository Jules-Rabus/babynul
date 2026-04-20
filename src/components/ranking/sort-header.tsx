"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export function SortHeader<K extends string>({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  column: K;
  sortBy: K;
  sortDir: SortDir;
  onSort: (col: K) => void;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wide text-xs font-semibold",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
        className,
      )}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}
