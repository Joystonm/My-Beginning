import type { Config } from "tailwindcss";

/**
 * Light-first editorial design system.
 *
 * The palette is intentionally restrained:
 * - warm off-white surfaces
 * - near-black text
 * - muted neutral hierarchy
 * - one calm accent (deep teal) for action and selection only
 *
 * No gradients are used as a primary language.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#FAF8F4",
          sunken: "#F2EFE9",
          inverted: "#0E0E0E",
        },
        ink: {
          primary: "#0E0E0E",
          secondary: "#5C5C5C",
          tertiary: "#8A8A85",
          muted: "#B4B4AE",
          inverse: "#FAF8F4",
        },
        line: {
          DEFAULT: "#E5E2DA",
          strong: "#CFCCC3",
          subtle: "#EEEAE0",
        },
        accent: {
          DEFAULT: "#0F6B6B",
          hover: "#0B5454",
          soft: "#E3EFEF",
          ink: "#FAF8F4",
        },
        signal: {
          positive: "#2F7D52",
          negative: "#B8412F",
          neutral: "#6B6B66",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // Editorial scale: deliberate, not exaggerated
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0.01em" }],
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        md: ["1rem", { lineHeight: "1.55rem" }],
        lg: ["1.125rem", { lineHeight: "1.65rem" }],
        xl: ["1.375rem", { lineHeight: "1.85rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.1rem", letterSpacing: "-0.01em" }],
        "3xl": ["2.25rem", { lineHeight: "2.55rem", letterSpacing: "-0.02em" }],
        "4xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.025em" }],
        "5xl": ["4rem", { lineHeight: "4.1rem", letterSpacing: "-0.03em" }],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "10px",
        xl: "14px",
        full: "9999px",
      },
      spacing: {
        // 4px base grid (Tailwind default), but we expose named editorial gaps
        gutter: "1.5rem",
        section: "4rem",
      },
      boxShadow: {
        // Subtle only. Never glow.
        sm: "0 1px 0 rgba(15, 15, 15, 0.04)",
        DEFAULT: "0 1px 2px rgba(15, 15, 15, 0.06), 0 0 0 1px rgba(15, 15, 15, 0.04)",
        panel: "0 1px 2px rgba(15, 15, 15, 0.05)",
      },
      transitionTimingFunction: {
        // Restrained motion
        editorial: "cubic-bezier(0.2, 0.6, 0.2, 1)",
      },
      transitionDuration: {
        DEFAULT: "180ms",
        slow: "260ms",
      },
    },
  },
  plugins: [],
};

export default config;