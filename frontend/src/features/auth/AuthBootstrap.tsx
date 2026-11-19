import * as React from "react";
import { useNavigate } from "react-router-dom";

import { AUTH_UNAUTHORIZED_EVENT } from "@/api/auth-token";
import { useAuthStore } from "@/stores/authStore";

interface AuthBootstrapProps {
  children: React.ReactNode;
}

/**
 * Recupera la sesión desde /auth/me cuando existe un token en sessionStorage
 * y centraliza la salida ante cualquier 401 emitido por el interceptor Axios.
 */
export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const navigate = useNavigate();
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const clearSession = useAuthStore((state) => state.clearSession);

  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  React.useEffect(() => {
    const handleUnauthorized = (): void => {
      clearSession();
      navigate("/login", { replace: true });
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession, navigate]);

  return <>{children}</>;
}
