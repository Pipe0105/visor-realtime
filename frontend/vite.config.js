// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expone en LAN (0.0.0.0)
    port: 5173,
    cors: true, // habilita CORS en el dev server de Vite para sus assets
  },
});
