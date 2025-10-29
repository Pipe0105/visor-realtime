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

  const totalSales = Number.isFinite(Number(summary?.total))
    ? Number(summary.total)
    : 0;

  let forecastTrendSymbol = null;
  let forecastTrendTooltip = "";

  if (forecast && Number.isFinite(Number(forecast.total))) {
    const forecastTotal = Number(forecast.total);

    if (totalSales > forecastTotal) {
      forecastTrendSymbol = "^";
      forecastTrendTooltip = "Ventas por encima del pronóstico";
    } else if (totalSales < forecastTotal) {
      forecastTrendSymbol = "v";
      forecastTrendTooltip = "Ventas por debajo del pronóstico";
    } else {
      forecastTrendSymbol = "-";
      forecastTrendTooltip = "Ventas iguales al pronóstico";
    }
  }

  const forecastValueNode = (
    <span className="flex items-center justify-center gap-3">
      <span>{forecastValue}</span>
      {forecastTrendSymbol ? (
        <span
          className="text-4xl font-bold leading-none"
          title={forecastTrendTooltip}
          aria-label={forecastTrendTooltip}
        >
          {forecastTrendSymbol}
        </span>
      ) : null}
    </span>
  );

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
        value={forecastValueNode}
        color="text-fuchsia-500"
        icon="📈"
        helperText=""
      />
    </section>
  );
}
