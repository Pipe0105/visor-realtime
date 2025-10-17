import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
    <header className="supports-[backdrop-filter]:bg-white/60 fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg transition-colors duration-300 dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
            <span className="animate-pulse text-primary">🧾</span>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-foreground sm:text-2xl">
                Visor Realtime
              </h1>
              <Badge
                variant="outline"
                className="border-primary/40 text-primary dark:border-primary/40"
              >
                Floresta
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Monitor de facturación en vivo para sucursales Siesa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 shadow-inner dark:bg-slate-800/80 dark:text-foreground">
            {formatTime()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTheme}
            className="shadow-sm"
          >
            {theme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          </Button>
        </div>
      </div>
    </header>
  );
}
