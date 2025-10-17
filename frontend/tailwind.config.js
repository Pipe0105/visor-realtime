/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // 👈 importante
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // 🎨 Paleta clara
        primary: "#0078D7",
        accent: "#FFD233",
        background: "#F8FAFC",
        card: "#FFFFFF",

        // 🌙 Paleta oscura personalizada
        darkBg: "#0F172A",   // 👈 esta es la que faltaba
        darkCard: "#1E293B",
        darkText: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        flash: {
          "0%": { backgroundColor: "rgba(34,197,94,.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        pop: {
          "0%": { transform: "scale(.98)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        flash: "flash 1.2s ease-out 1",
        pop: "pop 0.16s ease-out 1",
      },
    },
  },
  plugins: [],
};
