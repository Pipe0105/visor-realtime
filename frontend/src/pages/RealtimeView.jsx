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

const PAGE_SIZE = 700;

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">
            Monitoreo en vivo
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">
            Resumen de facturación diaria
          </h2>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Revisa cómo se comportan las ventas en tiempo real y consulta los
            detalles de cada factura sin abandonar la vista principal.
          </p>
        </div>
        <Badge
          variant={connectionHealthy ? "success" : "danger"}
          className="self-start text-sm"
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

      <Card className="border-dashed border-slate-200/80 bg-white/80 shadow-lg backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">
            Últimas facturas procesadas
          </CardTitle>
          <CardDescription>
            Haz clic sobre una factura para desplegar los ítems y revisar el
            detalle completo del documento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/60 p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <span className="text-4xl">🕓</span>
              <div className="space-y-1">
                <p className="text-lg font-medium text-slate-600 dark:text-foreground">
                  Aún no hay facturas nuevas
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  En cuanto se procese la primera, aparecerá aquí
                  automáticamente.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((msg, i) => {
                const isSelected = selectedInvoices === msg.invoice_number;
                return (
                  <li key={`${msg.invoice_number}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleInvoiceClick(msg.invoice_number)}
                      className={cn(
                        "w-full rounded-2xl border border-transparent bg-white/80 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-slate-900/60",
                        {
                          "border-primary/60 shadow-xl ring-2 ring-primary/30 dark:border-primary/60":
                            isSelected,
                        }
                      )}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                              {msg.items || 0}
                            </span>
                            <div>
                              <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Factura
                              </p>
                              <p className="text-lg font-semibold text-slate-900 dark:text-foreground">
                                #{msg.invoice_number}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              Total factura
                            </span>
                            <span className="text-xl font-semibold text-primary">
                              {formatCurrency(msg.total)}
                            </span>
                          </div>
                          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                            {msg.invoice_date
                              ? new Date(msg.invoice_date).toLocaleString(
                                  "es-CO",
                                  {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  }
                                )
                              : ""}
                          </div>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Ítems registrados:{" "}
                          <strong className="text-slate-700 dark:text-foreground">
                            {msg.items}
                          </strong>
                        </div>

                        {isSelected && (
                          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm shadow-inner transition-all dark:border-slate-800/70 dark:bg-slate-900/60">
                            {loadingItems ? (
                              <em className="text-slate-500 dark:text-slate-400">
                                Cargando ítems...
                              </em>
                            ) : invoiceItems.length > 0 ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-12">
                                  <span className="sm:col-span-6">
                                    Producto
                                  </span>
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
                                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {invoiceItems.map((item, idx) => (
                                    <div
                                      key={`${item.description}-${idx}`}
                                      className="grid grid-cols-1 gap-2 py-2 text-sm text-slate-700 dark:text-foreground sm:grid-cols-12"
                                    >
                                      <span className="sm:col-span-6">
                                        {item.description}
                                      </span>
                                      <span className="text-right text-slate-500 dark:text-slate-400 sm:col-span-2">
                                        {item.quantity.toFixed(2)}
                                      </span>
                                      <span className="text-right text-slate-500 dark:text-slate-400 sm:col-span-2">
                                        {formatCurrency(item.unit_price)}
                                      </span>
                                      <span className="text-right font-semibold text-primary sm:col-span-2">
                                        {formatCurrency(item.subtotal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-foreground sm:flex-row sm:items-center sm:justify-between">
                                  <span>
                                    Total ítems: {invoiceItems.length}
                                  </span>
                                  <span>
                                    Total factura:{" "}
                                    <span className="text-primary">
                                      {formatCurrency(
                                        invoiceItems.reduce(
                                          (sum, i) => sum + (i.subtotal || 0),
                                          0
                                        )
                                      )}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <em className="text-slate-500 dark:text-slate-400">
                                Sin ítems
                              </em>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RealtimeView;
