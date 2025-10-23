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

const isInvoiceRecord = (value) => value && typeof value === "object";

export function useRealtimeInvoices() {
  const [status, setStatus] = useState("Desconectado 🔴");
  const [messages, setMessages] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState(null);
  const [invoiceItems, setInvoicesItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dailySummary, setDailySummary] = useState({
    totalSales: 0,
    totalNetSales: 0,
    totalInvoices: 0,
    averageTicket: 0,
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
  const [dailySalesHistory, setDailySalesHistory] = useState([]);
  const [salesForecast, setSalesForecast] = useState(null);

  const [activePanel, setActivePanel] = useState("facturas");
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const knownInvoicesRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const pendingManualReconnectRef = useRef(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await apiFetch(`/invoices/today`);

      const data = await res.json();

      if (Array.isArray(data)) {
        const normalizedInvoices = data
          .map(normalizeInvoice)
          .filter(isInvoiceRecord);
        const sortedInvoices = sortInvoicesByTimestampDesc(normalizedInvoices);
        setMessages(sortedInvoices);
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

      const sortedInvoices = sortInvoicesByTimestampDesc(normalizedInvoices);

      setMessages(sortedInvoices);
      knownInvoicesRef.current = new Set(
        sortedInvoices
          .map((invoice) => getInvoiceIdentifier(invoice))
          .filter(Boolean)
      );
      const totalSales = toNumber(data.total_sales);
      const totalNetSales = toNumber(
        data.total_net_sales ?? data.total_without_taxes ?? data.total_sales
      );
      const totalInvoices = Math.trunc(toNumber(data.total_invoices));
      const averageTicket = toNumber(
        data.average_ticket ?? (totalInvoices ? totalSales / totalInvoices : 0)
      );
      setDailySummary({
        totalSales,
        totalNetSales,
        totalInvoices,
        averageTicket,
      });
      return sortedInvoices;
    } catch (err) {
      console.error("Error cargando facturas", err);
      setMessages([]);
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

  const loadDailySalesHistory = useCallback(
    async (branchValue) => {
      const params = new URLSearchParams();
      params.set("days", "10");
      const targetBranch =
        branchValue ??
        (filters.branch && filters.branch !== "" ? filters.branch : "all");

      if (targetBranch && targetBranch !== "all") {
        params.set("branch", targetBranch);
      }

      const response = await apiFetch(
        `/invoices/daily-sales?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();

      if (Array.isArray(payload)) {
        return payload;
      }

      if (Array.isArray(payload?.history)) {
        return payload.history;
      }

      return [];
    },
    [filters.branch]
  );

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

  useEffect(() => {
    let cancelled = false;

    loadDailySalesHistory()
      .then((history) => {
        if (!cancelled) {
          setDailySalesHistory(history);
        }
      })
      .catch((error) => {
        console.error("Error cargando historial de ventas", error);
        if (!cancelled) {
          setDailySalesHistory([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadDailySalesHistory]);

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
        getInvoiceDay(normalized.invoice_date) ||
        getInvoiceDay(normalized.timestamp) ||
        getInvoiceDay(normalized.created_at) ||
        today;

      const invoiceTotal = toNumber(data.total);
      const invoiceSubtotal = toNumber(
        data.subtotal != null ? data.subtotal : data.total
      );

      const normalizedId = getInvoiceIdentifier(normalized);
      const normalizedTimestampForMatch = normalizeTimestamp(
        normalized.timestamp ??
          normalized.invoice_date ??
          normalized.created_at ??
          null
      );

      setMessages((prev) => {
        const safePrev = prev.filter(isInvoiceRecord);

        const previousDay = safePrev[0]
          ? getInvoiceDay(safePrev[0].invoice_date) ||
            getInvoiceDay(safePrev[0].timestamp) ||
            getInvoiceDay(safePrev[0].created_at) ||
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
            item.timestamp ?? item.invoice_date ?? item.created_at ?? null
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
        const history = await loadDailySalesHistory(filters.branch);
        setDailySalesHistory(history);
      } catch (error) {
        console.error(
          "Error actualizando historial durante el refresco",
          error
        );
        setDailySalesHistory([]);
      }

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
    } catch (error) {
      console.error("Error general durante el refresco manual", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    filters.branch,
    forceReconnect,
    isRefreshing,
    loadDailySalesHistory,
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
        if (data.items) {
          setInvoicesItems(data.items);
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

  const billingSeries = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        series: [],
        average: 0,
      };
    }

    const timeFormatter = new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const tooltipFormatter = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const BUCKET_SIZE_MINUTES = 1;
    const BUCKET_SIZE_MS = BUCKET_SIZE_MINUTES * 60 * 1000;

    const entries = messages
      .map((msg) => {
        const rawTimestamp =
          msg.invoice_date ?? msg.timestamp ?? msg.created_at ?? null;
        const parsed = parseInvoiceTimestamp(rawTimestamp);
        if (!parsed) {
          return null;
        }

        return {
          invoiceNumber: msg.invoice_number,
          timestamp: parsed.getTime(),
          iso: parsed.toISOString(),
          total: toNumber(msg.total),
          branch: msg.branch || "FLO",
          tooltipLabel: tooltipFormatter.format(parsed),
          timeLabel: timeFormatter.format(parsed),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length === 0) {
      return {
        series: [],
        average: 0,
      };
    }

    const invoiceAverage =
      entries.reduce((sum, item) => sum + toNumber(item.total), 0) /
      entries.length;

    const bucketsMap = new Map();

    entries.forEach((entry) => {
      const bucketStart =
        Math.floor(entry.timestamp / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
      const bucketEnd = bucketStart + BUCKET_SIZE_MS;

      if (!bucketsMap.has(bucketStart)) {
        bucketsMap.set(bucketStart, {
          bucketStart,
          bucketEnd,
          total: 0,
          invoices: [],
        });
      }

      const bucket = bucketsMap.get(bucketStart);
      bucket.total += toNumber(entry.total);
      bucket.invoices.push({
        ...entry,
        deviation: toNumber(entry.total) - invoiceAverage,
      });
    });

    const buckets = Array.from(bucketsMap.values()).sort(
      (a, b) => a.bucketStart - b.bucketStart
    );

    const bucketAverage =
      buckets.reduce((sum, bucket) => sum + bucket.total, 0) / buckets.length;

    const series = buckets.map((bucket) => {
      const startDate = new Date(bucket.bucketStart);
      const endDate = new Date(bucket.bucketEnd - 1);

      const windowLabel = `${timeFormatter.format(
        startDate
      )} - ${timeFormatter.format(endDate)}`;

      return {
        id: `bucket-${bucket.bucketStart}`,
        timestamp: bucket.bucketStart,
        total: bucket.total,
        average: bucketAverage,
        deviation: bucket.total - bucketAverage,
        timeLabel: windowLabel,
        tooltipLabel: `${bucket.invoices.length} ${
          bucket.invoices.length === 1 ? "factura" : "facturas"
        } entre ${windowLabel}`,
        invoiceCount: bucket.invoices.length,
        bucketStart: bucket.bucketStart,
        bucketEnd: bucket.bucketEnd,
        invoices: bucket.invoices,
        windowLabel,
      };
    });

    return {
      series,
      average: bucketAverage,
    };
  }, [messages]);

  const latestBillingPoint =
    billingSeries.series.length > 0
      ? billingSeries.series[billingSeries.series.length - 1]
      : null;

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

  const dailySalesSeries = useMemo(() => {
    const liveTotalsByDay = new Map();

    if (messages.length > 0) {
      messages.forEach((msg) => {
        const branchKey = msg.branch || "FLO";
        if (filters.branch !== "all" && branchKey !== filters.branch) {
          return;
        }

        const baseDate =
          (msg.invoice_date && msg.invoice_date.slice(0, 10)) ||
          (msg.timestamp && msg.timestamp.slice(0, 10)) ||
          (msg.created_at && msg.created_at.slice(0, 10)) ||
          todayKey;
        const totalValue = toNumber(msg.total);
        liveTotalsByDay.set(
          baseDate,
          (liveTotalsByDay.get(baseDate) || 0) + totalValue
        );
      });
    }

    const historyTotals = new Map();
    dailySalesHistory.forEach((entry) => {
      if (!entry || !entry.date) {
        return;
      }
      historyTotals.set(entry.date, toNumber(entry.total));
    });

    const allDates = new Set([
      ...historyTotals.keys(),
      ...liveTotalsByDay.keys(),
    ]);

    if (allDates.size === 0) {
      if (filters.branch === "all" && dailySummary.totalSales > 0) {
        const fallbackTotal = toNumber(dailySummary.totalSales);
        return [
          {
            date: todayKey,
            total: fallbackTotal,
            cumulative: fallbackTotal,
          },
        ];
      }
      return [];
    }

    const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b));

    let cumulative = 0;
    return sortedDates.map((date) => {
      const baseTotal = historyTotals.get(date) || 0;
      const liveTotal = liveTotalsByDay.has(date)
        ? liveTotalsByDay.get(date)
        : null;
      const total = liveTotal != null ? liveTotal : baseTotal;
      cumulative += total;
      return {
        date,
        total,
        cumulative,
      };
    });
  }, [
    dailySalesHistory,
    dailySummary.totalSales,
    filters.branch,
    messages,
    todayKey,
  ]);

  const invoicesCountLabel = (() => {
    if (messages.length === 0) {
      return "Sin facturas registradas";
    }
    if (activeFiltersCount > 0) {
      return `${filteredMessages.length} de ${messages.length} ${
        messages.length === 1 ? "factura" : "facturas"
      }`;
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

  useEffect(() => {
    if (activePanel !== "facturas") {
      setAreFiltersOpen(false);
    }
  }, [activePanel]);

  return {
    status,
    messages,
    summary,
    billingSeries,
    latestBillingPoint,
    dailySalesSeries,
    isRefreshing,
    handleManualRefresh,
    activePanel,
    setActivePanel,
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
    salesForecast,
  };
}
