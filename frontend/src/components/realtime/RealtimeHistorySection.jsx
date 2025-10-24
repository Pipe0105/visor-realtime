import React from "react";
import DailyBillingChart from "../DailyBillingChart";
import DailySalesChart from "../DailySalesChart";
import SalesHeatmap from "../SalesHeatmap";
import { Badge } from "../badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import { cn } from "../../lib/utils";

export default function RealtimeHistorySection({
  billingSeries,
  latestBillingPoint,
  formatCurrency,
  hourlySalesHeatmap,
  dailySalesSeries,
  isLoadingHistory = false,
  historyError = null,
  historyLastUpdated = null,
  historyHasData = false,
  onRetryHistory,
}) {
  const safeBillingSeries = billingSeries ?? { series: [], average: 0 };
  const safeLatestPoint =
    latestBillingPoint ??
    (Array.isArray(safeBillingSeries.series)
      ? safeBillingSeries.series[safeBillingSeries.series.length - 1] ?? null
      : null);
  const safeDailySales = Array.isArray(dailySalesSeries)
    ? dailySalesSeries
    : [];
  const safeHeatmap =
    hourlySalesHeatmap && typeof hourlySalesHeatmap === "object"
      ? hourlySalesHeatmap
      : { hours: [], rows: [], maxTotal: 0, totalInvoices: 0, hasData: false };

  const hasBillingData =
    Array.isArray(safeBillingSeries.series) &&
    safeBillingSeries.series.length > 0;
  const hasDailySalesData = safeDailySales.length > 0;
  const hasHeatmapData = Boolean(
    safeHeatmap?.hasData ||
      (Array.isArray(safeHeatmap?.rows) &&
        safeHeatmap.rows.some(
          (row) =>
            Array.isArray(row?.values) &&
            row.values.some((value) => Number(value?.total) > 0)
        ))
  );

  const effectiveHasHistory =
    historyHasData || hasBillingData || hasDailySalesData || hasHeatmapData;

  const formattedLastUpdated = historyLastUpdated
    ? (() => {
        const parsed = new Date(historyLastUpdated);
        if (Number.isNaN(parsed.getTime())) {
          return null;
        }
        return parsed.toLocaleString("es-CO", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      })()
    : null;

  const shouldShowEmptyState =
    !isLoadingHistory && !historyError && !effectiveHasHistory;

  const statusBannerNeeded =
    isLoadingHistory || Boolean(historyError) || shouldShowEmptyState;

  return (
    <section className="space-y-6">
      {statusBannerNeeded ? (
        <div className="mx-auto w-full max-w-5xl space-y-3">
          {isLoadingHistory ? (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm",
                "dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300"
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-primary"
                  aria-hidden="true"
                />
                Cargando historial reciente...
              </span>
              {formattedLastUpdated ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Última actualización {formattedLastUpdated}
                </span>
              ) : null}
            </div>
          ) : null}
          {historyError ? (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm",
                "dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
              )}
            >
              <span>
                No se pudo obtener el historial.{" "}
                <span className="font-medium">{historyError}</span>
              </span>
              {typeof onRetryHistory === "function" ? (
                <button
                  type="button"
                  onClick={() => onRetryHistory()}
                  disabled={isLoadingHistory}
                  className="rounded-md border border-transparent bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}
          {shouldShowEmptyState ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-400">
              <p className="font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Sin datos históricos disponibles
              </p>
              <p className="mt-2 text-xs">
                Aún no contamos con suficientes facturas para construir las
                visualizaciones. En cuanto entren nuevos registros, los verás
                reflejados aquí.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
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
              {formattedLastUpdated && !isLoadingHistory ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Actualizado {formattedLastUpdated}
                </p>
              ) : null}
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-transparent bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary"
            >
              {safeLatestPoint?.timeLabel
                ? `Última: ${safeLatestPoint.timeLabel}`
                : "Sin registros recientes"}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            La línea central marca el promedio diario; los picos hacia arriba o
            abajo resaltan oscilaciones inmediatas en la facturación.
          </p>
        </CardHeader>
        <CardContent className="mx-auto w-full max-w-5xl">
          <DailyBillingChart
            data={
              Array.isArray(safeBillingSeries.series)
                ? safeBillingSeries.series
                : []
            }
            averageValue={Number(safeBillingSeries.average) || 0}
            formatCurrency={formatCurrency}
          />
        </CardContent>
      </Card>
      <div className="mx-auto w-full max-w-5xl">
        <DailySalesChart data={safeDailySales} />
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <SalesHeatmap data={safeHeatmap} />
      </div>
    </section>
  );
}
