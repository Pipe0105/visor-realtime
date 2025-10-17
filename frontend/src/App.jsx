import React from "react";
import { useState, useEffect } from "react";
import RealtimeView from "./pages/RealtimeView";
import Header from "./components/Header";

export default function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return(
    <div className="min-h-screen bg-background dark:bg-darkBg transition-colors duration-300" >
      <Header onToggleTheme={toggleTheme} theme={theme}/>
      <main className="pt-20 px-6">
        <RealtimeView />
      </main>
    </div>
  )
}