import React, { useState, useEffect } from "react";
import RealtimeView from "./pages/RealtimeView";
import Header from "./components/Header";

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-white to-slate-100 text-foreground transition-colors duration-500 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-foreground">
      <Header onToggleTheme={toggleTheme} theme={theme} />
      <main className="px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <RealtimeView />
      </main>
    </div>
  );
}
