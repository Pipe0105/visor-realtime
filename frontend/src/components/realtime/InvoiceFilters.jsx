import React, { useState, useMemo } from "react";
import { Button } from "../button";
import { cn } from "../../lib/utils";

const SORT_OPTIONS = [
  { value: "recent", label: "Recientes" },
  { value: "oldest", label: "Antiguas" },
  { value: "total-desc", label: "Total: mayor a menor" },
  { value: "total-asc", label: "Total: menor a mayor" },
  { value: "items-desc", label: "Items: mayor cantidad" },
  { value: "items-asc", label: "Items: menor cantidad" },
];

const FilterCard = ({ title, description, children, className }) => (
  <section
    className={cn(
      "flex flex-col rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/70 overflow-visible",
      className
    )}
  >
    <header className="mb-2">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {description}
        </p>
      )}
    </header>
    <div className="space-y-2">{children}</div>
  </section>
);

/* --- Dropdown moderno personalizado --- */
const SortDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () =>
      SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0],
    [value]
  );

  return (
    <div className="relative overflow-visible">
      <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Orden actual
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {selectedOption.label}
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && (
        <ul className="absolute z-[9999] mt-2 w-full rounded-md border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 animate-fade-in">
          {SORT_OPTIONS.map((option) => (
            <li
              key={option.value}
              onClick={() => {
                onChange({ target: { value: option.value } });
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-primary/10 dark:text-slate-200 dark:hover:bg-slate-800",
                option.value === value ? "bg-primary/10 font-medium" : ""
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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
  if (!isOpen) return null;

  return (
    <div
      id="invoice-filters"
      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 max-w-3xl mx-auto overflow-visible"
    >
      {/* Header */}
      <header className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Panel de filtros
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <span className="rounded-full bg-slate-200/70 px-3 py-1 font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtro${
                  activeFiltersCount > 1 ? "s" : ""
                } activo${activeFiltersCount > 1 ? "s" : ""}`
              : "Sin filtros aplicados"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={activeFiltersCount === 0}
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Limpiar
            </Button>
            <Button
              size="sm"
              onClick={onApply}
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Aplicar filtros
            </Button>
          </div>
        </div>
      </header>

      {/* Cuerpo de filtros */}
      <div className="mt-6 grid gap-5 sm:grid-cols-1 md:grid-cols-2 overflow-visible relative z-10">
        <FilterCard title="Buscar folio">
          <input
            type="search"
            value={filters.query}
            onChange={onFilterChange("query")}
            placeholder="Ej. 001-2024"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </FilterCard>

        <FilterCard title="Orden Actual">
          <SortDropdown
            value={filters.sortBy}
            onChange={onFilterChange("sortBy")}
          />
        </FilterCard>

        <FilterCard title="Rango de montos">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Mínimo
              </label>
              <input
                type="number"
                value={filters.minTotal}
                onChange={onFilterChange("minTotal")}
                placeholder={totalsRange.min || "0"}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <span className="text-slate-400 font-semibold">—</span>
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Máximo
              </label>
              <input
                type="number"
                value={filters.maxTotal}
                onChange={onFilterChange("maxTotal")}
                placeholder={totalsRange.max}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
        </FilterCard>

        <FilterCard title="Cantidad de ítems">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Mínimo
              </label>
              <input
                type="number"
                value={filters.minItems}
                onChange={onFilterChange("minItems")}
                placeholder={itemsRange.min || "0"}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <span className="text-slate-400 font-semibold">—</span>
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Máximo
              </label>
              <input
                type="number"
                value={filters.maxItems}
                onChange={onFilterChange("maxItems")}
                placeholder={itemsRange.max}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>
        </FilterCard>
      </div>

      {/* Footer */}
      <footer className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-slate-800">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={activeFiltersCount === 0}
          className="text-xs font-semibold uppercase tracking-wide"
        >
          Limpiar
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          className="text-xs font-semibold uppercase tracking-wide"
        >
          Aplicar filtros
        </Button>
      </footer>
    </div>
  );
}
