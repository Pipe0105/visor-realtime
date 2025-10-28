import React, { useState, useEffect } from "react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";

export default function Header({ onToggleTheme, theme }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = () =>
    time.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <header className="supports-[backdrop-filter]:bg-white/70 fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl transition-colors duration-300 dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950">
            <span className="text-base font-semibold tracking-tight">VRT</span>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground sm:text-xl">
                Visor Realtime
              </h1>
              <Badge
                variant="outline"
                className="rounded-full border-transparent bg-slate-900 px-3 py-1 text-xs text-slate-50 dark:bg-slate-100 dark:text-slate-900 font-semibold"
              >
                Floresta
              </Badge>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Monitor de facturación en vivo para Floresta
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 sm:flex-nowrap">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-400">
              Hora local
            </p>
            <p className="font-mono text-sm text-slate-600 dark:text-slate-300">
              {formatTime()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTheme}
            aria-pressed={theme === "dark"}
            className=" hidden rounded-full border-slate-300 bg-white text-slate-700 shadow-none transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-foreground dark:hover:bg-slate-800/70"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </Button>
        </div>
      </div>
    </header>
  );
}
