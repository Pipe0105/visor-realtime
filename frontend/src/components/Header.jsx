import React, { useState, useEffect } from "react";

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
    <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-lg bg-white/70 dark:bg-darkCard/80 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center sm:flex-row sm:justify-between sm:text-left px-6 py-3">
        {/* Bloque Izquierdo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🧾</span>
            <h1 className="text-xl sm:text-2xl font-semibold text-primary dark:text-darkText">
              Visor Realtime — <span className="text-blue-600">FLORESTA</span>
            </h1>
          </div>
          <span className="text-gray-700 dark:text-gray-300 mt-1 sm:mt-0 text-sm">
            {formatTime()}
          </span>
        </div>

        {/* Bloque Derecho */}
        <div className="mt-2 sm:mt-0">
          <button
            onClick={onToggleTheme}
            className="px-3 py-1.5 rounded-lg font-medium bg-primary/10 dark:bg-gray-700 text-primary dark:text-gray-100 hover:scale-105 transition-all"
          >
            {theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Oscuro"}
          </button>
        </div>
      </div>
    </header>
  );

}
