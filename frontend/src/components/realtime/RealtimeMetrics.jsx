import React from "react";
import MetricCard from "../MetricCard";
import { formatCurrency as formatCurrencyDefault } from "../../lib/invoiceUtils";

export default function RealtimeMetrics({ summary, formatCurrency }) {
  const currencyFormatter = formatCurrency ?? formatCurrencyDefault;

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    </section>
  );
}
