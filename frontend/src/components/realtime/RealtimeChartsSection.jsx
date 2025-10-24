import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarChart } from "@mui/x-charts/BarChart";
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

function buildHourlyDataset(messages) {
  const totals = new Map();

  messages.forEach((invoice) => {
    const timestamp =
      parseInvoiceTimestamp(
        invoice?.invoice_date ?? invoice?.timestamp ?? invoice?.created_at
      ) ?? null;
    if (!timestamp) {
      return;
    }

    const hour = timestamp.getHours();
    const label = `${hour.toString().padStart(2, "0")}:00`;
    const totalValue = toNumber(invoice?.total);

    if (!totals.has(label)) {
      totals.set(label, { hour, total: 0, count: 0 });
    }

    const entry = totals.get(label);
    entry.total += totalValue;
    entry.count += 1;
  });

  return Array.from(totals.values())
    .sort((a, b) => a.hour - b.hour)
    .map((entry, index, array) => {
      const cumulative = array
        .slice(0, index + 1)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        label: `${entry.hour.toString().padStart(2, "0")}:00`,
        total: entry.total,
        count: entry.count,
        cumulative,
        average: entry.count > 0 ? entry.total / entry.count : 0,
      };
    });
}

function buildBranchDataset(messages) {
  const totals = new Map();

  messages.forEach((invoice) => {
    const branch = (invoice?.branch ?? "General").toString();
    const totalValue = toNumber(invoice?.total);

    if (!totals.has(branch)) {
      totals.set(branch, 0);
    }

    totals.set(branch, totals.get(branch) + totalValue);
  });

  return Array.from(totals.entries())
    .map(([branch, total]) => ({ branch, total }))
    .sort((a, b) => b.total - a.total);
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
  const hourlyDataset = useMemo(() => buildHourlyDataset(messages), [messages]);
  const branchDataset = useMemo(() => buildBranchDataset(messages), [messages]);

  const totalHourlyPoints = hourlyDataset.length;
  const [hourlyView, setHourlyView] = useState(() => ({
    start: 0,
    size: totalHourlyPoints > 0 ? totalHourlyPoints : 0,
  }));

  useEffect(() => {
    setHourlyView((previous) => {
      if (totalHourlyPoints === 0) {
        return { start: 0, size: 0 };
      }

      const clampedSize = Math.min(
        Math.max(1, previous.size || totalHourlyPoints),
        totalHourlyPoints
      );
      const maxStart = Math.max(0, totalHourlyPoints - clampedSize);
      const clampedStart = Math.min(previous.start, maxStart);

      if (clampedStart === previous.start && clampedSize === previous.size) {
        return previous;
      }

      return { start: clampedStart, size: clampedSize };
    });
  }, [totalHourlyPoints]);

  const visibleHourlyDataset = useMemo(() => {
    if (totalHourlyPoints === 0) {
      return [];
    }

    const windowStart = Math.min(hourlyView.start, totalHourlyPoints - 1);
    const windowEnd = Math.min(
      totalHourlyPoints,
      windowStart + Math.max(1, hourlyView.size)
    );

    return hourlyDataset.slice(windowStart, windowEnd);
  }, [hourlyDataset, hourlyView, totalHourlyPoints]);

  const totalSales = summary?.total ?? 0;
  const totalInvoices = summary?.count ?? 0;
  const hasHourlyData = hourlyDataset.length > 0;
  const hasBranchData = branchDataset.length > 0;
  const isZoomed = hasHourlyData && hourlyView.size < totalHourlyPoints;

  const hourlyChartRef = useRef(null);
  const hourlyChartWidth = useElementWidth(hourlyChartRef);
  const dragState = useRef({
    active: false,
    startX: 0,
    startWindow: 0,
    pointerId: null,
  });

  const resetHourlyView = useCallback(() => {
    setHourlyView({
      start: 0,
      size: totalHourlyPoints > 0 ? totalHourlyPoints : 0,
    });
  }, [totalHourlyPoints]);

  const handleHourlyWheel = useCallback(
    (event) => {
      if (!hasHourlyData || totalHourlyPoints <= 1) {
        return;
      }

      event.preventDefault();

      const containerRect = hourlyChartRef.current?.getBoundingClientRect();
      const pointerRatio =
        containerRect && containerRect.width > 0
          ? (event.clientX - containerRect.left) / containerRect.width
          : 0.5;

      const safePointerRatio = Number.isFinite(pointerRatio)
        ? Math.min(Math.max(pointerRatio, 0), 1)
        : 0.5;

      const zoomOut = event.deltaY > 0;

      setHourlyView((previous) => {
        const total = totalHourlyPoints;
        if (total <= 1) {
          return previous;
        }

        const minSize = Math.min(Math.max(2, Math.ceil(total * 0.2)), total);
        const maxSize = total;

        let nextSize = Math.round(previous.size * (zoomOut ? 1.15 : 0.85));
        nextSize = Math.max(minSize, Math.min(nextSize, maxSize));

        if (nextSize === previous.size) {
          return previous;
        }

        const anchorIndex =
          previous.start + safePointerRatio * Math.max(previous.size - 1, 1);
        let nextStart = Math.round(
          anchorIndex - safePointerRatio * Math.max(nextSize - 1, 1)
        );

        const maxStart = Math.max(0, total - nextSize);
        if (nextStart < 0) nextStart = 0;
        if (nextStart > maxStart) nextStart = maxStart;

        return {
          start: nextStart,
          size: nextSize,
        };
      });
    },
    [hasHourlyData, totalHourlyPoints]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (totalHourlyPoints <= hourlyView.size) {
        dragState.current = {
          active: false,
          startX: 0,
          startWindow: 0,
          pointerId: null,
        };
        return;
      }

      dragState.current = {
        active: true,
        startX: event.clientX,
        startWindow: hourlyView.start,
        pointerId: event.pointerId,
      };

      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [hourlyView.start, hourlyView.size, totalHourlyPoints]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragState.current.active || hourlyChartWidth <= 0) {
        return;
      }

      event.preventDefault();

      const deltaPixels = event.clientX - dragState.current.startX;

      setHourlyView((previous) => {
        const total = totalHourlyPoints;
        if (total <= previous.size) {
          return previous;
        }

        const itemsPerPixel = previous.size / hourlyChartWidth;
        const deltaItems = deltaPixels * itemsPerPixel;
        let nextStart = dragState.current.startWindow - deltaItems;

        const maxStart = Math.max(0, total - previous.size);
        if (nextStart < 0) nextStart = 0;
        if (nextStart > maxStart) nextStart = maxStart;

        const roundedStart = Math.round(nextStart);

        if (roundedStart === previous.start) {
          return previous;
        }

        return {
          start: roundedStart,
          size: previous.size,
        };
      });
    },
    [hourlyChartWidth, totalHourlyPoints]
  );

  const endDragging = useCallback((event) => {
    if (!dragState.current.active) {
      return;
    }

    if (dragState.current.pointerId != null) {
      event.currentTarget.releasePointerCapture?.(dragState.current.pointerId);
    }

    dragState.current = {
      active: false,
      startX: 0,
      startWindow: 0,
      pointerId: null,
    };
  }, []);

  const visibleWindowRange = useMemo(() => {
    if (visibleHourlyDataset.length === 0) {
      return "Sin datos";
    }

    const startLabel = visibleHourlyDataset[0].label;
    const endLabel =
      visibleHourlyDataset[visibleHourlyDataset.length - 1]?.label ??
      startLabel;

    return `${startLabel} – ${endLabel}`;
  }, [visibleHourlyDataset]);

  const totalByBranch = useMemo(
    () =>
      branchDataset.reduce((sum, entry) => {
        return sum + entry.total;
      }, 0),
    [branchDataset]
  );

  const leadingBranch = useMemo(() => {
    if (!hasBranchData) {
      return null;
    }

    const [top] = branchDataset;
    const percentage =
      totalByBranch > 0 ? (top.total / totalByBranch) * 100 : 0;

    return {
      label: top.branch,
      share: percentage,
    };
  }, [branchDataset, hasBranchData, totalByBranch]);

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
            Evolución del día y distribución por sede basadas en las facturas
            recibidas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
          <span>Total: {formatCurrency(totalSales)}</span>
          <span>Facturas: {totalInvoices}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Ventas por hora
            </CardTitle>
            <CardDescription>
              Muestra el monto total vendido en cada bloque horario del día.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[340px] flex-col gap-4">
            {hasHourlyData ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col">
                    <span className="font-semibold uppercase tracking-[0.18em]">
                      Ventana activa
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {visibleWindowRange}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden md:inline">
                      Usa la rueda del ratón o pellizca para hacer zoom.
                      Arrastra para desplazar.
                    </span>
                    {isZoomed && (
                      <button
                        type="button"
                        onClick={resetHourlyView}
                        className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                      >
                        Reiniciar vista
                      </button>
                    )}
                  </div>
                </div>
                <div
                  ref={hourlyChartRef}
                  onWheel={handleHourlyWheel}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDragging}
                  onPointerLeave={endDragging}
                  onPointerCancel={endDragging}
                  className="relative flex-1 select-none rounded-xl border border-slate-100/80 bg-gradient-to-b from-slate-50/70 via-white/60 to-slate-100/40 p-3 shadow-inner dark:border-slate-800/70 dark:from-slate-900/40 dark:via-slate-900/60 dark:to-slate-900/20"
                >
                  <BarChart
                    dataset={visibleHourlyDataset}
                    height={260}
                    xAxis={[
                      {
                        id: "hour",
                        scaleType: "band",
                        dataKey: "label",
                        label: "Bloque horario",
                        tickLabelPlacement: "middle",
                        tickLabelStyle: {
                          fontSize: 11,
                          fill: "rgb(71 85 105)",
                        },
                        labelStyle: {
                          fontSize: 12,
                          fontWeight: 600,
                          fill: "rgb(30 41 59)",
                        },
                      },
                    ]}
                    yAxis={[
                      {
                        id: "sales",
                        label: "Ventas acumuladas",
                        valueFormatter: (value) => formatCurrency(value ?? 0),
                        tickLabelStyle: {
                          fontSize: 11,
                          fill: "rgb(71 85 105)",
                        },
                        labelStyle: {
                          fontSize: 12,
                          fontWeight: 600,
                          fill: "rgb(30 41 59)",
                        },
                      },
                    ]}
                    series={[
                      {
                        dataKey: "total",
                        label: "Ventas",
                        valueFormatter: (value) => formatCurrency(value ?? 0),
                        color: "#2563eb",
                        highlightScope: {
                          highlighted: "item",
                          faded: "global",
                        },
                      },
                    ]}
                    grid={{ horizontal: true }}
                    axisHighlight={{ x: "band" }}
                    tooltip={{
                      trigger: "item",
                      slotProps: {
                        itemContent: {
                          sx: {
                            fontSize: 12,
                          },
                        },
                      },
                    }}
                    margin={{ top: 16, right: 16, bottom: 36, left: 64 }}
                  />
                  {!isZoomed && totalHourlyPoints > 1 && (
                    <div className="pointer-events-none absolute inset-x-6 bottom-6 flex items-center justify-center text-[11px] font-medium text-slate-500/80 dark:text-slate-400/80">
                      Desplaza con arrastre para enfocar un rango específico
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Aún no hay suficientes facturas para graficar.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Ventas por sede
            </CardTitle>
            <CardDescription>
              Distribución del total vendido según la sede reportada en cada
              factura.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            {hasBranchData ? (
              <div className="relative flex h-full flex-col">
                <div className="absolute inset-0 flex items-center justify-center">
                  {leadingBranch && (
                    <div className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Sede líder
                      </span>
                      <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                        {leadingBranch.label}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {leadingBranch.share.toFixed(1)}% del total
                      </span>
                    </div>
                  )}
                </div>
                <PieChart
                  height={280}
                  series={[
                    {
                      data: branchDataset.map((entry) => ({
                        id: entry.branch,
                        value: entry.total,
                        label: entry.branch,
                      })),
                      valueFormatter: ({ value }) => formatCurrency(value ?? 0),
                      innerRadius: 50,
                      outerRadius: 110,
                      paddingAngle: 2.2,
                      arcLabel: ({ value }) => {
                        if (!totalByBranch) return "";
                        const pct = (value / totalByBranch) * 100;
                        return `${Math.round(pct)}%`;
                      },
                      arcLabelMinAngle: 15,
                      highlightScope: { highlighted: "item", faded: "global" },
                      faded: {
                        additionalRadius: -14,
                        color: "rgba(148, 163, 184, 0.35)",
                      },
                    },
                  ]}
                  slotProps={{
                    legend: {
                      direction: "row",
                      position: { vertical: "bottom", horizontal: "middle" },
                      padding: 8,
                      labelStyle: {
                        fontSize: 12,
                      },
                    },
                  }}
                  tooltip={{
                    trigger: "item",
                    slotProps: {
                      itemContent: {
                        sx: { fontSize: 12 },
                      },
                    },
                  }}
                />
                <div className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                  Pasa el cursor o toca cada porción para conocer el monto
                  exacto.
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No se han reportado sedes en las facturas recibidas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
