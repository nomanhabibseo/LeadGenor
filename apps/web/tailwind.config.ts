import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          violet: "#7c3aed",
          cyan: "#06b6d4",
          amber: "#f59e0b",
        },
        surface: {
          850: "#0f172a",
          900: "#020617",
          950: "#010409",
        },
      },
      boxShadow: {
        brand: "0 4px 24px -4px rgba(37, 99, 235, 0.25), 0 8px 32px -8px rgba(124, 58, 237, 0.2)",
        card: "0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.06)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0c4a6e 100%)",
        "hero-mesh":
          "radial-gradient(ellipse 80% 60% at 50% -30%, rgba(59, 130, 246, 0.35), transparent), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(124, 58, 237, 0.2), transparent), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(6, 182, 212, 0.15), transparent)",
      },
    },
  },
  plugins: [],
} satisfies Config;
