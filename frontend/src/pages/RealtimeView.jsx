import React, { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
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

  useEffect(() => {
    async function loadInvoices() {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/invoices/today?limit=${PAGE_SIZE}`
        );
        const data = await res.json();

        if (Array.isArray(data)) {
          console.log("Facturas del día cargadas (modo legado):", data.length);
          setMessages(data.slice(0, PAGE_SIZE));
          const total = data.reduce((sum, f) => sum + (f.total || 0), 0);
          const count = data.length;
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
@@ -322,50 +323,54 @@ function RealtimeView() {
    }
    return `${messages.length} ${
      messages.length === 1 ? "factura" : "facturas"
    } hoy`;
  })();

  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetFilters = () => {
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
@@ -382,174 +387,210 @@ function RealtimeView() {

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
                    <div className="min-w-[10rem] flex-1">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Sucursal
                      </label>
                      <select
                        value={filters.branch}
                        onChange={handleFilterChange("branch")}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="all">Todas</option>
                        {availableBranches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
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
                            totalsRange.min !== Infinity ? totalsRange.min : "0"
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
                  En cuanto llegue la primera, aparecerá automáticamente en esta
                  lista.
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
              <ul className="space-y-2">
                {filteredMessages.map((msg, i) => {
                  const isSelected = selectedInvoices === msg.invoice_number;
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
                        onClick={() => handleInvoiceClick(msg.invoice_number)}
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
                        <span className="text-right sm:col-span-2">Cant.</span>
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
    </div>
  );
}
