import { PaletteMode } from "@mui/material";

declare module "@mui/material/styles" {
  interface TypeBackground {
    l0: string;
    l1: string;
    l2: string;
  }
  interface SimpleTypeBackgroundOptions {
    l0?: string;
    l1?: string;
    l2?: string;
  }
}

const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === "light"
      ? {
          // Light mode palette
          primary: {
            main: "#2563eb", // Vibrant blue
            light: "#60a5fa",
            dark: "#1d4ed8",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#4f46e5", // Indigo for secondary actions
            light: "#818cf8",
            dark: "#4338ca",
            contrastText: "#ffffff",
          },
          background: {
            l0: "#f8fafc", // Subtle cool gray
            l1: "#ffffff", // Pure white
            l2: "#f1f5f9", // Light cool gray
            paper: "#ffffff",
            default: "#ffffff",
          },
          text: {
            primary: "#0f172a", // Very dark blue-gray
            secondary: "#475569", // Medium blue-gray
          },
          divider: "rgba(0, 0, 0, 0.08)",
          error: {
            main: "#dc2626", // Red
            light: "#ef4444",
            dark: "#b91c1c",
          },
          warning: {
            main: "#d97706", // Amber
            light: "#f59e0b",
            dark: "#b45309",
          },
          success: {
            main: "#059669", // Emerald
            light: "#10b981",
            dark: "#047857",
          },
          info: {
            main: "#0284c7", // Light blue
            light: "#0ea5e9",
            dark: "#0369a1",
          },
        }
      : {
          // Dark mode palette
          primary: {
            main: "#60a5fa", // Lighter blue for dark mode
            light: "#93c5fd",
            dark: "#3b82f6",
            contrastText: "#000000",
          },
          secondary: {
            main: "#818cf8", // Lighter indigo for dark mode
            light: "#a5b4fc",
            dark: "#6366f1",
            contrastText: "#000000",
          },
          background: {
            l0: "#0f172a", // Dark blue-gray
            l1: "#1e293b", // Slightly lighter blue-gray
            l2: "#334155", // Medium blue-gray
            paper: "#1e293b",
            default: "#0f172a",
          },
          text: {
            primary: "#f1f5f9", // Very light blue-gray
            secondary: "#cbd5e1", // Light blue-gray
          },
          divider: "rgba(255, 255, 255, 0.08)",
          error: {
            main: "#ef4444", // Brighter red for dark mode
            light: "#f87171",
            dark: "#dc2626",
          },
          warning: {
            main: "#f59e0b", // Brighter amber for dark mode
            light: "#fbbf24",
            dark: "#d97706",
          },
          success: {
            main: "#10b981", // Brighter emerald for dark mode
            light: "#34d399",
            dark: "#059669",
          },
          info: {
            main: "#0ea5e9", // Brighter light blue for dark mode
            light: "#38bdf8",
            dark: "#0284c7",
          },
        }),
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
});

type DesignTokens = ReturnType<typeof getDesignTokens>;
type DesignTheme = Omit<DesignTokens, "palette"> & {
  palette: DesignTokens["palette"] & {
    mode: PaletteMode;
  };
};

export default getDesignTokens;
export type { DesignTokens, DesignTheme };
