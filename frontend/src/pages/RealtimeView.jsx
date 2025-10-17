import React, { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import { Badge } from "../components/badge";
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
        );

        setMessages(Array.isArray(data.invoices) ? data.invoices : []);
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
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/FLO");

    ws.onopen = () => {
      setStatus("Conectado 🟢");
      console.log("✅ WebSocket conectado");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 Mensaje recibido:", data);

      const today = new Date().toISOString().slice(0, 10);
      const invoceDay = data.timestamp ? data.timestamp.slice(0, 10) : today;

      setMessages((prev) => {
        const firstDay = prev[0]?.timestamp
          ? prev[0].timestamp.slice(0, 10)
          : today;
        const isNewDay = prev.length > 0 && invoceDay !== firstDay;
        const invoiceTotal = toNumber(data.total);

        setDailySummary((prevSummary) => {
          if (isNewDay) {
            console.log("Nuevo dia detectado - reiniciando resumen diario");
            return {
              totalSales: invoiceTotal,
              totalInvoices: 1,
              averageTicket: invoiceTotal,
            };
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
          return [data];
        }

        return [data, ...prev.slice(0, PAGE_SIZE - 1)];
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

  const connectionHealthy = status.includes("🟢");

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
  const invoicesCountLabel =
    messages.length === 0
      ? "Sin facturas registradas"
      : `${messages.length} ${
          messages.length === 1 ? "factura" : "facturas"
        } hoy`;

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
            cada factura sin perder de vista el panel principal.
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
        <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          {" "}
          <CardHeader className="space-y-3 pb-5">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                Últimas facturas
              </CardTitle>
              <CardDescription>
                Selecciona un folio para revisar sus ítems al instante.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-full border-transparent bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {invoicesCountLabel}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
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
            ) : (
              <ul className="space-y-2">
                {messages.map((msg, i) => {
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

        <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
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
          <CardContent className="space-y-6">
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
                      <span className="text-right sm:col-span-2">Unitario</span>
                      <span className="text-right sm:col-span-2">Subtotal</span>
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
                  Mantén la vista principal mientras exploras el detalle de cada
                  documento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default RealtimeView;
