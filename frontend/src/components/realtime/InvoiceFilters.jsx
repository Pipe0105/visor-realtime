import React, { useEffect, useRef, useState } from "react";

import { Button } from "../button";

const SORT_OPTIONS = [
  {
    value: "recent",
    label: "Recientes",
    helper: "Últimas facturas primero",
  },
  {
    value: "oldest",
    label: "Antiguas",
    helper: "orden cronologico",
  },
  {
    value: "total-desc",
    label: "Total: mayor a menor",
    helper: "Importes mas altos primero",
  },
  {
    value: "total-asc",
    label: "Total: menor a mayor",
    helper: "Importes mas bajos primero",
  },
  {
    value: "items-desc",
    label: "items: mayor cantidad",
    helper: "Facturas con mas items",
  },
  {
    value: "items-asc",
    label: "items: menor cantidad",
    helper: "Facturas con menos items",
  },
];

export default function InvoiceFilters({
  isOpen,
  filters,
  onFilterChange,
  totalsRange,
  itemsRange,
  activeFiltersCount,
  onReset,
  onApply,
}) {
  if (!isOpen) {
    return null;
  }

  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortTriggerRef = useRef(null);
  const sortPanelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        sortTriggerRef.current &&
        !sortTriggerRef.current.contains(event.target) &&
        sortPanelRef.current &&
        !sortPanelRef.current.contains(event.target)
      ) {
        setIsSortOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSortChange = (event) => {
    onFilterChange("sortBy")(event);
    setIsSortOpen(false);
  };

  return (
    <div
      id="invoice-filters"
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/50"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_auto] md:items-start">
          <div className="flex flex-col gap-3">
            <div className="w-full">
              <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Buscar folio
              </label>
              <input
                type="search"
                value={filters.query}
                onChange={onFilterChange("query")}
                placeholder="Ej. 001-2024"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="flex justify-end md:justify-start">
            <div className="relative">
              <button
                ref={sortTriggerRef}
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-inner transition hover:border-primary/60 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-800/70 dark:bg-slate-900/80 dark:text-slate-300"
                aria-expanded={isSortOpen}
                aria-haspopup="listbox"
              >
                <span>Ordenar facturas</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  {SORT_OPTIONS.find(
                    (option) => option.value === filters.sortBy
                  )?.label ?? "Más recientes"}
                </span>
              </button>
              {isSortOpen ? (
                <div
                  ref={sortPanelRef}
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/90"
                  role="listbox"
                >
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {SORT_OPTIONS.map((option) => {
                      const isActive = filters.sortBy === option.value;
                      return (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 transition hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                        >
                          <input
                            type="radio"
                            name="invoice-sort"
                            value={option.value}
                            checked={isActive}
                            onChange={handleSortChange}
                            className="mt-1 h-3.5 w-3.5 border-slate-400 text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {option.label}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {option.helper}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/80">
            <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Total con impuestos (mín / máx)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={filters.minTotal}
                onChange={onFilterChange("minTotal")}
                placeholder={
                  totalsRange.min !== Infinity ? totalsRange.min : "0"
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-xs font-semibold text-slate-400">—</span>
              <input
                type="number"
                value={filters.maxTotal}
                onChange={onFilterChange("maxTotal")}
                placeholder={totalsRange.max}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/80">
            <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Ítems (mín / máx)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={filters.minItems}
                onChange={onFilterChange("minItems")}
                placeholder={itemsRange.min !== Infinity ? itemsRange.min : "0"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-xs font-semibold text-slate-400">—</span>
              <input
                type="number"
                value={filters.maxItems}
                onChange={onFilterChange("maxItems")}
                placeholder={itemsRange.max}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        {" "}
        <p>
          {activeFiltersCount > 0
            ? `${activeFiltersCount} filtro${
                activeFiltersCount > 1 ? "s" : ""
              } activos`
            : "Sin filtros aplicados"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={activeFiltersCount === 0}
            className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 hover:text-primary dark:text-slate-300"
          >
            Limpiar
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            className="text-xs font-semibold uppercase tracking-[0.22em]"
          >
            Aplicar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
