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

const axisCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  notation: "compact",
});

const innerWidth = WIDTH - PADDING.left - PADDING.right;
const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const exponent = Math.floor(Math.log10(value));
  const factor = Math.pow(10, exponent);
  const normalized = value / factor;

  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

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
      };
    }

    const timestamps = data.map((item) => item.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = maxTime - minTime;
    const sameTimestamp = timeSpan === 0;
    const timeRange = sameTimestamp ? 1 : timeSpan;

    const values = data.map((item) => Number(item.total) || 0);
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
      const ratio = (timestamp - minTime) / timeRange;
      return PADDING.left + ratio * innerWidth;
    };

    const scaleY = (value) => {
      const range = domainMax - domainMin || 1;
      const ratio = (value - domainMin) / range;
      return PADDING.top + (1 - ratio) * innerHeight;
    };
    const points = data.map((item) => {
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

    const tickCount = Math.min(4, points.length);
    const indexSet = new Set();
    if (tickCount > 0) {
      for (let i = 0; i < tickCount; i += 1) {
        const ratio = tickCount === 1 ? 1 : i / (tickCount - 1);
        const index = Math.round(ratio * (points.length - 1));
        indexSet.add(index);
      }
    }

    const xTicks = Array.from(indexSet)
      .sort((a, b) => a - b)
      .map((index) => ({
        x: points[index].x,
        label: data[index].timeLabel,
      }));

    return {
      points,
      linePath,
      areaPath,
      baselineY,
      yTicks,
      xTicks,
      domainMin,
      domainMax,
    };
  }, [data, innerHeight, innerWidth]);

  const focusIndex =
    hoverIndex ?? (data && data.length ? data.length - 1 : null);
  const focusPoint = focusIndex != null && data ? data[focusIndex] : null;
  const previousPoint =
    focusPoint && focusIndex > 0 && data ? data[focusIndex - 1] : null;
  const deltaValue =
    previousPoint && focusPoint
      ? (Number(focusPoint.total) || 0) - (Number(previousPoint.total) || 0)
      : null;

  const handlePointerMove = useCallback(
    (event) => {
      if (!chart.points.length || !data?.length) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0) {
        return;
      }
      const relativeX = event.clientX - bounds.left;
      const viewBoxX = (relativeX / bounds.width) * svgWidth;
      const clampedX = Math.min(
        Math.max(viewBoxX, PADDING.left),
        svgWidth - PADDING.right
      );

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
    [chart.points, data?.length, svgWidth]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);
  const formatAxisTick = useCallback((value) => {
    if (!Number.isFinite(value) || value === 0) {
      return axisCurrencyFormatter.format(0);
    }
    const formatted = axisCurrencyFormatter.format(Math.abs(value));
    return value > 0 ? formatted : `-${formatted}`;
  }, []);

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

      <div
        className="relative h-64 w-full cursor-crosshair"
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
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
