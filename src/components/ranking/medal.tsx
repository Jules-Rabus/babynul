import { cn } from "@/lib/utils";

export function Medal({ rank, className }: { rank: number; className?: string }) {
  if (rank === 1)
    return (
      <span className={cn("inline-flex w-8 justify-center text-lg", className)} aria-label="1er">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className={cn("inline-flex w-8 justify-center text-lg", className)} aria-label="2e">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className={cn("inline-flex w-8 justify-center text-lg", className)} aria-label="3e">
        🥉
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex w-8 justify-center text-sm font-semibold text-muted-foreground",
        className,
      )}
    >
      #{rank}
    </span>
  );
}
