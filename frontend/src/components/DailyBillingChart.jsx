import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Typography, useTheme } from "@mui/material";

import { LineChart } from "@mui/x-charts/LineChart";

const DEFAULT_HEIGHT = 320;
const FALLBACK_WIDTH = 720;
const CHART_MARGIN = { left: 72, right: 24, top: 48, bottom: 48 };

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
  const dragStateRef = useRef(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [visibleDomain, setVisibleDomain] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const theme = useTheme();

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

  useEffect(() => {
    if (dataset.length === 0) {
      setVisibleDomain(null);
      return;
    }

    const firstTimestamp = dataset[0].timestamp;
    const lastTimestamp = dataset[dataset.length - 1].timestamp;

    setVisibleDomain((prev) => {
      if (!Array.isArray(prev) || prev.length !== 2) {
        return [firstTimestamp, lastTimestamp];
      }

      const [prevStart, prevEnd] = prev;
      if (prevStart < firstTimestamp || prevEnd > lastTimestamp) {
        return [firstTimestamp, lastTimestamp];
      }

      return prev;
    });
  }, [dataset]);

  const xDomain = useMemo(() => {
    if (dataset.length === 0) {
      return null;
    }

    if (Array.isArray(visibleDomain) && visibleDomain.length === 2) {
      const [min, max] = visibleDomain;
      if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
        return [min, max];
      }
    }

    return [dataset[0].timestamp, dataset[dataset.length - 1].timestamp];
  }, [dataset, visibleDomain]);

  const sliderBounds = useMemo(() => {
    if (dataset.length < 2) {
      return null;
    }

    const min = dataset[0].timestamp;
    const max = dataset[dataset.length - 1].timestamp;

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return null;
    }

    const span = Math.max(max - min, 1);
    const estimatedStep = Math.floor(span / Math.min(dataset.length, 24));
    const minDistance = Math.min(Math.max(estimatedStep, 1), span);

    return { min, max, minDistance };
  }, [dataset]);

  const chartGeometry = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const chartWidth = Math.max(width, 360);
    const drawableWidth = Math.max(
      chartWidth - CHART_MARGIN.left - CHART_MARGIN.right,
      1
    );

    const chartHeight = DEFAULT_HEIGHT + CHART_MARGIN.top + CHART_MARGIN.bottom;

    return { container, chartWidth, drawableWidth, chartHeight };
  }, [width]);

  const clampDomain = useCallback(
    (start, end) => {
      if (!sliderBounds) {
        return [start, end];
      }

      const span = Math.max(end - start, sliderBounds.minDistance);
      let nextStart = start;
      let nextEnd = start + span;

      if (nextStart < sliderBounds.min) {
        nextStart = sliderBounds.min;
        nextEnd = nextStart + span;
      }

      if (nextEnd > sliderBounds.max) {
        nextEnd = sliderBounds.max;
        nextStart = nextEnd - span;
      }

      nextEnd = Math.max(nextEnd, nextStart + sliderBounds.minDistance);

      return [nextStart, nextEnd];
    },
    [sliderBounds]
  );

  const handleWheel = useCallback(
    (event) => {
      if (!sliderBounds || !Array.isArray(xDomain) || xDomain.length !== 2) {
        return;
      }

      const [domainStart, domainEnd] = xDomain;
      if (!Number.isFinite(domainStart) || !Number.isFinite(domainEnd)) {
        return;
      }

      const span = domainEnd - domainStart;
      if (span <= sliderBounds.minDistance) {
        return;
      }

      const geometry = chartGeometry();
      if (!geometry) {
        return;
      }

      if (
        typeof Element !== "undefined" &&
        event.target instanceof Element &&
        event.target.closest('[role="slider"]')
      ) {
        return;
      }
      const { container, drawableWidth, chartHeight } = geometry;
      const { left, top } = container.getBoundingClientRect();

      const pointerY = event.clientY - top;

      if (pointerY < 0 || pointerY > chartHeight) {
        return;
      }

      const pointerOffset = event.clientX - left - CHART_MARGIN.left;
      const pointerRatio = Math.min(
        Math.max(pointerOffset / drawableWidth, 0),
        1
      );

      event.preventDefault();
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      const zoomIntensity = 0.18;
      const totalSpan = sliderBounds.max - sliderBounds.min;
      const minSpan = sliderBounds.minDistance;
      const maxSpan = Math.max(totalSpan, minSpan);

      let nextSpan = span * (1 + zoomIntensity * direction);
      nextSpan = Math.min(Math.max(nextSpan, minSpan), maxSpan);

      const center = domainStart + span * pointerRatio;
      let nextStart = center - pointerRatio * nextSpan;
      let nextEnd = nextStart + nextSpan;

      [nextStart, nextEnd] = clampDomain(nextStart, nextEnd);

      if (
        Math.abs(nextStart - domainStart) < 1 &&
        Math.abs(nextEnd - domainEnd) < 1
      ) {
        return;
      }

      setVisibleDomain([nextStart, nextEnd]);
    },
    [sliderBounds, xDomain, chartGeometry, clampDomain]
  );

  const totalSpan = useMemo(() => {
    if (!sliderBounds) {
      return null;
    }
    return sliderBounds.max - sliderBounds.min;
  }, [sliderBounds]);

  const currentSpan = useMemo(() => {
    if (!xDomain || xDomain.length !== 2) {
      return null;
    }
    const [start, end] = xDomain;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }
    return end - start;
  }, [xDomain]);

  const canPan = useMemo(() => {
    if (!sliderBounds || !currentSpan || !totalSpan) {
      return false;
    }
    return currentSpan < totalSpan - 1;
  }, [sliderBounds, currentSpan, totalSpan]);

  const isAtMaxZoom = useMemo(() => {
    if (!sliderBounds || !currentSpan) {
      return false;
    }
    return currentSpan <= sliderBounds.minDistance + 1;
  }, [sliderBounds, currentSpan]);

  const handlePointerDown = useCallback(
    (event) => {
      if (!canPan || event.button !== 0) {
        return;
      }

      const geometry = chartGeometry();
      if (!geometry || !xDomain) {
        return;
      }

      const { container, chartHeight, chartWidth } = geometry;
      const { left, top } = container.getBoundingClientRect();
      const pointerY = event.clientY - top;
      const pointerX = event.clientX - left;

      if (
        pointerY < 0 ||
        pointerY > chartHeight ||
        pointerX < 0 ||
        pointerX > chartWidth
      ) {
        return;
      }

      dragStateRef.current = {
        startX: event.clientX,
        domainStart: xDomain[0],
        domainEnd: xDomain[1],
      };
      setIsDragging(true);
      event.preventDefault();
    },
    [canPan, chartGeometry, xDomain]
  );

  useEffect(() => {
    if (!canPan) {
      dragStateRef.current = null;
      setIsDragging(false);
      return () => {};
    }

    const handlePointerMove = (event) => {
      if (!dragStateRef.current || !sliderBounds) {
        return;
      }

      const geometry = chartGeometry();
      if (!geometry) {
        return;
      }

      const { drawableWidth } = geometry;
      const { startX, domainStart, domainEnd } = dragStateRef.current;
      const span = domainEnd - domainStart;
      if (!Number.isFinite(span) || span <= 0) {
        return;
      }

      const deltaX = event.clientX - startX;
      if (!Number.isFinite(deltaX)) {
        return;
      }

      const shift = (-deltaX / drawableWidth) * span;
      let nextStart = domainStart + shift;
      let nextEnd = domainEnd + shift;

      [nextStart, nextEnd] = clampDomain(nextStart, nextEnd);

      event.preventDefault();

      setVisibleDomain((prev) => {
        if (
          Array.isArray(prev) &&
          Math.abs(prev[0] - nextStart) < 1 &&
          Math.abs(prev[1] - nextEnd) < 1
        ) {
          return prev;
        }
        return [nextStart, nextEnd];
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [canPan, clampDomain, chartGeometry, sliderBounds]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return () => {};
    }

    const handleNativeWheel = (event) => {
      handleWheel(event);
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
    };
  }, [handleWheel]);

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

  const showMaxZoomMessage = Boolean(
    sliderBounds &&
      totalSpan !== null &&
      currentSpan !== null &&
      totalSpan - currentSpan > 1 &&
      isAtMaxZoom
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        cursor: canPan ? (isDragging ? "grabbing" : "grab") : "default",
        userSelect: isDragging ? "none" : undefined,
      }}
      onWheel={handleWheel}
      onMouseDown={handlePointerDown}
    >
      <LineChart
        dataset={dataset}
        xAxis={[
          {
            scaleType: "time",
            dataKey: "timestamp",
            valueFormatter: formatTimeLabel,
            min: xDomain ? xDomain[0] : undefined,
            max: xDomain ? xDomain[1] : undefined,
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
            showMark: true,
            areaOpacity: 0.14,
            mark: { size: 6 },
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
        margin={CHART_MARGIN}
        slotProps={{
          legend: {
            direction: "row",
            position: { vertical: "top", horizontal: "center" },
            padding: { top: 8 },
          },
          tooltip: {
            trigger: "axis",
          },
        }}
        sx={{
          "--Charts-axisLineColor": theme.palette.divider,
          "--Charts-axisTickColor": theme.palette.divider,
          "--Charts-axisLabelColor": theme.palette.text.secondary,
          "--Charts-legendLabelColor": theme.palette.text.secondary,
          "--Charts-tooltip-background": theme.palette.background.paper,
          "--Charts-tooltip-text-color": theme.palette.text.primary,

          [`.MuiLineElement-root`]: {
            strokeWidth: 2.25,
          },
          [`.MuiAreaElement-root`]: {
            fillOpacity: 0.16,
          },
          [`.MuiMarkElement-root`]: {
            stroke: theme.palette.primary.main,
            strokeWidth: 2,
            fill: theme.palette.common.white,
            r: 4,
          },
          [`.MuiChartsAxis-tickLabel`]: {
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          },
        }}
      />
      {showMaxZoomMessage ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 2,
            color: theme.palette.text.secondary,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Alcanzaste el nivel máximo de zoom.
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 1.5,
          color: theme.palette.text.secondary,

          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Pasa el cursor sobre cada punto para ver la factura y su desviación del
        promedio. Usa la rueda del mouse para acercar o alejar y arrastra sobre
        la gráfica para desplazarte sin perder el nivel de zoom.
      </Typography>
    </Box>
  );
}
