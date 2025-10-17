import React from "react";
import { cn } from "../lib/utils";

const badgeBase =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

const badgeVariants = {
  default: "border-transparent bg-primary text-primary-foreground shadow",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground shadow",
  outline: "text-foreground",
  success:
    "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const Badge = React.forwardRef(function Badge(
  { className, variant = "default", ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(
        badgeBase,
        badgeVariants[variant] ?? badgeVariants.default,
        className
      )}
      {...props}
    />
  );
});

Badge.displayName = "Badge";

export { Badge };
