import React from "react";
import { Badge } from "../badge";
import { Button } from "../button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import InvoiceDetails from "./InvoiceDetails";
import InvoiceFilters from "./InvoiceFilters";
import InvoiceList from "./InvoiceList";

export default function RealtimeInvoicesSection({
  activeFiltersCount,
  areFiltersOpen,
  onToggleFilters,
  onCloseFilters,
  invoicesCountLabel,
  filters,
  onFilterChange,
  totalsRange,
  itemsRange,
  onResetFilters,
  onApplyFilters,
  messages,
  filteredMessages,
  paginatedMessages,
  onInvoiceClick,
  selectedInvoice,
  invoiceItems,
  loadingItems,
  selectedInvoiceData,
  selectedInvoiceMeta,
  detailComputedTotal,
  detailItemsCount,
  pageRangeStart,
  pageRangeEnd,
  totalFilteredInvoices,
  totalPages,
  paginationRange,
  currentPage,
  onPageChange,
  formatCurrency,
  availableBranches,
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                Últimas facturas
              </CardTitle>
              <CardDescription>
                Selecciona un folio para revisar sus ítems al instante.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  {`${activeFiltersCount} filtro${
                    activeFiltersCount > 1 ? "s" : ""
                  } activos`}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFilters}
                aria-expanded={areFiltersOpen}
                aria-controls="invoice-filters"
                className="gap-2 rounded-full border border-transparent bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-slate-800/60 dark:text-slate-300"
              >
                <span aria-hidden="true">🔍</span>
                {areFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              </Button>
            </div>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full border-transparent bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
          >
            {invoicesCountLabel}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <InvoiceFilters
            isOpen={areFiltersOpen}
            filters={filters}
            onFilterChange={onFilterChange}
            totalsRange={totalsRange}
            itemsRange={itemsRange}
            activeFiltersCount={activeFiltersCount}
            onReset={onResetFilters}
            onApply={onApplyFilters}
            availableBranches={availableBranches}
          />
          <InvoiceList
            messages={messages}
            filteredMessages={filteredMessages}
            paginatedMessages={paginatedMessages}
            onInvoiceClick={onInvoiceClick}
            selectedInvoice={selectedInvoice}
            pageRangeStart={pageRangeStart}
            pageRangeEnd={pageRangeEnd}
            totalFilteredInvoices={totalFilteredInvoices}
            totalPages={totalPages}
            paginationRange={paginationRange}
            currentPage={currentPage}
            onPageChange={onPageChange}
            formatCurrency={formatCurrency}
          />
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <InvoiceDetails
          selectedInvoiceData={selectedInvoiceData}
          selectedInvoiceMeta={selectedInvoiceMeta}
          invoiceItems={invoiceItems}
          loadingItems={loadingItems}
          detailComputedTotal={detailComputedTotal}
          detailItemsCount={detailItemsCount}
          formatCurrency={formatCurrency}
        />
      </div>
    </section>
  );
}
