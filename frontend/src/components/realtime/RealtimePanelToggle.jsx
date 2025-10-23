import React from "react";
import { cn } from "../../lib/utils";

export default function RealtimePanelToggle({
  panelOptions,
  activePanel,
  onPanelChange,
  viewDescription,
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4">
      <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:bg-slate-800/60 dark:text-slate-300">
        {panelOptions.map((option) => {
          const isActive = activePanel === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPanelChange(option.id)}
              className={cn(
                "rounded-full px-4 py-2 transition",
                isActive
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/80 dark:text-foreground"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {viewDescription}
      </p>
    </section>
  );
}
