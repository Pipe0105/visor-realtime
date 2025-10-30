import React, { useState, useEffect } from "react";
import RealtimeView from "./pages/RealtimeView";
import Header from "./components/Header";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }
  } catch (error) {
    console.warn("No se pudo leer la preferencia de tema almacenada", error);
  }

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      window.localStorage.setItem("theme", theme);
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema", error);
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gray-200 to-slate-200 text-foreground transition-colors duration-500 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-foreground">
      {" "}
      <Header onToggleTheme={toggleTheme} theme={theme} />
      <main className="px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <RealtimeView />
      </main>
    </div>
  );
}
