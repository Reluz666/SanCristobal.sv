import { ArrowLeft, Loader2, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="flex items-center gap-3 border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader2 className="size-4 animate-spin text-zinc-500" strokeWidth={1.5} />
        <div>
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
            Verificando sesión
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
            Sanctum / RBAC / tenant scope
          </p>
        </div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md border border-zinc-200 bg-card dark:border-zinc-800">
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center border bg-background text-muted-foreground">
            <ShieldX className="size-4" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              403 / Autorización
            </p>
            <h1 className="mt-1 text-sm font-medium">Acceso restringido</h1>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tu rol no incluye los permisos requeridos para este módulo. Solicita acceso al
            administrador de la empresa o vuelve a la consola principal.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" strokeWidth={1.5} />
              Volver al resumen
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredPermissions = [],
}: ProtectedRouteProps) {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const roles = useAuthStore((state) => state.roles);
  const permissions = useAuthStore((state) => state.permissions);

  if (status === "idle" || status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  const isAdmin = roles.includes("admin");
  const roleAllowed =
    requiredRoles.length === 0 || isAdmin || requiredRoles.some((role) => roles.includes(role));
  const permissionsAllowed =
    requiredPermissions.length === 0 ||
    isAdmin ||
    requiredPermissions.every((permission) => permissions.includes(permission));

  if (!roleAllowed || !permissionsAllowed) {
    return <AccessDenied />;
  }

  return children ? <>{children}</> : <Outlet />;
}
