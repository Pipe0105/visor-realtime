import React, { useEffect, useMemo, useRef, useState } from "react";

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

const FilterCard = ({ icon, title, description, children }) => (
  <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm transition dark:border-slate-800/70 dark:bg-slate-900/60">
    <header className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
          {title}
        </p>
        {description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {icon ? (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-lg">
          {icon}
        </span>
      ) : null}
    </header>
    <div className="mt-4 space-y-3">{children}</div>
  </section>
);

const SortOption = ({ option, isActive, onChange }) => (
  <label
    key={option.value}
    className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-primary/40 hover:bg-primary/5"
  >
    <input
      type="radio"
      name="invoice-sort"
      value={option.value}
      checked={isActive}
      onChange={onChange}
      className="mt-1 h-3.5 w-3.5 border-slate-400 text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    />
    <span className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {option.label}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {option.helper}
      </span>
    </span>
  </label>
);

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
      className="rounded-2xl border border-slate-200 bg-slate-50/90 px-5 py-5 shadow-sm backdrop-blur-sm transition dark:border-slate-800/60 dark:bg-slate-950/40"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 pb-4 dark:border-slate-800/70">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            Panel de filtros
          </p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Refina la visualización de facturas
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ajusta los criterios para encontrar rápidamente los folios que
            necesitas analizar.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs">
          <span className="rounded-full bg-slate-200/60 px-3 py-1 font-semibold uppercase tracking-[0.24em] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtro${
                  activeFiltersCount > 1 ? "s" : ""
                } activos`
              : "Sin filtros aplicados"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={activeFiltersCount === 0}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 hover:text-primary disabled:opacity-60 dark:text-slate-300"
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
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <FilterCard
            icon="🔎"
            title="Buscar folio"
            description="Introduce un folio o parte de él para filtrar las facturas."
          >
            <input
              type="search"
              value={filters.query}
              onChange={onFilterChange("query")}
              placeholder="Ej. 001-2024"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </FilterCard>

          <FilterCard
            icon="🧮"
            title="Rango de montos"
            description="Limita los resultados por total con impuestos."
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[6.5rem]">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                  Mínimo
                </label>
                <input
                  type="number"
                  value={filters.minTotal}
                  onChange={onFilterChange("minTotal")}
                  placeholder={
                    totalsRange.min !== Infinity ? totalsRange.min : "0"
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <span className="hidden text-xs font-semibold text-slate-400 sm:inline">
                —
              </span>
              <div className="flex-1 min-w-[6.5rem]">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                  Máximo
                </label>
                <input
                  type="number"
                  value={filters.maxTotal}
                  onChange={onFilterChange("maxTotal")}
                  placeholder={totalsRange.max}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
          </FilterCard>

          <FilterCard
            icon="📦"
            title="Cantidad de ítems"
            description="Filtra por facturas con un número específico de ítems."
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[6.5rem]">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                  Mínimo
                </label>
                <input
                  type="number"
                  value={filters.minItems}
                  onChange={onFilterChange("minItems")}
                  placeholder={
                    itemsRange.min !== Infinity ? itemsRange.min : "0"
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <span className="hidden text-xs font-semibold text-slate-400 sm:inline">
                —
              </span>
              <div className="flex-1 min-w-[6.5rem]">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                  Máximo
                </label>
                <input
                  type="number"
                  value={filters.maxItems}
                  onChange={onFilterChange("maxItems")}
                  placeholder={itemsRange.max}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
          </FilterCard>
        </div>

        <FilterCard
          icon="⚖️"
          title="Ordenar resultados"
          description="Elige cómo se priorizan las facturas listadas."
        >
          <div className="space-y-2">
            {SORT_OPTIONS.map((option) => (
              <SortOption
                key={option.value}
                option={option}
                isActive={filters.sortBy === option.value}
                onChange={onFilterChange("sortBy")}
              />
            ))}
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
            Actual:{" "}
            {SORT_OPTIONS.find((option) => option.value === filters.sortBy)
              ?.label ?? "Más recientes"}
          </p>
        </FilterCard>
      </div>
    </div>
  );
}
