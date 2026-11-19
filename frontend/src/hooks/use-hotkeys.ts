import * as React from "react";

export type Hotkey = "F2" | "F4" | "F8" | "ESCAPE" | "COMMAND_PALETTE";

export type HotkeyHandlers = Partial<Record<Hotkey, (event: KeyboardEvent) => void>>;

interface HotkeyOptions {
  enabled?: boolean;
}

/**
 * Atajos globales de operación POS. No intercepta la escritura normal:
 * solo teclas de función, Escape y el modificador de la paleta.
 */
export function useHotkeys(handlers: HotkeyHandlers, options: HotkeyOptions = {}): void {
  const handlersRef = React.useRef(handlers);
  const enabled = options.enabled ?? true;

  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const current = handlersRef.current;
      const paletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (paletteShortcut) {
        event.preventDefault();
        current.COMMAND_PALETTE?.(event);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case "F2":
          event.preventDefault();
          current.F2?.(event);
          break;
        case "F4":
          event.preventDefault();
          current.F4?.(event);
          break;
        case "F8":
          event.preventDefault();
          current.F8?.(event);
          break;
        case "Escape":
          current.ESCAPE?.(event);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
