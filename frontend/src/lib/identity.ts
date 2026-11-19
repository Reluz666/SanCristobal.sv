const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  cashier: "Vendedor",
  warehouse: "Almacén",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function primaryRoleLabel(roles: string[]): string {
  const [first] = roles;

  return first ? roleLabel(first) : "Sin rol asignado";
}

export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "US";
  }

  if (parts.length === 1) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }

  return `${(parts[0] ?? "").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}
