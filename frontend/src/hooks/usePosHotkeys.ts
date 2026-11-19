import { useHotkeys, type HotkeyHandlers } from "@/hooks/use-hotkeys";

/**
 * Atajos propios del punto de venta. Se registran en la página POS y
 * reemplazan a los atajos globales del AppShell mientras la terminal está
 * montada, para que F4 cobre en lugar de navegar.
 */
export function usePosHotkeys(handlers: HotkeyHandlers, enabled = true): void {
  useHotkeys(handlers, { enabled });
}
