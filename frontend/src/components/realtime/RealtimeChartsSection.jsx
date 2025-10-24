import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import {
  formatCurrency as formatCurrencyDefault,
  parseInvoiceTimestamp,
  toNumber,
} from "../../lib/invoiceUtils";

const START_HOUR = 7;
const END_HOUR = 21;
const MINUTE_IN_MS = 60 * 1000;
const MIN_WINDOW_MINUTES = 5;
const AGGREGATION_OPTIONS = [
  { value: 1, label: "1 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
];

function getReferenceDate(messages = []) {
  for (const invoice of messages) {
    const timestamp =
      parseInvoiceTimestamp(
        invoice?.invoice_date ?? invoice?.timestamp ?? invoice?.created_at
      ) ?? null;
    if (timestamp) {
      return timestamp;
    }
  }
  return new Date();
}

function buildIntervalDataset(messages = [], intervalMinutes = 1) {
  const referenceDate = getReferenceDate(messages);
  const start = new Date(referenceDate);
  start.setHours(START_HOUR, 0, 0, 0);
  const end = new Date(referenceDate);
  end.setHours(END_HOUR, 0, 0, 0);

  if (end <= start) {
    end.setTime(start.getTime() + 14 * 60 * MINUTE_IN_MS);
  }

  const totalMinutes = Math.round(
    (end.getTime() - start.getTime()) / MINUTE_IN_MS
  );
  const intervalMs = Math.max(1, intervalMinutes) * MINUTE_IN_MS;
  const totalsByInterval = new Map();

  messages.forEach((invoice) => {
    const timestamp =
      parseInvoiceTimestamp(
        invoice?.invoice_date ?? invoice?.timestamp ?? invoice?.created_at
      ) ?? null;
    if (!timestamp) {
      return;
    }

    const normalizedTimestamp = new Date(timestamp);
    normalizedTimestamp.setSeconds(0, 0);

    if (normalizedTimestamp < start || normalizedTimestamp > end) {
      return;
    }

    const intervalIndex = Math.floor(
      (normalizedTimestamp.getTime() - start.getTime()) / intervalMs
    );

    if (intervalIndex < 0 || intervalIndex > totalMinutes) {
      return;
    }

    const totalValue = toNumber(invoice?.total);

    if (!Number.isFinite(totalValue)) {
      return;
    }

    totalsByInterval.set(
      intervalIndex,
      (totalsByInterval.get(intervalIndex) ?? 0) + totalValue
    );
  });

  const dataset = Array.from(totalsByInterval.entries())
    .sort(([a], [b]) => a - b)
    .map(([intervalIndex, total]) => {
      const timestamp = new Date(start.getTime() + intervalIndex * intervalMs);
      return {
        timestamp,
        intervalIndex,
        label: timestamp.toISOString(),
        total,
      };
    });

  return {
    dataset,
    domain: {
      start: start.getTime(),
      end: end.getTime(),
    },
  };
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return () => {};
    }

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect()?.width ?? 0;
      setWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return () => {};
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width: observedWidth } = entries[0].contentRect;
      setWidth(observedWidth);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return width;
}

