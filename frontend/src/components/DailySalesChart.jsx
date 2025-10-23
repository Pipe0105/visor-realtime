import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
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
                  valueFormatter: (value) =>
                    currencyFormatter.format(Math.max(Number(value) || 0, 0)),
                },
              ]}
              series={[
                {
                  id: "daily-total",
                  dataKey: "total",
                  label: "Ventas diarias",
                  curve: "monotoneX",
                  area: true,
                  color: "#22c55e",
                  valueFormatter: (value) =>
                    currencyFormatter.format(Number(value) || 0),
                },
                {
                  id: "cumulative-total",
                  dataKey: "cumulative",
                  label: "Ventas acumuladas",
                  curve: "catmullRom",
                  color: "#0ea5e9",
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
              }}
              sx={{
                [`.MuiLineElement-root`]: {
                  strokeWidth: 2.25,
                },
                [`.MuiAreaElement-root`]: {
                  fillOpacity: 0.2,
                },
                [`.MuiChartsAxis-tickLabel`]: {
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
