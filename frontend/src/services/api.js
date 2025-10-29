const DEFAULT_API_PORT = "8000";

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripTrailingSlash(value) {
  if (!value) return value;
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value) {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function getWindowLocation() {
  if (typeof window === "undefined" || !window?.location) {
    return {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "",
    };
  }

  return window.location;
}

function computeApiBaseUrl() {
  const location = getWindowLocation();

  const protocolHint = safeTrim(import.meta?.env?.VITE_API_PROTOCOL ?? "");
  const protocol = (protocolHint || location.protocol || "http:")
    .replace(/:$/, "")
    .toLowerCase();

  let host = safeTrim(import.meta?.env?.VITE_API_HOST ?? "");
  if (!host) {
    host = location.hostname || "127.0.0.1";
  }

  let port = import.meta?.env?.VITE_API_PORT;
  if (port === undefined || port === null) {
    port = DEFAULT_API_PORT;
  }

  port = safeTrim(String(port));

  let base = `${protocol}://${host}`;
  if (port && !host.includes(":")) {
    base += `:${port}`;
  }

  const apiPath = safeTrim(import.meta?.env?.VITE_API_PATH ?? "");
  if (apiPath) {
    base += apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  }

  return stripTrailingSlash(base);
}

export function getApiBaseUrl() {
  return computeApiBaseUrl();
}

export function getApiBaseComponents() {
  const baseUrl = getApiBaseUrl();

  try {
    return new URL(`${baseUrl}/`);
  } catch {
    return null;
  }
}

export function buildApiUrl(path = "") {
  const baseUrl = getApiBaseUrl();
  if (!path) return baseUrl;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBase = stripTrailingSlash(baseUrl);
  const normalizedPath = ensureLeadingSlash(path);
  return `${normalizedBase}${normalizedPath}`;
}

export function apiFetch(path, options) {
  return fetch(buildApiUrl(path), options);
}

// -------------------- WEBSOCKET --------------------

function computeWsAuthority() {
  const apiComponents = getApiBaseComponents();
  const location = getWindowLocation();

  const protocolHint = safeTrim(import.meta?.env?.VITE_WS_PROTOCOL ?? "");
  const referenceProtocol =
    protocolHint || apiComponents?.protocol || location.protocol || "http:";
  const normalizedProtocol = referenceProtocol.replace(/:$/, "").toLowerCase();
  const protocol =
    normalizedProtocol === "https"
      ? "wss"
      : normalizedProtocol === "wss" || normalizedProtocol === "ws"
      ? normalizedProtocol
      : "ws";

  let host = safeTrim(import.meta?.env?.VITE_WS_HOST ?? "");
  if (!host) {
    host = apiComponents?.hostname || location.hostname || "127.0.0.1";
  }

  let portValue = import.meta?.env?.VITE_WS_PORT;
  if (portValue === undefined || portValue === null) {
    portValue = apiComponents?.port ?? "";
  }

  let port = safeTrim(String(portValue));
  if (port === "0") port = "";

  const authority = port && !host.includes(":") ? `${host}:${port}` : host;

  return `${protocol}://${authority}`;
}

export function getWsBaseUrl() {
  return stripTrailingSlash(computeWsAuthority());
}

export function buildWebSocketUrl(path = "") {
  // Si el path ya es una URL completa (ws:// o wss://)
  if (path && /^wss?:\/\//i.test(path)) {
    return stripTrailingSlash(path);
  }

  // Si hay un VITE_WS_URL explícito en .env
  const explicitUrl = safeTrim(import.meta?.env?.VITE_WS_URL ?? "");
  if (explicitUrl) {
    if (/^wss?:\/\//i.test(explicitUrl)) {
      return stripTrailingSlash(explicitUrl);
    }
    return `${getWsBaseUrl()}${ensureLeadingSlash(explicitUrl)}`;
  }

  // Si hay un path por variable (VITE_WS_PATH)
  const envPath = safeTrim(import.meta?.env?.VITE_WS_PATH ?? "");
  const finalPath = path || envPath || "";
  return `${getWsBaseUrl()}${ensureLeadingSlash(finalPath)}`;
}
