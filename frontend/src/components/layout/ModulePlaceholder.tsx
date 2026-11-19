import { ArrowLeft, Check, LockKeyhole, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ModuleCapability {
  title: string;
  description: string;
}

export interface ModuleDependency {
  label: string;
  ready: boolean;
}

interface ModulePlaceholderProps {
  section: string;
  title: string;
  description: string;
  icon: LucideIcon;
  capabilities: ModuleCapability[];
  dependencies: ModuleDependency[];
}

export function ModulePlaceholder({
  section,
  title,
  description,
  icon: Icon,
  capabilities,
  dependencies,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        section={section}
        title={title}
        description={description}
        meta={
          <>
            <Badge
              variant="outline"
              className="h-5 gap-1.5 rounded-sm px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
            >
              EN DESARROLLO
            </Badge>
            <span className="text-xs text-muted-foreground">
              Disponible en una próxima versión
            </span>
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" strokeWidth={1.5} />
              Volver al resumen
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Alcance del módulo"
          description="Funcionalidad planificada para este módulo."
          className="overflow-hidden"
        >
          <div className="flex items-start gap-3.5 border-b p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
              <Icon className="size-4.5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Módulo en preparación</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Este módulo aún no está habilitado. Usará la misma API, el aislamiento por
                empresa y el control de permisos del resto del sistema.
              </p>
            </div>
          </div>
          <div>
            {capabilities.map((capability, index) => (
              <div
                key={capability.title}
                className="flex gap-3 border-b px-5 py-3.5 last:border-0"
              >
                <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{capability.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Dependencias"
          description="Estado de los prerrequisitos técnicos."
        >
          <div>
            {dependencies.map((dependency) => (
              <div
                key={dependency.label}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
              >
                <span
                  className={
                    dependency.ready
                      ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  }
                >
                  {dependency.ready ? (
                    <Check className="size-3" strokeWidth={1.5} />
                  ) : (
                    <LockKeyhole className="size-3" strokeWidth={1.5} />
                  )}
                </span>
                <span className="flex-1 text-xs text-foreground">{dependency.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  {dependency.ready ? "Listo" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t bg-muted/20 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Las acciones de escritura se habilitarán cuando todas las dependencias estén
              listas.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
