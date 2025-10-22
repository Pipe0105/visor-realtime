// src/services/socketService.js
import { buildWebSocketUrl } from "./api";

function ensureLeadingSlash(value) {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function ensureTrailingSlash(value) {
  if (!value) return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveWebSocketPath(branchCode) {
  const envUrl = import.meta?.env?.VITE_WS_URL;
  const trimmedEnvUrl = typeof envUrl === "string" ? envUrl.trim() : "";

  if (trimmedEnvUrl) {
    return trimmedEnvUrl;
  }

  const envPath = import.meta?.env?.VITE_WS_PATH;
  const basePath =
    typeof envPath === "string" && envPath.trim() ? envPath.trim() : "/ws";

  const normalizedBase = ensureLeadingSlash(basePath.replace(/\/+$/, ""));

  if (!branchCode) {
    return normalizedBase;
  }

  const suffix = String(branchCode).trim();
  if (!suffix) {
    return normalizedBase;
  }

  return `${ensureTrailingSlash(normalizedBase)}${suffix}`;
}

export function connectToBranch(branchCode, onMessage) {
  const wsPath = resolveWebSocketPath(branchCode);
  const ws = new WebSocket(buildWebSocketUrl(wsPath));

  ws.onopen = () => {
    console.log(` Connected to branch ${branchCode}`);
  };

  ws.onclose = () => {
    console.log(` Disconnected from branch ${branchCode}`);
  };

  ws.onerror = (err) => {
    console.error(" WebSocket error:", err);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.warn("Unknown message:", event.data);
    }
  };

  return ws;
}
