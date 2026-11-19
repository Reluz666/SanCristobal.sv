const STORAGE_KEY = "vpp.auth.session";
export const AUTH_CHANGED_EVENT = "vpp:auth-changed";
export const AUTH_UNAUTHORIZED_EVENT = "vpp:unauthorized";

interface StoredSession {
  token: string;
  expiresAt: string | null;
}

let memorySession: StoredSession | null = null;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      typeof parsed.token === "string" &&
      parsed.token.length > 0
    ) {
      const expiresAt =
        "expiresAt" in parsed && typeof parsed.expiresAt === "string"
          ? parsed.expiresAt
          : null;

      return { token: parsed.token, expiresAt };
    }
  } catch {
    return null;
  }

  return null;
}

function isExpired(session: StoredSession): boolean {
  if (session.expiresAt === null) {
    return false;
  }

  const expiresAt = Date.parse(session.expiresAt);

  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function getAuthToken(): string | null {
  const session = memorySession ?? parseSession(getStorage()?.getItem(STORAGE_KEY) ?? null);

  if (!session) {
    return null;
  }

  if (isExpired(session)) {
    clearAuthToken();
    return null;
  }

  memorySession = session;

  return session.token;
}

export function setAuthToken(token: string, expiresAt: string | null = null): void {
  const session: StoredSession = { token, expiresAt };
  memorySession = session;

  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // La sesión en memoria sigue disponible si el navegador bloquea storage.
  }

  notifyAuthChanged();
}

export function clearAuthToken(): void {
  memorySession = null;

  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Sin storage no hay nada que limpiar.
  }

  notifyAuthChanged();
}
