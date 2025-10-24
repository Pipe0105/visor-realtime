import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Typography } from "@mui/material";
import { ChartsTooltipPaper } from "@mui/x-charts/ChartsTooltip/ChartsTooltipTable";
import { LineChart } from "@mui/x-charts/LineChart";

const DEFAULT_HEIGHT = 320;
const FALLBACK_WIDTH = 720;
const CHART_MARGIN = { left: 80, right: 24, top: 48, bottom: 48 };
const MAX_POINTS = 1200;
const VISIBLE_PADDING_RATIO = 0.05;
const BUCKET_INTERVAL_MINUTES = 1;
const BUCKET_INTERVAL_MS = BUCKET_INTERVAL_MINUTES * 60 * 1000;

const axisCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CHART_COLOR_TOKENS = {
  textMuted: "hsl(var(--muted-foreground))",
  positive: "hsl(var(--chart-positive))",
  negative: "hsl(var(--chart-negative))",
  seriesPrimary: "hsl(var(--chart-series-primary))",
  seriesAverage: "hsl(var(--chart-series-average))",
  markStroke: "hsl(var(--chart-series-primary))",
  markFill: "hsl(var(--card))",
};

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

function createMinuteIntervalFilter(stepMinutes) {
  const step = Math.max(Math.floor(stepMinutes), 1);
  return (value) => {
    const timestamp =
      value instanceof Date ? value.getTime() : Number(value) || 0;
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const totalMinutes = Math.round(timestamp / 60000);
    return totalMinutes % step === 0;
  };
}

function formatSignedCurrency(value, formatter) {
  const numericValue = Number(value) || 0;
  const formatted = formatter(Math.abs(numericValue));
  const prefix = numericValue >= 0 ? "+" : "−";
  return `${prefix}${formatted}`;
}

