import { ShieldCheck } from "lucide-react";

import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export function SecurityPage() {
  return (
    <ModulePlaceholder
      section="Sistema"
      title="Seguridad"
      description="Control de acceso por roles, aislamiento por empresa y auditoría de operaciones críticas."
      icon={ShieldCheck}
      capabilities={[
        {
          title: "Sanctum con expiración",
          description:
            "Tokens Bearer por dispositivo, revocación explícita y protección de rutas autenticadas.",
        },
        {
          title: "RBAC con equipos",
          description:
            "Roles y permisos con company_id como team_foreign_key para evitar filtraciones entre empresas.",
        },
        {
          title: "Policies por modelo",
          description:
            "Autorización granular que bloquea IDOR y BOLA incluso con UUID conocidos.",
        },
        {
          title: "Auditoría correlacionada",
          description:
            "Activity log con company_id, causer_id, IP, user agent y trace_id en cada acción crítica.",
        },
      ]}
      dependencies={[
        { label: "Contrato API y envelope único", ready: true },
        { label: "Aislamiento multi-tenant en tres capas", ready: true },
        { label: "Sanctum y expiración de tokens", ready: true },
        { label: "Roles, permisos y policies", ready: true },
      ]}
    />
  );
}
