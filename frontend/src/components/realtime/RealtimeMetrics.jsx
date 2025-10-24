import React from "react";
import MetricCard from "../MetricCard";
import { formatCurrency as formatCurrencyDefault } from "../../lib/invoiceUtils";

export default function RealtimeMetrics({ summary, formatCurrency }) {
  const currencyFormatter = formatCurrency ?? formatCurrencyDefault;
  const forecast = summary?.forecast ?? null;

  const forecastTitle = forecast
    ? forecast.branch && forecast.branch !== "all"
      ? `Pronóstico (${forecast.branch})`
      : "Pronóstico del día"
    : "Pronóstico del día";

  const forecastValue = forecast
    ? currencyFormatter(forecast.total || 0)
    : "Sin datos";

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {" "}
      <MetricCard
        title="Total ventas"
        value={currencyFormatter(summary.total)}
        color="text-primary"
        icon="💰"
      />
      <MetricCard
        title="Total sin impuestos"
        value={currencyFormatter(summary.netTotal)}
        color="text-emerald-500"
        icon="🧾"
      />
      <MetricCard
        title="Facturas"
        value={summary.count}
        color="text-blue-500"
        icon="📄"
      />
      <MetricCard
        title="Promedio"
        value={currencyFormatter(summary.avg)}
        color="text-amber-500"
        icon="📊"
      />
      <MetricCard
        title={forecastTitle}
        value={forecastValue}
        color="text-fuchsia-500"
        icon="📈"
      />
    </section>
  );
}
