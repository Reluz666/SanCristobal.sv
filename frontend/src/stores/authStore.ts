import { create } from "zustand";

import { apiGet, apiPost } from "@/api/client";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/api/auth-token";
import { authSessionSchema } from "@/lib/schemas";
import type { AuthSession, AuthUser, Company } from "@/types/tenant";

export type AuthStatus = "idle" | "loading" | "authenticated" | "guest";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  expiresAt: string | null;
  user: AuthUser | null;
  company: Company | null;
  roles: string[];
  permissions: string[];
  error: string | null;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  clearSession: () => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

const GUEST_STATE = {
  status: "guest" as const,
  token: null,
  expiresAt: null,
  user: null,
  company: null,
  roles: [],
  permissions: [],
  error: null,
};

let bootstrapPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...GUEST_STATE,
  status: "idle",

  login: async (email, password) => {
    set({ status: "loading", error: null });

    try {
      const session = await apiPost<AuthSession>(
        "/auth/login",
        { email, password },
        authSessionSchema,
      );

      if (!session.token) {
        throw new Error("El servidor no devolvió un token de acceso válido.");
      }

      setAuthToken(session.token, session.expires_at);

      set({
        status: "authenticated",
        token: session.token,
        expiresAt: session.expires_at,
        user: session.user,
        company: session.company,
        roles: session.roles,
        permissions: session.permissions,
        error: null,
      });

      return session;
    } catch (error) {
      set({
        status: get().user ? "authenticated" : "guest",
        error: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      });

      throw error;
    }
  },

  logout: async () => {
    try {
      await apiPost<null>("/auth/logout");
    } catch {
      // Si el token ya expiró o no hay red, la sesión local se limpia igual.
    } finally {
      clearAuthToken();
      set({ ...GUEST_STATE });
    }
  },

  bootstrap: async () => {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    if (get().status !== "idle") {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      set({ ...GUEST_STATE });
      return;
    }

    set({ status: "loading", token, error: null });

    bootstrapPromise = (async () => {
      try {
        const session = await apiGet<AuthSession>("/auth/me", authSessionSchema);

        set({
          status: "authenticated",
          token: session.token ?? token,
          expiresAt: session.expires_at,
          user: session.user,
          company: session.company,
          roles: session.roles,
          permissions: session.permissions,
          error: null,
        });
      } catch {
        clearAuthToken();
        set({ ...GUEST_STATE });
      }
    })().finally(() => {
      bootstrapPromise = null;
    });

    return bootstrapPromise;
  },

  clearSession: () => {
    clearAuthToken();
    set({ ...GUEST_STATE });
  },

  hasRole: (role) => get().roles.includes(role),

  hasAnyRole: (roles) =>
    roles.length === 0 || roles.some((role) => get().roles.includes(role)),

  hasPermission: (permission) => {
    const state = get();

    return state.roles.includes("admin") || state.permissions.includes(permission);
  },

  hasAnyPermission: (permissions) =>
    permissions.length === 0 ||
    get().roles.includes("admin") ||
    permissions.some((permission) => get().permissions.includes(permission)),
}));
