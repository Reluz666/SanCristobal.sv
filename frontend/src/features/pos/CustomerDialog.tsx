import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ApiClientError } from "@/api/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCustomer,
  fetchCustomers,
  lookupCustomer,
  type CreateCustomerPayload,
} from "@/features/pos/api";
import { formatDni, formatRuc } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/stores/posStore";
import type { Customer, CustomerLookup, IdentityDocumentType } from "@/types/pos";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IDENTITY_TYPES: { value: IdentityDocumentType; label: string }[] = [
  { value: "1", label: "DNI" },
  { value: "6", label: "RUC" },
  { value: "4", label: "Carnet de extranjería" },
  { value: "7", label: "Pasaporte" },
];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function inferIdentityType(documentNumber: string): IdentityDocumentType {
  if (documentNumber.length === 11) {
    return "6";
  }

  if (documentNumber.length === 8) {
    return "1";
  }

  return "1";
}

function documentInputValue(type: IdentityDocumentType, value: string): string {
  if (type === "1") {
    return formatDni(value);
  }

  if (type === "6") {
    return formatRuc(value);
  }

  return value.toUpperCase().slice(0, 12);
}

export function CustomerDialog(props: CustomerDialogProps) {
  if (!props.open) {
    return null;
  }

  return <CustomerDialogContent {...props} />;
}

