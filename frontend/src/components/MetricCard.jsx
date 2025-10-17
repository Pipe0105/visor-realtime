import React from "react";
import { Card, CardHeader, CardTitle } from "./card";
import { cn } from "../lib/utils";

export default function MetricCard({
  title,
  value,
  color = "text-primary",
  icon = "",
}) {
  const valueColor =
    color === "text-primary" ? "text-slate-900 dark:text-foreground" : color;

  return (
    <Card className="border border-slate-200 bg-white text-center shadow-sm transition-colors dark:border-slate-800/70 dark:bg-slate-900/70">
      {" "}
      <CardHeader className=" flex flex-col justify-center space-y-4 pb-5 text-center">
        <div className="flex space-y-2 items-center justify-between">
          <p className="flex items-center justify-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">
            {" "}
            {title}
          </p>
          {icon ? (
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-base",
                color
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
        <CardTitle
          className={cn("text-3xl font-semibold tracking-tight", valueColor)}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
