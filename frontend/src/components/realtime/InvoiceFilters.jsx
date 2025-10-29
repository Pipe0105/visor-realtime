import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

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
      "flex flex-col rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/70 overflow-visible",
      className
    )}
  >
    <header className="mb-2">
      <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {" "}
        {title}
      </h4>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
        className="w-full flex justify-between items-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {selectedOption.label}
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && (
        <ul className="absolute z-[9999] mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 animate-fade-in">
          {" "}
          {SORT_OPTIONS.map((option) => (
            <li
              key={option.value}
              onClick={() => {
                onChange({ target: { value: option.value } });
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer px-4 py-2 text-base text-slate-700 hover:bg-primary/10 dark:text-slate-200 dark:hover:bg-slate-800",
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
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex"
      onClick={(e) => {
        // Cierra si hace clic fuera del panel
        if (e.target.id === "filters-overlay") onClose?.();
      }}
    >
      {/* Overlay invisible para capturar clics fuera */}
      <div id="filters-overlay" className="absolute inset-0 bg-transparent" />

      {/* Panel lateral izquierdo */}
      <div
        className={cn(
          "relative h-full w-full max-w-sm transform border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Panel de filtros
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} filtro${
                    activeFiltersCount > 1 ? "s" : ""
                  } activo${activeFiltersCount > 1 ? "s" : ""}`
                : "Sin filtros aplicados"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-110px)] overflow-y-auto p-5 space-y-5">
          <FilterCard title="Buscar folio">
            <input
              type="search"
              value={filters.query}
              onChange={onFilterChange("query")}
              placeholder="Ej. 001-2024"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </FilterCard>

          <FilterCard title="Orden Actual">
            <SortDropdown
              value={filters.sortBy}
              onChange={onFilterChange("sortBy")}
            />
          </FilterCard>

          <FilterCard title="Rango de montos">
            <div className="flex gap-3">
              <input
                type="number"
                value={filters.minTotal}
                onChange={onFilterChange("minTotal")}
                placeholder={totalsRange.min || "0"}
                className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <input
                type="number"
                value={filters.maxTotal}
                onChange={onFilterChange("maxTotal")}
                placeholder={totalsRange.max}
                className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </FilterCard>

          <FilterCard title="Cantidad de ítems">
            <div className="flex gap-3">
              <input
                type="number"
                value={filters.minItems}
                onChange={onFilterChange("minItems")}
                placeholder={itemsRange.min || "0"}
                className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <input
                type="number"
                value={filters.maxItems}
                onChange={onFilterChange("maxItems")}
                placeholder={itemsRange.max}
                className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </FilterCard>
        </div>

        {/* Footer */}
        <footer className="flex justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-800">
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
    </div>,
    document.body
  );
}
