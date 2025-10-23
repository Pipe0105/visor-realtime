import React from "react";
import DailyBillingChart from "../DailyBillingChart";
import DailySalesChart from "../DailySalesChart";
import { Badge } from "../badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";

export default function RealtimeHistorySection({
  billingSeries,
  latestBillingPoint,
  formatCurrency,
  dailySalesSeries,
}) {
  return (
    <section className="space-y-6">
      <Card className="mx-auto w-full max-w-5xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-foreground">
                Evolución diaria
              </CardTitle>
              <CardDescription>
                Visualiza cómo cada factura se desvía del promedio del día.
              </CardDescription>
            </div>
            {latestBillingPoint ? (
              <Badge
                variant="outline"
                className="rounded-full border-transparent bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary"
              >
                Última: {latestBillingPoint.timeLabel}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            La línea central marca el promedio diario; los picos hacia arriba o
            abajo resaltan oscilaciones inmediatas en la facturación.
          </p>
        </CardHeader>
        <CardContent className="mx-auto w-full max-w-5xl">
          <DailyBillingChart
            data={billingSeries.series}
            averageValue={billingSeries.average}
            formatCurrency={formatCurrency}
          />
        </CardContent>
      </Card>
      <div className="mx-auto w-full max-w-5xl">
        <DailySalesChart data={dailySalesSeries} />
      </div>
    </section>
  );
}
