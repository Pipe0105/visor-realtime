import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // opcional, pero útil si usas estilos globales

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
