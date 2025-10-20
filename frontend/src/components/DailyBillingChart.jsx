import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 28, right: 28, bottom: 44, left: 60 };

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

function formatDeviation(value, formatCurrency) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const absFormatted = formatCurrency(Math.abs(value));
  if (value > 0) {
    return `+${absFormatted}`;
  }
  if (value < 0) {
    return `-${absFormatted}`;
  }
  return formatCurrency(0);
}

function DailyBillingChart({ data, averageValue, formatCurrency }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    setHoverIndex(null);
  }, [data?.length]);

  const chart = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        points: [],
        yTicks: [],
        xTicks: [],
        baselineY: PADDING.top + innerHeight / 2,
        areaPath: "",
        linePath: "",
        domainMin: -1,
        domainMax: 1,
      };
    }

    const timestamps = data.map((item) => item.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = maxTime - minTime;
    const sameTimestamp = timeSpan === 0;
    const timeRange = sameTimestamp ? 1 : timeSpan;

    const deviations = data.map((item) => item.deviation);
    const minDeviation = Math.min(...deviations);
    const maxDeviation = Math.max(...deviations);
    const amplitude = Math.max(Math.abs(minDeviation), Math.abs(maxDeviation));
    const paddedAmplitude = niceCeil((amplitude || 1) * 1.1);
    const domainMin = -paddedAmplitude;
    const domainMax = paddedAmplitude;

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
    const points = data.map((item) => ({
      ...item,
      x: scaleX(item.timestamp),
      y: scaleY(item.deviation),
    }));

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

      const baselineYValue = scaleY(0);
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      areaPath = `${commands} L ${lastPoint.x.toFixed(
        2
      )} ${baselineYValue.toFixed(2)} L ${firstPoint.x.toFixed(
        2
      )} ${baselineYValue.toFixed(2)} Z`;
    }

    const baselineY = scaleY(0);

    const yTicks = [
      -paddedAmplitude,
      -paddedAmplitude / 2,
      0,
      paddedAmplitude / 2,
      paddedAmplitude,
    ];

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
  }, [data]);

  const focusIndex =
    hoverIndex ?? (data && data.length ? data.length - 1 : null);
  const focusPoint = focusIndex != null && data ? data[focusIndex] : null;

  const handlePointerMove = useCallback(
    (event) => {
      if (!chart.points.length || !data?.length) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeX = event.clientX - bounds.left;
      const clampedX = Math.min(
        Math.max(relativeX, PADDING.left),
        PADDING.left + innerWidth
      );
      const ratio =
        innerWidth === 0 ? 0 : (clampedX - PADDING.left) / innerWidth;
      const index = Math.round(ratio * (chart.points.length - 1));
      setHoverIndex(index);
    },
    [chart.points.length, data?.length]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverIndex(null);
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
              {formatCurrency(focusPoint.total)}
            </p>
            <p
              className={cn(
                "text-[11px] font-medium",
                focusPoint.deviation >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              )}
            >
              {formatDeviation(focusPoint.deviation, formatCurrency)} vs
              promedio
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {focusPoint.tooltipLabel}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="relative h-64 w-full cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        role="presentation"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
                  x2={WIDTH - PADDING.right}
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
                  {formatDeviation(tick, formatCurrency)}
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={HEIGHT - PADDING.bottom}
            y2={HEIGHT - PADDING.bottom}
            stroke="currentColor"
            strokeWidth={0.8}
            opacity={0.4}
          />

          {chart.xTicks.map((tick) => (
            <text
              key={`${tick.label}-${tick.x}`}
              x={tick.x}
              y={HEIGHT - PADDING.bottom + 20}
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
