import type { Config } from "tailwindcss";

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
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#10B981",
          hover: "#059669",
          light: "#D1FAE5",
          dark: "#065F46",
        },
        chess: {
          dark: "#769656",
          light: "#eeeed2",
          boardBorder: "#405335",
          win: "#22C55E",
          draw: "#94A3B8",
          loss: "#EF4444",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
