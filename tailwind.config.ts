import type { Config } from "tailwindcss";

function withOpacity(variableName: string): any {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variableName})`;
  };
}

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: withOpacity("--background"),
        foreground: withOpacity("--foreground"),
        primary: {
          DEFAULT: "#10B981",
          hover: "#059669",
          light: "#D1FAE5",
          dark: "#065F46",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: withOpacity("--card"),
          foreground: withOpacity("--card-foreground"),
        },
        popover: {
          DEFAULT: withOpacity("--popover"),
          foreground: withOpacity("--popover-foreground"),
        },
        secondary: {
          DEFAULT: withOpacity("--secondary"),
          foreground: withOpacity("--secondary-foreground"),
        },
        muted: {
          DEFAULT: withOpacity("--muted"),
          foreground: withOpacity("--muted-foreground"),
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          foreground: withOpacity("--accent-foreground"),
        },
        destructive: {
          DEFAULT: withOpacity("--destructive"),
          foreground: withOpacity("--destructive-foreground"),
        },
        border: withOpacity("--border"),
        input: withOpacity("--input"),
        ring: withOpacity("--ring"),
        chess: {
          dark: "#769656",
          light: "#eeeed2",
          boardBorder: "#405335",
          win: "#22C55E",
          draw: "#94A3B8",
          loss: "#EF4444",
        }
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
        full: "9999px",
        control: "6px",
        tag: "6px",
        surface: "14px",
        table: "12px",
      },
      boxShadow: {
        none: "none",
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.06)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.06)",
        md: "0 2px 6px -1px rgba(0, 0, 0, 0.08)",
        lg: "0 4px 10px -2px rgba(0, 0, 0, 0.1)",
        xl: "0 6px 14px -3px rgba(0, 0, 0, 0.12)",
        "2xl": "0 8px 18px -4px rgba(0, 0, 0, 0.15)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
