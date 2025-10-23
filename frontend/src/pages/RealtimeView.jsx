import React from "react";
import RealtimeHeader from "../components/realtime/RealtimeHeader";
import RealtimeHistorySection from "../components/realtime/RealtimeHistorySection";
import RealtimeInvoicesSection from "../components/realtime/RealtimeInvoicesSection";
import RealtimeMetrics from "../components/realtime/RealtimeMetrics";
import RealtimePanelToggle from "../components/realtime/RealtimePanelToggle";
import { useRealtimeInvoices } from "../hooks/useRealtimeInvoices";
import { formatCurrency } from "../lib/invoiceUtils";

const PANEL_OPTIONS = [
  { id: "facturas", label: "Facturas" },
  { id: "historial", label: "Historial" },
];

function RealtimeView() {
  const {
    status,
    summary,
    billingSeries,
    latestBillingPoint,
    dailySalesSeries,
    isRefreshing,
    handleManualRefresh,
    activePanel,
    setActivePanel,
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
  const isInvoicesView = activePanel === "facturas";
  const viewDescription = isInvoicesView
    ? "Explora las facturas en tiempo real y revisa sus detalles sin salir del panel."
    : "Analiza las variaciones frente al promedio y el comportamiento acumulado de los últimos días.";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <RealtimeHeader
        status={status}
        connectionHealthy={connectionHealthy}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <RealtimeMetrics summary={summary} formatCurrency={formatCurrency} />

      <RealtimePanelToggle
        panelOptions={PANEL_OPTIONS}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        viewDescription={viewDescription}
      />

      {!isInvoicesView ? (
        <RealtimeHistorySection
          billingSeries={billingSeries}
          latestBillingPoint={latestBillingPoint}
          formatCurrency={formatCurrency}
          dailySalesSeries={dailySalesSeries}
        />
      ) : null}

      {isInvoicesView ? (
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
      ) : null}
    </div>
  );
}

export default RealtimeView;
