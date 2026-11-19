import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Plus,
  Trash2,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ApiClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSale, DOCUMENT_TYPE_LABELS } from "@/features/pos/api";
import { calculateCart } from "@/features/pos/calculations";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { formatMoney } from "@/lib/currency";
import { decimal, isZero, subtract } from "@/lib/decimal";
import { playSound } from "@/lib/sound";
import { useAuthStore } from "@/stores/authStore";
import { usePosStore } from "@/stores/posStore";
import { cn } from "@/lib/utils";
import type {
  CreateSalePayload,
  PaymentDraft,
  PaymentMethod,
  SaleCreationResult,
} from "@/types/pos";

interface CheckoutModalProps {
  open: boolean;
  warehouseUuid?: string;
  onOpenChange: (open: boolean) => void;
  onCompleted: (result: SaleCreationResult) => void;
}

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "YAPE", label: "Yape", icon: Smartphone },
  { value: "PLIN", label: "Plin", icon: Smartphone },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "TRANSFER", label: "Transferencia", icon: Wallet },
];

function requiresReference(method: PaymentMethod): boolean {
  return method !== "CASH";
}

function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((entry) => entry.value === method)?.label ?? method;
}

function createPaymentDraft(method: PaymentMethod, amount: string): PaymentDraft {
  return {
    id: crypto.randomUUID(),
    method,
    amount,
    referenceNumber: "",
  };
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");

  if (!/\d/.test(whole + fractionParts.join(""))) {
    return "";
  }

  const normalizedWhole = whole === "" ? "0" : whole;

  if (fractionParts.length === 0) {
    return normalizedWhole;
  }

  return `${normalizedWhole}.${fractionParts.join("").slice(0, 2)}`;
}

export function CheckoutModal(props: CheckoutModalProps) {
  const lines = usePosStore((state) => state.lines);

  if (!props.open) {
    return null;
  }

  return <CheckoutModalContent key={calculateCart(lines).total} {...props} />;
}

