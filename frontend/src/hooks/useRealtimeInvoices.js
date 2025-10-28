import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildWebSocketUrl } from "../services/api";
import {
  getInvoiceDay,
  getInvoiceIdentifier,
  normalizeInvoice,
  normalizeTimestamp,
  sortInvoicesByTimestampDesc,
  parseInvoiceTimestamp,
  toNumber,
} from "../lib/invoiceUtils";

const PAGE_SIZE = 100;
const MAX_VISIBLE_INVOICES = 700;
const DEFAULT_DAILY_HISTORY_DAYS = 14;

const isInvoiceRecord = (value) => value && typeof value === "object";

function normalizeDailyHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const date = typeof entry.date === "string" ? entry.date : null;
  const total = toNumber(entry.total);
  const invoices = Math.max(0, Math.trunc(toNumber(entry.invoices)));
  const cumulative = toNumber(
    entry.cumulative != null ? entry.cumulative : entry.total
  );

  return {
    date,
    total,
    cumulative,
    invoices,
  };
}

export function useRealtimeInvoices() {
  const [status, setStatus] = useState("Desconectado 🔴");
  const [allMessages, setAllMessages] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState(null);
  const [invoiceItems, setInvoicesItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dailySummary, setDailySummary] = useState({
    totalSales: 0,
    totalNetSales: 0,
    totalInvoices: 0,
    averageTicket: 0,
  });

  const [dailySalesHistory, setDailySalesHistory] = useState({
    branch: "all",
    days: DEFAULT_DAILY_HISTORY_DAYS,
    history: [],
  });
  const [filters, setFilters] = useState({
    query: "",
    branch: "all",
    minTotal: "",
    maxTotal: "",
    minItems: "",
    maxItems: "",
  });
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [salesForecast, setSalesForecast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const knownInvoicesRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const pendingManualReconnectRef = useRef(false);

  const messages = useMemo(
    () => allMessages.slice(0, MAX_VISIBLE_INVOICES),
    [allMessages]
  );

  const loadInvoices = useCallback(async () => {
    try {
      const res = await apiFetch(`/invoices/today`);

      const data = await res.json();

      if (Array.isArray(data)) {
        const normalizedInvoices = data
          .map(normalizeInvoice)
          .filter(isInvoiceRecord);
        const sortedInvoices = sortInvoicesByTimestampDesc(normalizedInvoices);
        setAllMessages(sortedInvoices);

        knownInvoicesRef.current = new Set(
          sortedInvoices
            .map((invoice) => getInvoiceIdentifier(invoice))
            .filter(Boolean)
        );
        const total = sortedInvoices.reduce(
          (sum, f) => sum + toNumber(f.total),
          0
        );
        const totalNet = sortedInvoices.reduce(
          (sum, f) => sum + toNumber(f.subtotal ?? f.total),
          0
        );
        const count = sortedInvoices.length;
        setDailySummary({
          totalSales: total,
          totalNetSales: totalNet,
          totalInvoices: count,
          averageTicket: count ? total / count : 0,
        });
        return sortedInvoices;
      }

      const normalizedInvoices = Array.isArray(data.invoices)
        ? data.invoices.map(normalizeInvoice).filter(isInvoiceRecord)
        : [];

      let allInvoices = [...normalizedInvoices];
      const totalInvoicesCount = Math.trunc(toNumber(data.total_invoices));
      const pageLimit = Math.max(
        1,
        Math.trunc(toNumber(data.limit ?? normalizedInvoices.length ?? 0)) ||
          MAX_VISIBLE_INVOICES
      );
      let nextOffset = Math.max(0, Math.trunc(toNumber(data.offset ?? 0)));
      nextOffset += normalizedInvoices.length;

      while (
        Number.isFinite(totalInvoicesCount) &&
        totalInvoicesCount > 0 &&
        allInvoices.length < totalInvoicesCount
      ) {
        const params = new URLSearchParams();
        params.set("offset", String(nextOffset));
        params.set("limit", String(pageLimit));

        let nextPagePayload = null;
        try {
          const nextResponse = await apiFetch(
            `/invoices/today?${params.toString()}`
          );
          if (!nextResponse.ok) {
            break;
          }
          nextPagePayload = await nextResponse.json();
        } catch (error) {
          console.error("Error cargando página adicional de facturas", error);
          break;
        }

        const nextRawInvoices = Array.isArray(nextPagePayload)
          ? nextPagePayload
          : Array.isArray(nextPagePayload?.invoices)
          ? nextPagePayload.invoices
          : [];

        if (nextRawInvoices.length === 0) {
          break;
        }

        const nextNormalized = nextRawInvoices
          .map(normalizeInvoice)
          .filter(isInvoiceRecord);

        if (nextNormalized.length === 0) {
          break;
        }

        allInvoices = allInvoices.concat(nextNormalized);
        nextOffset += nextNormalized.length;
        if (nextNormalized.length < pageLimit) {
          break;
        }
      }

      const sortedInvoices = sortInvoicesByTimestampDesc(allInvoices);

      setAllMessages(sortedInvoices);
      knownInvoicesRef.current = new Set(
        sortedInvoices
          .map((invoice) => getInvoiceIdentifier(invoice))
          .filter(Boolean)
      );
      const totalSales = toNumber(data.total_sales);
      const totalNetSales = toNumber(
        data.total_net_sales ?? data.total_without_taxes ?? data.total_sales
      );
      const averageTicket = toNumber(
        data.average_ticket ??
          (totalInvoicesCount ? totalSales / totalInvoicesCount : 0)
      );
      setDailySummary({
        totalSales,
        totalNetSales,
        totalInvoices: totalInvoicesCount,
        averageTicket,
      });
      return sortedInvoices;
    } catch (err) {
      console.error("Error cargando facturas", err);
      setAllMessages([]);
      knownInvoicesRef.current = new Set();
      setDailySummary({
        totalSales: 0,
        totalNetSales: 0,
        totalInvoices: 0,
        averageTicket: 0,
      });
      throw err;
    }
  }, []);

  useEffect(() => {
    loadInvoices().catch(() => {});
  }, [loadInvoices]);

  const loadSalesForecast = useCallback(
    async (branchValue) => {
      const params = new URLSearchParams();
      const targetBranch = branchValue ?? filters.branch ?? "all";
      if (targetBranch && targetBranch !== "all") {
        params.set("branch", targetBranch);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/invoices/today/forecast?${queryString}`
        : `/invoices/today/forecast`;

      const response = await apiFetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      return payload;
    },
    [filters.branch]
  );

  const loadDailySalesHistory = useCallback(
    async (branchValue) => {
      const params = new URLSearchParams();
      params.set("days", String(DEFAULT_DAILY_HISTORY_DAYS));

      const targetBranch = branchValue ?? filters.branch ?? "all";
      if (targetBranch && targetBranch !== "all") {
        params.set("branch", targetBranch);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/invoices/daily-sales?${queryString}`
        : `/invoices/daily-sales`;

      const response = await apiFetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rawHistory = Array.isArray(payload?.history) ? payload.history : [];

      let runningCumulative = 0;
      const normalizedHistory = [];
      for (const entry of rawHistory) {
        const normalized = normalizeDailyHistoryEntry(entry);
        if (!normalized?.date) {
          continue;
        }
        runningCumulative += normalized.total;
        normalizedHistory.push({
          ...normalized,
          cumulative:
            normalized.cumulative > 0
              ? normalized.cumulative
              : runningCumulative,
        });
      }

      return {
        branch: payload?.branch ?? targetBranch ?? "all",
        days: payload?.days ?? DEFAULT_DAILY_HISTORY_DAYS,
        history: normalizedHistory,
      };
    },
    [filters.branch]
  );

  useEffect(() => {
    let cancelled = false;

    loadSalesForecast(filters.branch)
      .then((forecast) => {
        if (!cancelled) {
          setSalesForecast(forecast);
        }
      })
      .catch((error) => {
        console.error("Error obteniendo pronóstico de ventas", error);
        if (!cancelled) {
          setSalesForecast(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters.branch, loadSalesForecast]);

  useEffect(() => {
    let cancelled = false;

    loadDailySalesHistory(filters.branch)
      .then((history) => {
        if (!cancelled) {
          setDailySalesHistory(history);
        }
      })
      .catch((error) => {
        console.error("Error obteniendo historial diario de ventas", error);
        if (!cancelled) {
          setDailySalesHistory({
            branch: filters.branch ?? "all",
            days: DEFAULT_DAILY_HISTORY_DAYS,
            history: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters.branch, loadDailySalesHistory]);

  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined" || !shouldReconnectRef.current) {
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setStatus("Conectando 🟡");

    const socket = new WebSocket(buildWebSocketUrl("/ws/FLO"));
    wsRef.current = socket;

    socket.onopen = () => {
      pendingManualReconnectRef.current = false;
      intentionalCloseRef.current = false;
      setStatus("Conectado 🟢");
      console.log("✅ WebSocket conectado");
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error("⚠️ No se pudo parsear el mensaje de WebSocket", error);
        return;
      }
      console.log("📩 Mensaje recibido:", data);

      if (!isInvoiceRecord(data)) {
        console.warn(
          "⚠️ Mensaje de WebSocket ignorado: no contiene una factura válida",

          data
        );
        return;
      }

      const normalized = normalizeInvoice(data);

      if (!isInvoiceRecord(normalized)) {
        console.warn(
          "⚠️ Mensaje de WebSocket ignorado tras normalizar la factura",

          data
        );
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      const messageDay =
        getInvoiceDay(normalized.timestamp) ||
        getInvoiceDay(normalized.created_at) ||
        getInvoiceDay(normalized.invoice_date) ||
        today;

      const invoiceTotal = toNumber(data.total);
      const invoiceSubtotal = toNumber(
        data.subtotal != null ? data.subtotal : data.total
      );

      const normalizedId = getInvoiceIdentifier(normalized);
      const normalizedTimestampForMatch = normalizeTimestamp(
        normalized.timestamp ??
          normalized.created_at ??
          normalized.invoice_date ??
          null
      );

      setAllMessages((prev) => {
        const safePrev = prev.filter(isInvoiceRecord);

        const previousDay = safePrev[0]
          ? getInvoiceDay(safePrev[0].timestamp) ||
            getInvoiceDay(safePrev[0].created_at) ||
            getInvoiceDay(safePrev[0].invoice_date) ||
            today
          : today;

        const isNewDay = safePrev.length > 0 && messageDay !== previousDay;

        const knownInvoices = new Set(
          safePrev
            .map((invoice) => getInvoiceIdentifier(invoice))
            .filter(Boolean)
        );
        const matchesExistingInvoice = (item) => {
          if (!isInvoiceRecord(item)) {
            return false;
          }
          if (normalizedId != null) {
            return getInvoiceIdentifier(item) === normalizedId;
          }

          const itemTimestampForMatch = normalizeTimestamp(
            item.timestamp ?? item.created_at ?? item.invoice_date ?? null
          );

          return (
            item.invoice_number === normalized.invoice_number &&
            itemTimestampForMatch === normalizedTimestampForMatch
          );
        };

        const hasExistingInvoice =
          normalizedId != null
            ? knownInvoices.has(normalizedId)
            : safePrev.some(matchesExistingInvoice);

        setDailySummary((prevSummary) => {
          if (isNewDay) {
            console.log("Nuevo dia detectado - reiniciando resumen diario");
            return {
              totalSales: invoiceTotal,
              totalNetSales: invoiceSubtotal,
              totalInvoices: 1,
              averageTicket: invoiceTotal,
            };
          }

          if (hasExistingInvoice) {
            return prevSummary;
          }

          const baseInvoices = prevSummary?.totalInvoices || 0;
          const baseNetSales = prevSummary?.totalNetSales || 0;
          const baseSales = prevSummary?.totalSales || 0;
          const totalSales = baseSales + invoiceTotal;
          const totalNetSales = baseNetSales + invoiceSubtotal;
          const totalInvoices = baseInvoices + 1;

          return {
            totalSales,
            totalNetSales,
            totalInvoices,
            averageTicket: totalInvoices ? totalSales / totalInvoices : 0,
          };
        });

        if (!hasExistingInvoice) {
          setDailySalesHistory((prevHistory) => {
            const previousHistory = Array.isArray(prevHistory?.history)
              ? prevHistory.history.map((entry) => ({
                  date: entry?.date ?? null,
                  total: toNumber(entry?.total),
                  cumulative: toNumber(entry?.cumulative),
                  invoices: Math.max(0, Math.trunc(toNumber(entry?.invoices))),
                }))
              : [];

            const deltaTotal = invoiceTotal;
            if (!Number.isFinite(deltaTotal) || deltaTotal === 0) {
              return prevHistory;
            }

            const todayIso = messageDay;

            const baseCumulative =
              previousHistory.length > 0
                ? previousHistory[previousHistory.length - 1].cumulative
                : 0;

            if (isNewDay || previousHistory.length === 0) {
              return {
                ...prevHistory,
                history: [
                  ...previousHistory,
                  {
                    date: todayIso,
                    total: deltaTotal,
                    cumulative: baseCumulative + deltaTotal,
                    invoices: 1,
                  },
                ],
              };
            }

            const existingIndex = previousHistory.findIndex(
              (entry) => entry?.date === todayIso
            );

            if (existingIndex === -1) {
              return {
                ...prevHistory,
                history: [
                  ...previousHistory,
                  {
                    date: todayIso,
                    total: deltaTotal,
                    cumulative: baseCumulative + deltaTotal,
                    invoices: 1,
                  },
                ],
              };
            }

            const updatedHistory = previousHistory.map((entry, index) => {
              if (index === existingIndex) {
                const nextTotal = entry.total + deltaTotal;
                return {
                  ...entry,
                  total: nextTotal,
                  cumulative: entry.cumulative + deltaTotal,
                  invoices: entry.invoices + 1,
                };
              }

              if (index > existingIndex) {
                return {
                  ...entry,
                  cumulative: entry.cumulative + deltaTotal,
                };
              }

              return entry;
            });

            return {
              ...prevHistory,
              history: updatedHistory,
            };
          });
        }

        let nextMessages;

        if (isNewDay) {
          nextMessages = [normalized];
        } else if (hasExistingInvoice) {
          const updatedInvoices = safePrev.map((item) =>
            matchesExistingInvoice(item)
              ? normalizeInvoice({ ...item, ...normalized })
              : item
          );
          nextMessages = updatedInvoices;
        } else {
          nextMessages = [normalized, ...safePrev];
        }

        const orderedMessages = sortInvoicesByTimestampDesc(
          nextMessages.filter(isInvoiceRecord)
        );

        knownInvoicesRef.current = new Set(
          orderedMessages
            .map((invoice) => getInvoiceIdentifier(invoice))
            .filter(Boolean)
        );

        return orderedMessages;
      });
    };

    socket.onerror = (event) => {
      console.error("⚠️ Error en WebSocket", event);
    };

    socket.onclose = () => {
      wsRef.current = null;
      console.log("⚠️ WebSocket cerrado");

      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        if (pendingManualReconnectRef.current && shouldReconnectRef.current) {
          pendingManualReconnectRef.current = false;
          connectWebSocket();
        } else if (!shouldReconnectRef.current) {
          setStatus("Desconectado 🔴");
        }
        return;
      }

      if (!shouldReconnectRef.current) {
        setStatus("Desconectado 🔴");
        return;
      }

      setStatus("Reconectando ♻️");
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 4000);
    };
  }, []);

  const forceReconnect = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    setStatus("Reconectando ♻️");

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const currentSocket = wsRef.current;
    if (currentSocket) {
      pendingManualReconnectRef.current = true;
      intentionalCloseRef.current = true;
      try {
        currentSocket.close();
      } catch (error) {
        console.error("Error cerrando WebSocket para reconectar", error);
        pendingManualReconnectRef.current = false;
        intentionalCloseRef.current = false;
        connectWebSocket();
      }
      return;
    }

    pendingManualReconnectRef.current = false;
    intentionalCloseRef.current = false;
    connectWebSocket();
  }, [connectWebSocket]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      forceReconnect();

      try {
        const response = await apiFetch(`/invoices/rescan`, { method: "POST" });
        if (response.ok) {
          await response.json().catch(() => null);
        }
      } catch (error) {
        console.error("Error solicitando re-escaneo de facturas", error);
      }

      await loadInvoices().catch(() => {});

      try {
        const forecast = await loadSalesForecast(filters.branch);
        setSalesForecast(forecast);
      } catch (error) {
        console.error(
          "Error actualizando pronóstico durante el refresco",
          error
        );
        setSalesForecast(null);
      }

      try {
        const history = await loadDailySalesHistory(filters.branch);
        setDailySalesHistory(history);
      } catch (error) {
        console.error(
          "Error actualizando historial diario durante el refresco",
          error
        );
      }
    } catch (error) {
      console.error("Error general durante el refresco manual", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    filters.branch,
    forceReconnect,
    isRefreshing,
    loadInvoices,
    loadSalesForecast,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const MIN_INTERVAL_MS = 15_000;
    const MAX_INTERVAL_MS = 30_000;

    const scheduleNextRefresh = () => {
      const delay =
        MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);

      autoRefreshTimerRef.current = window.setTimeout(async () => {
        autoRefreshTimerRef.current = null;

        try {
          await handleManualRefresh();
        } finally {
          scheduleNextRefresh();
        }
      }, delay);
    };

    scheduleNextRefresh();

    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [handleManualRefresh]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connectWebSocket();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        try {
          wsRef.current.close();
        } catch (error) {
          console.error("Error cerrando WebSocket en limpieza", error);
        }
      }
      pendingManualReconnectRef.current = false;
    };
  }, [connectWebSocket]);

  const handleInvoiceClick = useCallback(
    async (invoice_number) => {
      if (selectedInvoices === invoice_number) {
        setSelectedInvoices(null);
        setInvoicesItems([]);
        return;
      }

      setInvoicesItems([]);
      setLoadingItems(true);
      setSelectedInvoices(invoice_number);
      try {
        const res = await apiFetch(`/invoices/${invoice_number}/items`);
        const data = await res.json();
        if (Array.isArray(data.items)) {
          const sortedItems = [...data.items].sort((a, b) => {
            const lineA = Number.isFinite(Number(a?.line_number))
              ? Number(a.line_number)
              : null;
            const lineB = Number.isFinite(Number(b?.line_number))
              ? Number(b.line_number)
              : null;

            if (lineA != null && lineB != null) {
              return lineA - lineB;
            }
            if (lineA != null) return -1;
            if (lineB != null) return 1;

            const descriptionA = a?.description ?? "";
            const descriptionB = b?.description ?? "";

            return descriptionA.localeCompare(descriptionB, "es", {
              sensitivity: "base",
            });
          });

          setInvoicesItems(sortedItems);
        } else {
          setInvoicesItems([]);
        }
      } catch (err) {
        console.error("error cargando items", err);
        setInvoicesItems([]);
      } finally {
        setLoadingItems(false);
      }
    },
    [selectedInvoices]
  );

  const summary = useMemo(() => {
    const forecastData = salesForecast?.forecast ?? null;
    const todayData = salesForecast?.today ?? null;

    const normalizedForecast = forecastData
      ? {
          total: toNumber(forecastData.total),
          remaining: toNumber(forecastData.remaining),
          method: forecastData.method ?? null,
          ratio: toNumber(forecastData.ratio),
          historyDays: forecastData.history_days ?? 0,
          historySamples: forecastData.history_samples ?? 0,
          historyAverageTotal: toNumber(forecastData.history_average_total),
          historyAverageFirstChunk: toNumber(
            forecastData.history_average_first_chunk
          ),
          generatedAt: forecastData.generated_at ?? null,
          branch: salesForecast?.branch ?? "all",
          firstChunkInvoices: todayData?.first_chunk_invoices ?? 0,
          firstChunkTotal: toNumber(todayData?.first_chunk_total),
          currentTotal: toNumber(todayData?.current_total),
          invoiceCount: todayData?.invoice_count ?? 0,
          previousTotal: toNumber(forecastData.previous_total),
          previousNetTotal: toNumber(forecastData.previous_net_total),
          previousInvoiceCount: forecastData.previous_invoice_count ?? 0,
          previousDate: forecastData.previous_date ?? null,
        }
      : null;

    return {
      total: dailySummary.totalSales,
      netTotal: dailySummary.totalNetSales,
      count: dailySummary.totalInvoices,
      avg: dailySummary.averageTicket,
      forecast: normalizedForecast,
    };
  }, [dailySummary, salesForecast]);

  const selectedInvoiceData = selectedInvoices
    ? messages.find((msg) => msg.invoice_number === selectedInvoices)
    : null;
  const hasSelectedInvoiceTotal =
    selectedInvoiceData && selectedInvoiceData.total != null;
  const detailItemsCount =
    invoiceItems.length > 0
      ? invoiceItems.length
      : selectedInvoiceData?.items ?? 0;
  const detailSubtotal =
    invoiceItems.length > 0
      ? invoiceItems.reduce((sum, item) => sum + toNumber(item.subtotal), 0)
      : toNumber(selectedInvoiceData?.subtotal);
  const detailComputedTotal = hasSelectedInvoiceTotal
    ? toNumber(selectedInvoiceData.total)
    : detailSubtotal;
  const selectedInvoiceDateValue = selectedInvoiceData
    ? parseInvoiceTimestamp(
        selectedInvoiceData.invoice_date ??
          selectedInvoiceData.timestamp ??
          selectedInvoiceData.created_at ??
          null
      )
    : null;
  const selectedInvoiceDate = selectedInvoiceDateValue
    ? selectedInvoiceDateValue.toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const selectedInvoiceMeta = selectedInvoiceData
    ? [
        selectedInvoiceDate ? `Emitida ${selectedInvoiceDate}` : null,
        `${detailItemsCount} ${detailItemsCount === 1 ? "ítem" : "ítems"}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const availableBranches = useMemo(() => {
    const branchSet = new Set();
    messages.forEach((msg) => {
      branchSet.add(msg.branch || "FLO");
    });
    return Array.from(branchSet).sort((a, b) => a.localeCompare(b));
  }, [messages]);

  const totalsRange = useMemo(() => {
    if (messages.length === 0) {
      return { min: 0, max: 0 };
    }
    return messages.reduce(
      (acc, msg) => {
        const value = toNumber(msg.total);
        return {
          min: Math.min(acc.min, value),
          max: Math.max(acc.max, value),
        };
      },
      { min: Number.POSITIVE_INFINITY, max: 0 }
    );
  }, [messages]);

  const itemsRange = useMemo(() => {
    if (messages.length === 0) {
      return { min: 0, max: 0 };
    }
    return messages.reduce(
      (acc, msg) => {
        const value = toNumber(msg.items);
        return {
          min: Math.min(acc.min, value),
          max: Math.max(acc.max, value),
        };
      },
      { min: Number.POSITIVE_INFINITY, max: 0 }
    );
  }, [messages]);

  const filteredMessages = useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    const normalizedQuery = filters.query.trim().toLowerCase();
    const minTotal =
      filters.minTotal !== "" ? toNumber(filters.minTotal) : null;
    const maxTotal =
      filters.maxTotal !== "" ? toNumber(filters.maxTotal) : null;
    const minItems =
      filters.minItems !== "" ? toNumber(filters.minItems) : null;
    const maxItems =
      filters.maxItems !== "" ? toNumber(filters.maxItems) : null;

    return messages.filter((msg) => {
      const matchesQuery = normalizedQuery
        ? `${msg.invoice_number}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesBranch =
        filters.branch === "all" || (msg.branch || "FLO") === filters.branch;

      const totalValue = toNumber(msg.total);
      const itemsValue = toNumber(msg.items);

      const matchesMinTotal = minTotal === null || totalValue >= minTotal;
      const matchesMaxTotal = maxTotal === null || totalValue <= maxTotal;
      const matchesMinItems = minItems === null || itemsValue >= minItems;
      const matchesMaxItems = maxItems === null || itemsValue <= maxItems;

      return (
        matchesQuery &&
        matchesBranch &&
        matchesMinTotal &&
        matchesMaxTotal &&
        matchesMinItems &&
        matchesMaxItems
      );
    });
  }, [filters, messages]);

  const totalFilteredInvoices = filteredMessages.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredInvoices / PAGE_SIZE));

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMessages.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredMessages]);

  const pageRangeStart =
    totalFilteredInvoices === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageRangeEnd =
    totalFilteredInvoices === 0
      ? 0
      : Math.min(
          pageRangeStart + paginatedMessages.length - 1,
          totalFilteredInvoices
        );

  const paginationRange = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1;
      }
      return Math.min(prev, totalPages);
    });
  }, [totalPages]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.query.trim()) count += 1;
    if (filters.branch !== "all") count += 1;
    if (filters.minTotal !== "" || filters.maxTotal !== "") count += 1;
    if (filters.minItems !== "" || filters.maxItems !== "") count += 1;
    return count;
  }, [filters]);

  const invoicesCountLabel = (() => {
    if (messages.length === 0) {
      return "Sin facturas registradas";
    }
    if (activeFiltersCount > 0) {
      return `${filteredMessages.length} de ${messages.length} ${
        messages.length === 1 ? "factura" : "facturas"
      }`;
    }
    if (dailySummary.totalInvoices > messages.length) {
      return `${messages.length} de ${dailySummary.totalInvoices} facturas`;
    }
    return `${messages.length} ${
      messages.length === 1 ? "factura" : "facturas"
    } hoy`;
  })();

  const handleFilterChange = useCallback(
    (field) => (event) => {
      const value = event.target.value;
      setCurrentPage(1);
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setCurrentPage(1);
    setFilters({
      query: "",
      branch: "all",
      minTotal: "",
      maxTotal: "",
      minItems: "",
      maxItems: "",
    });
  }, []);

  const handleApplyFilters = useCallback(() => {
    setAreFiltersOpen(false);
  }, []);

  useEffect(() => {
    if (
      filters.branch !== "all" &&
      availableBranches.length > 0 &&
      !availableBranches.includes(filters.branch)
    ) {
      setFilters((prev) => ({
        ...prev,
        branch: "all",
      }));
    }
  }, [availableBranches, filters.branch]);

  return {
    status,
    allMessages,
    messages,
    summary,
    isRefreshing,
    handleManualRefresh,
    areFiltersOpen,
    setAreFiltersOpen,
    filters,
    handleFilterChange,
    totalsRange,
    itemsRange,
    handleResetFilters,
    handleApplyFilters,
    activeFiltersCount,
    filteredMessages,
    paginatedMessages,
    handleInvoiceClick,
    selectedInvoices,
    selectedInvoiceData,
    detailComputedTotal,
    detailItemsCount,
    invoiceItems,
    loadingItems,
    selectedInvoiceMeta,
    invoicesCountLabel,
    pageRangeStart,
    pageRangeEnd,
    totalFilteredInvoices,
    totalPages,
    paginationRange,
    currentPage,
    setCurrentPage,
    dailySalesHistory,
  };
}
