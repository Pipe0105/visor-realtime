import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";

const DEFAULT_HEIGHT = 320;
const FALLBACK_WIDTH = 720;

const axisCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
function getFormatter(formatCurrency) {
  if (typeof formatCurrency === "function") {
    return (value) => formatCurrency(Number(value) || 0);
  }
  return (value) =>
    axisCurrencyFormatter.format(Math.max(Number(value) || 0, 0));
}

function formatTimeLabel(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DailyBillingChart({
  data,
  averageValue,
  formatCurrency,
}) {
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

  const formatter = useMemo(
    () => getFormatter(formatCurrency),
    [formatCurrency]
  );

  const dataset = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const average = Number(averageValue) || 0;

    return [...data]
      .filter((item) => Number.isFinite(Number(item?.timestamp)))
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
      .map((item) => {
        const timestamp = Number(item.timestamp);
        const total = Number(item.total) || 0;
        return {
          id: item.id ?? `${timestamp}`,
          timestamp,
          total,
          average,
          timeLabel: item.timeLabel || formatTimeLabel(timestamp),
          deviation: Number(item.deviation) || total - average,
        };
      });
  }, [data, averageValue]);

  if (dataset.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span className="text-3xl" aria-hidden="true">
          📉
        </span>
        <p>No hay registros de facturación suficientes para graficar.</p>
        <p className="text-xs">
          Se mostrarán aquí a medida que recibamos nuevas facturas.
        </p>
      </div>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      <LineChart
        dataset={dataset}
        xAxis={[
          {
            scaleType: "time",
            dataKey: "timestamp",
            valueFormatter: formatTimeLabel,
          },
        ]}
        yAxis={[
          {
            valueFormatter: formatter,
          },
        ]}
        series={[
          {
            id: "billing-total",
            dataKey: "total",
            label: "Facturación",
            curve: "catmullRom",
            area: true,
            color: "#2563eb",
            valueFormatter: formatter,
          },
          {
            id: "billing-average",
            dataKey: "average",
            label: "Promedio diario",
            curve: "linear",
            showMark: false,
            color: "#f97316",
            valueFormatter: formatter,
          },
        ]}
        axisHighlight={{ x: "line", y: "none" }}
        width={Math.max(width, 360)}
        height={DEFAULT_HEIGHT}
        margin={{ left: 72, right: 24, top: 48, bottom: 48 }}
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
            fillOpacity: 0.16,
          },
          [`.MuiChartsAxis-tickLabel`]: {
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          },
        }}
      />
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 1.5,
          color: "var(--muted-foreground, #64748b)",
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Pasa el cursor sobre cada punto para ver la factura y su desviación del
        promedio.
      </Typography>
    </Box>
  );
}
