import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Theme } from "@/lib/theme";

interface UiState {
  theme: Theme;
  commandOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "system",
      commandOpen: false,
      setTheme: (theme) => {
        set({ theme });
      },
      toggleTheme: () => {
        const current = get().theme;
        set({ theme: current === "dark" ? "light" : "dark" });
      },
      setCommandOpen: (commandOpen) => {
        set({ commandOpen });
      },
      toggleCommand: () => {
        set((state) => ({ commandOpen: !state.commandOpen }));
      },
    }),
    {
      name: "vpp.ui",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
