import React from "react";
import { Button, buttonVariants } from "../button";
import { cn } from "../../lib/utils";
import {
  formatCurrency as formatCurrencyDefault,
  parseInvoiceTimestamp,
} from "../../lib/invoiceUtils";

export default function InvoiceList({
  messages,
  filteredMessages,
  paginatedMessages,
  onInvoiceClick,
  selectedInvoice,
  pageRangeStart,
  pageRangeEnd,
  totalFilteredInvoices,
  totalPages,
  paginationRange,
  currentPage,
  onPageChange,
  formatCurrency,
}) {
  const currencyFormatter = formatCurrency ?? formatCurrencyDefault;

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <span className="text-4xl" aria-hidden="true">
          🕓
        </span>
        <p className="text-sm font-medium">
          Aún no hay facturas registradas hoy.
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          En cuanto llegue la primera, aparecerá automáticamente en esta lista.
        </p>
      </div>
    );
  }

  if (filteredMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span className="text-4xl" aria-hidden="true">
          🔍
        </span>
        <p className="text-sm font-medium">
          No encontramos facturas con los filtros seleccionados.
        </p>
        <p className="text-xs">
          Ajusta los criterios para explorar otros resultados.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {paginatedMessages.map((msg, i) => {
          const isSelected = selectedInvoice === msg.invoice_number;
          const parsedInvoiceDate = parseInvoiceTimestamp(
            msg.invoice_date ?? msg.timestamp ?? msg.created_at
          );
          const invoiceDate = parsedInvoiceDate
            ? parsedInvoiceDate.toLocaleString("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "";

          return (
            <li key={`${msg.invoice_number}-${i}`}>
              <button
                type="button"
                onClick={() => onInvoiceClick(msg.invoice_number)}
                aria-pressed={isSelected}
                className={cn(
                  "group w-full rounded-xl border border-transparent bg-white px-4 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-slate-900/60",
                  {
                    "border-primary/50 bg-primary/5 shadow-md dark:border-primary/60 dark:bg-primary/10":
                      isSelected,
                  }
                )}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[7rem]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                      Factura
                    </p>
                    <p className="text-base font-semibold text-slate-900 dark:text-foreground">
                      #{msg.invoice_number}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                      Total
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {currencyFormatter(msg.total)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary/60"
                      aria-hidden="true"
                    />
                    {msg.items ?? 0} ítems
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary/60"
                      aria-hidden="true"
                    />
                    {(msg.branch || "FLO").toUpperCase()}
                  </span>
                  {invoiceDate ? <span>{invoiceDate}</span> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        <p>
          {totalFilteredInvoices === 0
            ? "Sin facturas para mostrar"
            : `Mostrando ${
                pageRangeStart === pageRangeEnd
                  ? pageRangeStart
                  : `${pageRangeStart}-${pageRangeEnd}`
              } de ${totalFilteredInvoices} factura${
                totalFilteredInvoices === 1 ? "" : "s"
              }`}
        </p>
        {totalPages > 1 ? (
          <div
            className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
            role="navigation"
            aria-label="Paginación de facturas"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="h-9 gap-1 px-3"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            {paginationRange.map((pageNumber) => (
              <button
                key={`page-${pageNumber}`}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={buttonVariants({
                  variant: pageNumber === currentPage ? "default" : "outline",
                  size: "sm",
                  className: cn(
                    "h-9 w-9 px-0",
                    pageNumber === currentPage
                      ? "shadow-sm"
                      : "bg-background dark:bg-slate-900"
                  ),
                })}
                aria-current={pageNumber === currentPage ? "page" : undefined}
                aria-label={`Ir a la página ${pageNumber}`}
              >
                {pageNumber}
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onPageChange(Math.min(currentPage + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="h-9 gap-1 px-3"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <span aria-hidden="true">→</span>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