function BillingAxisTooltipContent(props) {
  const {
    axisValue,
    dataIndex,
    classes,
    sx,
    dataset = [],
    currencyFormatter,
  } = props;

  if (dataIndex == null) {
    return null;
  }

  const axisTimestamp =
    axisValue instanceof Date ? axisValue.getTime() : Number(axisValue);

  if (!Number.isFinite(axisTimestamp)) {
    return null;
  }

  const bucket =
    dataset.find((item) => {
      const itemTimestamp = Number(item?.timestamp);
      if (!Number.isFinite(itemTimestamp)) {
        return false;
      }

      if (itemTimestamp === axisTimestamp) {
        return true;
      }

      return Math.abs(itemTimestamp - axisTimestamp) <= BUCKET_INTERVAL_MS / 2;
    }) || null;

  if (!bucket) {
    return null;
  }

  const invoices = Array.isArray(bucket.invoices) ? bucket.invoices : [];
  const invoiceCount = invoices.length;
  const formatCurrency =
    typeof currencyFormatter === "function"
      ? currencyFormatter
      : (value) => axisCurrencyFormatter.format(Math.max(value, 0));
  const totalLabel = formatCurrency(Number(bucket.total) || 0);

  return (
    <ChartsTooltipPaper sx={sx} className={classes.paper}>
      <Box sx={{ px: 2, py: 1.5, maxWidth: 320 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {bucket.tooltipLabel || bucket.timeLabel || "Detalle"}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: CHART_COLOR_TOKENS.textMuted,
            display: "block",
            mt: 0.5,
            letterSpacing: "0.02em",
          }}
        >
          {invoiceCount === 1
            ? "Incluye 1 factura"
            : `Incluye ${invoiceCount} facturas`}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            mt: 1,
            letterSpacing: "0.02em",
          }}
        >
          Total: {totalLabel}
        </Typography>
        {Number.isFinite(Number(bucket.deviation)) ? (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.25,
              fontWeight: 600,
              color:
                Number(bucket.deviation) >= 0
                  ? CHART_COLOR_TOKENS.positive
                  : CHART_COLOR_TOKENS.negative,
            }}
          >
            {formatSignedCurrency(
              Number(bucket.deviation) || 0,
              formatCurrency
            )}{" "}
            vs. promedio del día
          </Typography>
        ) : null}
        {invoiceCount > 0 ? (
          <Box
            component="ul"
            sx={{
              listStyle: "none",
              p: 0,
              m: 0,
              mt: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {invoices.map((invoice) => {
              const invoiceTotal = formatCurrency(Number(invoice.total) || 0);
              const deviation = Number(invoice.deviation);
              const key =
                invoice.id ||
                `${invoice.invoiceNumber ?? "invoice"}-${invoice.iso}`;

              return (
                <Box
                  key={key}
                  component="li"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: CHART_COLOR_TOKENS.textMuted,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {invoice.timeLabel}
                    {invoice.invoiceNumber
                      ? ` · #${invoice.invoiceNumber}`
                      : ""}
                    {invoice.branch ? ` · ${invoice.branch}` : ""}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {invoiceTotal}
                    </Typography>
                    {Number.isFinite(deviation) ? (
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color:
                            deviation >= 0
                              ? CHART_COLOR_TOKENS.positive
                              : CHART_COLOR_TOKENS.negative,
                        }}
                      >
                        {formatSignedCurrency(deviation, formatCurrency)}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </ChartsTooltipPaper>
  );
}

function downsampleLTTB(data, threshold) {
  if (!Array.isArray(data) || data.length <= threshold || threshold < 3) {
    return data;
  }

  const sampled = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i += 1) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 2) * bucketSize) + 1;

    const bucketStart = Math.min(rangeStart, data.length - 1);
    const bucketEnd = Math.min(rangeEnd, data.length);

    let avgX = 0;
    let avgY = 0;
    const avgRangeLength = bucketEnd - rangeStart;

    if (avgRangeLength > 0) {
      for (let j = rangeStart; j < bucketEnd; j += 1) {
        const point = data[j] || data[data.length - 1];
        avgX += Number(point.timestamp) || 0;
        avgY += Number(point.total) || 0;
      }

      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
    } else {
      const fallbackPoint = data[bucketStart] || data[a];
      avgX = Number(fallbackPoint.timestamp) || 0;
      avgY = Number(fallbackPoint.total) || 0;
    }

    let selectedIndex = bucketStart;
    let maxArea = -1;

    const pointA = data[a];
    const ax = Number(pointA.timestamp) || 0;
    const ay = Number(pointA.total) || 0;

    for (let j = bucketStart; j < bucketEnd; j += 1) {
      const point = data[j];
      if (!point) {
        continue;
      }

      const bx = Number(point.timestamp) || 0;
      const by = Number(point.total) || 0;

      const area =
        Math.abs((ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay)) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        selectedIndex = j;
      }
    }

    sampled.push(data[selectedIndex]);
    a = selectedIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
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
      if (direction < 0 && span <= sliderBounds.minDistance) {
        return;
      }
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

  const filteredDataset = useMemo(() => {
    if (dataset.length === 0) {
      return dataset;
    }

    if (!xDomain || xDomain.length !== 2) {
      return dataset;
    }

    const [domainStart, domainEnd] = xDomain;
    if (!Number.isFinite(domainStart) || !Number.isFinite(domainEnd)) {
      return dataset;
    }

    const padding = Math.max(
      (domainEnd - domainStart) * VISIBLE_PADDING_RATIO,
      1
    );
    const min = domainStart - padding;
    const max = domainEnd + padding;

    const filtered = dataset.filter(
      (item) => item.timestamp >= min && item.timestamp <= max
    );

    return filtered.length > 0 ? filtered : dataset;
  }, [dataset, xDomain]);

  const chartDataset = useMemo(() => {
    if (filteredDataset.length <= MAX_POINTS) {
      return filteredDataset;
    }
    return downsampleLTTB(filteredDataset, MAX_POINTS);
  }, [filteredDataset]);

  const xTickLabelInterval = useMemo(() => createMinuteIntervalFilter(30), []);

  const axisTooltipSlotProps = useMemo(
    () => ({
      dataset: chartDataset,
      currencyFormatter: formatter,
    }),
    [chartDataset, formatter]
  );

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
        dataset={chartDataset}
        xAxis={[
          {
            scaleType: "time",
            dataKey: "timestamp",
            valueFormatter: formatTimeLabel,
            min: xDomain ? xDomain[0] : undefined,
            max: xDomain ? xDomain[1] : undefined,
            tickLabelInterval: xTickLabelInterval,
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
            label: `Facturación (${BUCKET_INTERVAL_MINUTES} min)`,
            curve: chartDataset.length > 480 ? "linear" : "catmullRom",
            area: chartDataset.length <= 1600,
            color: CHART_COLOR_TOKENS.seriesPrimary,
            valueFormatter: formatter,
            showMark: chartDataset.length <= 240,
            areaOpacity: 0.14,
            mark: chartDataset.length <= 240 ? { size: 6 } : undefined,
          },
          {
            id: "billing-average",
            dataKey: "average",
            label: `Promedio (${BUCKET_INTERVAL_MINUTES} min)`,
            curve: "linear",
            showMark: false,
            color: CHART_COLOR_TOKENS.seriesAverage,
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
            slots: {
              axisContent: BillingAxisTooltipContent,
            },
            slotProps: {
              axisContent: axisTooltipSlotProps,
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
            fillOpacity: 0.16,
          },
          [`.MuiMarkElement-root`]: {
            stroke: "hsl(var(--primary))",
            strokeWidth: 2,
            fill: "hsl(var(--card))",
            r: 4,
          },
          [`.MuiChartsAxis-tickLabel`]: {
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fill: "var(--chart-axis-label)",
          },
        }}
      />
      {showMaxZoomMessage ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 2,
            color: CHART_COLOR_TOKENS.textMuted,
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
          color: CHART_COLOR_TOKENS.textMuted,

          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Cada punto agrupa la facturación emitida en ventanas por minuto. Pasa el
        cursor para ver el detalle, usa la rueda del mouse para acercar o alejar
        y arrastra sobre la gráfica para desplazarte sin perder el nivel de
        zoom.
      </Typography>
    </Box>
  );
}
