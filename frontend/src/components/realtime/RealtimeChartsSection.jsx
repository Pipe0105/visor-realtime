import React, { useMemo } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import {
  formatCurrency as formatCurrencyDefault,
  parseInvoiceTimestamp,
  toNumber,
} from "../../lib/invoiceUtils";

function buildHourlyDataset(messages) {
  const totals = new Map();

  messages.forEach((invoice) => {
    const timestamp =
      parseInvoiceTimestamp(
        invoice?.invoice_date ?? invoice?.timestamp ?? invoice?.created_at
      ) ?? null;
    if (!timestamp) {
      return;
    }

    const hour = timestamp.getHours();
    const label = `${hour.toString().padStart(2, "0")}:00`;
    const totalValue = toNumber(invoice?.total);

    if (!totals.has(label)) {
      totals.set(label, { hour, total: 0, count: 0 });
    }

    const entry = totals.get(label);
    entry.total += totalValue;
    entry.count += 1;
  });

  return Array.from(totals.values())
    .sort((a, b) => a.hour - b.hour)
    .map((entry, index, array) => {
      const cumulative = array
        .slice(0, index + 1)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        label: `${entry.hour.toString().padStart(2, "0")}:00`,
        total: entry.total,
        count: entry.count,
        cumulative,
        average: entry.count > 0 ? entry.total / entry.count : 0,
      };
    });
}

function buildBranchDataset(messages) {
  const totals = new Map();

  messages.forEach((invoice) => {
    const branch = (invoice?.branch ?? "General").toString();
    const totalValue = toNumber(invoice?.total);

    if (!totals.has(branch)) {
      totals.set(branch, 0);
    }

    totals.set(branch, totals.get(branch) + totalValue);
  });

  return Array.from(totals.entries())
    .map(([branch, total]) => ({ branch, total }))
    .sort((a, b) => b.total - a.total);
}

export default function RealtimeChartsSection({
  messages = [],
  summary = null,
  formatCurrency = formatCurrencyDefault,
}) {
  const hourlyDataset = useMemo(() => buildHourlyDataset(messages), [messages]);
  const branchDataset = useMemo(() => buildBranchDataset(messages), [messages]);

  const totalSales = summary?.total ?? 0;
  const totalInvoices = summary?.count ?? 0;

  return (
    <section
      className="grid gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60"
      aria-label="Gráficas de ventas"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-foreground">
            Panorama de ventas
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300/80">
            Evolución del día y distribución por sede basadas en las facturas
            recibidas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
          <span>Total: {formatCurrency(totalSales)}</span>
          <span>Facturas: {totalInvoices}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Ventas por hora
            </CardTitle>
            <CardDescription>
              Muestra el monto total vendido en cada bloque horario del día.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {hasHourlyData ? (
              <BarChart
                dataset={hourlyDataset}
                height={280}
                xAxis={[{ scaleType: "band", dataKey: "label" }]}
                series={[
                  {
                    dataKey: "total",
                    label: "Ventas",
                    valueFormatter: (value) => formatCurrency(value ?? 0),
                    color: "#2563eb",
                  },
                ]}
                margin={{ top: 16, right: 16, bottom: 32, left: 56 }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Aún no hay suficientes facturas para graficar.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Ventas por sede
            </CardTitle>
            <CardDescription>
              Distribución del total vendido según la sede reportada en cada
              factura.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {hasBranchData ? (
              <PieChart
                height={280}
                series={[
                  {
                    data: branchDataset.map((entry) => ({
                      id: entry.branch,
                      value: entry.total,
                      label: entry.branch,
                    })),
                    valueFormatter: ({ value }) => formatCurrency(value ?? 0),
                    innerRadius: 40,
                    paddingAngle: 1.8,
                  },
                ]}
                slotProps={{
                  legend: {
                    direction: "row",
                    position: { vertical: "bottom", horizontal: "middle" },
                    labelStyle: {
                      fontSize: 12,
                    },
                  },
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No se han reportado sedes en las facturas recibidas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