function CustomerDialogContent({ open, onOpenChange }: CustomerDialogProps) {
  const queryClient = useQueryClient();
  const customer = usePosStore((state) => state.customer);
  const setCustomer = usePosStore((state) => state.setCustomer);

  const [documentSearch, setDocumentSearch] = React.useState("");
  const [lookupResult, setLookupResult] = React.useState<CustomerLookup | null>(null);
  const [identityType, setIdentityType] = React.useState<IdentityDocumentType>("1");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [legalName, setLegalName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const recentQuery = useQuery({
    queryKey: ["pos", "customers", "recent"],
    queryFn: () => fetchCustomers(""),
    enabled: open,
  });

  const lookupMutation = useMutation({
    mutationFn: lookupCustomer,
    onSuccess: (result) => {
      setLookupResult(result);

      if (result.customer) {
        setIdentityType(result.customer.identity_document_type);
        setDocumentNumber(result.customer.document_number);
        setLegalName(result.customer.legal_name);
        setAddress(result.customer.address ?? "");
        return;
      }

      if (result.identity) {
        setIdentityType(result.identity.identity_document_type);
        setDocumentNumber(result.identity.document_number);
        setLegalName(result.identity.legal_name);
        setAddress(result.identity.address ?? "");
        return;
      }

      const normalized = digitsOnly(documentSearch);
      setIdentityType(inferIdentityType(normalized));
      setDocumentNumber(normalized);
      setLegalName("");
      setAddress("");
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiClientError ? error.message : "No se pudo consultar el documento.");
    },
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["pos", "customers"] });
      setCustomer(created);
      toast.success("Cliente registrado y seleccionado.");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError) {
        const firstField = Object.values(error.fields)[0]?.[0];
        setFormError(firstField ?? error.message);
        return;
      }

      setFormError("No se pudo registrar el cliente.");
    },
  });

  const runLookup = (): void => {
    const normalized = digitsOnly(documentSearch);
    setFormError(null);

    if (normalized === "") {
      setFormError("Ingresa un DNI o RUC para consultar.");
      return;
    }

    lookupMutation.mutate(normalized);
  };

  const selectCustomer = (selected: Customer): void => {
    setCustomer(selected);
    toast.success(`Cliente ${selected.legal_name} seleccionado.`);
    onOpenChange(false);
  };

  const submitCustomer = (): void => {
    setFormError(null);

    if (documentNumber.trim() === "") {
      setFormError("El número de documento es obligatorio.");
      return;
    }

    if (legalName.trim() === "") {
      setFormError("La razón social o nombre es obligatorio.");
      return;
    }

    const payload: CreateCustomerPayload = {
      identity_document_type: identityType,
      document_number: documentNumber.trim(),
      legal_name: legalName.trim(),
      address: address.trim() || undefined,
    };

    createMutation.mutate(payload);
  };

  const foundCustomer = lookupResult?.customer ?? null;
  const identity = lookupResult?.identity ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <UserRound className="size-4" strokeWidth={1.5} />
            Cliente del comprobante
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Busca por DNI o RUC, selecciona un cliente registrado o crea uno nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(92svh-7rem)] overflow-y-auto md:grid-cols-[1.1fr_0.9fr]">
          <section className="border-b p-5 md:border-r md:border-b-0">
            <p className="axis-label">Consulta de documento</p>
            <div className="mt-2 flex gap-2">
              <Input
                value={documentSearch}
                onChange={(event) => {
                  setDocumentSearch(digitsOnly(event.target.value).slice(0, 11));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runLookup();
                  }
                }}
                placeholder="DNI (8) o RUC (11)"
                inputMode="numeric"
                maxLength={11}
                className="font-mono tabular-nums"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                onClick={runLookup}
                disabled={lookupMutation.isPending}
              >
                <Search className="size-4" strokeWidth={1.5} />
                Buscar
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setCustomer(null);
                  toast.info("Venta al portador con Clientes varios.");
                  onOpenChange(false);
                }}
              >
                Clientes varios
              </Button>
              {customer ? (
                <Badge variant="outline" className="h-6 rounded-sm px-2 font-normal">
                  Actual: {customer.legal_name}
                </Badge>
              ) : null}
            </div>

            {identity && !foundCustomer ? (
              <div className="mt-4 rounded-md border border-amber-300 bg-amber-500/5 p-3 dark:border-amber-900">
                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-400">
                  Documento encontrado en el padrón de demostración
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los datos se muestran solo como referencia. Confírmalos antes de registrar.
                </p>
              </div>
            ) : null}

            {foundCustomer ? (
              <div className="mt-4 rounded-md border">
                <div className="flex items-start gap-3 border-b px-3 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    <UserRound className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{foundCustomer.legal_name}</p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {foundCustomer.identity_document_type_label} {foundCustomer.document_number}
                    </p>
                    {foundCustomer.address ? (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {foundCustomer.address}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">
                    {foundCustomer.is_generic ? "Cliente genérico" : "Cliente registrado"}
                  </span>
                  <Button type="button" size="sm" onClick={() => selectCustomer(foundCustomer)}>
                    Usar cliente
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="axis-label">
                  {lookupResult === null ? "Registro manual" : "Datos del cliente"}
                </p>
                <Badge
                  variant="outline"
                  className="h-5 rounded-sm px-1.5 font-mono text-[9px] font-normal text-muted-foreground"
                >
                  {identityType === "6" ? "RUC" : "DOC"}
                </Badge>
              </div>

              <div className="mt-3 grid gap-2.5">
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="customer-doc-type" className="text-[11px] text-muted-foreground">
                      Tipo
                    </Label>
                    <Select
                      value={identityType}
                      onValueChange={(value) => {
                        const next = value as IdentityDocumentType;
                        setIdentityType(next);
                        setDocumentNumber(documentInputValue(next, documentNumber));
                      }}
                    >
                      <SelectTrigger id="customer-doc-type" size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDENTITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customer-doc-number" className="text-[11px] text-muted-foreground">
                      Número
                    </Label>
                    <Input
                      id="customer-doc-number"
                      value={documentNumber}
                      onChange={(event) => {
                        setDocumentNumber(documentInputValue(identityType, event.target.value));
                      }}
                      maxLength={identityType === "4" || identityType === "7" ? 12 : 11}
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="customer-name" className="text-[11px] text-muted-foreground">
                    Nombre o razón social
                  </Label>
                  <Input
                    id="customer-name"
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    maxLength={200}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="customer-address" className="text-[11px] text-muted-foreground">
                    Dirección
                  </Label>
                  <Input
                    id="customer-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    maxLength={255}
                    placeholder="Opcional"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {formError ? (
                <Alert variant="destructive" className="mt-3 py-2">
                  <AlertDescription className="text-[11px]">{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                onClick={submitCustomer}
                disabled={createMutation.isPending}
              >
                <UserPlus className="size-4" strokeWidth={1.5} />
                {createMutation.isPending ? "Registrando..." : "Registrar y seleccionar"}
              </Button>
            </div>
          </section>

          <section className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="axis-label">Clientes frecuentes</p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {recentQuery.data?.length ?? 0}
              </span>
            </div>

            <div className="mt-2 max-h-[420px] overflow-y-auto rounded-md border">
              {recentQuery.isLoading ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Consultando clientes...
                </div>
              ) : recentQuery.isError ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No se pudo cargar la lista de clientes.
                </div>
              ) : (recentQuery.data?.length ?? 0) === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay clientes registrados.
                </div>
              ) : (
                recentQuery.data?.map((entry) => (
                  <button
                    key={entry.uuid}
                    type="button"
                    onClick={() => selectCustomer(entry)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left outline-hidden transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50",
                      customer?.uuid === entry.uuid && "bg-muted/60",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background font-mono text-[9px] text-muted-foreground">
                      {entry.identity_document_type === "6" ? "RUC" : "DNI"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{entry.legal_name}</span>
                      <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-muted-foreground">
                        {entry.document_number}
                      </span>
                    </span>
                    {entry.is_generic ? (
                      <Badge
                        variant="outline"
                        className="h-4 rounded-sm px-1 font-mono text-[8px] font-normal text-muted-foreground"
                      >
                        VARIOS
                      </Badge>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              El documento se valida nuevamente en el servidor. Ningún cliente puede pertenecer a
              otra empresa.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
