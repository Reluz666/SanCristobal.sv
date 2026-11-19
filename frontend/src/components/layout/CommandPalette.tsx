import { LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { NAV_GROUPS } from "@/components/layout/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { resolveTheme } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/ui-store";

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const logout = useAuthStore((state) => state.logout);
  const resolvedTheme = resolveTheme(theme);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permission === undefined || hasPermission(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const goTo = (to: string): void => {
    setOpen(false);
    navigate(to);
  };

  const handleLogout = async (): Promise<void> => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Busca un módulo o ejecuta una acción del sistema."
      className="sm:max-w-xl"
    >
      <CommandInput placeholder="Buscar módulo o acción..." />
      <CommandList>
        <CommandEmpty>Sin resultados para la búsqueda.</CommandEmpty>

        {visibleGroups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.hint ?? ""}`}
                onSelect={() => {
                  goTo(item.to);
                }}
              >
                <item.icon strokeWidth={1.5} />
                <span>{item.label}</span>
                <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
                  {item.hint}
                </span>
                {item.shortcut ? (
                  <CommandShortcut className="font-mono text-[10px]">
                    {item.shortcut}
                  </CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Sistema">
          <CommandItem
            value="cambiar tema apariencia"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {resolvedTheme === "dark" ? (
              <Sun strokeWidth={1.5} />
            ) : (
              <Moon strokeWidth={1.5} />
            )}
            <span>
              Cambiar a tema {resolvedTheme === "dark" ? "claro" : "oscuro"}
            </span>
          </CommandItem>
          <CommandItem
            value="cerrar sesión logout"
            onSelect={() => {
              void handleLogout();
            }}
          >
            <LogOut strokeWidth={1.5} />
            <span>Cerrar sesión</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