function CheckoutModalContent({ open, warehouseUuid, onOpenChange, onCompleted }: CheckoutModalProps) {
  const queryClient = useQueryClient();
  const company = useAuthStore((state) => state.company);
  const lines = usePosStore((state) => state.lines);
  const customer = usePosStore((state) => state.customer);
  const documentType = usePosStore((state) => state.documentType);
  const completeSale = usePosStore((state) => state.completeSale);

  const totals = React.useMemo(() => calculateCart(lines), [lines]);
  const total = totals.total;

  const [payments, setPayments] = React.useState<PaymentDraft[]>([]);
  const [draftMethod, setDraftMethod] = React.useState<PaymentMethod>("CASH");
  const [draftAmount, setDraftAmount] = React.useState("");
  const [receivedCash, setReceivedCash] = React.useState<string>(total);
  const [draftReference, setDraftReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showNotes, setShowNotes] = React.useState(false);
  const [copiedPhone, setCopiedPhone] = React.useState<PaymentMethod | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());

  const paid = React.useMemo(
    () =>
      payments.reduce(
        (accumulator, payment) =>
          AMOUNT_PATTERN.test(payment.amount)
            ? accumulator.plus(payment.amount)
            : accumulator,
        decimal(0),
      ),
    [payments],
  );
  const remaining = React.useMemo(() => subtract(total, paid), [paid, total]);
  const remainingIsZero = isZero(remaining);
  const remainingIsNegative = remaining.isNegative();
  const cashAmount = React.useMemo(
    () =>
      payments
        .filter((payment) => payment.method === "CASH" && AMOUNT_PATTERN.test(payment.amount))
        .reduce((amount, payment) => amount.plus(payment.amount), decimal(0)),
    [payments],
  );
  const hasCashPayment = payments.some((payment) => payment.method === "CASH");

  // Smart suggestions for common Peruvian Banknotes
  const billSuggestions = React.useMemo(() => {
    const totalNum = parseFloat(total) || 0;
    if (totalNum <= 0) return [];

    const suggestions: number[] = [totalNum]; // Exact cash
    const commonBills = [10, 20, 50, 100, 200];

    // Find next rounded amounts
    if (totalNum % 10 !== 0) {
      const next10 = Math.ceil(totalNum / 10) * 10;
      if (!suggestions.includes(next10)) suggestions.push(next10);
    }
    if (totalNum % 50 !== 0 && totalNum < 50) {
      if (!suggestions.includes(50)) suggestions.push(50);
    }
    if (totalNum % 100 !== 0 && totalNum < 100) {
      if (!suggestions.includes(100)) suggestions.push(100);
    }

    commonBills.forEach((bill) => {
      if (bill > totalNum && !suggestions.includes(bill) && suggestions.length < 5) {
        suggestions.push(bill);
      }
    });

    return suggestions.sort((a, b) => a - b);
  }, [total]);

  // Calculate change (vuelto)
  const changeAmount = React.useMemo(() => {
    if (!hasCashPayment) return "0.00";
    const rec = parseFloat(receivedCash) || 0;
    const cash = parseFloat(cashAmount.toFixed(2)) || 0;
    const diff = rec - cash;
    return diff > 0 ? diff.toFixed(2) : "0.00";
  }, [cashAmount, hasCashPayment, receivedCash]);

  const invoiceRequiresRuc =
    documentType === "01" &&
    (customer === null ||
      customer.identity_document_type !== "6" ||
      !/^\d{11}$/.test(customer.document_number));

  const receiptRequiresIdentity =
    documentType === "03" &&
    decimal(total).greaterThan(700) &&
    (customer === null ||
      !["1", "6"].includes(customer.identity_document_type) ||
      customer.document_number === "00000000");

  const mutation = useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateSalePayload;
      idempotencyKey: string;
    }) => createSale(payload, idempotencyKey),
    onSuccess: (result) => {
      playSound("success");
      completeSale(result.sale, result.ticket);
      void queryClient.invalidateQueries({ queryKey: ["pos", "cash-session"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "products"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "sales"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "recent-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "summary"] });
      toast.success(`${DOCUMENT_TYPE_LABELS[documentType]} emitida exitosamente.`);
      onCompleted(result);
      onOpenChange(false);
    },
    onError: (error) => {
      idempotencyKeyRef.current = crypto.randomUUID();
      if (error instanceof ApiClientError) {
        setFormError(error.message);
        return;
      }
      setFormError("Ocurrió un error inesperado al procesar la venta.");
    },
  });

  const handleSelectMethod = (method: PaymentMethod) => {
    setDraftMethod(method);
    playSound("click");
    setDraftReference("");
  };

  const handleSelectBill = (amount: number) => {
    playSound("click");
    const amountStr = amount.toFixed(2);
    setReceivedCash(amountStr);
  };

  const addPayment = (): void => {
    const rawAmount =
      draftAmount.trim() === ""
        ? remaining.isNegative()
          ? "0"
          : remaining.toFixed(2)
        : draftAmount;

    if (!AMOUNT_PATTERN.test(rawAmount) || !decimal(rawAmount).isPositive()) {
      setFormError("El importe del pago debe ser mayor a cero y tener hasta dos decimales.");
      return;
    }

    if (payments.length >= 10) {
      setFormError("Una venta admite hasta 10 medios de pago.");
      return;
    }

    if (requiresReference(draftMethod) && draftReference.trim() === "") {
      setFormError(`El pago con ${paymentMethodLabel(draftMethod)} requiere número de operación.`);
      return;
    }

    const amount = decimal(rawAmount).toFixed(2);
    if (paid.plus(amount).greaterThan(total)) {
      setFormError("El importe agregado supera el saldo pendiente de la venta.");
      return;
    }

    const payment = createPaymentDraft(draftMethod, amount);
    payment.referenceNumber = draftReference.trim();
    setPayments((current) => [...current, payment]);
    const nextRemaining = subtract(total, paid.plus(amount));
    setDraftMethod("CASH");
    setDraftAmount(nextRemaining.isPositive() ? nextRemaining.toFixed(2) : "");
    setDraftReference("");
    setFormError(null);
  };

  const updatePayment = (id: string, patch: Partial<PaymentDraft>): void => {
    setPayments((current) =>
      current.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)),
    );
  };

  const removePayment = (id: string): void => {
    setPayments((current) => current.filter((payment) => payment.id !== id));
  };

  const fillExactCash = (): void => {
    setPayments(total === "0.00" ? [] : [createPaymentDraft("CASH", total)]);
    setDraftMethod("CASH");
    setDraftAmount("");
    setDraftReference("");
    setReceivedCash(total);
    setFormError(null);
  };

  const handleCopyPhone = async (phone: string, method: PaymentMethod): Promise<void> => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(method);
      toast.success(`Número de ${paymentMethodLabel(method)} copiado`);
      setTimeout(() => setCopiedPhone(null), 2000);
    } catch {
      toast.error("No se pudo copiar el número de pago.");
    }
  };

  const mobilePaymentMethods = Array.from(new Set([
    ...payments.map((payment) => payment.method),
    draftMethod,
  ])).filter((method): method is "YAPE" | "PLIN" => method === "YAPE" || method === "PLIN");

  const submit = (): void => {
    if (mutation.isPending) {
      return;
    }

    setFormError(null);

    if (lines.length === 0) {
      setFormError("Agrega al menos un producto al carrito.");
      return;
    }

    if (invoiceRequiresRuc) {
      setFormError("La factura requiere cliente con RUC válido de 11 dígitos.");
      return;
    }

    if (receiptRequiresIdentity) {
      setFormError("Las boletas superiores a S/ 700.00 requieren identificar al cliente con DNI o RUC.");
      return;
    }

    if (payments.length === 0) {
      setFormError("Registra al menos un medio de pago.");
      return;
    }

    for (const payment of payments) {
      if (!AMOUNT_PATTERN.test(payment.amount) || !decimal(payment.amount).isPositive()) {
        setFormError("Cada pago debe ser mayor a cero y tener hasta dos decimales.");
        return;
      }

      if (requiresReference(payment.method) && payment.referenceNumber.trim() === "") {
        setFormError(`El pago con ${paymentMethodLabel(payment.method)} requiere número de operación.`);
        return;
      }
    }

    if (!remainingIsZero) {
      setFormError(
        remainingIsNegative
          ? "La suma de los pagos supera el total del comprobante."
          : "La suma de los pagos debe ser exactamente igual al total.",
      );
      return;
    }

    const singleCashPayment = payments.length === 1 && payments[0]?.method === "CASH";
    if (
      singleCashPayment &&
      (!AMOUNT_PATTERN.test(receivedCash) || decimal(receivedCash).lessThan(cashAmount))
    ) {
      setFormError("El monto recibido en efectivo no puede ser menor al total.");
      return;
    }

    let finalNotes = notes.trim();
    if (singleCashPayment && parseFloat(changeAmount) > 0) {
      const changeNote = `Pagó con S/ ${parseFloat(receivedCash).toFixed(2)} | Vuelto S/ ${changeAmount}`;
      finalNotes = finalNotes ? `${finalNotes} - ${changeNote}` : changeNote;
    }

    const payload: CreateSalePayload = {
      document_type: documentType,
      warehouse_uuid: warehouseUuid,
      customer_uuid: customer?.uuid,
      items: lines.map((line) => ({
        product_uuid: line.product.uuid,
        quantity: line.quantity || "1",
      })),
      payments: payments.map((payment) => ({
        payment_method: payment.method,
        amount: decimal(payment.amount).toFixed(2),
        reference_number: requiresReference(payment.method)
          ? payment.referenceNumber.trim()
          : undefined,
      })),
      notes: finalNotes || undefined,
    };

    mutation.mutate({
      payload,
      idempotencyKey: idempotencyKeyRef.current,
    });
  };

  useHotkeys(
    {
      F4: () => {
        if (!mutation.isPending && lines.length > 0) {
          submit();
        }
      },
    },
    { enabled: open },
  );

  const parsedReceived = parseFloat(receivedCash) || 0;
  const parsedCashAmount = parseFloat(cashAmount.toFixed(2)) || 0;
  const singleCashPayment = payments.length === 1 && payments[0]?.method === "CASH";
  const hasVuelto = singleCashPayment && parseFloat(changeAmount) > 0;
  const isIncomplete =
    singleCashPayment &&
    (!AMOUNT_PATTERN.test(receivedCash) || parsedReceived < parsedCashAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 rounded-3xl border border-border/80 shadow-2xl bg-card">
        {/* Header: Hero Total with Clean Badge */}
        <DialogHeader className="bg-muted/30 px-6 pt-6 pb-5 border-b border-border/50 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {DOCUMENT_TYPE_LABELS[documentType]}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {customer?.legal_name ?? "Clientes Varios"}
            </span>
          </div>

          <DialogTitle className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total a Cobrar
          </DialogTitle>
          <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground mt-0.5">
            {formatMoney(total)}
          </div>
        </DialogHeader>

        {/* Body: Streamlined Payment Flow */}
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Medios de pago</p>
                <p className="text-[10px] text-muted-foreground">Puedes combinar efectivo, billetera, tarjeta y transferencia.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={fillExactCash}>
                <Banknote className="mr-1 size-3.5" /> Efectivo exacto
              </Button>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-border/70 bg-muted/15 p-2.5">
                  <div className="flex items-start gap-2">
                    <Select
                      value={payment.method}
                      onValueChange={(value) =>
                        updatePayment(payment.id, {
                          method: value as PaymentMethod,
                          referenceNumber:
                            value === payment.method ? payment.referenceNumber : "",
                        })
                      }
                    >
                      <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg bg-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={payment.amount}
                      onChange={(event) => updatePayment(payment.id, { amount: sanitizeAmount(event.target.value) })}
                      inputMode="decimal"
                      aria-label={`Importe pagado con ${paymentMethodLabel(payment.method)}`}
                      className="h-9 w-28 rounded-lg bg-background text-right font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar pago con ${paymentMethodLabel(payment.method)}`}
                      onClick={() => removePayment(payment.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {requiresReference(payment.method) ? (
                    <Input
                      value={payment.referenceNumber}
                      onChange={(event) => updatePayment(payment.id, { referenceNumber: event.target.value })}
                      placeholder="Número de operación o voucher"
                      maxLength={50}
                      className="mt-2 h-8 rounded-lg bg-background font-mono text-xs"
                    />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <div className="flex items-center gap-2">
                <Select value={draftMethod} onValueChange={(value) => handleSelectMethod(value as PaymentMethod)}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={draftAmount}
                  onChange={(event) => setDraftAmount(sanitizeAmount(event.target.value))}
                  inputMode="decimal"
                  aria-label="Importe del nuevo pago"
                  placeholder={remaining.isPositive() ? remaining.toFixed(2) : "0.00"}
                  className="h-9 w-28 rounded-lg bg-background text-right font-mono text-xs"
                />
                <Button type="button" size="icon" aria-label="Agregar medio de pago" onClick={addPayment}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {requiresReference(draftMethod) ? (
                <Input
                  value={draftReference}
                  onChange={(event) => setDraftReference(event.target.value)}
                  placeholder="Número de operación"
                  maxLength={50}
                  className="mt-2 h-8 rounded-lg bg-background font-mono text-xs"
                />
              ) : null}
            </div>

            {mobilePaymentMethods.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">Datos de cobro digital</p>
                  <p className="text-[10px] text-muted-foreground">
                    {company?.branding.display_name ?? company?.trade_name ?? "Empresa"}
                  </p>
                </div>
                {mobilePaymentMethods.map((method) => {
                  const phone = method === "YAPE"
                    ? company?.payments.yape_phone
                    : company?.payments.plin_phone;

                  return (
                    <div key={method} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-bold">
                          {paymentMethodLabel(method)}: {phone ?? "Número no configurado"}
                        </p>
                        {!phone ? (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            Configura este dato antes de cobrar por este medio.
                          </p>
                        ) : null}
                      </div>
                      {phone ? (
                        <button
                          type="button"
                          onClick={() => void handleCopyPhone(phone, method)}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          {copiedPhone === method
                            ? <Check className="size-3.5 text-emerald-500" />
                            : <Copy className="size-3.5" />}
                          <span>{copiedPhone === method ? "Copiado" : "Copiar"}</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {singleCashPayment ? (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {billSuggestions.map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleSelectBill(bill)}
                      className="cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1 font-mono text-[10px] font-semibold hover:border-primary"
                    >
                      {decimal(bill).equals(total) ? `Exacto S/ ${bill.toFixed(2)}` : `S/ ${bill}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recibido en efectivo</span>
                  <Input
                    value={receivedCash}
                    onChange={(event) => setReceivedCash(sanitizeAmount(event.target.value))}
                    inputMode="decimal"
                    aria-label="Efectivo recibido"
                    className="h-9 flex-1 rounded-lg bg-background text-right font-mono text-sm"
                  />
                </div>
                <div className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold",
                  isIncomplete ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}>
                  <span>{hasVuelto ? "Vuelto" : isIncomplete ? "Falta" : "Pago exacto"}</span>
                  <span className="font-mono">{hasVuelto ? formatMoney(changeAmount) : isIncomplete ? formatMoney((parsedCashAmount - parsedReceived).toFixed(2)) : "S/ 0.00"}</span>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5 rounded-xl bg-muted/30 p-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Pagado</span><span className="font-mono">{formatMoney(paid.toFixed(2))}</span>
              </div>
              <div className={cn(
                "flex justify-between font-semibold",
                remainingIsZero ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
              )}>
                <span>{remainingIsNegative ? "Exceso" : remainingIsZero ? "Saldo" : "Pendiente"}</span>
                <span className="font-mono">{formatMoney(remaining.abs().toFixed(2))}</span>
              </div>
            </div>

            {receiptRequiresIdentity ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                Esta boleta supera S/ 700.00. Asigna un cliente identificado antes de emitirla.
              </p>
            ) : null}
            {invoiceRequiresRuc ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300">
                La factura requiere un cliente con RUC válido de 11 dígitos.
              </p>
            ) : null}
          </div>

          {/* Optional Notes Toggle */}
          <div>
            {!showNotes ? (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="text-[11px] text-muted-foreground hover:text-primary font-medium transition-colors cursor-pointer"
              >
                + Agregar nota u observación opcional
              </button>
            ) : (
              <div className="space-y-1">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nota (ej. Despacho a mototaxi)..."
                  className="h-8 text-xs rounded-xl bg-background"
                />
              </div>
            )}
          </div>

          {/* Form Error Alert */}
          {formError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          {/* Big Action Button */}
          <Button
            type="button"
            size="lg"
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-md cursor-pointer flex items-center justify-center gap-2 rounded-2xl"
            onClick={submit}
            disabled={
              mutation.isPending ||
              isIncomplete ||
              !remainingIsZero ||
              payments.length === 0 ||
              lines.length === 0 ||
              invoiceRequiresRuc ||
              receiptRequiresIdentity
            }
          >
            <CheckCircle2 className="size-4.5" strokeWidth={2} />
            <span>Emitir {DOCUMENT_TYPE_LABELS[documentType]}</span>
            <span className="font-mono">({formatMoney(total)})</span>
            <Kbd className="ml-1 h-5 bg-white/20 px-1.5 font-mono text-[10px] text-primary-foreground">
              F4
            </Kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
