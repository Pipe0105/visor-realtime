import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from "../lib/utils";

export default function MetricCard({
  title,
  value,
  color = "text-primary",
  icon = "",
}) {
  return (
    <Card className="relative overflow-hidden">
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full
      bg-primary/10 blur-3xl transition-all duration-500 group-hover:h-40 group-hover:w-40
      dark:bg-primary/20"
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium text-slate-500 dark:text-slate-300",
            color
          )}
        >
          {title}
        </CardTitle>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-foreground">
            {value}
          </p>
        </CardContent>
      </CardHeader>
    </Card>
  );
}
