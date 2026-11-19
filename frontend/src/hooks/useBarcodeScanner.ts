import * as React from "react";

interface BarcodeScannerOptions {
  enabled?: boolean;
}

/**
 * Mantiene el foco en el campo de captura del lector de barras.
 * El lector actúa como teclado: escribe el código y envía Enter.
 */
export function useBarcodeScanner(options: BarcodeScannerOptions = {}): {
  inputRef: React.RefObject<HTMLInputElement>;
  focusInput: () => void;
} {
  const enabled = options.enabled ?? true;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const focusInput = React.useCallback((): void => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(focusInput, 60);

    return () => window.clearTimeout(timer);
  }, [enabled, focusInput]);

  return { inputRef, focusInput };
}
