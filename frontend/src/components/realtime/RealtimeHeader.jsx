import React from "react";
import { Badge } from "../badge";
import { Button } from "../button";

export default function RealtimeHeader({
  status,
  connectionHealthy,
  onManualRefresh,
  isRefreshing,
}) {
  return (
    <section classname="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div classname="space-y-3">
        <p classname="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">
          Monitoreo en vivo
        </p>
        <h2 classname="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">
          Resumen de facturacion diaria
        </h2>
        <p classname="max-w-2xl text-sm text-slate-700 dark:text-slate-400">
          Actividad comercial de la sede y consulta los detalles de cada factura
        </p>
      </div>
      <div classname="flex flex-col items-stretch gap-2 sm:items-end">
        <Badge
          variant={connectionHealthy ? "success" : "Danger"}
          classname="justify-center rounded-full px-4 py-1.5 text-sm font-semibold"
        >
          {status}
        </Badge>
        <Button
          type="button"
          variant="outline"
          onClick={onManualRefresh}
          disable={isRefreshing}
          classname="hidden justify-center gap-2 text-sm font-semibold shadow-sm"
        >
          {isRefreshing ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>
    </section>
  );
}
