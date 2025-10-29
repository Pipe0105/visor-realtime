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
      "flex flex-col rounded-xl border border-slate-200 bg-white/95 p-5 shadow-lg shadow-slate-900/5 transition dark:border-slate-700 dark:bg-slate-900/75 overflow-visible",
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

const BranchSelect = ({ branches, value, onChange }) => {
  const options = useMemo(() => {
    if (!Array.isArray(branches) || branches.length === 0) {
      return [];
    }
    return branches.map((branch) => ({
      label: branch.toUpperCase(),
      value: branch,
    }));
  }, [branches]);

  const hasBranches = options.length > 0;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Sucursal
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={!hasBranches}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">Todas las sucursales</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-slate-400">
          ▾
        </span>
      </div>
      {!hasBranches ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No hay sucursales detectadas todavía.
        </p>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {options.length === 1
            ? "1 sucursal disponible"
            : `${options.length} sucursales disponibles`}
        </p>
      )}
    </div>
  );
};

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
  availableBranches = [],
}) {
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    []
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 0,
      }),
    []
  );

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

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-200"
      />

      {/* Panel lateral izquierdo */}
      <div
        className={cn(
          "relative z-10 h-full w-full max-w-sm transform border-r border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-950 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-filters-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2
              id="invoice-filters-title"
              className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {" "}
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

          <FilterCard
            title="Sucursal"
            description="Filtra por la tienda que emitió la factura."
          >
            <BranchSelect
              branches={availableBranches}
              value={filters.branch}
              onChange={onFilterChange("branch")}
            />
          </FilterCard>

          <FilterCard title="Orden Actual">
            <SortDropdown
              value={filters.sortBy}
              onChange={onFilterChange("sortBy")}
            />
          </FilterCard>

          <FilterCard
            title="Rango de montos"
            description={`Montos detectados entre ${currencyFormatter.format(
              totalsRange?.min ?? 0
            )} y ${currencyFormatter.format(totalsRange?.max ?? 0)}.`}
          >
            {" "}
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

          <FilterCard
            title="Cantidad de ítems"
            description={`Historial entre ${numberFormatter.format(
              itemsRange?.min ?? 0
            )} y ${numberFormatter.format(itemsRange?.max ?? 0)} ítems.`}
          >
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
        <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={activeFiltersCount === 0}
            className="w-full text-xs font-semibold uppercase tracking-[0.24em] sm:w-auto"
          >
            Limpiar
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            className="w-full text-xs font-semibold uppercase tracking-[0.24em] sm:w-auto"
          >
            Aplicar filtros
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
