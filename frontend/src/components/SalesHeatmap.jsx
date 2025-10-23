import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";

const compactCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatHourRange(hour) {
  const start = formatHourLabel(hour);
  const end = `${String((hour + 1) % 24).padStart(2, "0")}:00`;
  return `${start} - ${end}`;
}

function getCellBackground(value, maxValue) {
  if (!maxValue || maxValue <= 0 || value <= 0) {
    return {
      backgroundColor: "rgba(148, 163, 184, 0.15)",
    };
  }

  const intensity = Math.min(value / maxValue, 1);
  const alpha = 0.2 + intensity * 0.6;
  return {
    backgroundColor: `rgba(16, 185, 129, ${alpha})`,
  };
}

function getCellTextColor(value, maxValue) {
  if (!maxValue || maxValue <= 0 || value <= 0) {
    return "text-slate-600 dark:text-slate-400";
  }

  const intensity = Math.min(value / maxValue, 1);
  return intensity > 0.6
    ? "text-emerald-50"
    : "text-emerald-900 dark:text-emerald-100";
}

export default function SalesHeatmap({ data }) {
  const hours = data?.hours ?? [];
  const rows = data?.rows ?? [];
  const maxValue = data?.maxTotal ?? 0;
  const totalInvoices = data?.totalInvoices ?? 0;

  return (
    <Card className="w-full border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      <CardHeader className="space-y-4 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
              Mapa térmico por horario
            </CardTitle>
            <CardDescription>
              Identifica los momentos del día con mayor intensidad de ventas.
            </CardDescription>
          </div>
          <Badge className="rounded-full border-transparent bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {totalInvoices > 0
              ? `${totalInvoices} factura${totalInvoices === 1 ? "" : "s"}`
              : "Sin facturas registradas"}
          </Badge>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Cada celda concentra el valor total vendido en la franja horaria
          correspondiente.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 || hours.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <span className="text-3xl" aria-hidden="true">
              🌡️
            </span>
            <p>No hay suficientes registros para construir el mapa térmico.</p>
            <p className="text-xs">
              Se actualizará automáticamente cuando ingresen nuevas facturas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div
                  className="grid gap-1 text-[11px]"
                  style={{
                    gridTemplateColumns: `auto repeat(${hours.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="sticky left-0 z-10 flex items-center bg-white px-2 py-1 font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
                    Sucursal / Hora
                  </div>
                  {hours.map((hour) => (
                    <div
                      key={`hour-header-${hour}`}
                      className="flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-semibold uppercase tracking-[0.22em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                  {rows.map((row) => (
                    <React.Fragment key={`row-${row.key}`}>
                      <div className="sticky left-0 z-10 flex items-center rounded-md bg-slate-100 px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:bg-slate-800/60 dark:text-slate-200">
                        {row.label}
                      </div>
                      {row.values.map((value) => {
                        const backgroundStyle = getCellBackground(
                          value.total,
                          maxValue
                        );
                        const textClass = getCellTextColor(
                          value.total,
                          maxValue
                        );
                        const tooltip = `${row.label} · ${formatHourRange(
                          value.hour
                        )} · ${currencyFormatter.format(value.total)} · ${
                          value.count
                        } factura${value.count === 1 ? "" : "s"}`;
                        return (
                          <div
                            key={`${row.key}-${value.hour}`}
                            className={`flex h-14 items-center justify-center rounded-md border border-slate-200 px-2 text-center text-[0.7rem] font-semibold transition dark:border-slate-800 ${textClass}`}
                            style={backgroundStyle}
                            title={tooltip}
                          >
                            {value.total > 0
                              ? compactCurrencyFormatter.format(value.total)
                              : "—"}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex h-3 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800" />
              <span>Bajas ventas</span>
              <span className="flex h-3 w-12 items-center justify-center rounded-full bg-emerald-300" />
              <span>Altas ventas</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
