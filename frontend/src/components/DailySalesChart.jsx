import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const width = 640;
const height = 260;
const padding = { top: 16, right: 24, bottom: 40, left: 96 };

function getDayLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

function buildLinePath(points) {
  return points
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
}

function buildAreaPath(points, baseline) {
  if (points.length === 0) {
    return "";
  }
  const start = `M ${points[0].x} ${baseline}`;
  const lines = points.map(({ x, y }) => `L ${x} ${y}`).join(" ");
  const end = `L ${points[points.length - 1].x} ${baseline} Z`;
  return `${start} ${lines} ${end}`;
}

export default function DailySalesChart({ data }) {
  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return [...data].sort((a, b) => {
      const aDate = new Date(`${a?.date ?? ""}T00:00:00`);
      const bDate = new Date(`${b?.date ?? ""}T00:00:00`);

      if (!Number.isNaN(aDate.getTime()) && !Number.isNaN(bDate.getTime())) {
        return aDate.getTime() - bDate.getTime();
      }

      return String(a?.date ?? "").localeCompare(String(b?.date ?? ""));
    });
  }, [data]);
  const chart = useMemo(() => {
    if (!Array.isArray(sortedData) || sortedData.length === 0) {
      return { points: [], labels: [], maxValue: 0 };
    }

    const maxValue = sortedData.reduce(
      (acc, point) => Math.max(acc, point.cumulative),
      0
    );
    const denominator = Math.max(data.length - 1, 1);
    const plotHeight = height - padding.top - padding.bottom;
    const plotWidth = width - padding.left - padding.right;
    const baseline = padding.top + plotHeight;

    const points = sortedData.map((point, index) => {
      const x = padding.left + (plotWidth * index) / denominator;
      const value = point.cumulative || 0;
      const y =
        baseline - (maxValue === 0 ? 0 : (value / maxValue) * plotHeight);

      return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        label: getDayLabel(point.date),
        total: point.total,
        cumulative: point.cumulative,
      };
    });

    const labels = points.map((point) => point.label);

    return { points, labels, maxValue, baseline, plotHeight };
  }, [sortedData]);

  return (
    <Card className="w-full border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      {" "}
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
          Evolución de ventas
        </CardTitle>
        <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
          Ventas diarias y acumuladas de los últimos días.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chart.points.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <span className="text-3xl" aria-hidden="true">
              📈
            </span>
            <p>No hay datos históricos disponibles todavía.</p>
            <p className="text-xs">
              En cuanto registremos más días, verás la tendencia aquí.
            </p>
          </div>
        ) : (
          <div className="relative flex flex-col gap-4">
            <div className="overflow-x-auto">
              <svg
                role="img"
                aria-label="Gráfica de ventas acumuladas por día"
                width={width}
                height={height}
                className="min-w-full"
              >
                <defs>
                  <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="rgb(59 130 246)"
                      stopOpacity="0.35"
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(59 130 246)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                <g>
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={chart.baseline}
                    y2={chart.baseline}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeOpacity="0.25"
                  />
                  {chart.points.map((point, index) => (
                    <text
                      key={`label-${point.label}-${index}`}
                      x={point.x}
                      y={height - 12}
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium uppercase tracking-[0.16em] dark:fill-slate-100"
                    >
                      {point.label}
                    </text>
                  ))}
                </g>

                <g>
                  {Array.from({ length: 4 }).map((_, tickIndex) => {
                    const value = (chart.maxValue / 4) * (tickIndex + 1);
                    const y =
                      chart.baseline -
                      (chart.maxValue === 0
                        ? 0
                        : (value / chart.maxValue) * chart.plotHeight);
                    return (
                      <g key={`tick-${tickIndex}`}>
                        <line
                          x1={padding.left - 8}
                          x2={width - padding.right}
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          strokeWidth="0.75"
                          strokeDasharray="4 4"
                          strokeOpacity="0.2"
                        />
                        <text
                          x={padding.left - 12}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-600 text-[11px] font-medium dark:fill-slate-200"
                        >
                          {currencyFormatter.format(Math.round(value))}
                        </text>
                      </g>
                    );
                  })}
                </g>

                <path
                  d={buildAreaPath(chart.points, chart.baseline)}
                  fill="url(#sales-area)"
                  stroke="none"
                />

                <path
                  d={buildLinePath(chart.points)}
                  fill="none"
                  stroke="rgb(37 99 235)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {chart.points.map((point, index) => (
                  <circle
                    key={`dot-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={4.5}
                    fill="rgb(37 99 235)"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </div>

            <dl className="grid gap-2 sm:grid-cols-3">
              {sortedData.map((point, index) => (
                <div
                  key={`stat-${point.date}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300"
                >
                  <dt className="font-semibold uppercase tracking-[0.2em]">
                    {getDayLabel(point.date)}
                  </dt>
                  <dd className="mt-1 flex flex-col gap-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-100">
                    <span>
                      Diario:{" "}
                      {currencyFormatter.format(Math.round(point.total || 0))}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Acumulado:{" "}
                      {currencyFormatter.format(
                        Math.round(point.cumulative || 0)
                      )}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
