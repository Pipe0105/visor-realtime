import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import { formatCurrency as formatCurrencyDefault } from "../../lib/invoiceUtils";

export default function InvoiceDetails({
  selectedInvoiceData,
  selectedInvoiceMeta,
  invoiceItems,
  loadingItems,
  detailComputedTotal,
  detailItemsCount,
  formatCurrency,
}) {
  const currencyFormatter = formatCurrency ?? formatCurrencyDefault;

  return (
    <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:overflow-hidden">
      <CardHeader className="space-y-2 pb-5">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
          {selectedInvoiceData
            ? `Factura #${selectedInvoiceData.invoice_number}`
            : "Detalle de factura"}
        </CardTitle>
        <CardDescription>
          {selectedInvoiceData
            ? selectedInvoiceMeta
            : "Selecciona una factura de la lista para explorar sus ítems sin salir de la vista principal."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 lg:flex-1 lg:overflow-y-auto">
        {selectedInvoiceData ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                  Total
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                  {currencyFormatter(detailComputedTotal)}
                </span>
              </div>
              <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                  Ítems
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                  {detailItemsCount}
                </span>
              </div>
              <div className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                <span className="block text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-500">
                  Folio
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-foreground">
                  #{selectedInvoiceData.invoice_number}
                </span>
              </div>
            </div>
            {loadingItems ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                Cargando ítems…
              </div>
            ) : invoiceItems.length > 0 ? (
              <div className="space-y-4">
                <div className="hidden grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 sm:grid">
                  <span className="sm:col-span-6">Producto</span>
                  <span className="text-right sm:col-span-2">Cant.</span>
                  <span className="text-right sm:col-span-2">Unitario</span>
                  <span className="text-right sm:col-span-2">Subtotal</span>
                </div>
                <div className="space-y-2">
                  {invoiceItems.map((item, idx) => (
                    <div
                      key={`${item.description}-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-colors dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-12"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-100 sm:col-span-6">
                        {item.description}
                      </span>
                      <span className="flex items-center justify-between text-slate-600 dark:text-slate-400 sm:col-span-2 sm:justify-end">
                        <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                          Cant.
                        </span>
                        <span>{item.quantity.toFixed(2)}</span>
                      </span>
                      <span className="flex items-center justify-between text-slate-600 dark:text-slate-400 sm:col-span-2 sm:justify-end">
                        <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                          Unitario
                        </span>
                        <span>{currencyFormatter(item.unit_price)}</span>
                      </span>
                      <span className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 sm:col-span-2 sm:justify-end">
                        <span className="text-xs uppercase tracking-wide text-slate-500 sm:hidden">
                          Subtotal
                        </span>
                        <span>{currencyFormatter(item.subtotal)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                Sin ítems para mostrar
              </div>
            )}
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <span className="text-3xl" aria-hidden="true">
              🧾
            </span>
            <p className="text-sm font-medium">
              Selecciona una factura para ver sus ítems.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Mantén la vista principal mientras exploras el detalle de cada
              documento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
