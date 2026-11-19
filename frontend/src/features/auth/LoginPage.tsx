import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Boxes,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ScanBarcode,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiClientError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { APP_TAGLINE, FALLBACK_LOGO_URL, resolveBranding } from "@/lib/branding";
import { loginSchema, type LoginFormValues } from "@/lib/schemas";
import { useAuthStore } from "@/stores/authStore";

const CURRENT_YEAR = new Date().getFullYear();

function readRedirectFrom(state: unknown): string {
  if (
    typeof state === "object" &&
    state !== null &&
    "from" in state &&
    typeof state.from === "string" &&
    state.from.startsWith("/")
  ) {
    return state.from;
  }

  return "/";
}

const CAPABILITIES = [
  {
    icon: ScanBarcode,
    title: "POS de alta velocidad",
    description: "Lector de barras, atajos de teclado y cobro con pagos mixtos.",
  },
  {
    icon: Boxes,
    title: "Kardex multi-almacén",
    description: "Saldo físico y valorizado con costo promedio ponderado.",
  },
  {
    icon: ReceiptText,
    title: "Facturación SUNAT",
    description: "Comprobantes electrónicos, series y trazabilidad de estados.",
  },
] as const;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const company = useAuthStore((state) => state.company);
  const branding = resolveBranding(company);
  const legalName = company?.legal_name ?? branding.name;
  const companyRuc = company?.ruc ?? (branding.ruc || import.meta.env.VITE_COMPANY_RUC || "");
  const logoUrl = branding.logoUrl ?? FALLBACK_LOGO_URL;
  const redirectTo = readRedirectFrom(location.state);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  React.useEffect(() => {
    document.title = `Acceso | ${branding.name}`;
  }, [branding.name]);

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  const applyAuthError = (error: unknown): void => {
    if (error instanceof ApiClientError) {
      const emailError = error.fields.email?.[0];
      const passwordError = error.fields.password?.[0];

      if (emailError) {
        form.setError("email", { type: "server", message: emailError });
      }

      if (passwordError) {
        form.setError("password", { type: "server", message: passwordError });
      }

      setServerError(error.message);

      return;
    }

    setServerError(
      error instanceof Error ? error.message : "No se pudo completar el inicio de sesión.",
    );
  };

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);

    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      applyAuthError(error);
    }
  };

  const busy = form.formState.isSubmitting;

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto grid min-h-svh w-full max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_440px]">
        <aside className="hidden flex-col justify-between border-r border-zinc-200 bg-zinc-100/60 p-10 lg:flex dark:border-zinc-800 dark:bg-zinc-900/30">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={logoUrl}
                alt={branding.name}
                className="size-10 rounded-full object-contain bg-white shadow-xs"
              />
              <div className="leading-tight">
                <p className="text-[13px] font-semibold">{branding.name}</p>
                <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-primary font-medium uppercase">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-md">
              <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase dark:text-zinc-400">
                Consola operativa
              </p>
              <h2 className="mt-3 text-[26px] leading-[1.15] font-semibold tracking-tight">
                Caja, inventario y comprobantes en una sola línea de operación.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Sistema multiempresa con aislamiento por tenant, Kardex valorizado y
                trazabilidad electrónica ante SUNAT.
              </p>
            </div>

            <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {CAPABILITIES.map((capability, index) => (
                <div key={capability.title} className="flex gap-3 py-3.5">
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[10px] tabular-nums text-zinc-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <capability.icon
                    className="mt-0.5 size-4 shrink-0 text-zinc-500 dark:text-zinc-400"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{capability.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {capability.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] text-zinc-400 uppercase">
                Empresa
              </p>
              <p className="mt-1 text-[11px] font-medium">{legalName}</p>
              {companyRuc ? (
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
                  RUC {companyRuc}
                </p>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] text-zinc-400 uppercase">
                Entorno
              </p>
              <p className="mt-1 font-mono text-[10px] tabular-nums text-zinc-600 dark:text-zinc-300">
                SUNAT BETA / PEN / IGV 18%
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-500">America/Lima</p>
            </div>
          </div>
        </aside>

        <main className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <img
                  src={logoUrl}
                  alt={branding.name}
                  className="size-8 rounded-full object-contain bg-white shadow-xs"
                />
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{branding.name}</p>
                  <p className="font-mono text-[9px] tracking-[0.1em] text-primary font-medium uppercase">
                    {APP_TAGLINE}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="rounded-sm border-zinc-300 font-mono text-[9px] text-zinc-500 dark:border-zinc-700"
              >
                SANDBOX
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">
                01 / Autenticación
              </span>
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
              <Badge
                variant="outline"
                className="hidden rounded-sm border-zinc-300 font-mono text-[9px] text-zinc-500 sm:inline-flex dark:border-zinc-700"
              >
                SANDBOX
              </Badge>
            </div>

            <div className="mt-5">
              <h1 className="text-xl font-semibold tracking-tight">Acceso al sistema</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Ingresa con tu cuenta corporativa. El acceso está restringido a usuarios y
                empresas activas.
              </p>
            </div>

            {serverError ? (
              <Alert variant="destructive" className="mt-5">
                <TriangleAlert strokeWidth={1.5} />
                <AlertTitle>No se pudo iniciar sesión</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            <Form {...form}>
              <form
                onSubmit={(event) => {
                  void form.handleSubmit(onSubmit)(event);
                }}
                className="mt-6 space-y-4"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-[0.1em] text-zinc-500 uppercase dark:text-zinc-400">
                        Correo corporativo
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="username"
                          autoFocus
                          spellCheck={false}
                          placeholder="usuario@empresa.pe"
                          className="h-10 bg-white font-mono text-[13px] dark:bg-zinc-900"
                          disabled={busy}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-3">
                        <FormLabel className="font-mono text-[10px] tracking-[0.1em] text-zinc-500 uppercase dark:text-zinc-400">
                          Contraseña
                        </FormLabel>
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] text-zinc-400">
                          <LockKeyhole className="size-3" strokeWidth={1.5} />
                          TLS / Bearer
                        </span>
                      </div>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          placeholder="Contraseña corporativa"
                          className="h-10 bg-white font-mono text-[13px] dark:bg-zinc-900"
                          disabled={busy}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="mt-1 h-11 w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-brand-glow cursor-pointer"
                  disabled={busy}
                >
                  <span>{form.formState.isSubmitting ? "Validando credenciales..." : "Iniciar Sesión"}</span>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <ArrowRight className="size-4" strokeWidth={2} />
                  )}
                </Button>
              </form>
            </Form>

            <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 pt-4 font-mono text-[9px] tabular-nums text-zinc-400 dark:border-zinc-800">
              {companyRuc ? <span>RUC {companyRuc}</span> : null}
              <span aria-hidden="true">/</span>
              <span>API v1</span>
              <span aria-hidden="true">/</span>
              <span>v0.1.0</span>
              <span className="ml-auto">© {CURRENT_YEAR} {branding.name}</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
