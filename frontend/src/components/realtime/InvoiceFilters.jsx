import React from "react";
import { Button } from "../button";

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

  return (
    <div
      id="invoice-filters"
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/50"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="min-w-[12rem] flex-1">
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
        <div className="flex flex-wrap gap-3">
          <div>
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
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-xs font-semibold text-slate-400">—</span>
              <input
                type="number"
                value={filters.maxTotal}
                onChange={onFilterChange("maxTotal")}
                placeholder={totalsRange.max}
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Ítems (mín / máx)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={filters.minItems}
                onChange={onFilterChange("minItems")}
                placeholder={itemsRange.min !== Infinity ? itemsRange.min : "0"}
                className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-xs font-semibold text-slate-400">—</span>
              <input
                type="number"
                value={filters.maxItems}
                onChange={onFilterChange("maxItems")}
                placeholder={itemsRange.max}
                className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
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
