import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { ApiClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeCashSession } from "@/features/pos/api";
import { formatMoney, formatSignedMoney } from "@/lib/currency";
import { add, subtract } from "@/lib/decimal";
import type { CashSession } from "@/types/pos";

interface CashCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CashSession;
}

export function CashCloseDialog(props: CashCloseDialogProps) {
  if (!props.open) {
    return null;
  }

  return <CashCloseDialogContent {...props} />;
}

function CashCloseDialogContent({ open, onOpenChange, session }: CashCloseDialogProps) {
  const queryClient = useQueryClient();
  const cashTotal = session.summary?.cash_total ?? "0.00";
  const expected = add(session.opening_balance, cashTotal).toFixed(2);

  const [actual, setActual] = React.useState(expected);
  const [notes, setNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const difference = subtract(actual || "0", expected);

  const mutation = useMutation({
    mutationFn: () => closeCashSession(session.uuid, actual, notes.trim() || undefined),
    onSuccess: (closed) => {
      void queryClient.invalidateQueries({ queryKey: ["pos", "cash-session"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "cash-registers"] });
      toast.success(
        `Turno cerrado. Diferencia ${formatSignedMoney(closed.difference ?? "0")}.`,
      );
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiClientError ? error.message : "No se pudo cerrar el turno de caja.";
      setFormError(message);
      toast.error(message);
    },
  });

  const submit = (): void => {
    setFormError(null);

    if (!/^\d+(\.\d{1,2})?$/.test(actual)) {
      setFormError("El saldo contado debe tener hasta dos decimales.");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <LockKeyhole className="size-4" strokeWidth={1.5} />
            Cierre y arqueo de caja
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {session.cash_register.name} / {session.cash_register.warehouse?.name ?? "Sin almacén"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <div className="rounded-md border">
            <div className="flex justify-between border-b px-3 py-2 text-xs">
              <span className="text-muted-foreground">Fondo inicial</span>
              <span className="font-mono tabular-nums">{formatMoney(session.opening_balance)}</span>
            </div>
            <div className="flex justify-between border-b px-3 py-2 text-xs">
              <span className="text-muted-foreground">Ventas en efectivo</span>
              <span className="font-mono tabular-nums">{formatMoney(cashTotal)}</span>
            </div>
            <div className="flex justify-between px-3 py-2 text-xs font-medium">
              <span>Efectivo esperado</span>
              <span className="font-mono tabular-nums">{formatMoney(expected)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual-closing" className="text-[11px] text-muted-foreground">
              Efectivo contado
            </Label>
            <Input
              id="actual-closing"
              value={actual}
              onChange={(event) => {
                setActual(event.target.value.replace(",", ".").replace(/[^\d.]/g, ""));
              }}
              inputMode="decimal"
              className="font-mono text-right tabular-nums"
            />
            <p
              className={
                difference.isZero()
                  ? "text-[11px] text-muted-foreground"
                  : "text-[11px] text-amber-700 dark:text-amber-400"
              }
            >
              Diferencia: {formatSignedMoney(difference.toFixed(2))}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="closing-notes" className="text-[11px] text-muted-foreground">
              Observaciones
            </Label>
            <Textarea
              id="closing-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              className="min-h-14 text-xs"
              placeholder="Opcional. Explica cualquier diferencia detectada."
            />
          </div>

          {formError ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">{formError}</p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Cerrando..." : "Cerrar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