export default function RealtimeChartsSection({
  messages = [],
  summary = null,
  formatCurrency = formatCurrencyDefault,
}) {
  const [aggregationMinutes, setAggregationMinutes] = useState(1);

  const { dataset: salesDataset, domain } = useMemo(
    () => buildIntervalDataset(messages, aggregationMinutes),
    [messages, aggregationMinutes]
  );

  const totalSales = summary?.total ?? 0;
  const totalInvoices = summary?.count ?? 0;
  const hasInvoices = messages.length > 0;

  const [viewDomain, setViewDomain] = useState(domain);
  const [isPanning, setIsPanning] = useState(false);

  const maxIntervalTotal = useMemo(
    () =>
      salesDataset.reduce(
        (maxValue, entry) => Math.max(maxValue, entry?.total ?? 0),
        0
      ),
    [salesDataset]
  );
  const yAxisMax = useMemo(() => {
    if (!Number.isFinite(maxIntervalTotal) || maxIntervalTotal <= 0) {
      return 1_000_000;
    }

    const paddedMax = maxIntervalTotal * 1.1;
    const magnitude = 10 ** Math.floor(Math.log10(paddedMax));
    const roundedMax = Math.ceil(paddedMax / magnitude) * magnitude;

    return Math.max(roundedMax, 1_000_000);
  }, [maxIntervalTotal]);
  const containerRef = useRef(null);
  const panStateRef = useRef({
    isPanning: false,
    pointerId: null,
    startX: 0,
    initialStart: domain.start,
    initialEnd: domain.end,
  });

  useEffect(() => {
    setViewDomain(domain);
    panStateRef.current = {
      isPanning: false,
      pointerId: null,
      startX: 0,
      initialStart: domain.start,
      initialEnd: domain.end,
    };
    setIsPanning(false);
  }, [domain.start, domain.end]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const minWindowMs = useMemo(
    () => Math.max(MIN_WINDOW_MINUTES, aggregationMinutes) * MINUTE_IN_MS,
    [aggregationMinutes]
  );

  const fullRangeMs = useMemo(
    () => Math.max(domain.end - domain.start, minWindowMs),
    [domain.end, domain.start, minWindowMs]
  );

  const clampDomain = useCallback(
    (start, end) => {
      const desiredWindow = end - start;
      const windowSize = Math.min(
        Math.max(desiredWindow, minWindowMs),
        fullRangeMs
      );
      let nextStart = start;
      let nextEnd = start + windowSize;

      if (nextStart < domain.start) {
        nextStart = domain.start;
        nextEnd = nextStart + windowSize;
      }

      if (nextEnd > domain.end) {
        nextEnd = domain.end;
        nextStart = nextEnd - windowSize;
      }

      if (nextStart < domain.start) {
        nextStart = domain.start;
        nextEnd = domain.end;
      }

      if (nextEnd > domain.end) {
        nextStart = domain.end - windowSize;
        nextEnd = domain.end;
      }

      return {
        start: Math.max(domain.start, nextStart),
        end: Math.min(domain.end, nextEnd),
      };
    },
    [domain.end, domain.start, fullRangeMs, minWindowMs]
  );

  const handleWheel = useCallback(
    (event) => {
      if (!salesDataset.length) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation?.();
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointerRatio = rect.width
        ? Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
        : 0.5;

      setViewDomain((previous) => {
        const currentWindow = previous.end - previous.start;
        const direction = event.deltaY > 0 ? 1 : -1;
        const zoomMultiplier = direction > 0 ? 1.2 : 0.8;
        const nextWindow = Math.min(
          Math.max(currentWindow * zoomMultiplier, minWindowMs),

          fullRangeMs
        );
        const anchor = previous.start + pointerRatio * currentWindow;
        const nextStart = anchor - pointerRatio * nextWindow;
        const nextEnd = nextStart + nextWindow;
        return clampDomain(nextStart, nextEnd);
      });
    },
    [clampDomain, fullRangeMs, minWindowMs, salesDataset.length]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return () => {};
    }

    const wheelListener = (event) => {
      handleWheel(event);
    };

    container.addEventListener("wheel", wheelListener, { passive: false });

    return () => {
      container.removeEventListener("wheel", wheelListener);
    };
  }, [handleWheel]);

  const endPan = useCallback(() => {
    const container = containerRef.current;
    const { pointerId } = panStateRef.current;

    if (container && pointerId !== null) {
      try {
        container.releasePointerCapture(pointerId);
      } catch (error) {
        // Ignore release errors when the pointer has already been released.
      }
    }

    panStateRef.current = {
      isPanning: false,
      pointerId: null,
      startX: 0,
      initialStart: viewDomain.start,
      initialEnd: viewDomain.end,
    };
    setIsPanning(false);
  }, [viewDomain.end, viewDomain.start]);

  const handlePointerDown = useCallback(
    (event) => {
      if (
        !salesDataset.length ||
        (event.button !== undefined && event.button !== 0)
      ) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();
      container.setPointerCapture?.(event.pointerId);
      panStateRef.current = {
        isPanning: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        initialStart: viewDomain.start,
        initialEnd: viewDomain.end,
      };
      setIsPanning(true);
    },
    [salesDataset.length, viewDomain.end, viewDomain.start]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!panStateRef.current.isPanning) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (!rect.width) {
        return;
      }

      event.preventDefault();
      const deltaPixels = event.clientX - panStateRef.current.startX;
      const ratio = deltaPixels / rect.width;
      const windowSize =
        panStateRef.current.initialEnd - panStateRef.current.initialStart;
      const nextStart = panStateRef.current.initialStart - ratio * windowSize;
      const nextEnd = nextStart + windowSize;
      setViewDomain(clampDomain(nextStart, nextEnd));
    },
    [clampDomain]
  );

  const handlePointerUp = useCallback(() => {
    if (!panStateRef.current.isPanning) {
      return;
    }
    endPan();
  }, [endPan]);

  useEffect(() => {
    setViewDomain((previous) => clampDomain(previous.start, previous.end));
  }, [clampDomain]);

  return (
    <section
      className="grid gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60"
      aria-label="Gráficas de ventas"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-foreground">
            Panorama de ventas
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300/80">
            Evolución de las facturas recibidas durante la jornada según el
            intervalo seleccionado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
          <span>Total: {formatCurrency(totalSales)}</span>
          <span>Facturas: {totalInvoices}</span>
        </div>
      </div>

      <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div>
              <CardTitle className="text-base font-semibold">
                Ventas por intervalo de tiempo
              </CardTitle>
              <CardDescription>
                Acércate con la rueda del ratón y arrastra para desplazarte
                entre las 7:00 a. m. y las 9:00 p. m.
              </CardDescription>
            </div>
            <label
              className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              htmlFor="aggregation-interval"
            >
              Intervalo de agrupación
              <select
                id="aggregation-interval"
                value={aggregationMinutes}
                onChange={(event) =>
                  setAggregationMinutes(Number.parseInt(event.target.value, 10))
                }
                className="w-full min-w-[120px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-500/40"
              >
                {AGGREGATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="h-[360px]">
          {hasInvoices ? (
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative h-full w-full select-none rounded-lg border border-slate-200/60 bg-white/80 p-2 transition dark:border-slate-800/60 dark:bg-slate-950/50 ${
                isPanning ? "cursor-grabbing" : "cursor-crosshair"
              }`}
            >
              <LineChart
                dataset={salesDataset}
                height={320}
                xAxis={[
                  {
                    dataKey: "timestamp",
                    scaleType: "time",
                    valueFormatter: (value) => timeFormatter.format(value),
                    min: new Date(viewDomain.start),
                    max: new Date(viewDomain.end),
                    tickNumber: 8,
                  },
                ]}
                yAxis={[
                  {
                    min: 0,
                    max: yAxisMax,
                    valueFormatter: (value) => formatCurrency(value ?? 0),
                  },
                ]}
                series={[
                  {
                    id: "aggregated-sales",

                    dataKey: "total",
                    label: "Total vendido",
                    showMark: true,
                    valueFormatter: (value) => formatCurrency(value ?? 0),
                    curve: "monotoneX",
                  },
                ]}
                margin={{ top: 16, right: 24, bottom: 32, left: 72 }}
                grid={{ vertical: true, horizontal: true }}
                axisHighlight={{ x: "line", y: "line" }}
                tooltip={{ trigger: "axis" }}
                slotProps={{ legend: { hidden: true } }}
              />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 hidden text-xs text-slate-500 md:block dark:text-slate-400"></div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200/60 bg-slate-50 text-sm text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-400">
              Aún no hay facturas registradas en este rango horario.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
