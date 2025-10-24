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
const MIN_WINDOW_MS = MIN_WINDOW_MINUTES * MINUTE_IN_MS;

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

function buildMinuteDataset(messages = []) {
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
  const totalsByMinute = new Map();

  messages.forEach((invoice) => {
    const timestamp =
      parseInvoiceTimestamp(
        invoice?.invoice_date ?? invoice?.timestamp ?? invoice?.created_at
      ) ?? null;
    if (!timestamp) {
      return;
    }

    const minuteTimestamp = new Date(timestamp);
    minuteTimestamp.setSeconds(0, 0);

    if (minuteTimestamp < start || minuteTimestamp > end) {
      return;
    }

    const minuteIndex = Math.floor(
      (minuteTimestamp.getTime() - start.getTime()) / MINUTE_IN_MS
    );

    if (minuteIndex < 0 || minuteIndex > totalMinutes) {
      return;
    }

    const totalValue = toNumber(invoice?.total);

    if (!Number.isFinite(totalValue)) {
      return;
    }

    totalsByMinute.set(
      minuteIndex,
      (totalsByMinute.get(minuteIndex) ?? 0) + totalValue
    );
  });

  const dataset = Array.from(totalsByMinute.entries())
    .sort(([a], [b]) => a - b)
    .map(([minuteIndex, total]) => {
      const timestamp = new Date(start.getTime() + minuteIndex * MINUTE_IN_MS);
      return {
        timestamp,
        minuteIndex,
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
  const { dataset: minuteDataset, domain } = useMemo(
    () => buildMinuteDataset(messages),
    [messages]
  );

  const totalSales = summary?.total ?? 0;
  const totalInvoices = summary?.count ?? 0;
  const hasInvoices = messages.length > 0;

  const [viewDomain, setViewDomain] = useState(domain);
  const [isPanning, setIsPanning] = useState(false);
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

  const fullRangeMs = useMemo(
    () => Math.max(domain.end - domain.start, MIN_WINDOW_MS),
    [domain.end, domain.start]
  );

  const clampDomain = useCallback(
    (start, end) => {
      const desiredWindow = end - start;
      const windowSize = Math.min(
        Math.max(desiredWindow, MIN_WINDOW_MS),
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
    [domain.end, domain.start, fullRangeMs]
  );

  const handleWheel = useCallback(
    (event) => {
      if (!minuteDataset.length) {
        return;
      }

      event.preventDefault();
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
          Math.max(currentWindow * zoomMultiplier, MIN_WINDOW_MS),
          fullRangeMs
        );
        const anchor = previous.start + pointerRatio * currentWindow;
        const nextStart = anchor - pointerRatio * nextWindow;
        const nextEnd = nextStart + nextWindow;
        return clampDomain(nextStart, nextEnd);
      });
    },
    [clampDomain, fullRangeMs, minuteDataset.length]
  );

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
        !minuteDataset.length ||
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
    [minuteDataset.length, viewDomain.end, viewDomain.start]
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
            Evolución minuto a minuto de las facturas recibidas durante la
            jornada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
          <span>Total: {formatCurrency(totalSales)}</span>
          <span>Facturas: {totalInvoices}</span>
        </div>
      </div>

      <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Ventas minuto a minuto
          </CardTitle>
          <CardDescription>
            Acércate con la rueda del ratón y arrastra para desplazarte entre
            las 7:00 a. m. y las 9:00 p. m.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          {hasInvoices ? (
            <div
              ref={containerRef}
              onWheel={handleWheel}
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
                dataset={minuteDataset}
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
                    max: 3_000_000,
                    valueFormatter: (value) => formatCurrency(value ?? 0),
                  },
                ]}
                series={[
                  {
                    id: "minute-sales",
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
