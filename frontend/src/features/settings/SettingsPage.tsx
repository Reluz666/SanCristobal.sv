import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Image, Palette, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCompanySettings, type UpdateCompanySettingsPayload } from "@/features/settings/api";
import { useAuthStore } from "@/stores/authStore";
import type { Company } from "@/types/tenant";

function settingsFromCompany(company: Company | null): UpdateCompanySettingsPayload {
  return {
    branding: {
      display_name: company?.branding.display_name ?? "",
      logo_url: company?.branding.logo_url ?? "",
      primary_color: company?.branding.primary_color ?? "#03B7A3",
    },
    payments: {
      yape_phone: company?.payments.yape_phone ?? "",
      plin_phone: company?.payments.plin_phone ?? "",
    },
  };
}

export function SettingsPage() {
  const company = useAuthStore((state) => state.company);
  const [values, setValues] = React.useState(() => settingsFromCompany(company));

  const saveMutation = useMutation({
    mutationFn: updateCompanySettings,
    onSuccess: (updatedCompany) => {
      useAuthStore.setState({ company: updatedCompany });
      setValues(settingsFromCompany(updatedCompany));
      toast.success("Marca y datos de cobro actualizados.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    },
  });

  const updateBranding = <K extends keyof UpdateCompanySettingsPayload["branding"]>(
    key: K,
    value: UpdateCompanySettingsPayload["branding"][K],
  ): void => {
    setValues((current) => ({ ...current, branding: { ...current.branding, [key]: value } }));
  };

  const updatePayment = <K extends keyof UpdateCompanySettingsPayload["payments"]>(
    key: K,
    value: UpdateCompanySettingsPayload["payments"][K],
  ): void => {
    setValues((current) => ({ ...current, payments: { ...current.payments, [key]: value } }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    saveMutation.mutate({
      branding: {
        ...values.branding,
        display_name: values.branding.display_name.trim(),
        logo_url: values.branding.logo_url?.trim() || null,
      },
      payments: {
        yape_phone: values.payments.yape_phone?.trim() || null,
        plin_phone: values.payments.plin_phone?.trim() || null,
      },
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        section="Empresa"
        title="Marca y datos de cobro"
        description="Configura la identidad visual y los números empresariales de Yape y Plin."
      />

      <form onSubmit={submit} className="max-w-3xl space-y-5">
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Identidad de la empresa</h2>
              <p className="mt-1 text-xs text-muted-foreground">Se aplica al menú, acceso, botones, gráficos, favicon y tickets.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium">Nombre visible</span>
              <Input
                required
                maxLength={160}
                value={values.branding.display_name}
                onChange={(event) => updateBranding("display_name", event.target.value)}
                placeholder="Nombre comercial de la empresa"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium"><Image className="size-3.5" /> URL o ruta del logo</span>
              <Input
                value={values.branding.logo_url ?? ""}
                onChange={(event) => updateBranding("logo_url", event.target.value)}
                placeholder="/logo.png o https://..."
              />
              <span className="block text-[11px] text-muted-foreground">Sin logo propio, el acceso, los tickets y el menú contraído usan el logo predeterminado; el menú expandido muestra las iniciales.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">Color principal</span>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-2">
                <input
                  type="color"
                  aria-label="Seleccionar color principal"
                  value={values.branding.primary_color}
                  onChange={(event) => updateBranding("primary_color", event.target.value.toUpperCase())}
                  className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs">{values.branding.primary_color}</span>
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Cobros digitales</h2>
              <p className="mt-1 text-xs text-muted-foreground">Estos números se muestran al vendedor y se pueden copiar al registrar el pago.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Número de Yape</span>
              <Input
                type="tel"
                inputMode="tel"
                maxLength={32}
                value={values.payments.yape_phone ?? ""}
                onChange={(event) => updatePayment("yape_phone", event.target.value)}
                placeholder="Vacío si no está configurado"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Número de Plin</span>
              <Input
                type="tel"
                inputMode="tel"
                maxLength={32}
                value={values.payments.plin_phone ?? ""}
                onChange={(event) => updatePayment("plin_phone", event.target.value)}
                placeholder="Vacío si no está configurado"
              />
            </label>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Son datos públicos para recibir pagos; no reemplazan el teléfono de contacto de la empresa.</p>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending || !company}>
            <Save className="mr-2 size-4" />
            {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </form>
    </div>
  );
}
