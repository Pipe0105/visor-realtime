import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ChartsTooltipPaper } from "@mui/x-charts/ChartsTooltip/ChartsTooltipTable";
import { LineChart } from "@mui/x-charts/LineChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

const FALLBACK_WIDTH = 640;
const DEFAULT_HEIGHT = 320;

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const axisCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  notation: "compact",
});

function toTimestamp(dateString) {
  if (!dateString) {
    return NaN;
  }
  const parsed = new Date(`${dateString}T00:00:00`);
  return parsed.getTime();
}

function getDayLabel(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

function formatSignedCurrency(value, formatter) {
  const numeric = Number(value) || 0;
  const formatted = formatter(Math.abs(numeric));
  if (numeric === 0) {
    return `${formatted}`;
  }
  const prefix = numeric > 0 ? "+" : "−";
  return `${prefix}${formatted}`;
}

function DailySalesTooltipContent(props) {
  const {
    axisValue,
    dataIndex,
    dataset = [],
    classes = {},
    sx,
    formatCurrency,
  } = props;

  if (dataIndex == null && axisValue == null) {
    return null;
  }

  const axisTimestamp =
    axisValue instanceof Date ? axisValue.getTime() : Number(axisValue);

  const point =
    dataset[dataIndex ?? -1] ??
    dataset.find((item) => Number(item?.timestamp) === axisTimestamp);

  if (!point) {
    return null;
  }

  const currentIndex = dataset.indexOf(point);
  const previousPoint =
    currentIndex > 0 ? dataset[currentIndex - 1] : undefined;

  const currencyFormatterFn =
    typeof formatCurrency === "function"
      ? formatCurrency
      : (value) => currencyFormatter.format(Math.max(Number(value) || 0, 0));

  const totalLabel = currencyFormatterFn(point.total);
  const cumulativeLabel = currencyFormatterFn(point.cumulative);
  const delta = Number(point.total) - Number(previousPoint?.total || 0);
  const deltaLabel = formatSignedCurrency(delta, currencyFormatterFn);

  const detailDate = new Date(point.timestamp);
  const fullLabel = Number.isNaN(detailDate.getTime())
    ? point.label
    : detailDate.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

  const isPositive = delta >= 0;

  return (
    <ChartsTooltipPaper sx={sx} className={classes.paper}>
      <Box sx={{ px: 2, py: 1.5, maxWidth: 280 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {fullLabel}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mt: 1, fontWeight: 600, letterSpacing: "0.01em" }}
        >
          Ventas del día: {totalLabel}
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
          Acumulado del período: {cumulativeLabel}
        </Typography>
        {previousPoint ? (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.5,
              fontWeight: 600,
              color: isPositive
                ? "hsl(var(--chart-positive))"
                : "hsl(var(--chart-negative))",
            }}
          >
            Variación vs. día anterior: {deltaLabel}
          </Typography>
        ) : null}
      </Box>
    </ChartsTooltipPaper>
  );
}

export default function DailySalesChart({ data }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return () => {};
    }

    const updateWidth = () => {
      const nextWidth = element.clientWidth || FALLBACK_WIDTH;
      setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const dataset = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return [...data]
      .filter((item) => item && item.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((item) => {
        const timestamp = toTimestamp(item.date);
        const total = Number(item.total) || 0;
        const cumulative = Number(item.cumulative) || 0;
        return {
          date: item.date,
          timestamp,
          total,
          cumulative,
          label: getDayLabel(timestamp),
        };
      });
  }, [data]);

  return (
    <Card className="w-full border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
          Evolución de ventas
        </CardTitle>
        <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
          Ventas diarias y acumuladas de los últimos días.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dataset.length === 0 ? (
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
          <Box ref={containerRef} sx={{ width: "100%" }}>
            <LineChart
              dataset={dataset}
              xAxis={[
                {
                  scaleType: "time",
                  dataKey: "timestamp",
                  valueFormatter: (value) => getDayLabel(value),
                },
              ]}
              yAxis={[
                {
                  label: "",
                  valueFormatter: (value) =>
                    axisCurrencyFormatter.format(
                      Math.max(Number(value) || 0, 0)
                    ),
                },
              ]}
              series={[
                {
                  id: "daily-total",
                  dataKey: "total",
                  label: "Ventas diarias",
                  curve: "monotoneX",
                  area: true,
                  color: "hsl(var(--chart-positive-soft))",
                  showMark: dataset.length <= 30,
                  valueFormatter: (value) =>
                    currencyFormatter.format(Number(value) || 0),
                  areaOpacity: 0.16,
                },
                {
                  id: "cumulative-total",
                  dataKey: "cumulative",
                  label: "Ventas acumuladas",
                  curve: "catmullRom",
                  color: "hsl(var(--chart-series-secondary))",
                  showMark: dataset.length <= 30,
                  valueFormatter: (value) =>
                    currencyFormatter.format(Number(value) || 0),
                },
              ]}
              axisHighlight={{ x: "line", y: "none" }}
              width={Math.max(width, 360)}
              height={DEFAULT_HEIGHT}
              margin={{ left: 80, right: 24, top: 40, bottom: 48 }}
              slotProps={{
                legend: {
                  direction: "row",
                  position: { vertical: "top", horizontal: "center" },
                  padding: { top: 8 },
                },
                tooltip: {
                  trigger: "axis",
                  slots: {
                    axisContent: DailySalesTooltipContent,
                  },
                  slotProps: {
                    axisContent: {
                      dataset,
                      formatCurrency: (value) =>
                        currencyFormatter.format(
                          Math.max(Number(value) || 0, 0)
                        ),
                    },
                  },
                },
              }}
              sx={{
                "--Charts-axisLineColor": "var(--chart-axis-line)",
                "--Charts-axisTickColor": "var(--chart-axis-tick)",
                "--Charts-axisLabelColor": "var(--chart-axis-label)",
                "--Charts-legendLabelColor": "var(--chart-axis-legend)",
                "--Charts-tooltip-background": "var(--chart-tooltip-bg)",
                "--Charts-tooltip-text-color": "var(--chart-tooltip-text)",
                [`.MuiLineElement-root`]: {
                  strokeWidth: 2.25,
                },
                [`.MuiAreaElement-root`]: {
                  fillOpacity: 0.2,
                },
                [`.MuiChartsAxis-left .MuiChartsAxis-label`]: {
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fill: "var(--chart-axis-label)",
                },
                [`.MuiChartsAxis-tickLabel`]: {
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fill: "var(--chart-axis-label)",
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
