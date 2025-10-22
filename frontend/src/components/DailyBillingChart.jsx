import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils";

const DEFAULT_DIMENSIONS = { width: 720, height: 260 };
const PADDING = { top: 28, right: 28, bottom: 44, left: 60 };
const MIN_SELECTION_WIDTH = 8;

const axisCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  notation: "compact",
});
function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const exponent = Math.floor(Math.log10(value));
  const factor = Math.pow(10, exponent);
  const normalized = value / factor;

  let nice;
  if (normalized <= 0.2) nice = 0.2;
  else if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else nice = 2;

  return nice * factor;
}

function niceFloor(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const exponent = Math.floor(Math.log10(value));
  const factor = Math.pow(10, exponent);
  const normalized = value / factor;

  let nice;
  if (normalized >= 5) nice = 5;
  else if (normalized >= 2) nice = 2;
  else nice = 1;

  return nice * factor;
}

function DailyBillingChart({ data, averageValue, formatCurrency }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);
  const [timeWindow, setTimeWindow] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionOriginRef = useRef(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const measure = () => {
      const nextWidth = element.clientWidth || DEFAULT_DIMENSIONS.width;
      setDimensions((prev) =>
        prev.width === nextWidth
          ? prev
          : { width: nextWidth, height: DEFAULT_DIMENSIONS.height }
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("resize", measure);
      };
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHoverIndex(null);
  }, [data?.length]);

  const svgWidth = Math.max(dimensions.width, 320);
  const svgHeight = DEFAULT_DIMENSIONS.height;
  const innerWidth = Math.max(svgWidth - PADDING.left - PADDING.right, 0);
  const innerHeight = Math.max(svgHeight - PADDING.top - PADDING.bottom, 0);

  const chart = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        points: [],
        yTicks: [],
        xTicks: [],
        baselineY: PADDING.top + innerHeight,
        areaPath: "",
        linePath: "",
        domainMin: 0,
        domainMax: 1,
        visibleData: [],
        scaleXInverse: null,
        availableMinTime: null,
        availableMaxTime: null,
        hasActiveWindow: false,
      };
    }

    const sortableData = data.filter((item) =>
      Number.isFinite(Number(item?.timestamp))
    );

    if (sortableData.length === 0) {
      return {
        points: [],
        yTicks: [],
        xTicks: [],
        baselineY: PADDING.top + innerHeight,
        areaPath: "",
        linePath: "",
        domainMin: 0,
        domainMax: 1,
        visibleData: [],
        scaleXInverse: null,
        availableMinTime: null,
        availableMaxTime: null,
        hasActiveWindow: false,
      };
    }

    const availableMinTime = Math.min(
      ...sortableData.map((item) => Number(item.timestamp))
    );
    const availableMaxTime = Math.max(
      ...sortableData.map((item) => Number(item.timestamp))
    );

    let filteredData = sortableData;

    if (
      timeWindow &&
      Number.isFinite(timeWindow[0]) &&
      Number.isFinite(timeWindow[1])
    ) {
      const [rawStart, rawEnd] = timeWindow;
      const start = Math.min(rawStart, rawEnd);
      const end = Math.max(rawStart, rawEnd);

      filteredData = sortableData.filter(
        (item) => item.timestamp >= start && item.timestamp <= end
      );

      if (filteredData.length === 0) {
        const tolerance = 60 * 1000;
        filteredData = sortableData.filter(
          (item) =>
            item.timestamp >= start - tolerance &&
            item.timestamp <= end + tolerance
        );
      }
    }

    if (filteredData.length === 0) {
      filteredData = sortableData;
    }

    const timestamps = filteredData.map((item) => item.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = maxTime - minTime;
    const sameTimestamp = timeSpan === 0;

    const MIN_EXTRA_RANGE_MS = timeWindow ? 5 * 60 * 1000 : 12 * 60 * 1000;
    const marginFactor = timeWindow ? 0.06 : 0.12;
    const padding = sameTimestamp
      ? MIN_EXTRA_RANGE_MS
      : Math.max(timeSpan * marginFactor, MIN_EXTRA_RANGE_MS);

    const adjustedMinTime = sameTimestamp
      ? minTime - padding / 2
      : minTime - padding;
    const adjustedMaxTime = sameTimestamp
      ? maxTime + padding / 2
      : maxTime + padding;

    const timeRange = sameTimestamp
      ? 1
      : Math.max(adjustedMaxTime - adjustedMinTime, 1);

    const values = filteredData.map((item) => Number(item.total) || 0);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    let domainMin;
    let domainMax;

    if (rawMin === rawMax) {
      const buffer = rawMin === 0 ? 1 : Math.max(rawMin * 0.1, 1);
      domainMin = Math.max(0, rawMin - buffer);
      domainMax = rawMax + buffer;
    } else {
      const range = rawMax - rawMin;
      const buffer = Math.max(range * 0.15, 1);
      domainMin = rawMin - buffer;
      domainMax = rawMax + buffer;
    }

    domainMin = Math.max(0, Math.min(rawMin, niceFloor(domainMin)));
    domainMax = Math.max(domainMin + 1, niceCeil(domainMax));

    const scaleX = (timestamp) => {
      if (sameTimestamp) {
        return PADDING.left + innerWidth / 2;
      }
      const ratio = (timestamp - adjustedMinTime) / timeRange;
      return PADDING.left + ratio * innerWidth;
    };

    const scaleY = (value) => {
      const range = domainMax - domainMin || 1;
      const ratio = (value - domainMin) / range;
      return PADDING.top + (1 - ratio) * innerHeight;
    };
    const points = filteredData.map((item) => {
      const value = Number(item.total) || 0;
      return {
        ...item,
        value,
        x: scaleX(item.timestamp),
        y: scaleY(value),
      };
    });

    let linePath = "";
    let areaPath = "";

    if (points.length > 0) {
      const commands = points
        .map((point, index) => {
          const prefix = index === 0 ? "M" : "L";
          return `${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
        })
        .join(" ");

      linePath = commands;

      const baselineYValue = scaleY(domainMin);
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      areaPath = `${commands} L ${lastPoint.x.toFixed(
        2
      )} ${baselineYValue.toFixed(2)} L ${firstPoint.x.toFixed(
        2
      )} ${baselineYValue.toFixed(2)} Z`;
    }

    const baselineY = scaleY(domainMin);

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount }, (_, index) => {
      if (yTickCount === 1) {
        return domainMax;
      }
      const ratio = index / (yTickCount - 1);
      return domainMin + ratio * (domainMax - domainMin);
    });

    const MIN_TICK_GAP = 56; // px
    const maxTicksBySpace = Math.max(1, Math.floor(innerWidth / MIN_TICK_GAP));
    const tickCount = Math.min(points.length, maxTicksBySpace);
    const indexSet = new Set();
    if (tickCount > 0) {
      for (let i = 0; i < tickCount; i += 1) {
        const ratio = tickCount === 1 ? 1 : i / (tickCount - 1);
        const index = Math.round(ratio * (points.length - 1));
        indexSet.add(index);
      }
    }

    const rawTicks = Array.from(indexSet)
      .sort((a, b) => a - b)
      .map((index) => ({
        x: points[index].x,
        label: filteredData[index].timeLabel,
      }));

    const xTicks = [];

    let lastAcceptedX = -Infinity;
    rawTicks.forEach((tick, idx) => {
      if (idx === 0) {
        xTicks.push(tick);
        lastAcceptedX = tick.x;
        return;
      }

      const isLast = idx === rawTicks.length - 1;
      const hasGap = tick.x - lastAcceptedX >= MIN_TICK_GAP;

      if (isLast) {
        if (!xTicks.length || xTicks[xTicks.length - 1].x !== tick.x) {
          if (!hasGap && xTicks.length > 1) {
            xTicks[xTicks.length - 1] = tick;
          } else {
            xTicks.push(tick);
          }
        }
        lastAcceptedX = tick.x;
        return;
      }

      if (hasGap) {
        xTicks.push(tick);
        lastAcceptedX = tick.x;
      }
    });

    if (rawTicks.length === 1 && xTicks.length === 0) {
      xTicks.push(rawTicks[0]);
    }

    return {
      points,
      linePath,
      areaPath,
      baselineY,
      yTicks,
      xTicks,
      domainMin,
      domainMax,
      visibleData: filteredData,
      scaleXInverse: sameTimestamp
        ? () => minTime
        : (x) => {
            const ratio =
              innerWidth === 0 ? 0 : (x - PADDING.left) / innerWidth;
            const clampedRatio = Math.min(Math.max(ratio, 0), 1);
            return (
              adjustedMinTime +
              clampedRatio * (adjustedMaxTime - adjustedMinTime)
            );
          },
      availableMinTime,
      availableMaxTime,
      hasActiveWindow: Boolean(timeWindow),
    };
  }, [data, innerHeight, innerWidth, timeWindow]);

  const focusIndex =
    hoverIndex ??
    (chart.visibleData && chart.visibleData.length
      ? chart.visibleData.length - 1
      : null);
  const focusPoint =
    focusIndex != null && chart.visibleData
      ? chart.visibleData[focusIndex]
      : null;
  const previousPoint =
    focusPoint && focusIndex > 0 && chart.visibleData
      ? chart.visibleData[focusIndex - 1]
      : null;
  const deltaValue =
    previousPoint && focusPoint
      ? (Number(focusPoint.total) || 0) - (Number(previousPoint.total) || 0)
      : null;

  useEffect(() => {
    if (hoverIndex == null) {
      return;
    }
    if (!chart.visibleData || chart.visibleData.length === 0) {
      setHoverIndex(null);
      return;
    }
    if (hoverIndex >= chart.visibleData.length) {
      setHoverIndex(chart.visibleData.length - 1);
    }
  }, [chart.visibleData, hoverIndex]);

  useEffect(() => {
    if (
      !timeWindow ||
      chart.availableMinTime == null ||
      chart.availableMaxTime == null
    ) {
      return;
    }

    const [start, end] = timeWindow;
    if (end < chart.availableMinTime || start > chart.availableMaxTime) {
      setTimeWindow(null);
      setSelectionBox(null);
      setHoverIndex(null);
    }
  }, [chart.availableMinTime, chart.availableMaxTime, timeWindow]);

  const getClampedViewBoxX = useCallback(
    (event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0) {
        return null;
      }
      const relativeX = event.clientX - bounds.left;
      const viewBoxX = (relativeX / bounds.width) * svgWidth;
      return Math.min(
        Math.max(viewBoxX, PADDING.left),
        svgWidth - PADDING.right
      );
    },
    [svgWidth]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!chart.points.length || !chart.visibleData?.length) {
        return;
      }
      const clampedX = getClampedViewBoxX(event);
      if (clampedX == null) {
        return;
      }

      if (isSelecting) {
        setSelectionBox((prev) =>
          prev
            ? {
                start: prev.start,
                end: clampedX,
              }
            : null
        );
        return;
      }

      let closestIndex = 0;
      let minDistance = Number.POSITIVE_INFINITY;
      chart.points.forEach((point, index) => {
        const distance = Math.abs(point.x - clampedX);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      setHoverIndex(closestIndex);
    },
    [chart.points, chart.visibleData, getClampedViewBoxX, isSelecting]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      if (!chart.points.length || !chart.scaleXInverse) {
        return;
      }
      const clampedX = getClampedViewBoxX(event);
      if (clampedX == null) {
        return;
      }
      selectionOriginRef.current = clampedX;
      setSelectionBox({ start: clampedX, end: clampedX });
      setIsSelecting(true);
      setHoverIndex(null);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    },
    [chart.points.length, chart.scaleXInverse, getClampedViewBoxX]
  );

  const finalizeSelection = useCallback(
    (event, skipZoom = false) => {
      const origin = selectionOriginRef.current;
      setIsSelecting(false);
      selectionOriginRef.current = null;
      setSelectionBox(null);
      if (event?.currentTarget?.releasePointerCapture) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (err) {
          // Pointer may already be released; ignore errors
        }
      }

      if (skipZoom || origin == null || !chart.scaleXInverse) {
        return;
      }

      const clampedX = event ? getClampedViewBoxX(event) : origin;
      const endX = clampedX ?? origin;
      const startX = origin;
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);

      if (maxX - minX < MIN_SELECTION_WIDTH) {
        return;
      }

      const startTime = chart.scaleXInverse(minX);
      const endTime = chart.scaleXInverse(maxX);

      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        return;
      }

      if (Math.abs(endTime - startTime) < 1000) {
        return;
      }

      setTimeWindow([startTime, endTime]);
    },
    [chart.scaleXInverse, getClampedViewBoxX]
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (!isSelecting) {
        return;
      }
      finalizeSelection(event);
    },
    [finalizeSelection, isSelecting]
  );

  const handlePointerCancel = useCallback(
    (event) => {
      if (!isSelecting) {
        return;
      }
      finalizeSelection(event, true);
    },
    [finalizeSelection, isSelecting]
  );

  const formatAxisTick = useCallback((value) => {
    if (!Number.isFinite(value) || value === 0) {
      return axisCurrencyFormatter.format(0);
    }
    const formatted = axisCurrencyFormatter.format(Math.abs(value));
    return value > 0 ? formatted : `-${formatted}`;
  }, []);

  const handleResetZoom = useCallback(() => {
    setTimeWindow(null);
    setSelectionBox(null);
    setHoverIndex(null);
  }, []);

  const selectionRect =
    selectionBox &&
    Number.isFinite(selectionBox.start) &&
    Number.isFinite(selectionBox.end)
      ? {
          x: Math.min(selectionBox.start, selectionBox.end),
          width: Math.abs(selectionBox.end - selectionBox.start),
        }
      : null;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        Aún no hay registros suficientes para graficar.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Promedio del día
          </p>
          <p className="text-lg font-semibold text-slate-900 dark:text-foreground">
            {formatCurrency(averageValue || 0)}
          </p>
        </div>
        {focusPoint ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {focusPoint.invoiceNumber
                ? `Folio ${focusPoint.invoiceNumber}`
                : "Movimiento"}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-foreground">
              {formatCurrency(Number(focusPoint.total) || 0)}
            </p>
            {previousPoint ? (
              <p
                className={cn(
                  "mt-1 text-[11px] font-medium",
                  deltaValue === 0
                    ? "text-slate-500 dark:text-slate-400"
                    : deltaValue > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                )}
              >
                {deltaValue === 0
                  ? "Sin cambios"
                  : `${deltaValue > 0 ? "+" : "-"}${formatCurrency(
                      Math.abs(deltaValue)
                    )}`}{" "}
                vs anterior
              </p>
            ) : null}
            {focusPoint.branch ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                {focusPoint.branch}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {focusPoint.tooltipLabel}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <p>Arrastra sobre el gráfico para acercar un intervalo específico.</p>
        {chart.hasActiveWindow ? (
          <button
            type="button"
            onClick={handleResetZoom}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold uppercase tracking-[0.22em] text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Restablecer zoom
          </button>
        ) : null}
      </div>

      <div
        className="relative h-64 w-full cursor-crosshair"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleResetZoom}
        role="presentation"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full text-slate-500 [color-scheme:light] dark:text-slate-400"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="daily-billing-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
              <stop offset="65%" stopColor="rgba(59,130,246,0.15)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0)" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick) => {
            const positionRatio =
              (tick - chart.domainMin) /
              (chart.domainMax - chart.domainMin || 1);
            const y = PADDING.top + (1 - positionRatio) * innerHeight;
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={svgWidth - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={tick === 0 ? 1.2 : 0.6}
                  strokeDasharray={tick === 0 ? "" : "4 6"}
                  opacity={tick === 0 ? 0.9 : 0.35}
                />
                <text
                  x={PADDING.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-current text-[11px] font-medium"
                >
                  {formatAxisTick(tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            x2={svgWidth - PADDING.right}
            y1={svgHeight - PADDING.bottom}
            y2={svgHeight - PADDING.bottom}
            stroke="currentColor"
            strokeWidth={0.8}
            opacity={0.4}
          />

          {chart.xTicks.map((tick) => (
            <text
              key={`${tick.label}-${tick.x}`}
              x={tick.x}
              y={svgHeight - PADDING.bottom + 20}
              textAnchor="middle"
              className="fill-current text-[11px] font-medium"
            >
              {tick.label}
            </text>
          ))}

          {chart.areaPath ? (
            <path
              d={chart.areaPath}
              fill="url(#daily-billing-area)"
              stroke="none"
            />
          ) : null}

          {selectionRect ? (
            <rect
              x={selectionRect.x}
              y={PADDING.top}
              width={selectionRect.width}
              height={innerHeight}
              fill="rgba(59,130,246,0.12)"
              stroke="rgba(59,130,246,0.45)"
              strokeDasharray="6 6"
            />
          ) : null}

          {chart.linePath ? (
            <path
              d={chart.linePath}
              fill="none"
              stroke="rgb(59,130,246)"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {chart.points.map((point, index) => {
            const isActive = hoverIndex === index;
            const isLast = index === chart.points.length - 1;
            const radius = isActive ? 5 : isLast ? 4 : 0;
            if (radius === 0) {
              return null;
            }
            return (
              <circle
                key={point.id ?? `${point.timestamp}-${index}`}
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={isActive ? "rgb(59,130,246)" : "white"}
                stroke="rgb(59,130,246)"
                strokeWidth={1.8}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default DailyBillingChart;
