import React from "react";
import MetricCard from "../MetricCard";
import { formatCurrency as formatCurrencyDefault } from "../../lib/invoiceUtils";

const METHOD_SHORT_LABELS = {
  daily_sales_regression: "Modelo: regresión multivariable",
  previous_day_first_chunk_ratio: "Modelo: ajuste con el día anterior",
  first_chunk_ratio: "Modelo: ritmo primeras facturas",
  historical_average: "Modelo: promedio histórico",
  current_total_only: "Modelo: total actual",
  previous_total_only: "Modelo: total día anterior",
  blended_historical_estimate: "Modelo: estimación combinada",
  time_of_day_ratio: "Modelo: proyección por avance del día",
};

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

  const forecastHelper = (() => {
    if (!forecast) {
      return "Sin datos suficientes";
    }

    const parts = [];
    if (forecast.method) {
      const methodSummary = METHOD_SHORT_LABELS[forecast.method];
      if (methodSummary) {
        parts.push(methodSummary);
      }
    }
    if (forecast.previousTotal) {
      parts.push(
        `Total día anterior: ${currencyFormatter(
          Math.max(forecast.previousTotal, 0)
        )}`
      );
    }
    if (forecast.historyDays) {
      parts.push(`Historial de ${forecast.historyDays} días`);
    }
    if (forecast.generatedAt) {
      const generatedDate = new Date(forecast.generatedAt);
      if (!Number.isNaN(generatedDate.getTime())) {
        parts.push(
          `Actualizado ${generatedDate.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        );
      }
    }

    return parts.join(" · ");
  })();

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
        helperText={forecastHelper}
      />
    </section>
  );
}
