import React, { useEffect, useMemo, useRef, useState } from "react";
import DailySalesChart from "../components/DailySalesChart";
import MetricCard from "../components/MetricCard";
import { Badge } from "../components/badge";
import { Button, buttonVariants } from "../components/button";
import DailyBillingChart from "../components/DailyBillingChart";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card";
import { cn } from "../lib/utils";

function formatCurrency(value) {
  if (value == null || isNaN(value)) return "$0";
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const PAGE_SIZE = 100;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTimestamp(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) {
      return fromNumber.toISOString();
    }
    return String(value);
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  const parsed = new Date(stringValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return stringValue;
}

function normalizeInvoice(invoice) {
  if (!invoice || typeof invoice !== "object") {
    return invoice;
  }

  const normalizedTimestamp = normalizeTimestamp(
    invoice.invoice_date ?? invoice.timestamp ?? invoice.created_at ?? null
  );

  const base = { ...invoice };

  if (normalizedTimestamp != null) {
    base.timestamp = normalizedTimestamp;
  } else if (invoice.timestamp != null) {
    base.timestamp =
      normalizeTimestamp(invoice.timestamp) ?? invoice.timestamp ?? null;
  }

  return base;
}

function getInvoiceIdentifier(invoice) {
  if (!invoice || typeof invoice !== "object") {
    return null;
  }

  const directId =
    invoice.invoice_id ??
    invoice.invoice_number ??
    invoice.id ??
    invoice.uuid ??
    null;

  if (directId != null) {
    return String(directId);
  }

  const normalizedTimestamp = normalizeTimestamp(
    invoice.timestamp ?? invoice.invoice_date ?? invoice.created_at ?? null
  );

  if (invoice.invoice_number && normalizedTimestamp) {
    return `${invoice.invoice_number}-${normalizedTimestamp}`;
  }

  if (normalizedTimestamp) {
    return normalizedTimestamp;
  }

  return null;
}

function getInvoiceDay(value) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length >= 10) {
    return normalized.slice(0, 10);
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function RealtimeView() {
  const [status, setStatus] = useState("Desconectado 🔴");
  const [messages, setMessages] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState(null);
  const [invoiceItems, setInvoicesItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dailySummary, setDailySummary] = useState({
    totalSales: 0,
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
  const [activePanel, setActivePanel] = useState("facturas");
  const [currentPage, setCurrentPage] = useState(1);

  const knownInvoicesRef = useRef(new Set());

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/invoices/today`);

        const data = await res.json();

        if (Array.isArray(data)) {
          console.log("Facturas del día cargadas (modo legado):", data.length);
          const normalizedInvoices = data.map(normalizeInvoice);
          setMessages(normalizedInvoices);
          knownInvoicesRef.current = new Set(
            normalizedInvoices
              .map((invoice) => getInvoiceIdentifier(invoice))
              .filter(Boolean)
          );
          const total = normalizedInvoices.reduce(
            (sum, f) => sum + (f.total || 0),
            0
          );
          const count = normalizedInvoices.length;
          setDailySummary({
            totalSales: total,
            totalInvoices: count,
            averageTicket: count ? total / count : 0,
          });
          return;
        }

        console.log(
          "Facturas del día cargadas:",
          Array.isArray(data.invoices) ? data.invoices.length : 0
        );

        const normalizedInvoices = Array.isArray(data.invoices)
          ? data.invoices.map(normalizeInvoice)
          : [];

        setMessages(normalizedInvoices);
        knownInvoicesRef.current = new Set(
          normalizedInvoices
            .map((invoice) => getInvoiceIdentifier(invoice))
            .filter(Boolean)
        );
        const totalSales = toNumber(data.total_sales);
        const totalInvoices = Math.trunc(toNumber(data.total_invoices));
        const averageTicket = toNumber(
          data.average_ticket ??
            (totalInvoices ? totalSales / totalInvoices : 0)
        );
        setDailySummary({
          totalSales,
          totalInvoices,
          averageTicket,
        });
      } catch (err) {
        console.error("Error cargando facturas", err);
        setMessages([]);
        knownInvoicesRef.current = new Set();
        setDailySummary({
          totalSales: 0,
          totalInvoices: 0,
          averageTicket: 0,
        });
      }
    }

    loadInvoices();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDailySalesHistory() {
      try {
        const params = new URLSearchParams();
        params.set("days", "10");
        if (filters.branch && filters.branch !== "all") {
          params.set("branch", filters.branch);
        }

        const response = await fetch(
          `http://127.0.0.1:8000/invoices/daily-sales?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        if (Array.isArray(payload)) {
          setDailySalesHistory(payload);
          return;
        }

        if (Array.isArray(payload?.history)) {
          setDailySalesHistory(payload.history);
          return;
        }

        setDailySalesHistory([]);
      } catch (error) {
        console.error("Error cargando historial de ventas", error);
        if (!cancelled) {
          setDailySalesHistory([]);
        }
      }
    }

    loadDailySalesHistory();

    return () => {
      cancelled = true;
    };
  }, [filters.branch]);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/FLO");

    ws.onopen = () => {
      setStatus("Conectado 🟢");
      console.log("✅ WebSocket conectado");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 Mensaje recibido:", data);

      const today = new Date().toISOString().slice(0, 10);
      const nextMessageDay = (value) => getInvoiceDay(value);

      const messageDay =
        nextMessageDay(data.invoice_date) ||
        nextMessageDay(data.timestamp) ||
        nextMessageDay(data.created_at) ||
        today;

      setMessages((prev) => {
        const previousDay = prev[0]
          ? nextMessageDay(prev[0].invoice_date) ||
            nextMessageDay(prev[0].timestamp) ||
            nextMessageDay(prev[0].created_at) ||
            today
          : today;
        const isNewDay = prev.length > 0 && messageDay !== previousDay;

        const invoiceTotal = toNumber(data.total);

        const normalized = normalizeInvoice(data);

        const normalizedId = getInvoiceIdentifier(normalized);

        const knownInvoices = knownInvoicesRef.current;
        const hasKnownIdentifier =
          normalizedId != null && knownInvoices.has(normalizedId);
        const normalizedTimestampForMatch = normalizeTimestamp(
          normalized.timestamp ??
            normalized.invoice_date ??
            normalized.created_at ??
            null
        );
        const matchesExistingInvoice = (item) => {
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
          hasKnownIdentifier || prev.some(matchesExistingInvoice);

        setDailySummary((prevSummary) => {
          if (isNewDay) {
            console.log("Nuevo dia detectado - reiniciando resumen diario");
            return {
              totalSales: invoiceTotal,
              totalInvoices: 1,
              averageTicket: invoiceTotal,
            };
          }

          if (hasExistingInvoice) {
            return prevSummary;
          }

          const baseSales = prevSummary?.totalSales || 0;
          const baseInvoices = prevSummary?.totalInvoices || 0;
          const totalSales = baseSales + invoiceTotal;
          const totalInvoices = baseInvoices + 1;

          return {
            totalSales,
            totalInvoices,
            averageTicket: totalInvoices ? totalSales / totalInvoices : 0,
          };
        });

        if (isNewDay) {
          knownInvoicesRef.current = new Set(
            normalizedId != null ? [normalizedId] : []
          );
          return [normalized];
        }

        if (hasExistingInvoice) {
          if (normalizedId != null && !knownInvoices.has(normalizedId)) {
            knownInvoices.add(normalizedId);
          }
          return prev.map((item) =>
            matchesExistingInvoice(item)
              ? normalizeInvoice({ ...item, ...normalized })
              : item
          );
        }

        if (normalizedId != null) {
          knownInvoices.add(normalizedId);
        }

        return [normalized, ...prev];
      });
    };

    ws.onclose = () => {
      setStatus("Desconectado 🔴");
      console.log("⚠️ WebSocket cerrado");
    };

    return () => ws.close();
  }, []);

  async function handleInvoiceClick(invoice_number) {
    if (selectedInvoices === invoice_number) {
      setSelectedInvoices(null);
      setInvoicesItems([]);
      return;
    }

    setInvoicesItems([]);
    setLoadingItems(true);
    setSelectedInvoices(invoice_number);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/invoices/${invoice_number}/items`
      );
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
  }

  const summary = {
    total: dailySummary.totalSales,
    count: dailySummary.totalInvoices,
    avg: dailySummary.averageTicket,
  };

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

    const entries = messages
      .map((msg, idx) => {
        const isoTimestamp =
          msg.invoice_date || msg.timestamp || msg.created_at || null;
        if (!isoTimestamp) {
          return null;
        }
        const parsed = new Date(isoTimestamp);
        if (Number.isNaN(parsed.getTime())) {
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

    const average =
      entries.reduce((sum, item) => sum + toNumber(item.total), 0) /
      entries.length;

    const series = entries.map((entry) => ({
      ...entry,
      deviation: toNumber(entry.total) - average,
      id: `${entry.invoiceNumber ?? "invoice"}-${entry.iso}`,
    }));

    return {
      series,
      average,
    };
  }, [messages]);

  const latestBillingPoint =
    billingSeries.series.length > 0
      ? billingSeries.series[billingSeries.series.length - 1]
      : null;

  const connectionHealthy = status.includes("🟢");
  const isInvoicesView = activePanel === "facturas";

  const selectedInvoiceData = selectedInvoices
    ? messages.find((msg) => msg.invoice_number === selectedInvoices)
    : null;
  const detailItemsCount =
    invoiceItems.length > 0
      ? invoiceItems.length
      : selectedInvoiceData?.items ?? 0;
  const detailComputedTotal =
    invoiceItems.length > 0
      ? invoiceItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
      : selectedInvoiceData?.total ?? 0;
  const selectedInvoiceDate = selectedInvoiceData?.invoice_date
    ? new Date(selectedInvoiceData.invoice_date).toLocaleString("es-CO", {
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

  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetFilters = () => {
    setCurrentPage(1);
    setFilters({
      query: "",
      branch: "all",
      minTotal: "",
      maxTotal: "",
      minItems: "",
      maxItems: "",
    });
  };

  const handleApplyFilters = () => {
    setAreFiltersOpen(false);
  };

  const panelOptions = [
    { id: "facturas", label: "Facturas" },
    { id: "historial", label: "Historial" },
  ];

  const viewDescription = isInvoicesView
    ? "Explora las facturas en tiempo real y revisa sus detalles sin salir del panel."
    : "Analiza las variaciones frente al promedio y el comportamiento acumulado de los últimos días.";

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <section className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">
            Monitoreo en vivo
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">
            Resumen de facturación diaria
          </h2>
          <p className="max-w-2xl text-sm text-slate-700 dark:text-slate-400">
            Sigue la actividad comercial de la sede y consulta los detalles de
            cada factura.
          </p>
        </div>
        <Badge
          variant={connectionHealthy ? "success" : "danger"}
          className="justify-center self-start rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm"
        >
          {status}
        </Badge>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total ventas"
          value={formatCurrency(summary.total)}
          color="text-primary"
          icon="💰"
        />
        <MetricCard
          title="Facturas"
          value={summary.count}
          color="text-blue-500"
          icon="📄"
        />
        <MetricCard
          title="Promedio"
          value={formatCurrency(summary.avg)}
          color="text-amber-500"
          icon="📊"
        />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:bg-slate-800/60 dark:text-slate-300">
          {panelOptions.map((option) => {
            const isActive = activePanel === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setActivePanel(option.id)}
                className={cn(
                  "rounded-full px-4 py-2 transition",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/80 dark:text-foreground"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {viewDescription}
        </p>
      </section>

      {!isInvoicesView ? (
        <section className="space-y-6">
          <Card className="mx-auto w-full max-w-5xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                    Evolución diaria
                  </CardTitle>
                  <CardDescription>
                    Visualiza cómo cada factura se desvía del promedio del día.
                  </CardDescription>
                </div>
                {latestBillingPoint ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-transparent bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary"
                  >
                    Última: {latestBillingPoint.timeLabel}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                La línea central marca el promedio diario; los picos hacia
                arriba o abajo resaltan oscilaciones inmediatas en la
                facturación.
              </p>
            </CardHeader>
            <CardContent className="mx-auto w-full max-w-5xl">
              <DailyBillingChart
                data={billingSeries.series}
                averageValue={billingSeries.average}
                formatCurrency={formatCurrency}
              />
            </CardContent>
          </Card>
          <div className="mx-auto w-full max-w-5xl">
            <DailySalesChart data={dailySalesSeries} />
          </div>
        </section>
      ) : null}

      {isInvoicesView ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
            {" "}
            <CardHeader className="space-y-4 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                    Últimas facturas
                  </CardTitle>
                  <CardDescription>
                    Selecciona un folio para revisar sus ítems al instante.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                      {`${activeFiltersCount} filtro${
                        activeFiltersCount > 1 ? "s" : ""
                      } activos`}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAreFiltersOpen((prev) => !prev)}
                    aria-expanded={areFiltersOpen}
                    aria-controls="invoice-filters"
                    className="gap-2 rounded-full border border-transparent bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-slate-800/60 dark:text-slate-300"
                  >
                    <span aria-hidden="true">🔍</span>
                    {areFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                  </Button>
                </div>
              </div>
              <Badge
                variant="outline"
                className="w-fit rounded-full border-transparent bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
              >
                {invoicesCountLabel}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {areFiltersOpen ? (
                <div
                  id="invoice-filters"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-1 flex-wrap gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          Buscar folio
                        </label>
                        <input
                          type="search"
                          value={filters.query}
                          onChange={handleFilterChange("query")}
                          placeholder="Ej. 001-2024"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          Total (mín / máx)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            value={filters.minTotal}
                            onChange={handleFilterChange("minTotal")}
                            placeholder={
                              totalsRange.min !== Infinity
                                ? totalsRange.min
                                : "0"
                            }
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                          <span className="text-xs font-semibold text-slate-400">
                            —
                          </span>
                          <input
                            type="number"
                            value={filters.maxTotal}
                            onChange={handleFilterChange("maxTotal")}
                            placeholder={totalsRange.max}
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          Ítems (mín / máx)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            value={filters.minItems}
                            onChange={handleFilterChange("minItems")}
                            placeholder={
                              itemsRange.min !== Infinity ? itemsRange.min : "0"
                            }
                            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                          <span className="text-xs font-semibold text-slate-400">
                            —
                          </span>
                          <input
                            type="number"
                            value={filters.maxItems}
                            onChange={handleFilterChange("maxItems")}
                            placeholder={itemsRange.max}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <p>
                      {activeFiltersCount > 0
                        ? `${activeFiltersCount} filtro${
                            activeFiltersCount > 1 ? "s" : ""
                          } activos`
                        : "Sin filtros aplicados"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        disabled={activeFiltersCount === 0}
                        className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 hover:text-primary dark:text-slate-300"
                      >
                        Limpiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApplyFilters}
                        className="text-xs font-semibold uppercase tracking-[0.22em]"
                      >
                        Aplicar filtros
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  {" "}
                  <span className="text-4xl" aria-hidden="true">
                    🕓
                  </span>
                  <p className="text-sm font-medium">
                    Aún no hay facturas registradas hoy.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {" "}
                    En cuanto llegue la primera, aparecerá automáticamente en
                    esta lista.
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <span className="text-4xl" aria-hidden="true">
                    🔍
                  </span>
                  <p className="text-sm font-medium">
                    No encontramos facturas con los filtros seleccionados.
                  </p>
                  <p className="text-xs">
                    Ajusta los criterios para explorar otros resultados.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="space-y-2">
                    {paginatedMessages.map((msg, i) => {
                      const isSelected =
                        selectedInvoices === msg.invoice_number;
                      const invoiceDate = msg.invoice_date
                        ? new Date(msg.invoice_date).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "";
                      return (
                        <li key={`${msg.invoice_number}-${i}`}>
                          <button
                            type="button"
                            onClick={() =>
                              handleInvoiceClick(msg.invoice_number)
                            }
                            aria-pressed={isSelected}
                            className={cn(
                              "group w-full rounded-xl border border-transparent bg-white px-4 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-slate-900/60",
                              {
                                "border-primary/50 bg-primary/5 shadow-md dark:border-primary/60 dark:bg-primary/10":
                                  isSelected,
                              }
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="min-w-[7rem]">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                                  {" "}
                                  Factura
                                </p>
                                <p className="text-base font-semibold text-slate-900 dark:text-foreground">
                                  #{msg.invoice_number}
                                </p>
                              </div>
                              <div className="ml-auto text-right">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                                  {" "}
                                  Total
                                </p>
                                <p className="text-lg font-semibold text-primary">
                                  {formatCurrency(msg.total)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                {" "}
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-primary/60"
                                  aria-hidden="true"
                                />
                                {msg.items ?? 0} ítems
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-primary/60"
                                  aria-hidden="true"
                                />
                                {(msg.branch || "FLO").toUpperCase()}
                              </span>
                              {invoiceDate ? <span>{invoiceDate}</span> : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
                    {" "}
                    <p>
                      {totalFilteredInvoices === 0
                        ? "Sin facturas para mostrar"
                        : `Mostrando ${
                            pageRangeStart === pageRangeEnd
                              ? pageRangeStart
                              : `${pageRangeStart}-${pageRangeEnd}`
                          } de ${totalFilteredInvoices} factura${
                            totalFilteredInvoices === 1 ? "" : "s"
                          }`}
                    </p>
                    {totalPages > 1 ? (
                      <div
                        className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
                        role="navigation"
                        aria-label="Paginación de facturas"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className="h-9 gap-1 px-3"
                        >
                          <span aria-hidden="true">←</span>
                          <span className="hidden sm:inline">Anterior</span>
                        </Button>
                        {paginationRange.map((pageNumber) => (
                          <button
                            key={`page-${pageNumber}`}
                            type="button"
                            onClick={() => setCurrentPage(pageNumber)}
                            className={buttonVariants({
                              variant:
                                pageNumber === currentPage
                                  ? "default"
                                  : "outline",
                              size: "sm",
                              className: cn(
                                "h-9 w-9 px-0",
                                pageNumber === currentPage
                                  ? "shadow-sm"
                                  : "bg-background dark:bg-slate-900"
                              ),
                            })}
                            aria-current={
                              pageNumber === currentPage ? "page" : undefined
                            }
                            aria-label={`Ir a la página ${pageNumber}`}
                          >
                            {pageNumber}
                          </button>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages)
                            )
                          }
                          disabled={currentPage === totalPages}
                          className="h-9 gap-1 px-3"
                        >
                          <span className="hidden sm:inline">Siguiente</span>
                          <span aria-hidden="true">→</span>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:overflow-hidden">
              {" "}
              <CardHeader className="space-y-2 pb-5">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                  {selectedInvoiceData
                    ? `Factura #${selectedInvoiceData.invoice_number}`
                    : "Detalle de factura"}
                </CardTitle>
                <CardDescription>
                  {selectedInvoiceData
                    ? selectedInvoiceMeta
                    : "Selecciona una factura de la lista para explorar sus ítems sin salir de la vista principal."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 lg:flex-1 lg:overflow-y-auto">
                {selectedInvoiceData ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                        <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                          {" "}
                          Total
                        </span>
                        <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                          {formatCurrency(detailComputedTotal)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                        <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                          {" "}
                          Ítems
                        </span>
                        <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                          {detailItemsCount}
                        </span>
                      </div>
                      <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                        <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                          {" "}
                          Folio
                        </span>
                        <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                          #{selectedInvoiceData.invoice_number}
                        </span>
                      </div>
                    </div>
                    {loadingItems ? (
                      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                        {" "}
                        Cargando ítems…
                      </div>
                    ) : invoiceItems.length > 0 ? (
                      <div className="space-y-4">
                        <div className="hidden grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 sm:grid">
                          {" "}
                          <span className="sm:col-span-6">Producto</span>
                          <span className="text-right sm:col-span-2">
                            Cant.
                          </span>
                          <span className="text-right sm:col-span-2">
                            Unitario
                          </span>
                          <span className="text-right sm:col-span-2">
                            Subtotal
                          </span>
                        </div>
                        <div className="space-y-2">
                          {invoiceItems.map((item, idx) => (
                            <div
                              key={`${item.description}-${idx}`}
                              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-colors dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-12"
                            >
                              <span className="font-medium text-slate-700 dark:text-slate-100 sm:col-span-6">
                                {item.description}
                              </span>
                              <span className="flex items-center justify-between text-slate-600 dark:text-slate-400 sm:col-span-2 sm:justify-end">
                                <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                                  Cant.
                                </span>
                                <span>{item.quantity.toFixed(2)}</span>
                              </span>
                              <span className="flex items-center justify-between text-slate-600 dark:text-slate-400 sm:col-span-2 sm:justify-end">
                                <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                                  Unitario
                                </span>
                                <span>{formatCurrency(item.unit_price)}</span>
                              </span>
                              <span className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 sm:col-span-2 sm:justify-end">
                                <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                                  Subtotal
                                </span>
                                <span>{formatCurrency(item.subtotal)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                        {" "}
                        Sin ítems para mostrar
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                    {" "}
                    <span className="text-3xl" aria-hidden="true">
                      🧾
                    </span>
                    <p className="text-sm font-medium">
                      Selecciona una factura para ver sus ítems.
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Mantén la vista principal mientras exploras el detalle de
                      cada documento.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default RealtimeView;
