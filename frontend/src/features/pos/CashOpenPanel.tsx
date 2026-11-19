import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDollarSign, Landmark, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { ApiClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCashRegisters, openCashSession } from "@/features/pos/api";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CashRegister } from "@/types/pos";

interface CashOpenPanelProps {
  onOpened: () => void;
}

export function CashOpenPanel({ onOpened }: CashOpenPanelProps) {
  const queryClient = useQueryClient();
  const registersQuery = useQuery({
    queryKey: ["pos", "cash-registers"],
    queryFn: fetchCashRegisters,
  });

  const [selectedUuidState, setSelectedUuid] = React.useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = React.useState("0.00");
  const [formError, setFormError] = React.useState<string | null>(null);

  const registers = registersQuery.data ?? [];
  const available = registers.filter((register) => !register.is_open);

  const selectedUuid = available.some((register) => register.uuid === selectedUuidState)
    ? selectedUuidState
    : available[0]?.uuid ?? null;

  const mutation = useMutation({
    mutationFn: (register: CashRegister) => {
      const selected = registers.find((entry) => entry.uuid === register.uuid);

      if (!selected) {
        throw new Error("Selecciona una caja disponible.");
      }

      return openCashSession(selected.uuid, openingBalance);
    },
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["pos", "cash-session"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "products"] });
      toast.success(`Turno aperturado en ${session.cash_register.name}.`);
      onOpened();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError) {
        setFormError(error.message);
        toast.error(error.message);
        return;
      }

      setFormError("No se pudo aperturar el turno de caja.");
      toast.error("No se pudo aperturar el turno de caja.");
    },
  });

  const selected = registers.find((register) => register.uuid === selectedUuid) ?? null;

  const submit = (): void => {
    setFormError(null);

    if (!selected) {
      setFormError("Selecciona una caja para aperturar el turno.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(openingBalance)) {
      setFormError("El fondo inicial debe tener hasta dos decimales.");
      return;
    }

    mutation.mutate(selected);
  };

  return (
    <section className="rounded-md border bg-card">
      <header className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Landmark className="size-4" strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="text-sm font-medium">Apertura de turno obligatoria</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              El motor POS bloquea la venta hasta que exista una caja abierta para tu usuario.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
        <div className="border-b md:border-r md:border-b-0">
          <div className="border-b px-4 py-2">
            <span className="axis-label">Cajas de la sede</span>
          </div>

          {registersQuery.isLoading ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Consultando cajas...
            </div>
          ) : registersQuery.isError ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No se pudieron consultar las cajas.
            </div>
          ) : registers.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No hay cajas activas en esta empresa.
            </div>
          ) : (
            registers.map((register) => {
              const active = selectedUuid === register.uuid;

              return (
                <button
                  key={register.uuid}
                  type="button"
                  disabled={register.is_open}
                  onClick={() => setSelectedUuid(register.uuid)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-4 py-3 text-left outline-hidden transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60",
                    active && "bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-transparent",
                    )}
                  >
                    <Check className="size-3" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{register.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Warehouse className="size-3" strokeWidth={1.5} />
                      {register.warehouse?.name ?? "Sin almacén"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase",
                      register.is_open
                        ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                        : "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
                    )}
                  >
                    {register.is_open ? "Abierta" : "Disponible"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-4">
          <p className="axis-label">Fondo inicial</p>
          <div className="mt-2 space-y-2">
            <Label htmlFor="opening-balance" className="text-[11px] text-muted-foreground">
              Efectivo entregado al cajero
            </Label>
            <div className="relative">
              <CircleDollarSign
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                id="opening-balance"
                value={openingBalance}
                onChange={(event) => {
                  setOpeningBalance(event.target.value.replace(",", ".").replace(/[^\d.]/g, ""));
                }}
                inputMode="decimal"
                className="pl-8 text-right font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Caja</span>
              <span className="font-medium">{selected?.name ?? "Sin seleccionar"}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Almacén</span>
              <span className="truncate">{selected?.warehouse?.name ?? "--"}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Fondo</span>
              <span className="font-mono tabular-nums">{formatMoney(openingBalance || "0")}</span>
            </div>
          </div>

          {formError ? (
            <p className="mt-3 text-[11px] text-red-600 dark:text-red-400">{formError}</p>
          ) : null}

          <Button
            type="button"
            className="mt-4 w-full"
            size="sm"
            onClick={submit}
            disabled={mutation.isPending || available.length === 0}
          >
            {mutation.isPending ? "Aperturando..." : "Aperturar turno de caja"}
          </Button>

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            La caja determina el almacén del que se descuenta el stock y la serie del comprobante.
          </p>
        </div>
      </div>
    </section>
  );
}
