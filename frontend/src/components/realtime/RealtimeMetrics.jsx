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

  const forecastHelper = (() => {
    if (!forecast) {
      return "Sin datos suficientes";
    }

    const parts = [];
    if (forecast.remaining != null) {
      parts.push(
        `Restante estimado: ${currencyFormatter(
          Math.max(forecast.remaining, 0)
        )}`
      );
    }
    if (forecast.firstChunkInvoices) {
      parts.push(
        `Basado en las primeras ${forecast.firstChunkInvoices} ` +
          (forecast.firstChunkInvoices === 1 ? "factura" : "facturas")
      );
    }
    if (forecast.historyDays) {
      parts.push(`Historial de ${forecast.historyDays} días`);
    }
    if (forecast.method === "historical_average") {
      parts.push("Método: promedio histórico");
    } else if (forecast.method === "first_chunk_ratio") {
      parts.push("Método: ritmo de las primeras facturas");
    } else if (forecast.method === "current_total_only") {
      parts.push("Método: total actual");
    } else if (forecast.method === "no_branch_match") {
      parts.push("Sucursal no encontrada");
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
