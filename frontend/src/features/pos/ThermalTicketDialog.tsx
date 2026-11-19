import * as React from "react";
import { Printer, Smartphone, X } from "lucide-react";
import { toDataURL } from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, formatQuantity } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { FALLBACK_LOGO_URL } from "@/lib/branding";
import { cn } from "@/lib/utils";
import type { SaleTicket, SunatStatus } from "@/types/pos";

interface ThermalTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: SaleTicket | null;
}

const STATUS_TONE: Record<SunatStatus, string> = {
  INTERNAL: "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  PENDING: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  ACCEPTED: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
  OBSERVED: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  REJECTED: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
  ANNULLED: "border-zinc-400 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300",
};

export function ThermalTicketDialog(props: ThermalTicketDialogProps) {
  if (!props.open || !props.ticket) {
    return null;
  }

  return <ThermalTicketDialogContent {...props} ticket={props.ticket} />;
}

function ThermalTicketDialogContent({ open, onOpenChange, ticket }: ThermalTicketDialogProps & { ticket: SaleTicket }) {
  const [qrResult, setQrResult] = React.useState<{ qrText: string; dataUrl: string | null } | null>(null);
  const qrDataUrl = qrResult?.qrText === ticket.sunat.qr_text ? qrResult.dataUrl : null;

  React.useEffect(() => {
    let cancelled = false;

    void toDataURL(ticket.sunat.qr_text, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 180,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) {
          setQrResult({ qrText: ticket.sunat.qr_text, dataUrl: url });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrResult({ qrText: ticket.sunat.qr_text, dataUrl: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticket]);

  const handleShareWhatsApp = () => {
    if (!ticket) return;
    const itemsList = ticket.items
      .map((it) => `• ${it.quantity} ${it.description} (S/ ${it.total})`)
      .join("\n");
    const text = `*${ticket.company.trade_name}*\nComprobante: *${ticket.document.number}* (${ticket.document.type_label})\nCliente: ${ticket.customer.legal_name}\nFecha: ${ticket.document.issue_date ? formatDateTime(ticket.document.issue_date) : "Hoy"}\n\n*Detalle del pedido:*\n${itemsList}\n\n*TOTAL: S/ ${ticket.totals.total}*\n\n¡Gracias por su compra en ${ticket.company.trade_name}!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92svh] gap-0 overflow-hidden p-0 sm:max-w-[460px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm">Comprobante emitido</DialogTitle>
            <DialogDescription className="mt-0.5 font-mono text-[11px]">
              {ticket?.document.number ?? "Sin comprobante"}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
              disabled={!ticket}
              className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 font-semibold text-xs rounded-xl shadow-xs cursor-pointer gap-1"
              title="Compartir comprobante por WhatsApp"
            >
              <Smartphone className="size-3.5" strokeWidth={1.8} />
              <span>WhatsApp</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => window.print()}
              disabled={!ticket}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Printer className="size-4 mr-1" strokeWidth={1.8} />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar ticket"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92svh-3.5rem)] overflow-y-auto bg-zinc-200/80 p-5 dark:bg-zinc-950 flex justify-center">
          {ticket ? (
            <article className="print-area w-[80mm] max-w-full bg-white px-[5mm] py-[6mm] font-mono text-[10px] leading-[1.45] text-black shadow-xl rounded-md">
              <header className="text-center">
                <img
                  src={ticket.company.logo_url ?? FALLBACK_LOGO_URL}
                  alt={ticket.company.trade_name}
                  className="mx-auto mb-1.5 size-12 rounded-full object-contain"
                />
                <h2 className="text-[13px] font-bold tracking-tight uppercase">
                  {ticket.company.trade_name}
                </h2>
                <p className="mt-0.5">{ticket.company.legal_name}</p>
                <p className="mt-0.5 font-semibold">RUC {ticket.company.ruc}</p>
                {ticket.company.address ? <p>{ticket.company.address}</p> : null}
                {ticket.company.phone ? <p>Tel / WhatsApp: {ticket.company.phone}</p> : null}
              </header>

              <div className="my-3 border-y border-dashed border-black py-2 text-center">
                <p className="text-[11px] font-bold uppercase">{ticket.document.type_label}</p>
                <p className="mt-0.5 text-[14px] font-bold tracking-tight">
                  {ticket.document.number}
                </p>
                <p className="mt-0.5">
                  {ticket.document.issue_date
                    ? formatDateTime(ticket.document.issue_date)
                    : "Sin fecha"}
                </p>
              </div>

              <section className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="shrink-0">Cliente</span>
                  <span className="truncate text-right">{ticket.customer.legal_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{ticket.customer.identity_document_type_label}</span>
                  <span>{ticket.customer.document_number}</span>
                </div>
                {ticket.customer.address ? (
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0">Dirección</span>
                    <span className="text-right">{ticket.customer.address}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span>Vendedor</span>
                  <span className="text-right">{ticket.cashier.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Moneda</span>
                  <span>{ticket.document.currency}</span>
                </div>
              </section>

              <table className="mt-3 w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="border-y border-black">
                    <th className="py-1 text-left font-bold">Cant.</th>
                    <th className="py-1 text-left font-bold">Descripción</th>
                    <th className="py-1 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.items.map((item, index) => (
                    <tr key={`${item.description}-${String(index)}`} className="align-top">
                      <td className="py-1 pr-1 tabular-nums">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="py-1 pr-1">
                        <span>{item.description}</span>
                        <span className="block text-[9px] text-zinc-600">
                          {formatMoney(item.unit_price, {
                            grouped: false,
                            scale: 4,
                          })}{" "}
                          / {item.unit_code}
                        </span>
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {formatMoney(item.total, { grouped: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <section className="mt-2 space-y-0.5 border-t border-dashed border-black pt-2">
                <div className="flex justify-between gap-2">
                  <span>Subtotal gravado</span>
                  <span className="tabular-nums">
                    {formatMoney(ticket.totals.taxed, { grouped: false })}
                  </span>
                </div>
                {ticket.totals.exonerated !== "0.00" ? (
                  <div className="flex justify-between gap-2">
                    <span>Exonerado</span>
                    <span className="tabular-nums">
                      {formatMoney(ticket.totals.exonerated, { grouped: false })}
                    </span>
                  </div>
                ) : null}
                {ticket.totals.unaffected !== "0.00" ? (
                  <div className="flex justify-between gap-2">
                    <span>Inafecto</span>
                    <span className="tabular-nums">
                      {formatMoney(ticket.totals.unaffected, { grouped: false })}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span>IGV 18%</span>
                  <span className="tabular-nums">
                    {formatMoney(ticket.totals.igv, { grouped: false })}
                  </span>
                </div>
                {ticket.totals.discount !== "0.00" ? (
                  <div className="flex justify-between gap-2">
                    <span>Descuento</span>
                    <span className="tabular-nums">
                      -{formatMoney(ticket.totals.discount, { grouped: false })}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2 border-t border-black pt-1 text-[12px] font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatMoney(ticket.totals.total, { grouped: false })}
                  </span>
                </div>
              </section>

              <p className="mt-2 text-[9px] leading-snug uppercase">
                {ticket.totals.amount_in_words}
              </p>

              <section className="mt-2 border-t border-dashed border-black pt-2">
                {ticket.payments.map((payment, index) => (
                  <div
                    key={`${payment.payment_method}-${String(index)}`}
                    className="flex justify-between gap-2"
                  >
                    <span>{payment.payment_method_label}</span>
                    <span className="tabular-nums">
                      {formatMoney(payment.amount, { grouped: false })}
                    </span>
                  </div>
                ))}
              </section>

              <section className="mt-3 flex items-start gap-2 border-t border-dashed border-black pt-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR de consulta SUNAT"
                    className="size-[74px] shrink-0"
                  />
                ) : (
                  <div className="size-[74px] shrink-0 border border-dashed border-black" />
                )}
                <div className="min-w-0 flex-1 text-[8.5px] leading-snug">
                  <Badge
                    variant="outline"
                    className={cn(
                      "mb-1 rounded-sm px-1 py-0 font-mono text-[8px]",
                      STATUS_TONE[ticket.sunat.status],
                    )}
                  >
                    {ticket.sunat.status_label}
                  </Badge>
                  <p className="break-all">
                    Hash: {ticket.sunat.hash ?? "Pendiente de firma"}
                  </p>
                  <p className="mt-1">
                    Código: {ticket.sunat.code ?? "--"} / XML:{" "}
                    {ticket.sunat.has_xml ? "generado" : "pendiente"}
                  </p>
                  <p className="mt-1">{ticket.sunat.description ?? "Sin detalle SUNAT."}</p>
                </div>
              </section>

              <footer className="mt-3 border-t border-dashed border-black pt-2 text-center text-[8.5px] leading-snug">
                <p>{ticket.print.footer}</p>
                <p className="mt-1 font-mono">
                  {ticket.company.ruc} / {ticket.document.number}
                </p>
              </footer>
            </article>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              No hay un comprobante para imprimir.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
