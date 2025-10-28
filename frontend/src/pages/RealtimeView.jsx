import React, { Suspense, useState, lazy } from "react";

import RealtimeHeader from "../components/realtime/RealtimeHeader";
import RealtimeInvoicesSection from "../components/realtime/RealtimeInvoicesSection";
import RealtimeMetrics from "../components/realtime/RealtimeMetrics";
import { useRealtimeInvoices } from "../hooks/useRealtimeInvoices";
import { formatCurrency } from "../lib/invoiceUtils";
const RealtimeChartsSection = lazy(() =>
  import("../components/realtime/RealtimeChartsSection")
);
import { Button } from "../components/button";

function RealtimeView() {
  const [showCharts, setShowCharts] = useState(false);
  const {
    status,
    summary,
    isRefreshing,
    handleManualRefresh,
    areFiltersOpen,
    setAreFiltersOpen,
    filters,
    handleFilterChange,
    totalsRange,
    itemsRange,
    handleResetFilters,
    handleApplyFilters,
    activeFiltersCount,
    filteredMessages,
    paginatedMessages,
    handleInvoiceClick,
    selectedInvoices,
    selectedInvoiceData,
    detailComputedTotal,
    detailItemsCount,
    invoiceItems,
    loadingItems,
    selectedInvoiceMeta,
    invoicesCountLabel,
    pageRangeStart,
    pageRangeEnd,
    totalFilteredInvoices,
    totalPages,
    paginationRange,
    currentPage,
    setCurrentPage,
    messages,
    allMessages,
    dailySalesHistory,
  } = useRealtimeInvoices();

  const connectionHealthy = status.includes("🟢");

  const handleToggleCharts = (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    setShowCharts((prev) => !prev);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <RealtimeHeader
        status={status}
        connectionHealthy={connectionHealthy}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <RealtimeMetrics summary={summary} formatCurrency={formatCurrency} />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggleCharts}
          aria-expanded={showCharts}
          className="gap-2 rounded-full border border-slate-200/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-300"
        >
          <span aria-hidden="true">{showCharts ? "📄" : "📈"}</span>
          {showCharts ? "Ver facturas" : "Ver gráficas"}
        </Button>
      </div>

      {showCharts ? (
        <Suspense
          fallback={
            <div className="grid gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300">
              Cargando gráficas en tiempo real...
            </div>
          }
        >
          <RealtimeChartsSection
            messages={allMessages}
            summary={summary}
            formatCurrency={formatCurrency}
            dailySalesHistory={dailySalesHistory}
          />
        </Suspense>
      ) : (
        <RealtimeInvoicesSection
          activeFiltersCount={activeFiltersCount}
          areFiltersOpen={areFiltersOpen}
          onToggleFilters={() => setAreFiltersOpen((prev) => !prev)}
          invoicesCountLabel={invoicesCountLabel}
          filters={filters}
          onFilterChange={handleFilterChange}
          totalsRange={totalsRange}
          itemsRange={itemsRange}
          onResetFilters={handleResetFilters}
          onApplyFilters={handleApplyFilters}
          messages={messages}
          filteredMessages={filteredMessages}
          paginatedMessages={paginatedMessages}
          onInvoiceClick={handleInvoiceClick}
          selectedInvoice={selectedInvoices}
          invoiceItems={invoiceItems}
          loadingItems={loadingItems}
          selectedInvoiceData={selectedInvoiceData}
          selectedInvoiceMeta={selectedInvoiceMeta}
          detailComputedTotal={detailComputedTotal}
          detailItemsCount={detailItemsCount}
          pageRangeStart={pageRangeStart}
          pageRangeEnd={pageRangeEnd}
          totalFilteredInvoices={totalFilteredInvoices}
          totalPages={totalPages}
          paginationRange={paginationRange}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

export default RealtimeView;
