import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import { formatCurrency as formatCurrencyDefault } from "../../lib/invoiceUtils";

const METHOD_LABELS = {
  previous_day_first_chunk_ratio: "ajuste con el dia anterior",
  first_chunk_ratio: "Ritmo de las primeras facturas",
  historical_average: "Promedio histórico",
  current_total_only: "Total actual",
  previous_total_only: "Total del dia anterior",
  blended_historical_estimate: "Estimación combinada",
  time_of_day_ratio: "Proyección por avance del día",
  no_branch_match: "Sucursal no encontrada",
};

function formatRatio(value) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return "—";
  }
  return value.toFixed(2);
}

export default function RealtimeForecastPanel({
  forecastData,
  formatCurrency,
}) {
  const currencyFormatter = formatCurrency ?? formatCurrencyDefault;

  const forecastRaw = forecastData?.forecast ?? null;

  const forecast = forecastRaw
    ? {
        total: forecastRaw.total ?? 0,
        remaining: forecastRaw.remaining ?? 0,
        method: forecastRaw.method ?? null,
        ratio: typeof forecastRaw.ratio === "number" ? forecastRaw.ratio : null,
        historyAverageTotal: forecastRaw.history_average_total ?? 0,
        historyAverageFirstChunk: forecastRaw.history_average_first_chunk ?? 0,
        historyDays: forecastRaw.history_days ?? 0,
        historySamples: forecastRaw.history_samples ?? 0,
        generatedAt: forecastRaw.generated_at ?? null,
        previousTotal: forecastRaw.previous_total ?? 0,
        previousNetTotal: forecastRaw.previous_net_total ?? 0,
        previousInvoiceCount: forecastRaw.previous_invoice_count ?? 0,
        previousDate: forecastRaw.previous_date ?? null,
      }
    : null;

  const todayInfo = forecastData?.today
    ? {
        currentTotal: forecastData.today.current_total ?? 0,
        currentNetTotal: forecastData.today.current_net_total ?? 0,
        invoiceCount: forecastData.today.invoice_count ?? 0,
        firstChunkTotal: forecastData.today.first_chunk_total ?? 0,
        firstChunkInvoices: forecastData.today.first_chunk_invoices ?? 0,
        averageTicket: forecastData.today.average_ticket ?? 0,
      }
    : null;
  const historyEntries = Array.isArray(forecastData?.history)
    ? forecastData.history.slice(0, 5)
    : [];

  const methodLabel = forecast
    ? METHOD_LABELS[forecast.method] ?? "Método no especificado"
    : "—";

  const branchLabel =
    forecastData?.branch && forecastData.branch !== "all"
      ? forecastData.branch
      : null;

  const ratioLabel = forecast ? formatRatio(forecast.ratio) : "—";

  const historyFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
      }),
    []
  );

  const previousDateLabel = useMemo(() => {
    if (!forecast?.previousDate) {
      return null;
    }
    try {
      const parsed = new Date(forecast.previousDate);
      if (!Number.isNaN(parsed.getTime())) {
        return historyFormatter.format(parsed);
      }
    } catch (error) {
      return forecast.previousDate;
    }

    return forecast.previousDate;
  }, [forecast?.previousDate, historyFormatter]);

  if (!forecast) {
    return null;
  }

  return (
    <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg font-semibold">
          Pronóstico detallado {branchLabel ? `· ${branchLabel}` : ""}
        </CardTitle>
        <CardDescription>
          Estimación basada en las primeras {todayInfo?.firstChunkInvoices || 0}{" "}
          facturas del día y el comportamiento histórico más reciente.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Total actual
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {currencyFormatter(todayInfo?.currentTotal || 0)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Pronóstico del día
              </dt>
              <dd className="text-base text-slate-900 dark:text-foreground">
                {currencyFormatter(forecast.total || 0)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Restante estimado
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {currencyFormatter(Math.max(forecast.remaining || 0, 0))}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Total día anterior
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {currencyFormatter(Math.max(forecast.previousTotal || 0, 0))}
                {previousDateLabel ? ` · ${previousDateLabel}` : ""}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Promedio histórico
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {currencyFormatter(forecast.historyAverageTotal || 0)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Ratio estimado
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {ratioLabel}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Método de cálculo
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {methodLabel}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Facturas analizadas
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {todayInfo?.firstChunkInvoices ?? 0} / 100 primeras
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold text-slate-600 dark:text-slate-300">
                Días considerados
              </dt>
              <dd className="text-base font-medium text-slate-900 dark:text-foreground">
                {forecast.historyDays}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Datos generados{" "}
            {forecast.generatedAt
              ? `el ${new Date(forecast.generatedAt).toLocaleString("es-CO")}`
              : "recientemente"}
            .
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Historial reciente
          </h4>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aún no hay suficientes días con una muestra comparable para
              mostrar.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historyEntries.map((entry) => {
                let formattedDate = entry.date;
                try {
                  const parsed = new Date(entry.date);
                  if (!Number.isNaN(parsed.getTime())) {
                    formattedDate = historyFormatter.format(parsed);
                  }
                } catch (error) {
                  formattedDate = entry.date;
                }

                return (
                  <li
                    key={`${entry.date}-${entry.total}`}
                    className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      {formattedDate}
                    </span>
                    <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                      {currencyFormatter(entry.total || 0)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.first_chunk_total
                        ? `Primer bloque: ${currencyFormatter(
                            entry.first_chunk_total
                          )} · Ratio: ${formatRatio(entry.ratio)}`
                        : "Sin datos suficientes"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
