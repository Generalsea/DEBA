/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        deba: {
          navy: "#0F172A",
          royal: "#2563EB",
          "royal-dark": "#1D4ED8",
          orange: "#F97316",
          "orange-dark": "#EA580C",
          emerald: "#10B981",
          "emerald-dark": "#059669",
          canvas: "#FAFAFA",
          surface: "#FFFFFF",
          ink: "#111827",
          muted: "#64748B",
          border: "#E5E7EB",
        },
      },
      boxShadow: {
        "deba-card": "0 12px 30px rgba(15, 23, 42, 0.08)",
        "deba-hover": "0 22px 52px rgba(37, 99, 235, 0.14)",
        "deba-orange": "0 12px 28px rgba(249, 115, 22, 0.22)",
        "deba-emerald": "0 12px 28px rgba(16, 185, 129, 0.20)",
      },
      backgroundImage: {
        "deba-hero":
          "radial-gradient(circle at 10% 10%, rgba(37,99,235,.20), transparent 30%), radial-gradient(circle at 90% 15%, rgba(249,115,22,.16), transparent 26%), linear-gradient(135deg, #0F172A 0%, #172554 52%, #0F766E 100%)",
        "deba-donation":
          "linear-gradient(120deg, rgba(16,185,129,.98) 0%, rgba(5,150,105,.96) 58%, rgba(37,99,235,.92) 100%)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
