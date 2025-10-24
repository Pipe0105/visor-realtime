import React from "react";
import RealtimeHeader from "../components/realtime/RealtimeHeader";
import RealtimeInvoicesSection from "../components/realtime/RealtimeInvoicesSection";
import RealtimeMetrics from "../components/realtime/RealtimeMetrics";
import { useRealtimeInvoices } from "../hooks/useRealtimeInvoices";
import { formatCurrency } from "../lib/invoiceUtils";

function RealtimeView() {
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
  } = useRealtimeInvoices();

  const connectionHealthy = status.includes("🟢");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <RealtimeHeader
        status={status}
        connectionHealthy={connectionHealthy}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <RealtimeMetrics summary={summary} formatCurrency={formatCurrency} />

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
    </div>
  );
}

export default RealtimeView;
